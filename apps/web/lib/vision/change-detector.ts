import {
  align,
  cellDiffs,
  meanAbsDiff,
  type Alignment,
  type Signature,
} from "./signature";

/**
 * Initial thresholds on zero-mean luma differences (0..1). They are a first
 * guess: tune them against the real camera.
 */
export const THRESHOLDS = {
  /** Previous-frame diff above this means the image is still moving. */
  motion: 0.03,
  /** The image must stay below `motion` this long to count as settled. */
  settleMs: 800,
  /** Aligned diff vs the reference above this: a different scene. */
  sceneLost: 0.15,
  /** Per-cell diff above this: that region changed. */
  cell: 0.12,
  /** Shift (signature px) from which the camera counts as moved. */
  shift: 16,
  /** A changed scene that holds still this long becomes the new reference. */
  adoptMs: 3000,
  /** Consecutive identical readings needed before a status is reported. */
  confirm: 2,
} as const;

type Draft = Omit<ChangeReading, "adoptions">;

export type ChangeStatus =
  | "calibrating" // no reference yet, waiting for a steady image
  | "moving" // the image is changing frame to frame
  | "stable" // matches the reference
  | "camera-moved" // same scene, shifted
  | "scene-lost" // no longer the reference scene
  | "changed"; // same scene, some regions differ

export type ChangeReading = {
  status: ChangeStatus;
  /** Diff against the previous frame. */
  motion: number;
  /** Aligned diff against the reference (0 while calibrating or moving). */
  drift: number;
  /** Changed grid cells, only for `changed`. */
  cells: number[];
  /** Live per-cell diff against the reference (empty without a reference). */
  heat: number[];
  /** Times a changed scene was adopted as the new reference. */
  adoptions: number;
};

const INITIAL: ChangeReading = {
  status: "calibrating",
  motion: 0,
  drift: 0,
  cells: [],
  heat: [],
  adoptions: 0,
};

/**
 * Compares each frame with the previous one (is the camera moving?) and with
 * a fixed reference taken once the image settles (did the scene change?). A
 * changed scene that then holds still becomes the new reference.
 */
export class ChangeDetector {
  private previous: Signature | null = null;
  private reference: Signature | null = null;
  private lastMoveAt = 0;
  private deviantSince: number | null = null;
  private adoptions = 0;
  private pending: ChangeStatus | null = null;
  private pendingCount = 0;
  private reported: ChangeReading = INITIAL;

  /** Forgets the reference: the next steady image becomes the new one. */
  reset(): ChangeReading {
    this.reference = null;
    this.deviantSince = null;
    this.pending = null;
    this.pendingCount = 0;
    this.reported = { ...INITIAL, adoptions: this.adoptions };
    return this.reported;
  }

  push(sig: Signature, now: number): ChangeReading {
    const first = this.previous === null;
    const motion = this.previous ? meanAbsDiff(this.previous, sig) : 0;
    this.previous = sig;
    if (first || motion > THRESHOLDS.motion) this.lastMoveAt = now;

    const ref = this.reference;
    const best = ref ? align(ref, sig) : null;
    const heat = ref && best ? cellDiffs(ref, sig, best) : [];
    const base = { motion, drift: 0, cells: [], heat };

    let next: Draft;
    if (now - this.lastMoveAt < THRESHOLDS.settleMs) {
      this.deviantSince = null;
      next = { ...base, status: ref ? "moving" : "calibrating" };
    } else if (!ref || !best) {
      this.reference = sig;
      return this.confirm({ ...base, status: "stable" }, true);
    } else {
      next = this.compare(best, heat, motion);
      if (next.status === "stable") {
        this.deviantSince = null;
      } else if (this.deviantSince === null) {
        this.deviantSince = now;
      } else if (now - this.deviantSince >= THRESHOLDS.adoptMs) {
        // The changed scene held still: it is the new normal.
        this.reference = sig;
        this.deviantSince = null;
        this.adoptions++;
        return this.confirm({ ...base, heat: [], status: "stable" }, true);
      }
    }
    // Status is debounced, but the heat map always shows the latest frame.
    return { ...this.confirm(next), heat };
  }

  private compare(best: Alignment, heat: number[], motion: number): Draft {
    const base = { motion, drift: best.diff, cells: [], heat };
    if (best.diff > THRESHOLDS.sceneLost) {
      return { ...base, status: "scene-lost" };
    }
    if (Math.hypot(best.dx, best.dy) >= THRESHOLDS.shift) {
      return { ...base, status: "camera-moved" };
    }
    const cells = heat.flatMap((diff, i) =>
      diff > THRESHOLDS.cell ? [i] : [],
    );
    return { ...base, status: cells.length > 0 ? "changed" : "stable", cells };
  }

  /** Debounces: a new status is reported after `confirm` identical readings. */
  private confirm(draft: Draft, immediate = false): ChangeReading {
    const reading = { ...draft, adoptions: this.adoptions };
    if (immediate || reading.status === this.reported.status) {
      this.pending = null;
      this.pendingCount = 0;
      this.reported = reading;
      return reading;
    }
    this.pendingCount =
      reading.status === this.pending ? this.pendingCount + 1 : 1;
    this.pending = reading.status;
    if (this.pendingCount >= THRESHOLDS.confirm) {
      this.pending = null;
      this.pendingCount = 0;
      this.reported = reading;
    }
    return this.reported;
  }
}
