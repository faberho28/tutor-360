import type { GrayFrame } from "./mask-tracker";

/** The tracker looks at a small picture: enough corners, cheap to follow. */
export const TRACK_WIDTH = 320;

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

/** The live video as a small grayscale frame, or null while it is not ready. */
export function sampleGray(video: HTMLVideoElement): GrayFrame | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  const width = TRACK_WIDTH;
  const height = Math.max(
    1,
    Math.round((width * video.videoHeight) / video.videoWidth),
  );
  if (!canvas) {
    canvas = document.createElement("canvas");
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!ctx) return null;
  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
  }
  ctx.drawImage(video, 0, 0, width, height);
  const rgba = ctx.getImageData(0, 0, width, height).data;
  const gray = new Uint8Array(width * height);
  for (let i = 0; i < gray.length; i++) {
    // Rec. 601 luma, integer math.
    gray[i] =
      (rgba[4 * i]! * 77 + rgba[4 * i + 1]! * 150 + rgba[4 * i + 2]! * 29) >> 8;
  }
  return { data: gray, width, height };
}
