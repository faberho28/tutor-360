/** Longest side sent to the model; keeps the upload light on slow networks. */
export const FRAME_MAX_SIDE = 1280;
const FRAME_QUALITY = 0.8;

export type CapturedFrame = {
  /** `data:image/jpeg;base64,...` */
  dataUrl: string;
  /** Size in pixels of the encoded image: the API reports masks in this space. */
  width: number;
  height: number;
};

/** Scales down to fit `maxSide`; never scales up. */
export function fitWithin(width: number, height: number, maxSide: number) {
  const scale = Math.min(1, maxSide / Math.max(width, height));
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

/** The video when it has a decoded frame to read, else null. */
export function readyVideo(
  video: HTMLVideoElement | null,
): HTMLVideoElement | null {
  return video && video.readyState >= 2 && video.videoWidth > 0 ? video : null;
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) =>
        blob
          ? resolve(blob)
          : reject(new Error("No se pudo codificar el frame")),
      "image/jpeg",
      FRAME_QUALITY,
    );
  });
}

function toDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error ?? new Error("Lectura fallida"));
    reader.readAsDataURL(blob);
  });
}

/**
 * The whole frame, with no crop and no masks: the model's coordinates refer to
 * the full image and the overlay applies the `object-cover` crop afterwards.
 * Encoding goes through `toBlob`, which compresses off the main thread, so the
 * live video does not stutter.
 */
export async function captureFrame(
  source: HTMLVideoElement | HTMLImageElement,
): Promise<CapturedFrame> {
  const natural =
    source instanceof HTMLVideoElement
      ? { width: source.videoWidth, height: source.videoHeight }
      : { width: source.naturalWidth, height: source.naturalHeight };
  if (natural.width === 0 || natural.height === 0) {
    throw new Error("El frame aún no está listo");
  }

  const { width, height } = fitWithin(
    natural.width,
    natural.height,
    FRAME_MAX_SIDE,
  );
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D no disponible");
  ctx.drawImage(source, 0, 0, width, height);

  return { dataUrl: await toDataUrl(await toBlob(canvas)), width, height };
}
