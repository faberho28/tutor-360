/** What one wording of a part got back from SAM. */
export type WordingResult = {
  phrase: string;
  /** Confidence of each mask it returned (null when SAM sent none). */
  scores: readonly (number | null)[];
};

export type WordingRank = {
  phrase: string;
  masks: number;
  /** Masks at or above the threshold (a mask without score counts as sure). */
  sure: number;
  scoreSum: number;
};

/**
 * SAM understands some wordings of the same part better than others, so Spark
 * gives several and we keep the one SAM understood best: the most masks it is
 * sure about, then the highest total confidence (so that, when none reaches the
 * threshold, the wording that is closest wins). On a full tie the first wording
 * (Spark's own favourite) stays. A wording with no masks never wins over one
 * that has them; when none has any, the first one is returned.
 */
export function rankWordings(
  results: readonly WordingResult[],
  threshold: number,
): WordingRank[] {
  return results
    .map((r) => ({
      phrase: r.phrase,
      masks: r.scores.length,
      sure: r.scores.filter((s) => s === null || s >= threshold).length,
      scoreSum: r.scores.reduce<number>((sum, s) => sum + (s ?? 0), 0),
    }))
    .map((rank, index) => ({ rank, index }))
    .sort(
      (a, b) =>
        b.rank.sure - a.rank.sure ||
        b.rank.scoreSum - a.rank.scoreSum ||
        a.index - b.index,
    )
    .map(({ rank }) => rank);
}
