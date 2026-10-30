import type { SessionStore } from "../session/store";

/** Spark's reviews take a few seconds; past this the capture saves what it has. */
export const REVIEWS_WAIT_MS = 15_000;

/**
 * Resolves when no detection is waiting for Spark's review any more (or after
 * `timeoutMs`). A capture taken right after an analysis would otherwise keep the
 * provisional names and the status "ok" of the parts.
 */
export function waitForReviews(
  store: SessionStore,
  timeoutMs: number = REVIEWS_WAIT_MS,
): Promise<void> {
  const pending = () => store.getState().detections.some((d) => d.reviewing);
  if (!pending()) return Promise.resolve();
  return new Promise((resolve) => {
    const finish = () => {
      clearTimeout(timer);
      unsubscribe();
      resolve();
    };
    const timer = setTimeout(finish, timeoutMs);
    const unsubscribe = store.subscribe(() => {
      if (!pending()) finish();
    });
  });
}
