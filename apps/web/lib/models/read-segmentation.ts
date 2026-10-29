import {
  parseImageStream,
  recordsOfKind,
  type ResponseStreamOutcome,
  type SegmentationDiagnostic,
  type SegmentationRecord,
} from "@meta-sam/parser";
import type { BoundingBox, Point } from "../types";
import { ModelError, toModelError } from "./errors";
import { maskToShape, type FrameSize } from "./mask-polygon";

export type SegmentedInstance = {
  /** Ordinal within one response; it restarts on every call. */
  objectId: string;
  /** The model's confidence (0..1), or null when the API did not send `c`. */
  score: number | null;
  /** Normalized 0..1 over the analyzed frame. */
  polygon: Point[];
  bbox: BoundingBox;
};

export type SegmentationReading = {
  instances: SegmentedInstance[];
  /** Lines the parser could not use; kept so callers can log them. */
  diagnostics: readonly SegmentationDiagnostic[];
  /** What the parser understood, untouched; the lab writes it down. */
  records: readonly SegmentationRecord[];
  outcome: ResponseStreamOutcome;
};

/** Reads a SAM response stream (real or simulated) into normalized instances. */
export async function readSegmentation(
  events: AsyncIterable<{ readonly type: string }>,
  frame: FrameSize,
): Promise<SegmentationReading> {
  let result;
  try {
    result = await parseImageStream(events).finalResult;
  } catch (error) {
    throw toModelError(error);
  }

  if (result.outcome.status !== "completed") {
    const detail = result.outcome.detail ? `: ${result.outcome.detail}` : "";
    throw new ModelError(
      "invalid_response",
      `The segmentation stream ended early (${result.outcome.reason})${detail}`,
    );
  }

  const boxes = new Map(
    recordsOfKind(result.records, "box").map((box) => [box.objectId, box]),
  );

  const instances: SegmentedInstance[] = [];
  for (const record of recordsOfKind(result.records, "mask")) {
    const shape = maskToShape(record, frame);
    if (!shape) continue;
    instances.push({
      objectId: record.objectId,
      score:
        record.confidence ?? boxes.get(record.objectId)?.confidence ?? null,
      ...shape,
    });
  }
  return {
    instances,
    diagnostics: result.diagnostics,
    records: result.records,
    outcome: result.outcome,
  };
}
