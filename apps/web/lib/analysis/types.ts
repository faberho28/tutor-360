import type { ComponentClass } from "../component-status";
import type { ModelErrorKind } from "../models/errors";
import type { Detection } from "../types";

/** Body of a 200 response from `POST /api/analyze`. */
export type AnalyzeResponse = {
  /** Coordinates are normalized (0..1) over the frame that was sent. */
  components: Detection[];
  /** Epoch milliseconds. */
  timestamp: number;
  /** Server time spent analyzing, not the full round trip. */
  latencyMs: number;
  /** Classes whose call failed while others succeeded (partial result). */
  failedClasses: ComponentClass[];
};

export type AnalyzeErrorKind = ModelErrorKind | "invalid_input";

export type AnalyzeErrorResponse = {
  error: { kind: AnalyzeErrorKind; message: string };
};
