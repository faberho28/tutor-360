import type { ComponentStatus } from "./component-status";

/** Normalized coordinates (0..1) over the analyzed image. */
export type Point = [number, number];

export type BoundingBox = { x: number; y: number; w: number; h: number };

export type Detection = {
  /** Stable while the component stays visible. */
  id: string;
  /** Name shown to the user (Spanish), given by the AI. */
  label: string;
  /** Short English noun phrase naming the object; used to match it across analyses. */
  concept: string;
  /** At least three points. */
  polygon: Point[];
  bbox: BoundingBox;
  /** null when the model does not provide a confidence. */
  score: number | null;
  /** Condition of the object, decided by the AI ("ok" when the case does not judge). */
  status: ComponentStatus;
  /** Why the AI gave that status (Spanish, one sentence); null when it gave none. */
  reason: string | null;
  /** Epoch milliseconds, used for "hace 3 s". */
  seenAt: number;
  /** True while Spark is still reviewing the name and the status of this part. */
  reviewing?: boolean;
};

export type StageState =
  "ready" | "no-permission" | "no-camera" | "loading-model" | "insecure";

export type CameraDevice = { id: string; label: string };

export type Diagnosis = {
  summary: string;
  severity: "low" | "medium" | "high";
  /** What to do, in order. */
  steps: string[];
  /**
   * Whether the close-up supports the condition the review reported. False when
   * it looks like dust, a shadow or too little detail to tell (HU-19).
   */
  confirmed?: boolean;
};

export type DiagnosisEntry =
  | { status: "loading" }
  | { status: "error" }
  /** No real diagnosis exists yet (the API is not wired): never fake one. */
  | { status: "unavailable" }
  | { status: "ready"; data: Diagnosis };

/** The general step-by-step of the scene, written by the AI once per scan. */
export type GeneralStepsEntry =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error" }
  | { status: "ready"; steps: string[] };

/** A saved moment of the scan. */
export type Capture = {
  id: string;
  /** Epoch milliseconds. */
  at: number;
  detections: Detection[];
  /** The image with the masks drawn on it. */
  imageDataUrl: string;
};

export type AnalysisState = {
  mode: "auto" | "manual";
  phase:
    | "idle"
    /** The local tracking is still downloading: the automatic mode starts after. */
    | "preparing"
    | "waiting"
    | "analyzing"
    | "paused"
    | "offline"
    | "quota"
    | "error";
  latencyMs: number | null;
  /**
   * A request to the models is in flight (manual or automatic). Unlike `phase`,
   * which also says "analyzing" while the automatic mode merely watches.
   */
  busy: boolean;
  startedAt: number | null;
  /** Why the last analysis failed (offline, quota or error phases), for the toast. */
  reason: string | null;
  /**
   * The detections no longer match the image (the camera moved) until the next
   * analysis arrives; the overlay dims them.
   */
  stale: boolean;
};
