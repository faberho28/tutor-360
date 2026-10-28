import {
  SIG_HEIGHT,
  SIG_WIDTH,
  toSignature,
  type Signature,
} from "./signature";

let canvas: HTMLCanvasElement | null = null;
let ctx: CanvasRenderingContext2D | null = null;

/** Downscales the whole video frame to a signature, or null if not ready. */
export function sampleVideo(video: HTMLVideoElement): Signature | null {
  if (video.readyState < 2 || video.videoWidth === 0) return null;
  if (!canvas) {
    canvas = document.createElement("canvas");
    canvas.width = SIG_WIDTH;
    canvas.height = SIG_HEIGHT;
    ctx = canvas.getContext("2d", { willReadFrequently: true });
  }
  if (!ctx) return null;
  ctx.drawImage(video, 0, 0, SIG_WIDTH, SIG_HEIGHT);
  return toSignature(ctx.getImageData(0, 0, SIG_WIDTH, SIG_HEIGHT).data);
}
