import type { View } from "../tracking/view";
import type { Detection } from "../types";
import { coverTransform } from "./geometry";
import { drawOverlay } from "./draw";

/** Same 16:9 box the stage shows, so a capture crops like the live view. */
export const CAPTURE_SIZE = { width: 640, height: 360 } as const;

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`No se pudo cargar ${src}`));
    image.src = src;
  });
}

function createCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  return { canvas, ctx };
}

/**
 * The image with the masks on top, as a data URL. The image is cropped like
 * `object-cover` and the masks go through the same `drawOverlay` as the stage.
 */
export function composeCapture(
  image: HTMLImageElement | HTMLVideoElement,
  detections: readonly Detection[],
  /** Where the scene is now relative to the detections' frame (tracking). */
  view: View | null = null,
  size: { width: number; height: number } = CAPTURE_SIZE,
): string {
  const { width, height } = size;
  const source =
    image instanceof HTMLVideoElement
      ? { width: image.videoWidth, height: image.videoHeight }
      : { width: image.naturalWidth, height: image.naturalHeight };
  const base = createCanvas(width, height);
  const masks = createCanvas(width, height);

  const t = coverTransform(source.width, source.height, width, height);
  base.ctx.drawImage(
    image,
    t.offsetX,
    t.offsetY,
    source.width * t.scale,
    source.height * t.scale,
  );

  // drawOverlay clears its canvas first, so the masks go on their own canvas.
  drawOverlay(masks.ctx, {
    width,
    height,
    source,
    detections,
    selectedId: null,
    hoveredId: null,
    now: 0,
    reducedMotion: true,
    font: "500 12px sans-serif",
    view,
  });
  base.ctx.drawImage(masks.canvas, 0, 0);

  return base.canvas.toDataURL("image/jpeg", 0.85);
}
