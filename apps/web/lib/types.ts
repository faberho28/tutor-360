import type { ComponentClass, ComponentStatus } from "./component-status";

/** Normalized coordinates (0..1) over the analyzed image. */
export type Point = [number, number];

export type BoundingBox = { x: number; y: number; w: number; h: number };

export type Detection = {
  /** Stable while the component stays visible. */
  id: string;
  cls: ComponentClass;
  /** At least three points. */
  polygon: Point[];
  bbox: BoundingBox;
  /** null when the model does not provide a confidence. */
  score: number | null;
  /** Always equal to STATUS_BY_CLASS[cls]. */
  status: ComponentStatus;
  /** Epoch milliseconds, used for "hace 3 s". */
  seenAt: number;
};

export type StageState =
  "ready" | "no-permission" | "no-camera" | "loading-model";

/** A saved moment of the scan. HU-09 adds the composed image. */
export type Capture = {
  id: string;
  /** Epoch milliseconds. */
  at: number;
  detections: Detection[];
};

export type AnalysisState = {
  mode: "auto" | "manual";
  phase: "idle" | "analyzing" | "paused" | "offline" | "quota" | "error";
  latencyMs: number | null;
  startedAt: number | null;
};
