import { toast } from "sonner";
import { captureFrame, readyVideo } from "../camera/capture-frame";
import type { ScanAnalysis } from "../services/types";
import type { SessionStore } from "../session/store";
import type { ChangeStatus } from "../vision/change-detector";
import { AnalyzeClientError, requestAnalysis } from "./analyze-client";
import { messageFor, phaseFor } from "./error-map";
import { AnalysisScheduler, type SchedulerPhase } from "./scheduler";
import { trackDetections } from "./track";
import type { AnalyzeResponse } from "./types";

type Outcome = { response: AnalyzeResponse; latencyMs: number };

const FAILED_PHASES = new Set(["offline", "quota", "error"]);

/** Optional override of the minimum gap between analyses (floor 500 ms). */
function minGapFromEnv(): number | undefined {
  const value = Number(process.env.NEXT_PUBLIC_ANALYSIS_MIN_GAP_MS);
  return Number.isFinite(value) && value > 0 ? value : undefined;
}

/**
 * The real analysis: the camera frame goes to /api/analyze when the user starts
 * the automatic mode and the scene changes, or when they press "Capturar". It
 * writes the results into the session store.
 */
export class RealAnalysis implements ScanAnalysis {
  readonly autoAvailable = true;
  private readonly store: SessionStore;
  private readonly getVideo: () => HTMLVideoElement | null;
  private readonly scheduler: AnalysisScheduler<Outcome>;
  private idCounter = 0;
  private auto = false;

  constructor(store: SessionStore, getVideo: () => HTMLVideoElement | null) {
    this.store = store;
    this.getVideo = getVideo;
    this.scheduler = new AnalysisScheduler<Outcome>({
      run: (signal) => this.run(signal),
      onResult: (outcome) => this.publish(outcome),
      onError: (error, info) => this.fail(error, info),
      onPhase: (phase) => this.showPhase(phase),
      minGapMs: minGapFromEnv(),
    });
  }

  start() {
    this.auto = true;
    this.store.getState().setAnalysis({
      mode: "auto",
      phase: "waiting",
      startedAt: Date.now(),
    });
    this.scheduler.start();
  }

  stop() {
    this.auto = false;
    this.scheduler.stop();
    this.store
      .getState()
      .setAnalysis({ mode: "manual", phase: "paused", startedAt: null });
  }

  /** Starts over: a failed automatic mode picks up again from a clean slate. */
  retry() {
    this.stop();
    this.start();
  }

  async captureOnce() {
    await this.scheduler.captureOnce();
  }

  /** The frame to save in a capture, after an analysis if one is due. */
  async snapshot() {
    if (!readyVideo(this.getVideo())) return null;
    await this.scheduler.captureOnce();
    return readyVideo(this.getVideo());
  }

  /** The change engine's latest status. */
  report(status: ChangeStatus) {
    const state = this.store.getState();
    const moved = status === "camera-moved" || status === "scene-lost";
    if (moved && state.detections.length > 0 && !state.analysis.stale) {
      state.setAnalysis({ stale: true });
    }
    this.scheduler.report(status);
  }

  dispose() {
    this.scheduler.dispose();
  }

  private async run(signal: AbortSignal): Promise<Outcome> {
    const video = readyVideo(this.getVideo());
    if (!video) {
      throw new AnalyzeClientError("unknown", "La cámara aún no está lista");
    }
    const startedAt = performance.now();
    const frame = await captureFrame(video);
    const response = await requestAnalysis(
      frame,
      this.store.getState().sessionId,
      { signal },
    );
    return { response, latencyMs: Math.round(performance.now() - startedAt) };
  }

  private publish({ response, latencyMs }: Outcome) {
    const state = this.store.getState();
    const now = Date.now();
    // Every analysis is a full picture of the frame: replace the list, keeping
    // the ids of what is still there.
    const next = trackDetections(
      state.detections,
      response.components.map((detection) => ({ ...detection, seenAt: now })),
      (cls) => `${cls}-${++this.idCounter}`,
    );
    state.replaceDetections(next);
    this.store.getState().setAnalysis({
      latencyMs,
      stale: false,
      phase: this.auto ? "analyzing" : "idle",
    });
  }

  private fail(error: unknown, info: { willRetry: boolean; manual: boolean }) {
    // A failed "Capturar" is reported by the control bar, not by the banner.
    if (info.manual) return;
    const phase = phaseFor(error);
    if (info.willRetry) {
      this.store.getState().setAnalysis({ phase });
    } else {
      this.auto = false;
      this.store
        .getState()
        .setAnalysis({ phase, mode: "manual", startedAt: null });
    }
    // The offline and quota banners explain themselves; others need the reason.
    if (phase === "error") {
      toast.error(messageFor(error), { id: "analysis-error" });
    }
  }

  private showPhase(phase: SchedulerPhase) {
    if (!this.auto) return;
    const current = this.store.getState().analysis.phase;
    // A failure stays on screen until an analysis succeeds.
    if (FAILED_PHASES.has(current)) return;
    if (phase === "waiting") {
      this.store.getState().setAnalysis({ phase: "waiting" });
    } else if (phase === "analyzing" || phase === "watching") {
      this.store.getState().setAnalysis({ phase: "analyzing" });
    }
  }
}
