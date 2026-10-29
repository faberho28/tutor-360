import type { CapturedFrame } from "../camera/capture-frame";
import type { Detection } from "../types";

/** Magenta: it appears nowhere on a board, a keyboard or a phone. */
const OUTLINE = "#FF00FF";

/**
 * A copy of the frame with only these masks outlined, for Spark to look at.
 * The person never sees it. Resolves to a JPEG data URL the size of the frame.
 */
export async function outlineMasks(
  frame: CapturedFrame,
  detections: readonly Detection[],
): Promise<string> {
  const image = new Image();
  image.src = frame.dataUrl;
  await image.decode();

  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(image, 0, 0, frame.width, frame.height);

  // Thick enough to read on a 1280 px frame, thin enough not to hide a small part.
  ctx.lineWidth = Math.max(
    2,
    Math.round(Math.max(frame.width, frame.height) / 400),
  );
  ctx.lineJoin = "round";
  ctx.strokeStyle = OUTLINE;
  ctx.fillStyle = "rgba(255, 0, 255, 0.18)";
  for (const detection of detections) {
    ctx.beginPath();
    detection.polygon.forEach(([x, y], i) => {
      const px = x * frame.width;
      const py = y * frame.height;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
  }
  return canvas.toDataURL("image/jpeg", 0.85);
}
