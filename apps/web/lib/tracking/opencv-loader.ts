import type * as OpenCvTypes from "@techstark/opencv-js";

/** The OpenCV.js namespace (the package types export no default). */
export type OpenCv = typeof OpenCvTypes;

const SCRIPT_URL = "/opencv/opencv.js";
const MANIFEST_URL = "/opencv/manifest.json";
/** Compiling the embedded WebAssembly can take a few seconds on a slow phone. */
const INIT_TIMEOUT_MS = 30_000;

export type OpenCvState =
  | { status: "idle" }
  /** `progress` is 0..1 of the download (0 while the size is unknown). */
  | { status: "loading"; progress: number }
  | { status: "ready" }
  | { status: "error"; message: string };

let state: OpenCvState = { status: "idle" };
let cv: OpenCv | null = null;
let loading: Promise<OpenCv> | null = null;
const listeners = new Set<() => void>();

function publish(next: OpenCvState) {
  state = next;
  listeners.forEach((listener) => listener());
}

/** For `useSyncExternalStore`. */
export function subscribeOpenCv(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOpenCvState(): OpenCvState {
  return state;
}

/** The loaded library, or null while it is not ready. */
export function getOpenCv(): OpenCv | null {
  return cv;
}

/** The decoded size of the build, written by `scripts/copy-opencv.mjs`. */
async function expectedBytes(): Promise<number> {
  try {
    const response = await fetch(MANIFEST_URL);
    const manifest = (await response.json()) as { bytes?: unknown };
    return typeof manifest.bytes === "number" ? manifest.bytes : 0;
  } catch {
    return 0;
  }
}

/** Streams the file so the screen can show a real progress. */
async function download(total: number): Promise<Blob> {
  const response = await fetch(SCRIPT_URL);
  if (!response.ok || !response.body) {
    throw new Error(`OpenCV no está disponible (${response.status})`);
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let received = 0;
  let shown = -1;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value as Uint8Array<ArrayBuffer>);
    received += value.byteLength;
    // One update per percent: a re-render per network chunk would be noise.
    const progress = total > 0 ? Math.min(1, received / total) : 0;
    const step = Math.floor(progress * 100);
    if (step !== shown) {
      shown = step;
      publish({ status: "loading", progress });
    }
  }
  return new Blob(chunks, { type: "text/javascript" });
}

/** Runs the build and waits for its WebAssembly runtime to be ready. */
async function start(source: Blob): Promise<OpenCv> {
  const url = URL.createObjectURL(source);
  try {
    await new Promise<void>((resolve, reject) => {
      const script = document.createElement("script");
      script.src = url;
      script.onload = () => resolve();
      script.onerror = () => reject(new Error("No se pudo iniciar OpenCV"));
      document.head.appendChild(script);
    });
  } finally {
    URL.revokeObjectURL(url);
  }

  // Depending on the build, `cv` is a promise, a ready module or a module that
  // announces its runtime with a callback.
  const loaded = (window as unknown as { cv?: unknown }).cv;
  if (!loaded) throw new Error("OpenCV no quedó disponible");
  if (loaded instanceof Promise) {
    return within(
      loaded as Promise<OpenCv>,
      "OpenCV tardó demasiado en iniciar",
    );
  }
  const runtime = loaded as OpenCv & { onRuntimeInitialized?: () => void };
  if (runtime.Mat) return runtime;
  await within(
    new Promise<void>((resolve) => {
      runtime.onRuntimeInitialized = () => resolve();
    }),
    "OpenCV tardó demasiado en iniciar",
  );
  return runtime;
}

/** Rejects if `work` takes longer than the start-up limit: never hang silently. */
function within<T>(work: Promise<T>, message: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = window.setTimeout(
      () => reject(new Error(message)),
      INIT_TIMEOUT_MS,
    );
    work.then(
      (value) => {
        window.clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        window.clearTimeout(timer);
        reject(error);
      },
    );
  });
}

/**
 * Downloads and starts OpenCV.js once per page; later calls share the same
 * work. Progress and failures go through `getOpenCvState`.
 */
export function loadOpenCv(): Promise<OpenCv> {
  if (cv) return Promise.resolve(cv);
  if (loading) return loading;
  publish({ status: "loading", progress: 0 });
  loading = (async () => {
    const total = await expectedBytes();
    const library = await start(await download(total));
    cv = library;
    publish({ status: "ready" });
    return library;
  })().catch((error: unknown) => {
    // A failed attempt can be retried by the next call.
    loading = null;
    publish({
      status: "error",
      message:
        error instanceof Error ? error.message : "No se pudo cargar OpenCV",
    });
    throw error;
  });
  return loading;
}
