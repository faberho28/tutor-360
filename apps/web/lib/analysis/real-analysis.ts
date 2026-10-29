import {
  captureFrame,
  readyVideo,
  type CapturedFrame,
} from "../camera/capture-frame";
import type { ScanAnalysis } from "../services/types";
import { readApiKey } from "../settings/api-key";
import type { SessionStore } from "../session/store";
import type { ChangeStatus } from "../vision/change-detector";
import { AnalyzeClientError, requestAnalysis } from "./analyze-client";
import { messageFor, phaseFor } from "./error-map";
import { PartReviews } from "./part-reviews";
import type { PlannedPart } from "./scene";
import { AnalysisScheduler, type SchedulerPhase } from "./scheduler";
import { trackDetections } from "./track";
import type { AnalyzeResponse } from "./types";

type Outcome = {
  response: AnalyzeResponse;
  latencyMs: number;
  /** The frame the masks were found on: Spark's review looks at a copy of it. */
  frame: CapturedFrame;
  /** True when the plan of the scene was reused (Spark was not asked). */
  planReused: boolean;
};

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
  /**
   * The parts Spark planned for the scene in front of the camera. While the
   * scene is the same the next analyses skip Spark; losing the scene drops it.
   */
  private plan: PlannedPart[] | null = null;
  /** Spark's second look: final names and condition, part by part. */
  private readonly reviews = new PartReviews();

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
      reason: null,
    });
    this.scheduler.start();
  }

  stop() {
    this.auto = false;
    this.scheduler.stop();
    this.store.getState().setAnalysis({
      mode: "manual",
      phase: "paused",
      startedAt: null,
      reason: null,
    });
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
    // Another object in front of the camera: what Spark planned no longer applies.
    if (status === "scene-lost") {
      this.plan = null;
      this.reviews.reset();
    }
    this.scheduler.report(status);
  }

  dispose() {
    this.scheduler.dispose();
    this.reviews.reset();
  }

  private async run(signal: AbortSignal): Promise<Outcome> {
    const video = readyVideo(this.getVideo());
    if (!video) {
      throw new AnalyzeClientError("unknown", "La cámara aún no está lista");
    }
    const startedAt = performance.now();
    const frame = await captureFrame(video);
    const { sessionId, labCase } = this.store.getState();
    // Only the automatic mode watches the scene: a manual capture is
    // deliberate and may be of something else, so it asks Spark again.
    const plan = this.auto && this.plan ? this.plan : undefined;
    const response = await requestAnalysis(frame, sessionId, {
      signal,
      context: labCase?.context || undefined,
      judgesCondition: labCase?.judgesCondition,
      apiKey: readApiKey() ?? undefined,
      plan,
    });
    return {
      response,
      latencyMs: Math.round(performance.now() - startedAt),
      frame,
      planReused: plan !== undefined,
    };
  }

  private publish({ response, latencyMs, frame, planReused }: Outcome) {
    const state = this.store.getState();
    const now = Date.now();
    // A plan Spark just made is a new scene: what was reviewed no longer applies.
    if (!planReused) this.reviews.reset();
    // An empty plan means Spark found nothing: ask it again next time.
    this.plan = response.plan.length > 0 ? response.plan : null;
    this.reviews.learn(response.plan);
    // Every analysis is a full picture of the frame: replace the list, keeping
    // the ids of what is still there.
    const next = trackDetections(
      state.detections,
      response.components.map((detection) => ({ ...detection, seenAt: now })),
      () => `object-${++this.idCounter}`,
    );
    const { labCase } = state;
    this.reviews.begin(
      next,
      frame,
      {
        context: labCase?.context || undefined,
        judgesCondition: labCase?.judgesCondition,
        apiKey: readApiKey() ?? undefined,
      },
      // A review finished: redraw with whatever the list is by now.
      () =>
        this.store
          .getState()
          .replaceDetections(
            this.reviews.decorate(this.store.getState().detections),
          ),
    );
    state.replaceDetections(this.reviews.decorate(next));
    this.store.getState().setAnalysis({
      latencyMs,
      stale: false,
      reason: null,
      phase: this.auto ? "analyzing" : "idle",
    });
  }

  private fail(error: unknown, info: { willRetry: boolean; manual: boolean }) {
    // A failed "Capturar" is reported by the control bar's own toast.
    if (info.manual) return;
    // The phase and the reason are what the failure toast shows.
    const failure = { phase: phaseFor(error), reason: messageFor(error) };
    if (info.willRetry) {
      this.store.getState().setAnalysis(failure);
    } else {
      this.auto = false;
      this.store
        .getState()
        .setAnalysis({ ...failure, mode: "manual", startedAt: null });
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
