/**
 * Where detections come from. The simulated source (lib/fixtures/mock-source)
 * and the real one (HU-18, camera + /api/analyze) implement the same contract,
 * so the screen does not change when the data becomes real.
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
