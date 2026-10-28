import type { BoundingBox } from "../types";

export type CropRect = { x: number; y: number; side: number };

/**
 * Square region of the source, in source pixels, centered on a normalized
 * bbox with some context around it. Used for list thumbnails.
 */
export function cropRect(
  bbox: BoundingBox,
  source: { width: number; height: number },
  context = 2.4,
  minSide = 64,
): CropRect {
  const maxSide = Math.min(source.width, source.height);
  const side = Math.min(
    maxSide,
    Math.max(
      minSide,
      Math.max(bbox.w * source.width, bbox.h * source.height) * context,
    ),
  );
  const cx = (bbox.x + bbox.w / 2) * source.width;
  const cy = (bbox.y + bbox.h / 2) * source.height;
  return {
    side,
    x: Math.min(Math.max(cx - side / 2, 0), source.width - side),
    y: Math.min(Math.max(cy - side / 2, 0), source.height - side),
  };
}
