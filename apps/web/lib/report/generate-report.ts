import type { SessionStore } from "../session/store";
import { buildReport, reportFileName, type ReportImage } from "./build-report";

async function measure(dataUrl: string): Promise<ReportImage> {
  const image = new Image();
  image.src = dataUrl;
  await image.decode();
  return { dataUrl, width: image.naturalWidth, height: image.naturalHeight };
}

/** Saves a blob through a temporary link; works on desktop and mobile browsers. */
function download(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Give the browser a moment to start the download before freeing the file.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

/**
 * Builds the PDF of the session in the browser (the pictures never leave the
 * device) and downloads it. Rejects when there are no captures or on any
 * failure; resolves without downloading when `signal` was aborted meanwhile.
 */
export async function generateReport(
  store: SessionStore,
  signal?: AbortSignal,
): Promise<void> {
  const {
    captures,
    diagnoses,
    reportIds,
    name,
    labCase,
    generalSteps,
    completedSteps,
    skippedSteps,
  } = store.getState();
  if (captures.length === 0) throw new Error("There are no captures");

  const images = await Promise.all(
    captures.map((c) => measure(c.imageDataUrl)),
  );
  const at = new Date();
  const blob = await buildReport({
    name,
    caseTitle: labCase?.title ?? null,
    at,
    captures,
    images,
    diagnoses,
    markedIds: reportIds,
    generalSteps: generalSteps.status === "ready" ? generalSteps.steps : null,
    completed: completedSteps,
    skipped: skippedSteps,
  });
  if (signal?.aborted) return;
  download(blob, reportFileName(name, at));
}
