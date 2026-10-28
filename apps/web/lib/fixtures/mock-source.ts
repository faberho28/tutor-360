import type { AnalysisSource } from "../analysis-source";
import type { SessionStore } from "../session/store";

const CYCLE_PAUSE_MS = 1000;

/** Between 0.7 s and 1.3 s, like the PRD's 1.5 s target with some variation. */
const randomLatency = () => 700 + Math.round(Math.random() * 600);

/**
 * Simulated analysis: it does not look at any image. Each cycle waits a random
 * latency and re-emits the current detections with a fresh timestamp.
 */
export class MockAnalysisSource implements AnalysisSource {
  private readonly store: SessionStore;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private running = false;

  constructor(store: SessionStore) {
    this.store = store;
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.store
      .getState()
      .setAnalysis({ mode: "auto", phase: "analyzing", startedAt: Date.now() });
    void this.loop();
  }

  stop() {
    this.dispose();
    this.store.getState().setAnalysis({ mode: "manual", phase: "paused" });
  }

  async captureOnce() {
    // In auto mode the detections on screen are already the latest.
    if (this.running) return;
    this.store.getState().setAnalysis({ phase: "analyzing" });
    await this.analyze();
    this.store.getState().setAnalysis({ phase: "idle" });
  }

  dispose() {
    this.running = false;
    clearTimeout(this.timer);
  }

  private async loop() {
    while (this.running) {
      await this.analyze();
      if (!this.running) return;
      await this.wait(CYCLE_PAUSE_MS);
    }
  }

  private analyze(): Promise<void> {
    const latencyMs = randomLatency();
    return new Promise((resolve) => {
      this.timer = setTimeout(() => {
        const state = this.store.getState();
        const now = Date.now();
        state.replaceDetections(
          state.detections.map((d) => ({ ...d, seenAt: now })),
        );
        state.setAnalysis({ latencyMs });
        resolve();
      }, latencyMs);
    });
  }

  private wait(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.timer = setTimeout(resolve, ms);
    });
  }
}
