import type { Detection } from "../types";
import { bboxIou } from "./iou";

/** Same class and at least this much overlap: it is the same component. */
export const TRACK_IOU = 0.5;

/**
 * Gives the new detections the ids of the previous ones they match, so the
 * selection, the diagnosis and the steps survive a new analysis. SAM numbers
 * its objects per call, so its own ids mean nothing across analyses. Pieces
 * that no longer show up are not carried over: every analysis is a full
 * picture of the frame.
 */
export function trackDetections(
  previous: readonly Detection[],
  incoming: readonly Detection[],
  newId: (cls: Detection["cls"]) => string,
): Detection[] {
  const pairs: { prev: number; next: number; iou: number }[] = [];
  incoming.forEach((next, nextIndex) => {
    previous.forEach((prev, prevIndex) => {
      if (prev.cls !== next.cls) return;
      const iou = bboxIou(prev.bbox, next.bbox);
      if (iou >= TRACK_IOU)
        pairs.push({ prev: prevIndex, next: nextIndex, iou });
    });
  });
  pairs.sort((a, b) => b.iou - a.iou);

  const idFor = new Map<number, string>();
  const taken = new Set<number>();
  for (const pair of pairs) {
    if (idFor.has(pair.next) || taken.has(pair.prev)) continue;
    const prev = previous[pair.prev];
    if (!prev) continue;
    idFor.set(pair.next, prev.id);
    taken.add(pair.prev);
  }

  return incoming.map((detection, index) => ({
    ...detection,
    id: idFor.get(index) ?? newId(detection.cls),
  }));
}
