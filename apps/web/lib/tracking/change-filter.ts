/**
 * A difference only counts as a change of the scene when it is the SAME
 * difference for a while. A hand that moves over the object changes different
 * cells every look: it is somebody passing, not something that changed. A part
 * that was put down, or taken away, differs in the same cells and stays that way.
 */

/** How long the same cells must differ before it counts (three looks at 200 ms). */
export const STABLE_CHANGE_MS = 600;
/** Share of the cells that must be the same as at the previous look (0..1). */
export const SAME_CELLS = 0.6;

/** |a ∩ b| / |a ∪ b|: 1 for identical sets, 0 for disjoint ones. */
function overlap(a: ReadonlySet<number>, b: ReadonlySet<number>): number {
  if (a.size === 0 && b.size === 0) return 1;
  let both = 0;
  for (const cell of a) if (b.has(cell)) both++;
  return both / (a.size + b.size - both);
}

export class ChangeFilter {
  private last: ReadonlySet<number> = new Set();
  /** Since when the same cells differ; null when nothing differs. */
  private since: number | null = null;

  /** Forgets what differed: a new reference starts from nothing. */
  reset() {
    this.last = new Set();
    this.since = null;
  }

  /**
   * One look. `differs` says whether something differs from the reference at all
   * (enough cells, or one very strong), and `cells` which ones. Returns true once
   * the same cells have differed for `STABLE_CHANGE_MS`.
   */
  push(cells: readonly number[], differs: boolean, now: number): boolean {
    if (!differs) {
      this.reset();
      return false;
    }
    const current = new Set(cells);
    const same =
      this.since !== null && overlap(current, this.last) >= SAME_CELLS;
    // Different cells than a moment ago: the clock starts over.
    if (!same) this.since = now;
    this.last = current;
    return now - this.since! >= STABLE_CHANGE_MS;
  }
}
