import type { BoundingBox } from "../types";

/** Intersection over union of two boxes, 0 when they do not touch. */
export function bboxIou(a: BoundingBox, b: BoundingBox): number {
  const overlapW = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const overlapH = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  if (overlapW <= 0 || overlapH <= 0) return 0;
  const intersection = overlapW * overlapH;
  const union = a.w * a.h + b.w * b.h - intersection;
  return union > 0 ? intersection / union : 0;
}
