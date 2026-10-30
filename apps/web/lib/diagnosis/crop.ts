import type { CapturedFrame } from "../camera/capture-frame";
import type { BoundingBox, Detection } from "../types";

/** The crop is brought to this range on its longest side. */
export const CROP_MIN_SIDE = 640;
export const CROP_MAX_SIDE = 1024;
/** Context around the part on each side, as a share of the part's own size. */
const MARGIN = 0.5;
/**
 * A crop never shows less than this share of the frame's shorter side: the
 * smaller the part, the more of its surroundings the model needs to tell what
 * it is looking at.
 */
const MIN_CONTEXT = 0.3;
/** Magenta: it appears nowhere on a board, a keyboard or a phone. */
const OUTLINE = "#FF00FF";

/**
 * The pixel rectangle to cut: the part with generous margin, at least
 * `MIN_CONTEXT` of the frame, moved (not clipped) to stay inside it.
 */
export function cropRect(
  bbox: BoundingBox,
  width: number,
  height: number,
): { x: number; y: number; w: number; h: number } {
  const minSide = Math.min(width, height) * MIN_CONTEXT;
  const w = Math.min(
    width,
    Math.max(bbox.w * width * (1 + 2 * MARGIN), minSide),
  );
  const h = Math.min(
    height,
    Math.max(bbox.h * height * (1 + 2 * MARGIN), minSide),
  );
  const cx = (bbox.x + bbox.w / 2) * width;
  const cy = (bbox.y + bbox.h / 2) * height;
  const x = Math.floor(Math.min(Math.max(cx - w / 2, 0), width - w));
  const y = Math.floor(Math.min(Math.max(cy - h / 2, 0), height - h));
  return {
    x,
    y,
    w: Math.max(1, Math.min(Math.round(w), width - x)),
    h: Math.max(1, Math.min(Math.round(h), height - y)),
  };
}

/** Output size: small crops are enlarged and big ones reduced, to the range. */
export function cropSize(w: number, h: number) {
  const longest = Math.max(w, h);
  const target = Math.min(CROP_MAX_SIDE, Math.max(CROP_MIN_SIDE, longest));
  const scale = target / longest;
  return {
    width: Math.max(1, Math.round(w * scale)),
    height: Math.max(1, Math.round(h * scale)),
  };
}

/**
 * The part with its surroundings, cut from the analyzed frame, with the part's
 * outline in magenta so the model knows what to diagnose and the rest is
 * context. Resolves to a JPEG data URL.
 */
export async function cropFrame(
  frame: CapturedFrame,
  part: Pick<Detection, "bbox" | "polygon">,
): Promise<string> {
  const image = new Image();
  image.src = frame.dataUrl;
  await image.decode();

  const rect = cropRect(part.bbox, frame.width, frame.height);
  const { width, height } = cropSize(rect.w, rect.h);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(image, rect.x, rect.y, rect.w, rect.h, 0, 0, width, height);

  // Outline only (no fill): the part's own detail must stay visible.
  const sx = width / rect.w;
  const sy = height / rect.h;
  ctx.lineWidth = Math.max(2, Math.round(Math.max(width, height) / 250));
  ctx.lineJoin = "round";
  ctx.strokeStyle = OUTLINE;
  ctx.beginPath();
  part.polygon.forEach(([nx, ny], i) => {
    const px = (nx * frame.width - rect.x) * sx;
    const py = (ny * frame.height - rect.y) * sy;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  });
  ctx.closePath();
  ctx.stroke();
  return canvas.toDataURL("image/jpeg", 0.9);
}
