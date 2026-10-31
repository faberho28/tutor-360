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
import { requestGuide } from "../guide/guide-client";
import { guideParts } from "../guide/limits";
import { markFrame } from "../guide/mark-frame";
import { requestVerify } from "../guide/verify-client";
import { requestVoiceTurn, type VoiceOutcome } from "../voice/voice-client";
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
import { waitForReviews } from "./wait-reviews";
import type { Detection, GuideReport } from "../types";
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
/** At least this long between two revisions of the steps (each one is a Spark call). */
const GUIDE_REVISION_GAP_MS = 10_000;

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
  /** Cancels the guided procedure request of the current context. */
  private guideRun = new AbortController();
  /** Cancels the end-of-procedure check of the current context. */
  private verifyRun = new AbortController();
  /** The last scene the models saw: its frame and its masks, to show the tutor. */
  private lastScene: { frame: CapturedFrame; parts: Detection[] } | null = null;
  /** Only the newest revision of the steps is applied. */
  private revisionSeq = 0;
  /** A revision of the steps is out (only one at a time). */
  private revising = false;
  private lastRevisionAt = 0;
  /** The frame the guide was written from: the "before" of the final check. */
  private guideFrame: CapturedFrame | null = null;
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
   * The guided procedure: asked once per scan, from the first analyzed frame and
   * only once Spark has named the parts (the steps point at them by id). A
   * failure is tried again with the next analysis.
   */
  private loadGuide(frame: CapturedFrame) {
    const { guide, labCase, setGuide } = this.store.getState();
    if (guide.status === "loading" || guide.status === "ready") return;
    setGuide({ status: "loading" });
    const { signal } = this.guideRun;
    this.guideFrame = frame;
    void waitForReviews(this.store).then(() => {
      if (signal.aborted) return;
      const detections = guideParts(this.store.getState().detections);
      if (detections.length === 0) {
        setGuide({ status: "error" });
        return;
      }
      // Each part is outlined and numbered on the picture the tutor sees.
      return markFrame(frame, detections)
        .then((marked) =>
          requestGuide(marked, {
            parts: detections,
            context: labCase?.context || undefined,
            apiKey: readApiKey() ?? undefined,
            signal,
          }),
        )
        .then(
          (guide) => {
            // A reset in between: this guide belongs to the old context.
            if (signal.aborted) return;
            this.store.getState().setGuide({
              status: "ready",
              check: { status: "idle" },
              outcome: null,
              scene: guide.observation,
              log: [],
              goal: guide.goal,
              steps: guide.steps,
              current: 0,
              reports: [],
              remarks: [],
              conclusion: "",
              thinking: false,
            });
          },
          () => {
            if (signal.aborted) return;
            this.store.getState().setGuide({ status: "error" });
          },
        );
    });
  }

  /**
   * The check at the end of the steps: the live picture next to the one the
   * guide started from, and Spark says whether the problem looks solved. Once
   * per guide; the camera may not see what a functional test checks, and then
   * the verdict says so.
   */
  checkGuide() {
    const { guide, setGuideCheck } = this.store.getState();
    if (guide.status !== "ready" || guide.check.status !== "idle") return;
    const video = readyVideo(this.getVideo());
    if (!video) {
      setGuideCheck({ status: "error" });
      return;
    }
    setGuideCheck({ status: "loading" });
    const { signal } = this.verifyRun;
    // The scene at the start is not shown again: it is kept as the description
    // Spark wrote then, and only the picture of now is sent.
    void captureFrame(video)
      .then((now) =>
        requestVerify(now.dataUrl, {
          goal: guide.goal,
          scene: guide.scene,
          reports: guide.reports,
          remarks: guide.remarks,
          log: guide.log,
          apiKey: readApiKey() ?? undefined,
          signal,
        }),
      )
      .then(
        ({ verdict, comment }) => {
          // A reset in between: this check belongs to the old context.
          if (signal.aborted) return;
          this.store
            .getState()
            .setGuideCheck({ status: "ready", verdict, comment });
        },
        () => {
          if (signal.aborted) return;
          this.store.getState().setGuideCheck({ status: "error" });
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
    this.guideRun.abort();
    this.guideRun = new AbortController();
    this.verifyRun.abort();
    this.verifyRun = new AbortController();
    this.guideFrame = null;
    this.revising = false;
    this.lastRevisionAt = 0;
    this.lastScene = null;
    this.revisionSeq++;
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
    this.loadGuide(frame);
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
    this.lastScene = { frame, parts: analyzed };
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
    this.reviseGuide(frame);
  }

  /**
   * The student says what happened in the current step. The report is kept and
   * the tutor, looking at the last scene with it, rewrites what is still to do
   * (or says how the procedure ended). Until the answer arrives the panel waits;
   * if it fails the steps stay as they were.
   */
  answerGuideStep(report: GuideReport) {
    const { guide } = this.store.getState();
    if (
      guide.status !== "ready" ||
      guide.thinking ||
      guide.current >= guide.steps.length
    ) {
      return;
    }
    this.store.getState().reportGuideStep(report);
    this.reviseFromStudent();
  }

  /**
   * The student told the tutor something that changes the plan (a part they
   * replaced, a step to skip, something new they found). It is kept and the steps
   * from the current one on are rewritten with it, even if the procedure was over.
   */
  tellGuide(remark: string) {
    const { guide } = this.store.getState();
    if (guide.status !== "ready" || guide.thinking || !remark.trim()) return;
    this.store.getState().addGuideRemark(remark.trim());
    this.reviseFromStudent();
  }

  /** Rewrites what is still to do from the reports and remarks the student has given. */
  private reviseFromStudent() {
    const { labCase } = this.store.getState();
    const after = this.store.getState().guide;
    if (after.status !== "ready") return;
    const seq = ++this.revisionSeq;
    const { signal } = this.guideRun;
    const progress = {
      goal: after.goal,
      steps: after.steps.map((step) => step.text),
      current: after.current,
      reports: after.reports,
      remarks: after.remarks,
      scene: after.scene,
      log: after.log,
    };
    this.store.getState().setGuideThinking(true);
    void this.freshPicture()
      .then((picture) => {
        // Without a picture to show there is nothing to ask: the steps go on.
        if (!picture) throw new Error("There is no picture to show");
        return requestGuide(picture.image, {
          parts: picture.parts,
          context: labCase?.context || undefined,
          progress,
          apiKey: readApiKey() ?? undefined,
          signal,
        });
      })
      .then(
        (next) => {
          if (signal.aborted || seq !== this.revisionSeq) return;
          this.store
            .getState()
            .reviseGuide(
              next.goal,
              next.steps,
              progress.current,
              next.conclusion,
              next.observation,
            );
        },
        () => {},
      )
      .finally(() => {
        if (!signal.aborted && seq === this.revisionSeq) {
          this.store.getState().setGuideThinking(false);
        }
      });
  }

  /**
   * A NEW frame from the camera, with the parts outlined where the student sees
   * them now (the tracking moves them) and numbered, and the parts it numbers.
   * The tutor never gets an old picture: what it saw before is kept as text.
   */
  private async freshPicture(): Promise<{
    image: string;
    parts: Detection[];
  } | null> {
    const { detections, view } = this.store.getState();
    const parts = guideParts(detections).map((d) => {
      const motion = viewFor(view, d.id);
      return motion ? { ...d, polygon: movePolygon(d.polygon, motion) } : d;
    });
    if (parts.length === 0) return null;
    const video = readyVideo(this.getVideo());
    const frame = video
      ? await captureFrame(video)
      : (this.lastScene?.frame ?? this.guideFrame);
    if (!frame) return null;
    return { image: await markFrame(frame, parts), parts };
  }

  /**
   * One thing the student said out loud. Spark, looking at the live frame and at
   * what it remembers of the procedure, says whether it answers the current step
   * (then it is applied as if the buttons had been pressed), asks the tutor
   * something (the reply comes back to be spoken and both are remembered), gives
   * new information or an instruction (the steps are rewritten) or is not for the
   * tutor.
   */
  async voiceTurn(
    transcript: string,
    signal?: AbortSignal,
  ): Promise<VoiceOutcome> {
    const none: VoiceOutcome = {
      intent: "ignore",
      result: null,
      note: "",
      reply: "",
      replan: false,
    };
    const { guide, labCase } = this.store.getState();
    if (guide.status !== "ready") return none;
    const awaiting = !guide.thinking && guide.current < guide.steps.length;
    const video = readyVideo(this.getVideo());
    const frame = video
      ? await captureFrame(video)
      : (this.lastScene?.frame ?? this.guideFrame);
    if (!frame) return none;
    const outcome = await requestVoiceTurn(
      {
        transcript,
        image: frame.dataUrl,
        caseContext: labCase?.context || undefined,
        context: {
          goal: guide.goal,
          steps: guide.steps.map((step) => step.text),
          current: guide.current,
          reports: guide.reports,
          awaiting,
          conclusion: guide.conclusion || undefined,
          scene: guide.scene,
          remarks: guide.remarks,
          log: guide.log,
        },
      },
      { signal, apiKey: readApiKey() ?? undefined },
    );
    if (outcome.intent === "answer" && outcome.result && awaiting) {
      // The step may have moved on while Spark was thinking (a button was pressed).
      const now = this.store.getState().guide;
      if (
        now.status === "ready" &&
        !now.thinking &&
        now.current === guide.current
      ) {
        this.answerGuideStep(
          outcome.note
            ? { result: outcome.result, note: outcome.note }
            : { result: outcome.result },
        );
      }
    }
    if (outcome.intent === "question" && outcome.reply) {
      // The next call remembers this exchange: Spark keeps nothing by itself.
      this.store.getState().logGuide(`El estudiante preguntó: «${transcript}»`);
      this.store.getState().logGuide(`El tutor respondió: «${outcome.reply}»`);
    }
    // New information or an instruction (even phrased as a question): the steps change.
    if (outcome.replan && outcome.intent !== "answer" && outcome.note) {
      this.tellGuide(outcome.note);
    }
    return outcome;
  }

  /**
   * Behind the student's back: an analysis only runs when the scene changed, so
   * after one the tutor looks at the new picture and rewrites the steps still to
   * do (dropping what is already achieved, adding what a new situation needs).
   * When nothing relevant changed it answers the same steps and nothing moves.
   */
  private reviseGuide(frame: CapturedFrame) {
    const { guide, labCase } = this.store.getState();
    if (guide.status !== "ready" || guide.current >= guide.steps.length) return;
    // The student's own report is being worked out: it is the newer information.
    if (guide.thinking) return;
    const now = performance.now();
    if (this.revising || now - this.lastRevisionAt < GUIDE_REVISION_GAP_MS) {
      return;
    }
    const detections = guideParts(this.store.getState().detections);
    if (detections.length === 0) return;
    this.revising = true;
    this.lastRevisionAt = now;
    const { signal } = this.guideRun;
    const seq = this.revisionSeq;
    const progress = {
      goal: guide.goal,
      steps: guide.steps.map((step) => step.text),
      current: guide.current,
      reports: guide.reports,
      remarks: guide.remarks,
      scene: guide.scene,
      log: guide.log,
    };
    void markFrame(frame, detections)
      .then((marked) =>
        requestGuide(marked, {
          parts: detections,
          context: labCase?.context || undefined,
          progress,
          apiKey: readApiKey() ?? undefined,
          signal,
        }),
      )
      .then(
        (next) => {
          // A reset in between: this revision belongs to the old context.
          // A newer revision (the student answered a step) wins.
          if (signal.aborted || seq !== this.revisionSeq) return;
          this.store
            .getState()
            .reviseGuide(
              next.goal,
              next.steps,
              progress.current,
              next.conclusion,
              next.observation,
            );
        },
        // A failed revision leaves the steps as they are.
        () => {},
      )
      .finally(() => {
        this.revising = false;
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
