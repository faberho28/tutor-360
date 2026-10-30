import type { BoundingBox } from "../types";
import { pickCorners } from "./corners";
import { normalizeHomography, type Homography } from "./homography";
import { growMask, labelComponents } from "./roi";
import { ransacSimilarity } from "./similarity";
import type { OpenCv } from "./opencv-loader";

type Mat = InstanceType<OpenCv["Mat"]>;

/** A grayscale frame, row by row, one byte per pixel. */
export type GrayFrame = {
  data: Uint8Array | Uint8ClampedArray;
  width: number;
  height: number;
};

export type LostReason = "few-points" | "no-homography" | "degenerate";

export type TrackReading =
  | {
      status: "tracking";
      /** The main motion, reference frame -> current, normalized coordinates. */
      homography: Homography;
      /**
       * Every rigid motion found, the one most points share first (`homography`
       * is `models[0]`): the keyboard that was turned, the cable that did not
       * move. See `assign` to know which mask follows which.
       */
      models: Homography[];
      /** Points that agree with the main motion. */
      inliers: number;
      /** Points in each motion of `models`, in the same order. */
      sizes: number[];
      /** Points the tracker still follows. */
      alive: number;
    }
  | { status: "lost"; reason: LostReason };

/** What the tracker needs to know about a mask to give it a motion. */
export type TrackedMask = {
  /** Normalized, in the tracker's reference frame. */
  bbox: BoundingBox;
  /** What it is (the wording that found it): masks of a kind move together. */
  concept: string;
};

/**
 * First guesses to tune on the real camera, like the change detector's
 * THRESHOLDS. A board is mostly flat and full of corners (solder joints, chip
 * edges, printed text), which is what makes this work.
 */
export const TRACKING = {
  /** Corners looked for in the reference frame. */
  maxPoints: 1000,
  /** Fraction of the strongest corner a candidate must reach. */
  quality: 0.001,
  /** Minimum distance between corners, in pixels of the tracked frame. */
  minDistance: 2,
  /** A whole frame with fewer corners is too bare to follow (a blank wall). */
  minReferencePoints: 25,
  /** An object's region needs fewer: it is small, and what matters is that they are its own. */
  minRegionPoints: 12,
  /** The looser search a region gets when the usual one finds too few corners. */
  looseQuality: 0.002,
  looseMinDistance: 4,
  /** Fewer points that agree with the homography and the track is lost. */
  minInliers: 12,
  /** A point further than this from the fitted motion is an outlier (pixels). */
  ransacPx: 3,
  /** Random pairs of points tried to propose the motion. */
  ransacIterations: 100,
  /** Points an object other than the main one needs for its own motion. */
  minOtherInliers: 8,
  /**
   * Optical-flow window and pyramid levels (the levels let it follow big moves).
   * 15 px, not the usual 21: a turn deforms the patch that is compared, and the
   * bigger the window the more it underestimates the turn. On a slow 180 degree
   * turn 21 px ended 5.5 degrees short and 15 px ended exact.
   */
  window: 15,
  levels: 3,
  /** Optical-flow residual (mean gray levels) above which a point is dropped. */
  maxFlowError: 30,
  /**
   * A point tracked back to the previous frame must land this close (pixels) to
   * where it started: one that does not was dragged by something else (a hand).
   */
  forwardBackward: 1.5,
  /**
   * An object with fewer than this share of its starting corners alive gets new
   * ones inside where its motion says it is now (the lab's biggest win: points
   * are lost to hands and blur, and without new ones the track starves).
   */
  replenishBelow: 0.6,
  /** Pixels an object's region is pulled in when looking for new corners. */
  replenishMargin: 8,
  /** The homography may not squash or blow up the image beyond this scale. */
  minScale: 0.4,
  maxScale: 2.5,
  /**
   * The reference is split in this grid to find regions that changed. Fine
   * enough that a small new part fills a cell instead of being diluted in a
   * big one (16 x 9 cells of 20 px on the 320 px frame).
   */
  cellCols: 16,
  cellRows: 9,
  /** A cell changed when its mean gray difference (0..255) exceeds this. */
  cellDiff: 25,
  /** A cell is only judged when this share of it is visible after the warp. */
  cellVisible: 0.6,
} as const;

/**
 * The frame as an OpenCV matrix with its average brightness fixed at mid-gray:
 * the camera adjusts its exposure on its own, and a uniform change of light
 * must not look like the scene moved (the optical flow drops any point whose
 * surroundings stop matching).
 */
function grayMat(cv: OpenCv, frame: GrayFrame): Mat {
  const mat = new cv.Mat(frame.height, frame.width, cv.CV_8UC1);
  const data = mat.data;
  data.set(frame.data);
  let sum = 0;
  for (let i = 0; i < data.length; i++) sum += data[i]!;
  const shift = 128 - sum / data.length;
  if (Math.abs(shift) >= 1) {
    for (let i = 0; i < data.length; i++) {
      data[i] = Math.max(0, Math.min(255, data[i]! + shift));
    }
  }
  return mat;
}

/**
 * Follows a flat scene between a fixed reference frame and the live video.
 *
 * It finds corners in the reference once and follows each one frame to frame
 * with pyramidal Lucas-Kanade; every update fits ONE homography from where each
 * corner was in the reference to where it is now (RANSAC throws out the points
 * that moved on their own: a hand, a part that was removed). Because the fit
 * always starts from the reference, errors do not pile up as they would by
 * chaining frame-to-frame transforms. Corners that are lost never come back,
 * so the track ends when too few remain and the caller asks the models again.
 */
export class MaskTracker {
  private readonly cv: OpenCv;
  private readonly width: number;
  private readonly height: number;
  private previous: Mat;
  /** The reference, blurred: compared against the current frame to see changes. */
  private readonly blurred: Mat;
  /** The latest pixel homography (reference -> current), for `changedCells`. */
  private lastPixelH: number[] | null = null;
  /** Reference position of each corner, [x0, y0, x1, y1...] in pixels. */
  private reference: Float32Array;
  /** Current position of each corner. */
  private current: Float32Array;
  private alive: Uint8Array;
  /**
   * Which object (separate piece of the region) each corner belongs to. The
   * objects are told apart by where they are, once, when the tracker starts.
   */
  private component: Uint16Array;
  private readonly componentCount: number;
  /** Corners each object started with: the top-up aims for this many. */
  private readonly target: number[];
  /** Each object's pixels pulled in from its edge: where new corners may go. */
  private core: Uint8Array | null = null;
  /** The biggest object: if its motion is lost, the scene is lost. */
  private readonly mainComponent: number;
  /** The main object's pixels (null: the whole frame), what changes are judged on. */
  private readonly mainRegion: Uint8Array | null;
  /** Position of each object's motion in the last reading's list (-1: none). */
  private compact: number[] = [];
  /** The pixel matrices of those motions (reference -> current), same order. */
  private motionPx: number[][] = [];
  /** Which object each pixel of the region belongs to (1..N; null: no region). */
  private readonly labels: Uint16Array | null;
  /** The pixels of each group of objects that share a motion, and what they were built for. */
  private regionCache: Map<number, Uint8Array> | null = null;
  private regionKey = "";
  /** Everything outside the objects: the table, where a new part would show. */
  private background: Uint8Array | null = null;
  /** The object's pixels in the reference (null: the whole frame). */
  private readonly roi: Uint8Array | null;
  private disposed = false;

  private constructor(
    cv: OpenCv,
    width: number,
    height: number,
    gray: Mat,
    blurred: Mat,
    corners: Float32Array,
    roi: Uint8Array | null,
    pieces: { labels: Uint16Array; sizes: number[] } | null,
  ) {
    this.cv = cv;
    this.width = width;
    this.height = height;
    this.previous = gray;
    this.blurred = blurred;
    this.roi = roi;
    this.reference = corners;
    this.current = Float32Array.from(corners);
    this.alive = new Uint8Array(corners.length / 2).fill(1);

    const points = corners.length / 2;
    this.component = new Uint16Array(points);
    this.labels = pieces && pieces.sizes.length > 0 ? pieces.labels : null;
    if (pieces && pieces.sizes.length > 0) {
      this.componentCount = pieces.sizes.length;
      for (let i = 0; i < points; i++) {
        const label =
          pieces.labels[
            Math.round(corners[2 * i + 1]!) * width +
              Math.round(corners[2 * i]!)
          ]!;
        this.component[i] = Math.max(0, label - 1);
      }
      // The main object is the one with the most corners, not the biggest: the
      // biggest is often a smooth mat or table with almost nothing to hold on
      // to, and judging the whole scene by it would lose a scene whose other
      // objects are followed perfectly.
      const corners_of = new Array<number>(this.componentCount).fill(0);
      for (let i = 0; i < points; i++) corners_of[this.component[i]!]!++;
      this.mainComponent = corners_of.indexOf(Math.max(...corners_of));
      this.mainRegion = new Uint8Array(width * height);
      for (let p = 0; p < this.mainRegion.length; p++) {
        if (pieces.labels[p] === this.mainComponent + 1) this.mainRegion[p] = 1;
      }
    } else {
      // No region: the whole frame is one object.
      this.componentCount = 1;
      this.mainComponent = 0;
      this.mainRegion = null;
    }
    this.target = new Array<number>(this.componentCount).fill(0);
    for (let i = 0; i < points; i++) this.target[this.component[i]!]!++;
  }

  /**
   * Starts following `reference`; null when it has too few corners to follow.
   * `roi` is the object (1 = part of it): only its corners are followed and only
   * it is compared for changes, because with the camera fixed the table and the
   * hands do not move with the object and would out-vote it.
   *
   * With a region there is NO fallback to the whole frame. A small, dark, smooth
   * object (a charger) has few corners while the grain of the table around it
   * has many and does not move with it: looking at the whole frame would follow
   * the table and leave the masks behind. The region is searched with looser
   * criteria first; if it still has too few corners there is nothing to hold on
   * to, and the caller asks the models again instead of following the table.
   */
  static create(
    cv: OpenCv,
    reference: GrayFrame,
    roi: Uint8Array | null = null,
  ): MaskTracker | null {
    const gray = grayMat(cv, reference);
    const strength = new cv.Mat();
    const blurred = new cv.Mat();
    try {
      cv.cornerMinEigenVal(gray, strength, 3, 3);
      const pick = (quality: number, minDistance: number) =>
        pickCorners(strength.data32F, reference.width, reference.height, {
          max: TRACKING.maxPoints,
          quality,
          minDistance,
          margin: Math.ceil(TRACKING.window / 2),
          roi,
        });
      const need = roi ? TRACKING.minRegionPoints : TRACKING.minReferencePoints;
      let corners = pick(TRACKING.quality, TRACKING.minDistance);
      if (corners.length / 2 < need && roi) {
        // Fainter corners, closer together: all a smooth object has to offer.
        corners = pick(TRACKING.looseQuality, TRACKING.looseMinDistance);
      }
      if (corners.length / 2 < need) {
        gray.delete();
        blurred.delete();
        return null;
      }
      cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0);
      const pieces = roi
        ? labelComponents(roi, reference.width, reference.height)
        : null;
      return new MaskTracker(
        cv,
        reference.width,
        reference.height,
        gray,
        blurred,
        corners,
        roi,
        pieces,
      );
    } catch (error) {
      gray.delete();
      blurred.delete();
      throw error;
    } finally {
      strength.delete();
    }
  }

  /** Where the scene is now, relative to the reference. */
  update(frame: GrayFrame): TrackReading {
    if (this.disposed) return { status: "lost", reason: "few-points" };
    if (frame.width !== this.width || frame.height !== this.height) {
      throw new Error("The frame is not the size of the reference");
    }
    const cv = this.cv;
    const followed = this.indexes();
    if (followed.length < TRACKING.minInliers) {
      return { status: "lost", reason: "few-points" };
    }

    const now = grayMat(cv, frame);
    const prevPts = cv.matFromArray(
      followed.length,
      1,
      cv.CV_32FC2,
      followed.flatMap((i) => [this.current[2 * i]!, this.current[2 * i + 1]!]),
    );
    const nextPts = new cv.Mat();
    const status = new cv.Mat();
    const err = new cv.Mat();
    const criteria = new cv.TermCriteria(
      cv.TermCriteria_EPS | cv.TermCriteria_COUNT,
      30,
      0.01,
    );
    const window = new cv.Size(TRACKING.window, TRACKING.window);
    const owned: Mat[] = [prevPts, nextPts, status, err];
    let keepNow = false;
    try {
      cv.calcOpticalFlowPyrLK(
        this.previous,
        now,
        prevPts,
        nextPts,
        status,
        err,
        window,
        TRACKING.levels,
        criteria,
      );
      // Track back to where each point came from: one that does not return
      // was dragged along by something else.
      const back = new cv.Mat();
      const backStatus = new cv.Mat();
      const backErr = new cv.Mat();
      owned.push(back, backStatus, backErr);
      cv.calcOpticalFlowPyrLK(
        now,
        this.previous,
        nextPts,
        back,
        backStatus,
        backErr,
        window,
        TRACKING.levels,
        criteria,
      );
      const returned = back.data32F;
      const next = nextPts.data32F;
      const ok = status.data;
      const residual = err.data32F;
      const kept: number[] = [];
      followed.forEach((i, k) => {
        const x = next[2 * k]!;
        const y = next[2 * k + 1]!;
        const inside = x >= 0 && y >= 0 && x < this.width && y < this.height;
        const returns =
          backStatus.data[k] === 1 &&
          Math.hypot(
            returned[2 * k]! - this.current[2 * i]!,
            returned[2 * k + 1]! - this.current[2 * i + 1]!,
          ) < TRACKING.forwardBackward;
        if (
          ok[k] === 1 &&
          residual[k]! < TRACKING.maxFlowError &&
          inside &&
          returns
        ) {
          this.current[2 * i] = x;
          this.current[2 * i + 1] = y;
          kept.push(i);
        } else {
          this.alive[i] = 0;
        }
      });
      if (kept.length < TRACKING.minInliers) {
        return { status: "lost", reason: "few-points" };
      }

      // The camera looks straight down, so an object can only move inside its
      // plane: shift, turn and zoom. A similarity (4 numbers) says exactly that
      // and, unlike a full homography, cannot make up a tilt or a skew out of
      // noise, which is what made the masks look like they moved in 3D.
      //
      // The scene holds several objects (the keyboard that is turned around,
      // the cable beside it that stays) and each gets its own fit from its own
      // corners, so a cable never mixes with the board it lies next to. Telling
      // them apart by where they are, and not by how they move, matters at the
      // centre of a turn: there a body barely moves and would pass for a still
      // one, merging with the cable into a compromise that turns too little.
      const found: ({
        fit: { a: number; b: number; tx: number; ty: number };
        count: number;
      } | null)[] = new Array(this.componentCount).fill(null);
      const byObject: number[][] = Array.from(
        { length: this.componentCount },
        () => [],
      );
      kept.forEach((i, k) => byObject[this.component[i]!]!.push(k));

      byObject.forEach((members, object) => {
        const need = TRACKING.minOtherInliers;
        if (members.length < need) return;
        const fit = ransacSimilarity(
          Float32Array.from(
            members.flatMap((k) => [
              this.reference[2 * kept[k]!]!,
              this.reference[2 * kept[k]! + 1]!,
            ]),
          ),
          Float32Array.from(
            members.flatMap((k) => [
              this.current[2 * kept[k]!]!,
              this.current[2 * kept[k]! + 1]!,
            ]),
          ),
          {
            threshold: TRACKING.ransacPx,
            iterations: TRACKING.ransacIterations,
          },
        );
        if (!fit || fit.count < need) return;
        const scale = Math.hypot(fit.similarity.a, fit.similarity.b);
        // A motion that squashes or blows up the image is not a real one.
        if (
          !Number.isFinite(scale) ||
          scale < TRACKING.minScale ||
          scale > TRACKING.maxScale
        ) {
          return;
        }
        // Settle the points that agree onto the motion: each one's own noise
        // would otherwise be carried into the next frame, and those errors add
        // up over a long move. One that does not agree moved on its own (a
        // hand, a part pulled out): never trust it again.
        const { a, b, tx, ty } = fit.similarity;
        members.forEach((k, m) => {
          const i = kept[k]!;
          if (fit.inliers[m] !== 1) {
            this.alive[i] = 0;
            return;
          }
          const x = this.reference[2 * i]!;
          const y = this.reference[2 * i + 1]!;
          this.current[2 * i] = a * x - b * y + tx;
          this.current[2 * i + 1] = b * x + a * y + ty;
        });
        found[object] = { fit: fit.similarity, count: fit.count };
      });

      // The objects whose motion was found, the best followed first. The scene
      // is lost only when none is followed well: one smooth object (a mat, a
      // charger) with nothing to hold on to must not take the others with it.
      const order = found
        .flatMap((f, object) => (f ? [object] : []))
        .sort((x, y) => found[y]!.count - found[x]!.count);
      const main = order.length > 0 ? found[order[0]!]! : null;
      if (!main || main.count < TRACKING.minInliers) {
        return {
          status: "lost",
          reason: order.length === 0 ? "few-points" : "no-homography",
        };
      }
      this.compact = new Array<number>(this.componentCount).fill(-1);
      order.forEach((object, index) => (this.compact[object] = index));
      const px = order.map((object) => {
        const { a, b, tx, ty } = found[object]!.fit;
        return [a, -b, tx, b, a, ty, 0, 0, 1];
      });

      this.replenish(now, found);

      // The next update follows from this frame.
      this.previous.delete();
      this.previous = now;
      this.lastPixelH = px[0]!;
      this.motionPx = px;
      keepNow = true;
      const models = px.map((m) =>
        normalizeHomography(m, this.width, this.height),
      );
      return {
        status: "tracking",
        homography: models[0]!,
        models,
        inliers: main.count,
        sizes: order.map((object) => found[object]!.count),
        alive: this.alive.reduce((n, v) => n + v, 0),
      };
    } finally {
      if (!keepNow) now.delete();
      // Only matrices live in WebAssembly memory; the size and the criteria
      // are plain objects.
      for (const mat of owned) mat.delete();
    }
  }

  /**
   * New corners for the objects that ran short, found in the current frame
   * inside where each one's motion says it is. Dead points are dropped on the way
   * so the arrays do not grow without end. The new corners keep their position
   * in the REFERENCE (the motion undone), so the fit stays one fit.
   */
  private replenish(
    now: Mat,
    found: ({
      fit: { a: number; b: number; tx: number; ty: number };
      count: number;
    } | null)[],
  ) {
    const alive = new Array<number>(this.componentCount).fill(0);
    for (let i = 0; i < this.alive.length; i++) {
      if (this.alive[i] === 1) alive[this.component[i]!]!++;
    }
    const needy: number[] = [];
    found.forEach((f, object) => {
      if (
        f &&
        f.count >= TRACKING.minInliers &&
        alive[object]! < this.target[object]! * TRACKING.replenishBelow
      ) {
        needy.push(object);
      }
    });
    if (needy.length === 0) return;

    const { width, height, cv } = this;
    if (this.roi && !this.core) {
      const outside = new Uint8Array(this.roi.length);
      for (let i = 0; i < outside.length; i++) {
        outside[i] = this.roi[i] === 1 ? 0 : 1;
      }
      const grown = growMask(outside, width, height, TRACKING.replenishMargin);
      this.core = new Uint8Array(outside.length);
      for (let i = 0; i < grown.length; i++) {
        this.core[i] = grown[i] === 1 ? 0 : 1;
      }
    }

    const strength = new cv.Mat();
    const addedRef: number[] = [];
    const addedNow: number[] = [];
    const addedObject: number[] = [];
    try {
      cv.cornerMinEigenVal(now, strength, 3, 3);
      for (const object of needy) {
        const { a, b, tx, ty } = found[object]!.fit;
        const scale = a * a + b * b;
        if (scale <= 1e-6) continue;
        // Where the object is in the current frame: its core, carried by its motion.
        const region = new Uint8Array(width * height);
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const dx = x - tx;
            const dy = y - ty;
            const rx = Math.round((a * dx + b * dy) / scale);
            const ry = Math.round((-b * dx + a * dy) / scale);
            if (rx < 0 || ry < 0 || rx >= width || ry >= height) continue;
            const at = ry * width + rx;
            if (this.labels) {
              if (this.core![at] !== 1 || this.labels[at] !== object + 1) {
                continue;
              }
            }
            region[y * width + x] = 1;
          }
        }
        const want = this.target[object]! - alive[object]!;
        const corners = pickCorners(strength.data32F, width, height, {
          max: want,
          quality: TRACKING.quality,
          minDistance: TRACKING.minDistance,
          margin: Math.ceil(TRACKING.window / 2),
          roi: region,
        });
        for (let i = 0; i < corners.length / 2; i++) {
          const x = corners[2 * i]!;
          const y = corners[2 * i + 1]!;
          const dx = x - tx;
          const dy = y - ty;
          addedNow.push(x, y);
          addedRef.push((a * dx + b * dy) / scale, (-b * dx + a * dy) / scale);
          addedObject.push(object);
        }
      }
    } finally {
      strength.delete();
    }

    // Rebuild the arrays: the points still alive, then the new ones.
    const keep: number[] = [];
    for (let i = 0; i < this.alive.length; i++) {
      if (this.alive[i] === 1) keep.push(i);
    }
    const total = keep.length + addedObject.length;
    const reference = new Float32Array(total * 2);
    const current = new Float32Array(total * 2);
    const component = new Uint16Array(total);
    keep.forEach((i, n) => {
      reference[2 * n] = this.reference[2 * i]!;
      reference[2 * n + 1] = this.reference[2 * i + 1]!;
      current[2 * n] = this.current[2 * i]!;
      current[2 * n + 1] = this.current[2 * i + 1]!;
      component[n] = this.component[i]!;
    });
    addedObject.forEach((object, m) => {
      const n = keep.length + m;
      reference[2 * n] = addedRef[2 * m]!;
      reference[2 * n + 1] = addedRef[2 * m + 1]!;
      current[2 * n] = addedNow[2 * m]!;
      current[2 * n + 1] = addedNow[2 * m + 1]!;
      component[n] = object;
    });
    this.reference = reference;
    this.current = current;
    this.component = component;
    this.alive = new Uint8Array(total).fill(1);
  }

  /**
   * Development only: where each corner that is still followed is, in
   * normalized coordinates, and the motion it belongs to (-1: that object has
   * none). Feeds the debug view of the overlay.
   */
  debugPoints(): { x: number; y: number; object: number }[] {
    const out: { x: number; y: number; object: number }[] = [];
    for (let i = 0; i < this.alive.length; i++) {
      if (this.alive[i] !== 1) continue;
      out.push({
        x: this.current[2 * i]! / this.width,
        y: this.current[2 * i + 1]! / this.height,
        object: this.compact[this.component[i]!] ?? -1,
      });
    }
    return out;
  }

  /**
   * Which of the motions of the last update each mask follows (an index into
   * `models`). A mask takes the motion most of the corners inside it follow. One
   * with no corners of its own (a flat panel) copies the masks of its kind, and
   * failing that the nearest mask that has some: a space bar moves with the keys.
   */
  assign(masks: readonly TrackedMask[]): number[] {
    const kinds = Math.max(1, this.compact.filter((m) => m >= 0).length);
    const votes = masks.map(() => new Array<number>(kinds).fill(0));
    const gx = 4 / this.width;
    const gy = 4 / this.height;
    for (let i = 0; i < this.alive.length; i++) {
      const m = this.compact[this.component[i]!] ?? -1;
      if (this.alive[i] !== 1 || m < 0) continue;
      const x = this.reference[2 * i]! / this.width;
      const y = this.reference[2 * i + 1]! / this.height;
      masks.forEach(({ bbox }, j) => {
        if (
          x >= bbox.x - gx &&
          x <= bbox.x + bbox.w + gx &&
          y >= bbox.y - gy &&
          y <= bbox.y + bbox.h + gy
        ) {
          votes[j]![m]!++;
        }
      });
    }

    const best = (v: number[]) => {
      let index = 0;
      for (let k = 1; k < v.length; k++) if (v[k]! > v[index]!) index = k;
      return index;
    };
    const decided = masks.map((_, j) =>
      votes[j]!.some((n) => n > 0) ? best(votes[j]!) : -1,
    );

    // Masks of one kind share what their members agree on.
    const byKind = new Map<string, number[]>();
    masks.forEach(({ concept }, j) => {
      if (decided[j]! < 0) return;
      const tally = byKind.get(concept) ?? new Array<number>(kinds).fill(0);
      tally[decided[j]!]!++;
      byKind.set(concept, tally);
    });

    return masks.map((mask, j) => {
      if (decided[j]! >= 0) return decided[j]!;
      const kind = byKind.get(mask.concept);
      if (kind) return best(kind);
      // Nearest mask that has a motion.
      let nearest = -1;
      let distance = Infinity;
      const cx = mask.bbox.x + mask.bbox.w / 2;
      const cy = mask.bbox.y + mask.bbox.h / 2;
      masks.forEach((other, k) => {
        if (decided[k]! < 0) return;
        const d = Math.hypot(
          other.bbox.x + other.bbox.w / 2 - cx,
          other.bbox.y + other.bbox.h / 2 - cy,
        );
        if (d < distance) {
          distance = d;
          nearest = k;
        }
      });
      return nearest >= 0 ? decided[nearest]! : 0;
    });
  }

  /**
   * The regions of the reference (cells of a grid, row by row) whose content is
   * different now, once the motion is undone: a part taken out, a hand that
   * stays in the frame. The current frame is warped back onto the reference,
   * blurred, brought to the same average brightness and compared cell by cell;
   * cells the warp does not fully cover are not judged. Call it after `update`
   * reported `tracking`.
   */
  changedCells(
    frame: GrayFrame,
    /** The object's pixels in the reference; defaults to the main object's. */
    region: Uint8Array | null = this.mainRegion,
    /**
     * The motion to undo: the tracker's main one, none at all ("still": for a
     * tracker that was lost, or an object nobody follows: its last motion is no
     * longer true, but "did anything move since the reference?" is still worth
     * asking), or a given one.
     */
    undo: "main" | "still" | readonly number[] = "main",
  ): { cells: number[]; peak: number } {
    const motion =
      undo === "main"
        ? this.lastPixelH
        : undo === "still"
          ? [1, 0, 0, 0, 1, 0, 0, 0, 1]
          : [...undo];
    if (this.disposed || !motion) return { cells: [], peak: 0 };
    const cv = this.cv;
    const { width, height } = this;
    const now = grayMat(cv, frame);
    const warped = new cv.Mat();
    const smooth = new cv.Mat();
    const white = new cv.Mat(height, width, cv.CV_8UC1, new cv.Scalar(255));
    const visible = new cv.Mat();
    const m = cv.matFromArray(3, 3, cv.CV_64F, motion);
    const size = new cv.Size(width, height);
    try {
      // `lastPixelH` maps reference -> current, so the inverse map brings the
      // current frame back onto the reference.
      cv.warpPerspective(
        now,
        warped,
        m,
        size,
        cv.INTER_LINEAR | cv.WARP_INVERSE_MAP,
        cv.BORDER_CONSTANT,
        new cv.Scalar(0),
      );
      cv.warpPerspective(
        white,
        visible,
        m,
        size,
        cv.INTER_NEAREST | cv.WARP_INVERSE_MAP,
        cv.BORDER_CONSTANT,
        new cv.Scalar(0),
      );
      cv.GaussianBlur(warped, smooth, new cv.Size(5, 5), 0);

      const ref = this.blurred.data;
      const cur = smooth.data;
      const seen = visible.data;

      // Same average brightness: an exposure change is not a changed part.
      let sumRef = 0;
      let sumCur = 0;
      let count = 0;
      for (let i = 0; i < seen.length; i++) {
        if (seen[i] === 255) {
          sumRef += ref[i]!;
          sumCur += cur[i]!;
          count++;
        }
      }
      if (count === 0) return { cells: [], peak: 0 };
      const offset = (sumRef - sumCur) / count;

      const { cellCols, cellRows } = TRACKING;
      const sums = new Float64Array(cellCols * cellRows);
      const counts = new Uint32Array(cellCols * cellRows);
      // Pixels of each cell that belong to the object, seen or not.
      const inside = new Uint32Array(cellCols * cellRows);
      for (let y = 0; y < height; y++) {
        const row = Math.min(cellRows - 1, Math.floor((y * cellRows) / height));
        for (let x = 0; x < width; x++) {
          const i = y * width + x;
          if (region && region[i] !== 1) continue;
          const cell =
            row * cellCols +
            Math.min(cellCols - 1, Math.floor((x * cellCols) / width));
          inside[cell]!++;
          if (seen[i] !== 255) continue;
          sums[cell]! += Math.abs(ref[i]! - (cur[i]! + offset));
          counts[cell]!++;
        }
      }
      const cellArea = (width * height) / (cellCols * cellRows);
      const changed: number[] = [];
      // The strongest difference of any judged cell, to see how far the scene
      // is from the threshold (and what the noise of a still scene looks like).
      let peak = 0;
      for (let c = 0; c < sums.length; c++) {
        // A cell is judged when the object fills at least half of it and the
        // warp shows most of that part.
        if (inside[c]! < cellArea * 0.5) continue;
        if (counts[c]! < inside[c]! * TRACKING.cellVisible) continue;
        const mean = sums[c]! / counts[c]!;
        if (mean > peak) peak = mean;
        if (mean > TRACKING.cellDiff) changed.push(c);
      }
      return { cells: changed, peak };
    } finally {
      for (const mat of [now, warped, smooth, white, visible, m]) mat.delete();
    }
  }

  /**
   * What changed anywhere that matters, each place judged with ITS OWN motion:
   * every object with the motion it follows, an object nobody follows as if it
   * had stayed still (so one that moved is noticed), and, only while the main
   * object has not moved (a fixed camera over a still scene), the table around
   * them, where a new part would show. Judging only the main object would miss
   * the others: a charger that moves while the table, which is the one being
   * followed, stays still.
   */
  changedRegions(frame: GrayFrame): { cells: number[]; peak: number } {
    if (this.disposed || this.motionPx.length === 0) {
      return { cells: [], peak: 0 };
    }
    if (!this.labels || !this.roi) {
      return this.changedCells(frame, null, this.motionPx[0]!);
    }

    const cells = new Set<number>();
    let peak = 0;
    const add = (found: { cells: number[]; peak: number }) => {
      found.cells.forEach((c) => cells.add(c));
      peak = Math.max(peak, found.peak);
    };
    for (const [group, region] of this.regionsByMotion()) {
      add(
        this.changedCells(
          frame,
          region,
          group >= 0 ? this.motionPx[group]! : "still",
        ),
      );
    }

    const main = this.motionPx[0]!;
    const mainStill =
      Math.hypot(main[2]!, main[5]!) <= 2 &&
      Math.abs(main[0]! - 1) <= 0.01 &&
      Math.abs(main[3]!) <= 0.01;
    if (mainStill) add(this.changedCells(frame, this.table(), "still"));
    return { cells: [...cells], peak };
  }

  /** The pixels of the objects, grouped by the motion they follow (-1: none). */
  private regionsByMotion(): Map<number, Uint8Array> {
    const key = this.compact.join(",");
    if (this.regionCache && key === this.regionKey) return this.regionCache;
    const labels = this.labels!;
    const out = new Map<number, Uint8Array>();
    for (let p = 0; p < labels.length; p++) {
      const label = labels[p]!;
      if (label === 0) continue;
      const group = this.compact[label - 1] ?? -1;
      let region = out.get(group);
      if (!region) {
        region = new Uint8Array(labels.length);
        out.set(group, region);
      }
      region[p] = 1;
    }
    this.regionCache = out;
    this.regionKey = key;
    return out;
  }

  /** Outside the objects, with a safety band so that their edges do not count. */
  private table(): Uint8Array {
    if (!this.background) {
      const grown = growMask(this.roi!, this.width, this.height, 4);
      this.background = new Uint8Array(grown.length);
      for (let i = 0; i < grown.length; i++) {
        this.background[i] = grown[i] === 0 ? 1 : 0;
      }
    }
    return this.background;
  }

  /** Frees the WebAssembly memory: OpenCV does not garbage-collect it. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.previous.delete();
    this.blurred.delete();
  }

  private indexes(): number[] {
    const out: number[] = [];
    this.alive.forEach((v, i) => {
      if (v === 1) out.push(i);
    });
    return out;
  }
}
