import type { CapturedFrame } from "../camera/capture-frame";
import { loadImage } from "../overlay/compose-capture";
import type { Detection } from "../types";

/** Magenta: it appears nowhere on a board, a keyboard or a phone. */
const OUTLINE = "#FF00FF";

/**
 * The analyzed frame with every part outlined and numbered (the n-th part of
 * `parts` is marked n), as a JPEG data URL. The tutor is told the numbers, so it
 * can say which outlined part a step is about instead of guessing from a name.
 */
export async function markFrame(
  frame: CapturedFrame,
  parts: readonly Pick<Detection, "polygon">[],
): Promise<string> {
  const image = await loadImage(frame.dataUrl);
  const canvas = document.createElement("canvas");
  canvas.width = frame.width;
  canvas.height = frame.height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas is not available");
  ctx.drawImage(image, 0, 0, frame.width, frame.height);

  const line = Math.max(
    2,
    Math.round(Math.max(frame.width, frame.height) / 500),
  );
  const fontSize = Math.max(14, Math.round(frame.height / 34));
  ctx.lineJoin = "round";
  ctx.lineWidth = line;
  ctx.strokeStyle = OUTLINE;
  ctx.font = `700 ${fontSize}px sans-serif`;
  ctx.textBaseline = "middle";

  parts.forEach((part, index) => {
    if (part.polygon.length < 3) return;
    const points = part.polygon.map(
      ([x, y]) => [x * frame.width, y * frame.height] as const,
    );
    ctx.beginPath();
    points.forEach(([x, y], i) =>
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
    );
    ctx.closePath();
    ctx.stroke();

    // The number sits on the top-left corner of the part's box.
    const left = Math.min(...points.map(([x]) => x));
    const top = Math.min(...points.map(([, y]) => y));
    const text = String(index + 1);
    const w = ctx.measureText(text).width + fontSize * 0.5;
    const h = fontSize * 1.2;
    const x = Math.min(Math.max(left, 0), frame.width - w);
    const y = Math.min(Math.max(top - h, 0), frame.height - h);
    ctx.fillStyle = OUTLINE;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(text, x + fontSize * 0.25, y + h / 2);
  });

  return canvas.toDataURL("image/jpeg", 0.88);
}
