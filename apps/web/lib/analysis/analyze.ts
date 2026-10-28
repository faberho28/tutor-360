import {
  statusOf,
  type ComponentClass,
  type ComponentStatus,
} from "../component-status";
import { CONCEPT_BY_CLASS } from "../models/concepts";
import {
  ModelError,
  toModelError,
  type ModelErrorKind,
} from "../models/errors";
import type { Segmenter } from "../models/segmenter";
import type { Detection } from "../types";
import { bboxIou } from "./iou";
import type { AnalyzeResponse } from "./types";

/** Two detections of different classes this close are the same physical thing. */
const CROSS_CLASS_IOU = 0.6;

const SEVERITY: Record<ComponentStatus, number> = {
  anomaly: 2,
  warning: 1,
  ok: 0,
};

/** When every class fails, report the cause that matters most to the user. */
const ERROR_PRIORITY: ModelErrorKind[] = [
  "not_configured",
  "auth",
  "quota",
  "timeout",
  "network",
  "invalid_response",
  "refused",
  "aborted",
  "unknown",
];

export type AnalyzeFrameInput = {
  imageDataUrl: string;
  width: number;
  height: number;
};

export type AnalyzeOptions = {
  segmenter: Segmenter;
  classes: readonly ComponentClass[];
  /** Detections below this confidence are dropped; ignored when `score` is null. */
  threshold: number;
  signal?: AbortSignal;
};

function mostSevere(errors: ModelError[]): ModelError {
  const ranked = [...errors].sort(
    (a, b) => ERROR_PRIORITY.indexOf(a.kind) - ERROR_PRIORITY.indexOf(b.kind),
  );
  return ranked[0] ?? new ModelError("unknown", "No class could be analyzed");
}

/**
 * "capacitor" and "swollen capacitor" are separate prompts and can both return
 * the same part. Keep the most serious reading, then the most confident one.
 */
function dedupeAcrossClasses(detections: Detection[]): Detection[] {
  const ranked = [...detections].sort(
    (a, b) =>
      SEVERITY[b.status] - SEVERITY[a.status] ||
      (b.score ?? 0) - (a.score ?? 0),
  );
  const kept: Detection[] = [];
  for (const candidate of ranked) {
    const duplicate = kept.some(
      (other) =>
        other.cls !== candidate.cls &&
        bboxIou(other.bbox, candidate.bbox) >= CROSS_CLASS_IOU,
    );
    if (!duplicate) kept.push(candidate);
  }
  return kept;
}

/**
 * One SAM call per class, in parallel, then filter and merge. Throws a
 * ModelError only when every class failed; partial failures are reported in
 * `failedClasses` so the screen can still show what did work.
 */
export async function analyzeFrame(
  frame: AnalyzeFrameInput,
  options: AnalyzeOptions,
): Promise<AnalyzeResponse> {
  const startedAt = Date.now();
  const { segmenter, classes, threshold, signal } = options;

  const settled = await Promise.allSettled(
    classes.map((cls) =>
      segmenter.segment({
        imageDataUrl: frame.imageDataUrl,
        frameWidth: frame.width,
        frameHeight: frame.height,
        concept: CONCEPT_BY_CLASS[cls],
        signal,
      }),
    ),
  );

  const detections: Detection[] = [];
  const failedClasses: ComponentClass[] = [];
  const errors: ModelError[] = [];

  settled.forEach((result, index) => {
    const cls = classes[index];
    if (!cls) return;
    if (result.status === "rejected") {
      failedClasses.push(cls);
      errors.push(toModelError(result.reason));
      return;
    }
    for (const instance of result.value) {
      if (instance.score !== null && instance.score < threshold) continue;
      detections.push({
        id: `${cls}-${instance.objectId}`,
        cls,
        polygon: instance.polygon,
        bbox: instance.bbox,
        score: instance.score,
        status: statusOf(cls),
        seenAt: startedAt,
      });
    }
  });

  if (classes.length > 0 && failedClasses.length === classes.length) {
    throw mostSevere(errors);
  }

  return {
    components: dedupeAcrossClasses(detections),
    timestamp: Date.now(),
    latencyMs: Date.now() - startedAt,
    failedClasses,
  };
}
