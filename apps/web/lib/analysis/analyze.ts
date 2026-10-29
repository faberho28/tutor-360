import type { ScenePlanner } from "../models/planner";
import type { Segmenter } from "../models/segmenter";
import type { Detection } from "../types";
import type { AnalyzeResponse } from "./types";

export type AnalyzeFrameInput = {
  imageDataUrl: string;
  width: number;
  height: number;
};

export type AnalyzeOptions = {
  planner: ScenePlanner;
  segmenter: Segmenter;
  /** The Laboratorio case context for the planner. */
  context?: string;
  /** False for inventory cases: everything is reported as ok. */
  judgesCondition: boolean;
  /** The user's own model API key; when absent the server's is used. */
  apiKey?: string;
  /** Detections below this confidence are dropped; ignored when `score` is null. */
  threshold: number;
  signal?: AbortSignal;
};

/**
 * Muse Spark names and locates what is in the frame, then SAM draws a mask
 * inside each box. An object SAM returns no mask for is dropped: there is
 * nothing to draw. Throws a ModelError when either call fails.
 */
export async function analyzeFrame(
  frame: AnalyzeFrameInput,
  options: AnalyzeOptions,
): Promise<AnalyzeResponse> {
  const startedAt = Date.now();
  const { planner, segmenter, threshold, signal } = options;

  const objects = await planner.plan({
    imageDataUrl: frame.imageDataUrl,
    context: options.context,
    judgesCondition: options.judgesCondition,
    apiKey: options.apiKey,
    signal,
  });

  const instances = await segmenter.segment({
    imageDataUrl: frame.imageDataUrl,
    frameWidth: frame.width,
    frameHeight: frame.height,
    objects: objects.map((object, id) => ({ id, box: object.box })),
    apiKey: options.apiKey,
    signal,
  });

  const detections: Detection[] = [];
  const taken = new Set<string>();
  for (const instance of instances) {
    const object = objects[Number(instance.objectId)];
    // One mask per object: the first one SAM reports for that box wins.
    if (!object || taken.has(instance.objectId)) continue;
    if (instance.score !== null && instance.score < threshold) continue;
    taken.add(instance.objectId);
    detections.push({
      id: `object-${instance.objectId}`,
      label: object.label,
      concept: object.concept,
      polygon: instance.polygon,
      bbox: instance.bbox,
      score: instance.score,
      status: object.status,
      reason: object.reason || null,
      seenAt: startedAt,
    });
  }

  return {
    components: detections,
    timestamp: Date.now(),
    latencyMs: Date.now() - startedAt,
  };
}
