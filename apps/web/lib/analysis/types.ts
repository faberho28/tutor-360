import type { ModelErrorKind } from "../models/errors";
import type { Detection } from "../types";
import type { PlannedPart } from "./scene";

/** What the server needs to know about the frame it analyzes. */
export type AnalyzeFrameInput = {
  imageDataUrl: string;
  width: number;
  height: number;
};

/** Body of a 200 response from `POST /api/analyze`. */
export type AnalyzeResponse = {
  /** Coordinates are normalized (0..1) over the frame that was sent. */
  components: Detection[];
  /**
   * The parts Spark planned for this scene. Send it back with the next frame of
   * the same scene to skip Spark; empty when Spark found nothing to look for.
   */
  plan: PlannedPart[];
  /** Epoch milliseconds. */
  timestamp: number;
  /** Server time spent analyzing, not the full round trip. */
  latencyMs: number;
};

export type AnalyzeErrorKind = ModelErrorKind | "invalid_input";

export type AnalyzeErrorResponse = {
  error: { kind: AnalyzeErrorKind; message: string };
};
