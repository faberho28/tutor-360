import {
  captureFrame,
  DETAIL_MAX_SIDE,
  FRAME_MAX_SIDE,
  readyVideo,
  type CapturedFrame,
} from "../camera/capture-frame";
import type { ScanAnalysis } from "../services/types";
import { readApiKey } from "../settings/api-key";
import type { SessionStore } from "../session/store";
import {
  clearAnalyzedFrame,
  setAnalyzedFrame,
} from "../diagnosis/analyzed-frame";
import { autoDiagnose } from "../diagnosis/request-diagnosis";
import { requestGeneralSteps } from "../diagnosis/steps-client";
import { TRACKING_ENABLED } from "../tracking/enabled";
import { moveBox, movePolygon } from "../tracking/homography";
import { getOpenCv, loadOpenCv } from "../tracking/opencv-loader";
import {
  TrackingSession,
  type TrackingStatus,
} from "../tracking/track-session";
import type { ChangeStatus } from "../vision/change-detector";
import { AnalyzeClientError, requestAnalysis } from "./analyze-client";
import { messageFor, phaseFor } from "./error-map";
import { PartReviews } from "./part-reviews";
import type { PlannedPart } from "./scene";
import { AnalysisScheduler, type SchedulerPhase } from "./scheduler";
import { trackDetections } from "./track";
import type { Detection } from "../types";
import { viewFor } from "../tracking/view";
import type { AnalyzeResponse } from "./types";

type Outcome = {
  response: AnalyzeResponse;
  latencyMs: number;
  /** The frame the masks were found on: Spark's review looks at a copy of it. */
  frame: CapturedFrame;
  /**
   * The same instant at the camera's own resolution (up to 2560 px), kept on the
   * device: the diagnosis crops come from it. Equal to `frame` when the camera
   * is not bigger than that.
   */
  detail: CapturedFrame;
  /** True when the plan of the scene was reused (Spark was not asked). */
  planReused: boolean;
  /** Whether the local tracking took this frame as its new reference. */
  tracked: boolean;
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
  /** Cancels the general steps request of the current context. */
  private stepsRun = new AbortController();
  /**
   * Follows the scene between analyses so the masks move with it instead of
   * costing a new analysis. Created when it is needed and OpenCV is ready; null
   * otherwise (and if OpenCV cannot load everything works as before, analyzing
   * on every change). `dispose` empties it but the object stays usable: React's
   * Strict Mode mounts, unmounts and mounts the same one again.
   */
  private session: TrackingSession | null = null;
  /** The OpenCV download, so that every caller waits for the same one. */
  private download: Promise<void> | null = null;
  /** The change engine's latest status (the tracking refines it). */
  private detector: ChangeStatus = "calibrating";

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
    // The download starts as soon as the screen opens: by the time the user
    // turns the automatic mode on it is usually ready.
    void this.downloadOpenCv();
  }

  /** Downloads OpenCV once; resolves when it is ready or failed (never rejects). */
  private downloadOpenCv(): Promise<void> {
    if (!TRACKING_ENABLED) return Promise.resolve();
    this.download ??= loadOpenCv()
      .then(() => undefined)
      .catch(() => {
        // Without OpenCV the scan still works: it analyzes on every change.
        // A later start tries the download again.
        console.warn("[tracking] OpenCV could not load; tracking is off");
        this.download = null;
      });
    return this.download;
  }

  /** The tracking, created the first time it is needed; null without OpenCV. */
  private ensureSession(): TrackingSession | null {
    if (!TRACKING_ENABLED) return null;
    if (this.session) return this.session;
    const cv = getOpenCv();
    if (!cv) return null;
    this.session = new TrackingSession(cv, this.getVideo, {
      onView: (view) => this.store.getState().setView(view),
      onStatus: () => this.refresh(),
    });
    return this.session;
  }

  start() {
    this.auto = true;
    if (!TRACKING_ENABLED || this.ensureSession()) {
      this.begin();
      return;
    }
    // Still downloading: the stage shows the progress and the loop starts after.
    this.store.getState().setAnalysis({
      mode: "auto",
      phase: "preparing",
      startedAt: Date.now(),
      reason: null,
    });
    void this.downloadOpenCv().then(() => {
      // The user may have paused it while it downloaded.
      if (!this.auto) return;
      this.ensureSession();
      this.begin();
    });
  }

  private begin() {
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
    this.detector = status;
    this.refresh();
  }

  /**
   * What the scheduler is told. While the tracking follows the scene, the
   * engine's "camera moved" and "scene lost" (it only understands a shift) are
   * not changes: the masks move with the scene. The models are asked again only
   * when the tracking is lost or when, motion aside, some regions differ.
   */
  private effectiveStatus(tracking: TrackingStatus): ChangeStatus {
    const detector = this.detector;
    if (tracking === "off") return detector;
    // Still settling: never analyze a frame in motion.
    if (detector === "calibrating" || detector === "moving") return detector;
    if (tracking === "lost") return "scene-lost";
    return this.session?.changed() ? "changed" : "stable";
  }

  /** Recomputes what to tell the scheduler and whether the masks are stale. */
  private refresh() {
    const state = this.store.getState();
    const tracking = this.session?.status() ?? "off";
    // Another object in front of the camera: what Spark planned no longer
    // applies. A scene the tracking still follows (a board turned around) is
    // the same one, even if the engine no longer recognizes it.
    if (this.detector === "scene-lost" && tracking !== "tracking") {
      this.plan = null;
      this.reviews.reset();
    }
    const status = this.effectiveStatus(tracking);
    const moved = status === "camera-moved" || status === "scene-lost";
    const stale = tracking === "lost" || (tracking === "off" && moved);
    if (stale && state.detections.length > 0 && !state.analysis.stale) {
      state.setAnalysis({ stale: true });
    }
    this.scheduler.report(status);
  }

  dispose() {
    this.scheduler.dispose();
    this.reviews.reset();
    this.session?.dispose();
    this.session = null;
  }

  private async run(signal: AbortSignal): Promise<Outcome> {
    const video = readyVideo(this.getVideo());
    if (!video) {
      throw new AnalyzeClientError("unknown", "La cámara aún no está lista");
    }
    const startedAt = performance.now();
    // The tracking takes THIS frame as the reference of what comes back, and
    // keeps following the video while the request is in flight. The masks on
    // screen are the objects, wherever each one is now: the tracking follows
    // what is inside their outlines and ignores the table and the hands.
    const { detections, view } = this.store.getState();
    const tracked =
      this.ensureSession()?.mark(
        detections.map((d) => {
          const motion = viewFor(view, d.id);
          return motion ? movePolygon(d.polygon, motion) : d.polygon;
        }),
      ) ?? false;
    this.store.getState().setAnalysis({ busy: true });
    try {
      // Both copies are drawn from the video in the same synchronous step, so
      // they show the same instant; the big one never leaves the device.
      const bigger =
        Math.max(video.videoWidth, video.videoHeight) > FRAME_MAX_SIDE;
      const [frame, detail] = await Promise.all([
        captureFrame(video),
        bigger ? captureFrame(video, DETAIL_MAX_SIDE) : null,
      ]);
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
        detail: detail ?? frame,
        planReused: plan !== undefined,
        tracked,
      };
    } catch (error) {
      this.session?.discard();
      throw error;
    } finally {
      this.store.getState().setAnalysis({ busy: false });
    }
  }

  /**
   * The general step-by-step: written by the AI from the first analyzed frame of
   * the scan (once per session; a failure is tried again with the next frame).
   */
  private loadGeneralSteps(frame: CapturedFrame) {
    const { generalSteps, labCase, setGeneralSteps } = this.store.getState();
    if (generalSteps.status === "loading" || generalSteps.status === "ready") {
      return;
    }
    setGeneralSteps({ status: "loading" });
    const { signal } = this.stepsRun;
    requestGeneralSteps(frame.dataUrl, {
      context: labCase?.context || undefined,
      apiKey: readApiKey() ?? undefined,
      signal,
    }).then(
      (steps) => {
        // A reset in between: these steps belong to the old context.
        if (signal.aborted) return;
        this.store.getState().setGeneralSteps({ status: "ready", steps });
      },
      () => {
        if (signal.aborted) return;
        this.store.getState().setGeneralSteps({ status: "error" });
      },
    );
  }

  /**
   * What Spark's reviews say about the parts, then what the diagnosis decided
   * after a closer look (it wins: it saw the part up close).
   */
  private decorated(detections: readonly Detection[]): Detection[] {
    const { statusOverrides } = this.store.getState();
    return this.reviews.decorate(detections).map((d) => {
      const override = statusOverrides[d.id];
      return override ? { ...d, ...override } : d;
    });
  }

  /**
   * Forgets everything about the scan and starts over: the request in flight is
   * cancelled, the plan, the reviews and the tracking are dropped, and the
   * session store goes back to its initial state (case and camera are kept).
   * Detection ids keep counting, so a late answer cannot land on a new part.
   */
  reset() {
    this.auto = false;
    this.scheduler.stop();
    this.plan = null;
    this.reviews.reset();
    this.session?.clear();
    this.stepsRun.abort();
    this.stepsRun = new AbortController();
    clearAnalyzedFrame(this.store);
    this.store.getState().reset();
  }

  private publish({
    response,
    latencyMs,
    frame,
    detail,
    planReused,
    tracked,
  }: Outcome) {
    const state = this.store.getState();
    const now = Date.now();
    // The diagnosis crops are cut from the same instant at the camera's own
    // resolution, where a small part still has detail.
    setAnalyzedFrame(this.store, detail);
    this.loadGeneralSteps(frame);
    // A plan Spark just made is a new scene: what was reviewed no longer applies.
    if (!planReused) this.reviews.reset();
    // An empty plan means Spark found nothing: ask it again next time.
    this.plan = response.plan.length > 0 ? response.plan : null;
    this.reviews.learn(response.plan);
    // Every analysis is a full picture of the frame: replace the list, keeping
    // the ids of what is still there. The new masks were found on a frame taken
    // seconds ago: the tracking carries each one to where its object is now, so
    // that they and the old ones (shown where their objects are) can be matched.
    const incoming = response.components.map((detection) => ({
      ...detection,
      seenAt: now,
    }));
    const session = tracked ? this.session : null;
    const placed = session ? session.place(incoming) : incoming;
    const onScreen = state.detections.map((d) => {
      const motion = viewFor(state.view, d.id);
      return motion ? { ...d, bbox: moveBox(d.bbox, motion) } : d;
    });
    const matched = trackDetections(
      onScreen,
      placed,
      () => `object-${++this.idCounter}`,
    );
    // Only the ids come from the match. `next` is where the objects are now;
    // `analyzed` is the same masks on the frame the models looked at, which is
    // what Spark's review must be shown.
    const next = placed.map((detection, i) => ({
      ...detection,
      id: matched[i]!.id,
    }));
    const analyzed = incoming.map((detection, i) => ({
      ...detection,
      id: matched[i]!.id,
    }));
    const { labCase } = state;
    this.reviews.begin(
      analyzed,
      frame,
      {
        context: labCase?.context || undefined,
        judgesCondition: labCase?.judgesCondition,
        apiKey: readApiKey() ?? undefined,
      },
      // A review finished: redraw with whatever the list is by now, and the
      // parts that came out as a problem get their diagnosis right away.
      () => {
        this.store
          .getState()
          .replaceDetections(this.decorated(this.store.getState().detections));
        autoDiagnose(this.store);
      },
    );
    // From here the tracking follows the masks where their objects are now.
    if (this.session) {
      if (tracked) this.session.commit(next);
      else this.session.clear();
    }
    state.replaceDetections(this.decorated(next));
    // Reviews already known (the scene is the same) can name and judge the new
    // masks at once, with no review settling later to trigger this.
    autoDiagnose(this.store);
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
