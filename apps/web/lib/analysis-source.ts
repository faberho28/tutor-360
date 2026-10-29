/**
 * Where detections come from (the camera + /api/analyze). The screen only
 * depends on this contract.
 *
 * A source writes its results into the session store.
 */
export interface AnalysisSource {
  /** Starts the automatic loop (mode "auto"). */
  start(): void;
  /** Stops the automatic loop (mode "manual"). */
  stop(): void;
  /** One analysis on demand; resolves when its result is in the store. */
  captureOnce(): Promise<void>;
  /** Releases timers without touching the store (component unmount). */
  dispose(): void;
}
