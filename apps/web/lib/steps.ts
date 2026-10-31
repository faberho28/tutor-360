export type StepStatus = "done" | "skipped" | "pending";

export function stepStatus(
  index: number,
  done: readonly number[],
  skipped: readonly number[],
): StepStatus {
  if (done.includes(index)) return "done";
  if (skipped.includes(index)) return "skipped";
  return "pending";
}

/** First step that is neither done nor skipped, or null when all are handled. */
export function currentStepIndex(
  total: number,
  done: readonly number[],
  skipped: readonly number[],
): number | null {
  for (let i = 0; i < total; i++) {
    if (stepStatus(i, done, skipped) === "pending") return i;
  }
  return null;
}

/** Percentage of steps already handled (done or skipped). */
export function stepProgress(
  total: number,
  done: readonly number[],
  skipped: readonly number[],
): number {
  if (total === 0) return 0;
  const handled = new Set([...done, ...skipped]);
  return Math.round((Math.min(handled.size, total) / total) * 100);
}
