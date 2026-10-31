import type { CapturedFrame } from "../camera/capture-frame";
import { loadImage } from "../overlay/compose-capture";

/** Each half is scaled to this width: both together stay a light upload. */
const HALF_WIDTH = 1000;

/**
 * The picture from before and the one from now side by side (before on the
 * left), as a JPEG data URL, so one image carries the whole comparison.
 */
export async function composeBeforeAfter(
  before: CapturedFrame,
  after: CapturedFrame,
): Promise<string> {
  const [left, right] = await Promise.all([
    loadImage(before.dataUrl),
    loadImage(after.dataUrl),
  ]);
  const width = Math.min(HALF_WIDTH, before.width);
  const height = Math.round((width * before.height) / before.width);
  const canvas = document.createElement("canvas");
  canvas.width = width * 2;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(left, 0, 0, width, height);
  ctx.drawImage(right, width, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.85);
}
