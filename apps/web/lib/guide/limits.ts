import type { Detection } from "../types";

/**
 * Parts the tutor is told about at most. A keyboard gives 60 to 80 masks and a
 * crowded board more: past this the picture is a wall of numbers.
 */
export const MAX_GUIDE_PARTS = 80;

/** The biggest parts when there are too many, keeping the order they came in. */
export function guideParts<T extends Pick<Detection, "bbox">>(
  detections: readonly T[],
): T[] {
  if (detections.length <= MAX_GUIDE_PARTS) return [...detections];
  const biggest = new Set(
    [...detections]
      .sort((a, b) => b.bbox.w * b.bbox.h - a.bbox.w * a.bbox.h)
      .slice(0, MAX_GUIDE_PARTS),
  );
  return detections.filter((d) => biggest.has(d));
}
