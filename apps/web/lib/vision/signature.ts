/**
 * Local change detection between video frames. Pure functions over tiny
 * grayscale signatures: no React, no DOM, no network, no model calls.
 */

export const SIG_WIDTH = 512;
export const SIG_HEIGHT = 288;
export const GRID_COLS = 128;
export const GRID_ROWS = 72;

/** Largest camera shift (in signature pixels) that is still tried to realign. */
const MAX_SHIFT = 32;

/** The alignment search samples every STEP pixels and shifts in STEP jumps. */
const STEP = 4;

/** A shift must lower the diff by at least this much to beat staying still. */
const SHIFT_GAIN = 0.01;

/** Zero-mean luma, so a brightness change does not read as a scene change. */
export type Signature = Float32Array;

/** Typed-array read that satisfies `noUncheckedIndexedAccess`. */
function at(values: ArrayLike<number>, index: number): number {
  return values[index] ?? 0;
}

/** Converts RGBA pixels (`SIG_WIDTH` x `SIG_HEIGHT`) to a zero-mean signature. */
export function toSignature(rgba: Uint8ClampedArray): Signature {
  const size = SIG_WIDTH * SIG_HEIGHT;
  const sig = new Float32Array(size);
  let sum = 0;
  for (let i = 0; i < size; i++) {
    const luma =
      (0.299 * at(rgba, i * 4) +
        0.587 * at(rgba, i * 4 + 1) +
        0.114 * at(rgba, i * 4 + 2)) /
      255;
    sig[i] = luma;
    sum += luma;
  }
  const mean = sum / size;
  for (let i = 0; i < size; i++) sig[i] = at(sig, i) - mean;
  return sig;
}

/** Mean absolute difference over the whole frame, 0..~1. */
export function meanAbsDiff(a: Signature, b: Signature): number {
  let sum = 0;
  for (let i = 0; i < a.length; i++) sum += Math.abs(at(a, i) - at(b, i));
  return sum / a.length;
}

export type Alignment = { dx: number; dy: number; diff: number };

/** Mean diff between `ref` and `cur` shifted by (dx, dy), over the overlap. */
function overlapDiff(
  ref: Signature,
  cur: Signature,
  dx: number,
  dy: number,
): number {
  let sum = 0;
  let count = 0;
  const y1 = Math.min(SIG_HEIGHT, SIG_HEIGHT - dy);
  const x1 = Math.min(SIG_WIDTH, SIG_WIDTH - dx);
  for (let y = Math.max(0, -dy); y < y1; y += STEP) {
    for (let x = Math.max(0, -dx); x < x1; x += STEP) {
      sum += Math.abs(
        at(ref, y * SIG_WIDTH + x) - at(cur, (y + dy) * SIG_WIDTH + (x + dx)),
      );
      count++;
    }
  }
  return sum / count;
}

/**
 * Finds the translation of `cur` that best matches `ref` (brute force over
 * +-MAX_SHIFT pixels, comparing only the overlap) and the remaining diff.
 */
export function align(ref: Signature, cur: Signature): Alignment {
  let best: Alignment = { dx: 0, dy: 0, diff: Infinity };
  for (let dy = -MAX_SHIFT; dy <= MAX_SHIFT; dy += STEP) {
    for (let dx = -MAX_SHIFT; dx <= MAX_SHIFT; dx += STEP) {
      const diff = overlapDiff(ref, cur, dx, dy);
      if (diff < best.diff) best = { dx, dy, diff };
    }
  }
  // Noise must not read as movement: keep (0, 0) unless a shift is clearly better.
  const still = overlapDiff(ref, cur, 0, 0);
  return still - best.diff < SHIFT_GAIN ? { dx: 0, dy: 0, diff: still } : best;
}

/** Mean diff per grid cell (row-major, GRID_COLS x GRID_ROWS), realigned. */
export function cellDiffs(
  ref: Signature,
  cur: Signature,
  { dx, dy }: { dx: number; dy: number },
): number[] {
  const cellW = SIG_WIDTH / GRID_COLS;
  const cellH = SIG_HEIGHT / GRID_ROWS;
  const diffs: number[] = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      let sum = 0;
      let count = 0;
      for (let y = row * cellH; y < (row + 1) * cellH; y++) {
        for (let x = col * cellW; x < (col + 1) * cellW; x++) {
          const cx = x + dx;
          const cy = y + dy;
          if (cx < 0 || cy < 0 || cx >= SIG_WIDTH || cy >= SIG_HEIGHT) continue;
          sum += Math.abs(
            at(ref, y * SIG_WIDTH + x) - at(cur, cy * SIG_WIDTH + cx),
          );
          count++;
        }
      }
      diffs.push(count > 0 ? sum / count : 0);
    }
  }
  return diffs;
}
