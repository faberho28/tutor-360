import type { Detection } from "../types";
import { ChangeFilter } from "./change-filter";
import { setTrackingDebug } from "./debug";
import { IDENTITY, moveBox, movePolygon, type Homography } from "./homography";
import {
  MaskTracker,
  TRACKING,
  type GrayFrame,
  type TrackedMask,
} from "./mask-tracker";
import type { OpenCv } from "./opencv-loader";
import { boxesMask, polygonsMask } from "./roi";
import { sampleGray } from "./sample-gray";
import type { View } from "./view";

/**
 * The fastest the video is looked at (about 30 times per second). A tick that
 * takes long pushes the next ones further apart, so a slow device looks less
 * often instead of freezing the page.
 */
const MIN_TICK_MS = 33;
/**
 * A scene that has not moved for `CALM_AFTER` ticks is looked at this often
 * instead (about 10 times per second): following a still scene at full speed
 * only keeps the machine busy. The first movement is noticed within this time
 * and the full rate comes back at once.
 */
const CALM_TICK_MS = 100;
const CALM_AFTER = 15;
/** A busy scene waits twice what a tick took (a third of the thread); a still one, five times (a sixth). */
const BUSY_WAIT_FACTOR = 2;
const CALM_WAIT_FACTOR = 5;
/** Video noise moves a transform by far less than this between two ticks. */
const CALM_EPSILON = 2e-3;
/** Where there is no video-frame callback, the video is polled this often. */
const POLL_MS = 66;
/** The regional comparison is heavier: at most this often. */
const REGION_EVERY_MS = 200;
/**
 * Changed cells (of 144) from which a region really changed. Two, so that one
 * cell hit by a glare or a speck is not enough but a small new part is.
 */
const MIN_CHANGED_CELLS = 2;
/**
 * A single cell this different (of 255) is a new part too: a glare or a speck
 * of dust reaches about 10 in the synthetic tests, a small part reaches 80.
 */
const STRONG_CELL = 60;
/** A transform is only published when it moved by more than this. */
const MOVE_EPSILON = 5e-5;
/** Pixels (of the 320 px frame) the object's region grows by: the board between parts. */
const ROI_MARGIN = 8;
/**
 * A tracker that is lost this soon after it started never had anything to hold
 * on to (a smooth object, a bare table). Two in a row and the scene is given up
 * on for a while: otherwise each analysis would start a tracker that is lost at
 * once, which asks for another analysis, and so on.
 */
const QUICK_LOSS_MS = 5000;
const GIVE_UP_AFTER = 2;
/** How long a scene that cannot be followed is left to the change engine. */
const GIVE_UP_FOR_MS = 20_000;

/**
 * "off": nothing to follow (no frame was analyzed yet, or it was too bare).
 * "tracking": the masks follow the scene. "lost": the scene can no longer be
 * followed, so the masks stay where they were and the models must look again.
 */
export type TrackingStatus = "off" | "tracking" | "lost";

type Follow = {
  tracker: MaskTracker;
  /** The motions of the last look, the main object's first. */
  models: Homography[];
  lost: boolean;
};

/** A follow that serves masks on screen (the candidate only has a reference). */
type ActiveFollow = Follow & {
  ids: string[];
  masks: TrackedMask[];
  /** The motion each mask follows (index into `models`). */
  assign: number[];
};

export type TrackingEvents = {
  /** The motions the masks must be drawn with (null: as they are). */
  onView(view: View | null): void;
  /** The status or the regional change flag changed. */
  onStatus(): void;
};

function sameMatrix(a: Homography, b: Homography) {
  return a.every((v, i) => Math.abs(v - b[i]!) <= MOVE_EPSILON);
}

/**
 * Follows the live video for the masks on screen. Two things are followed at
 * once: the ACTIVE tracker (reference = the frame the masks on screen belong to)
 * and, while an analysis is in flight, the CANDIDATE (reference = the frame that
 * analysis was sent with). When the answer arrives `place` carries its masks to
 * where the scene is NOW, and `commit` starts a fresh tracker on them: the masks
 * are drawn where things are and not where they were seconds earlier.
 *
 * Each object is followed apart (see `MaskTracker`): the keyboard that is turned
 * around moves its masks, the cable beside it that stays keeps its own still.
 */
export class TrackingSession {
  private readonly cv: OpenCv;
  private readonly getVideo: () => HTMLVideoElement | null;
  private readonly events: TrackingEvents;
  private active: ActiveFollow | null = null;
  private candidate: Follow | null = null;
  /** The masks of the analysis in flight, on ITS frame (kept for `commit`). */
  private found: readonly Detection[] = [];
  private regionChanged = false;
  /** What was last published, to publish only what moved. */
  private shownModels: Homography[] | null = null;
  private shownAssign: number[] | null = null;
  private shownRecord: Record<string, number> = {};
  private disposed = false;
  /** The pending wake-up: a video-frame callback or, without it, a timer. */
  private frameHandle: { video: HTMLVideoElement; id: number } | null = null;
  private timer: number | undefined;
  private lastTickAt = 0;
  /** Ticks in a row in which nothing moved (see `CALM_TICK_MS`). */
  private calmTicks = 0;
  /** The motions of the previous tick, to tell a still scene from a moving one. */
  private lastModels: Homography[] | null = null;
  private lastTook = 0;
  private lastRegionAt = 0;
  private committedAt = 0;
  /** Lets a difference through only when it is the same one for a while. */
  private readonly filter = new ChangeFilter();
  /** Trackers lost soon after they started, in a row. */
  private quickLosses = 0;
  private lostCounted = false;
  /** Until when the scene is not followed (see `GIVE_UP_FOR_MS`). */
  private pausedUntil = 0;

  constructor(
    cv: OpenCv,
    getVideo: () => HTMLVideoElement | null,
    events: TrackingEvents,
  ) {
    this.cv = cv;
    this.getVideo = getVideo;
    this.events = events;
    this.loop();
  }

  /**
   * Wakes up with every new video frame, so the transform is computed on the
   * frame that is actually on screen instead of on a clock that drifts from it.
   * The video may not exist yet (or change with the camera), so it is looked up
   * every time.
   */
  private loop() {
    if (this.disposed) return;
    const video = this.getVideo();
    if (video && typeof video.requestVideoFrameCallback === "function") {
      this.frameHandle = {
        video,
        id: video.requestVideoFrameCallback(() => this.wake()),
      };
    } else {
      this.timer = window.setTimeout(() => this.wake(), POLL_MS);
    }
  }

  private wake() {
    this.frameHandle = null;
    this.timer = undefined;
    if (this.disposed) return;
    const now = performance.now();
    // Never take more than about half of the thread.
    const calm = this.calmTicks >= CALM_AFTER;
    const wait = Math.max(
      calm ? CALM_TICK_MS : MIN_TICK_MS,
      this.lastTook * (calm ? CALM_WAIT_FACTOR : BUSY_WAIT_FACTOR),
    );
    if (now - this.lastTickAt >= wait) {
      this.lastTickAt = now;
      this.tick();
    }
    this.loop();
  }

  status(): TrackingStatus {
    if (performance.now() < this.pausedUntil) return "off";
    if (!this.active) return "off";
    return this.active.lost ? "lost" : "tracking";
  }

  /** Whether some regions differ from the analyzed frame, motion aside. */
  changed(): boolean {
    return this.regionChanged;
  }

  /**
   * An analysis is about to be sent: the frame it carries becomes the candidate
   * reference. `onScreen` are the outlines of the masks that are shown now
   * (already where the scene is): they are the object, and only what is inside
   * them is followed. Without any (the first analysis) the whole frame is the
   * best guess. Returns false when the frame has nothing to follow.
   */
  mark(onScreen: readonly (readonly (readonly [number, number])[])[]): boolean {
    this.discard();
    if (performance.now() < this.pausedUntil) return false;
    const video = this.getVideo();
    const frame = video ? sampleGray(video) : null;
    if (!frame) return false;
    const roi = onScreen.length
      ? polygonsMask(onScreen, frame.width, frame.height, ROI_MARGIN)
      : null;
    const tracker = MaskTracker.create(this.cv, frame, roi);
    if (!tracker) return false;
    this.candidate = { tracker, models: [IDENTITY], lost: false };
    return true;
  }

  /**
   * The answer is in, and its masks are on the frame the analysis was sent with:
   * each one is carried to where its object is now, with the motion of the
   * object it belongs to. Returns the same detections (same ids) on the current
   * frame. Without a usable candidate they come back unchanged.
   */
  place(found: readonly Detection[]): Detection[] {
    this.found = found;
    const candidate = this.candidate;
    if (!candidate || candidate.lost) return [...found];
    const motion = candidate.tracker.assign(
      found.map((d) => ({ bbox: d.bbox, concept: d.concept })),
    );
    return found.map((d, i) => {
      const h = candidate.models[motion[i]!] ?? candidate.models[0]!;
      return {
        ...d,
        polygon: movePolygon(d.polygon, h),
        bbox: moveBox(d.bbox, h),
      };
    });
  }

  /**
   * Starts following the placed masks (on the current frame) with a tracker of
   * their own, restricted to them: from now on the scene is compared with a
   * fresh picture and not with one taken seconds ago (during those seconds
   * things may have moved, and that would read as a change). What changed in
   * between (a part placed while the models were working) is still reported once,
   * from the candidate, before it is dropped.
   */
  commit(placed: readonly Detection[]) {
    const candidate = this.candidate;
    this.candidate = null;
    this.drop(this.active);
    this.active = null;
    this.regionChanged = false;
    this.filter.reset();
    this.committedAt = performance.now();
    this.lostCounted = false;

    const video = this.getVideo();
    const frame = video ? sampleGray(video) : null;
    if (candidate && frame) {
      // What differs from the frame that was analyzed. If the candidate was
      // lost the masks come back where the objects WERE (nothing carried them),
      // so the plain comparison says whether they have moved since. It is not
      // declared a change by the filter unless the candidate was lost (see below).
      try {
        const analyzed = boxesMask(
          this.found.map((d) => d.bbox),
          frame.width,
          frame.height,
          ROI_MARGIN,
        );
        const { cells, peak } = candidate.tracker.changedCells(
          frame,
          analyzed,
          candidate.lost ? "still" : "main",
        );
        const differs =
          cells.length >= MIN_CHANGED_CELLS || peak >= STRONG_CELL;
        if (candidate.lost) {
          // Nothing follows from here on, so no later look can confirm it: the
          // scheduler's hold time is the only filter left.
          this.regionChanged = differs;
        } else {
          this.filter.push(cells, differs, performance.now());
        }
      } catch {
        this.filter.reset();
      }
    }
    if (candidate && !candidate.lost && frame) {
      const roi = polygonsMask(
        placed.map((d) => d.polygon),
        frame.width,
        frame.height,
        ROI_MARGIN,
      );
      const tracker = MaskTracker.create(this.cv, frame, roi);
      if (tracker) {
        this.active = {
          tracker,
          models: [IDENTITY],
          lost: false,
          ids: placed.map((d) => d.id),
          masks: placed.map((d) => ({ bbox: d.bbox, concept: d.concept })),
          assign: placed.map(() => 0),
        };
      }
    }
    this.drop(candidate);
    this.found = [];
    this.publish(true);
    this.events.onStatus();
    this.publishDebug();
  }

  /** The analysis failed or was cancelled: its reference is not needed. */
  discard() {
    this.drop(this.candidate);
    this.candidate = null;
  }

  /** Forgets everything followed: the masks are drawn as they are. */
  clear() {
    this.discard();
    this.drop(this.active);
    this.active = null;
    this.regionChanged = false;
    this.filter.reset();
    this.publish(true);
    this.events.onStatus();
    this.publishDebug();
  }

  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    window.clearTimeout(this.timer);
    this.frameHandle?.video.cancelVideoFrameCallback(this.frameHandle.id);
    this.frameHandle = null;
    this.discard();
    this.drop(this.active);
    this.active = null;
  }

  private drop(follow: Follow | null) {
    follow?.tracker.dispose();
  }

  /** Development only: how long one tick takes, to know if the thread holds. */
  private timing = { total: 0, max: 0, count: 0 };
  private regionLog = { at: 0, peak: 0, cells: 0 };

  /**
   * Development only, every two seconds: how many cells changed and how strong
   * the strongest one was. Put a new part on the scene and this shows how close
   * it comes to the threshold; a still scene shows the noise to stay above.
   */
  private logRegions(cells: number, peak: number) {
    if (process.env.NODE_ENV === "production") return;
    const log = this.regionLog;
    log.peak = Math.max(log.peak, peak);
    log.cells = Math.max(log.cells, cells);
    const now = performance.now();
    if (now - log.at < 2000) return;
    console.debug(
      `[tracking] regions: up to ${log.cells} changed cells (need ${MIN_CHANGED_CELLS}, or one above ${STRONG_CELL}), strongest cell ${log.peak.toFixed(0)} (a cell counts above ${TRACKING.cellDiff})`,
    );
    this.regionLog = { at: now, peak: 0, cells: 0 };
  }

  private tick() {
    if (document.hidden) return;
    if (!this.active && !this.candidate) return;
    const startedAt = performance.now();
    this.step();
    const took = performance.now() - startedAt;
    this.lastTook = took;
    if (process.env.NODE_ENV === "production") return;
    const t = this.timing;
    t.total += took;
    t.max = Math.max(t.max, took);
    t.count++;
    if (t.count === 75) {
      console.debug(
        `[tracking] ${this.status()} · tick avg ${(t.total / t.count).toFixed(1)} ms, max ${t.max.toFixed(1)} ms over ${t.count} ticks (looks at most every ${MIN_TICK_MS} ms)`,
      );
      this.timing = { total: 0, max: 0, count: 0 };
    }
  }

  private step() {
    const video = this.getVideo();
    const frame = video ? sampleGray(video) : null;
    if (!frame) return;

    const before = this.status();
    const beforeChanged = this.regionChanged;
    if (this.candidate) this.follow(this.candidate, frame);
    if (this.active) {
      this.follow(this.active, frame);
      if (this.active.lost && !this.lostCounted) {
        this.lostCounted = true;
        this.countLoss();
      } else if (
        !this.active.lost &&
        performance.now() - this.committedAt > QUICK_LOSS_MS
      ) {
        // It held: the scene can be followed.
        this.quickLosses = 0;
      }
      if (this.active && !this.active.lost) {
        this.active.assign = this.active.tracker.assign(this.active.masks);
        this.publish(false);
        const now = performance.now();
        if (now - this.lastRegionAt >= REGION_EVERY_MS) {
          this.lastRegionAt = now;
          this.checkRegions(frame);
        }
      }
    }
    // Nothing is followed any more: there is nothing to hurry for.
    if (this.active?.lost) this.calmTicks = CALM_AFTER;
    if (before !== this.status() || beforeChanged !== this.regionChanged) {
      this.events.onStatus();
    }
    this.publishDebug();
  }

  /** Development only: what the debug view of the overlay draws. */
  private publishDebug() {
    if (process.env.NODE_ENV === "production") return;
    const follow = this.active;
    setTrackingDebug({
      status: this.status(),
      objects: follow?.models.length ?? 0,
      changed: this.regionChanged,
      analyzing: this.candidate !== null,
      tickMs: this.lastTook,
      points: follow && !follow.lost ? follow.tracker.debugPoints() : [],
    });
  }

  /**
   * The active tracker was just lost. If that is soon after it started, twice in
   * a row, this scene has nothing to hold on to: it is left to the change engine
   * for a while (as before the tracking existed) so that the loss does not
   * trigger one analysis after another.
   */
  private countLoss() {
    const now = performance.now();
    this.quickLosses =
      now - this.committedAt < QUICK_LOSS_MS ? this.quickLosses + 1 : 1;
    if (this.quickLosses < GIVE_UP_AFTER) return;
    this.pausedUntil = now + GIVE_UP_FOR_MS;
    this.quickLosses = 0;
    this.drop(this.active);
    this.active = null;
    this.regionChanged = false;
    this.publish(true);
  }

  private follow(follow: Follow, frame: GrayFrame) {
    if (follow.lost) return;
    try {
      const reading = follow.tracker.update(frame);
      if (reading.status === "tracking") follow.models = reading.models;
      else follow.lost = true;
    } catch {
      // The video changed size (another camera): that scene is gone.
      follow.lost = true;
    }
  }

  private checkRegions(frame: GrayFrame) {
    const follow = this.active;
    if (!follow || follow.lost) return;
    try {
      const { cells, peak } = follow.tracker.changedRegions(frame);
      // Something differs from the reference; it only counts as a change once
      // it is the same something for a while (a hand that moves is not).
      this.regionChanged = this.filter.push(
        cells,
        cells.length >= MIN_CHANGED_CELLS || peak >= STRONG_CELL,
        performance.now(),
      );
      this.logRegions(cells.length, peak);
    } catch {
      this.regionChanged = false;
      this.filter.reset();
    }
  }

  /**
   * Publishes the motions and who follows which, but only when something moved:
   * a still scene costs the page nothing. `force` publishes even if equal (a new
   * set of masks) and, with nothing followed, publishes "no view".
   */
  private publish(force: boolean) {
    const follow = this.active;
    if (!follow) {
      if (this.shownModels || force) {
        this.shownModels = null;
        this.shownAssign = null;
        this.shownRecord = {};
        this.events.onView(null);
      }
      return;
    }
    const sameMotions =
      this.shownModels !== null &&
      this.shownModels.length === follow.models.length &&
      follow.models.every((h, i) => sameMatrix(h, this.shownModels![i]!));
    const sameAssign =
      this.shownAssign !== null &&
      this.shownAssign.length === follow.assign.length &&
      follow.assign.every((m, i) => m === this.shownAssign![i]);
    const still =
      this.lastModels !== null &&
      this.lastModels.length === follow.models.length &&
      follow.models.every((h, i) =>
        h.every(
          (v, j) => Math.abs(v - this.lastModels![i]![j]!) <= CALM_EPSILON,
        ),
      );
    this.calmTicks = still ? this.calmTicks + 1 : 0;
    this.lastModels = follow.models.map((h) => [...h] as Homography);
    if (!force && sameMotions && sameAssign) return;

    if (force || !sameAssign) {
      this.shownRecord = Object.fromEntries(
        follow.ids.map((id, i) => [id, follow.assign[i]!]),
      );
    }
    this.shownModels = follow.models;
    this.shownAssign = follow.assign;
    this.events.onView({ models: follow.models, assign: this.shownRecord });
  }
}
