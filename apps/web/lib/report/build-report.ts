import type { Capture, Detection, DiagnosisEntry } from "../types";

export type ReportImage = { dataUrl: string; width: number; height: number };

export type ReportInput = {
  /** Name of the session, as the user typed it. */
  name: string;
  /** Name of the Lab case being scanned, when there is one. */
  caseTitle: string | null;
  at: Date;
  captures: readonly Capture[];
  /** One entry per capture, same order: the capture's picture with its size. */
  images: readonly ReportImage[];
  diagnoses: Readonly<Record<string, DiagnosisEntry>>;
  /** Detections the user marked "add to the report". */
  markedIds: readonly string[];
  /** Step indexes marked done / skipped, per detection id. */
  completed: Readonly<Record<string, readonly number[]>>;
  skipped: Readonly<Record<string, readonly number[]>>;
};

/** "[x]" done, "[-]" skipped, "[ ]" still to do. */
export function stepMark(
  index: number,
  done: readonly number[] = [],
  skipped: readonly number[] = [],
): string {
  if (done.includes(index)) return "[x]";
  if (skipped.includes(index)) return "[-]";
  return "[ ]";
}

/** "Steps done: 2 of 4 (1 skipped)". */
export function stepsSummary(
  total: number,
  done: readonly number[] = [],
  skipped: readonly number[] = [],
): string {
  const made = new Set(done.filter((i) => i < total)).size;
  const left = new Set(skipped.filter((i) => i < total && !done.includes(i)))
    .size;
  return `Steps done: ${made} of ${total}${left > 0 ? ` (${left} skipped)` : ""}`;
}

const PAGE = { w: 210, h: 297, margin: 15 } as const;
const CONTENT_W = PAGE.w - PAGE.margin * 2;
const MAX_IMAGE_H = 105;

const STATUS_TEXT = {
  ok: "Normal",
  warning: "To check",
  anomaly: "Anomaly",
};
const SEVERITY_TEXT = { low: "Low", medium: "Medium", high: "High" };

/** The PDF's standard fonts cover Latin-1: swap what they cannot draw. */
export function latin1(text: string): string {
  return text
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[–—]/g, "-")
    .replace(/…/g, "...")
    .replace(/[^\u0000-ÿ]/gu, "?");
}

/** A name safe for a file: lowercase, no accents, dashes for anything else. */
export function fileSlug(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return slug || "session";
}

export function reportFileName(name: string, at: Date): string {
  const day = [
    at.getFullYear(),
    String(at.getMonth() + 1).padStart(2, "0"),
    String(at.getDate()).padStart(2, "0"),
  ].join("-");
  return `report-${fileSlug(name)}-${day}.pdf`;
}

function countBy(captures: readonly Capture[], status: Detection["status"]) {
  return captures.reduce(
    (sum, c) => sum + c.detections.filter((d) => d.status === status).length,
    0,
  );
}

/** Lays the session out on A4 pages and returns the PDF. */
export async function buildReport(input: ReportInput): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  let y = PAGE.margin;

  const ensure = (height: number) => {
    if (y + height <= PAGE.h - PAGE.margin) return;
    doc.addPage();
    y = PAGE.margin;
  };

  const write = (
    text: string,
    options: {
      size?: number;
      bold?: boolean;
      gap?: number;
      indent?: number;
    } = {},
  ) => {
    const { size = 10, bold = false, gap = 1.5, indent = 0 } = options;
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    const lines: string[] = doc.splitTextToSize(
      latin1(text),
      CONTENT_W - indent,
    );
    const lineH = size * 0.45;
    for (const line of lines) {
      ensure(lineH);
      doc.text(line, PAGE.margin + indent, y + size * 0.35);
      y += lineH;
    }
    y += gap;
  };

  // Cover block.
  write("Tutor AI 360 - Session report", { size: 18, bold: true, gap: 3 });
  write(`Session: ${input.name}`, { size: 11 });
  if (input.caseTitle) write(`Case: ${input.caseTitle}`, { size: 11 });
  write(
    `Date: ${input.at.toLocaleString("en-US", { dateStyle: "long", timeStyle: "short" })}`,
    { size: 11, gap: 4 },
  );

  const anomalies = countBy(input.captures, "anomaly");
  const warnings = countBy(input.captures, "warning");
  write(
    `Captures: ${input.captures.length}    Anomalies: ${anomalies}    To check: ${warnings}`,
    { size: 11, bold: true, gap: 2 },
  );
  if (anomalies + warnings === 0) {
    write("No anomalies or parts to check were detected in this session.", {
      gap: 4,
    });
  }

  // One block per capture.
  input.captures.forEach((capture, index) => {
    const image = input.images[index];
    let w = CONTENT_W;
    let h = 0;
    if (image) {
      const ratio = image.width / image.height;
      h = w / ratio;
      if (h > MAX_IMAGE_H) {
        h = MAX_IMAGE_H;
        w = h * ratio;
      }
    }
    // The title and its picture go on the same page.
    ensure(12 + h);
    y += 3;
    write(
      `Capture ${index + 1} - ${new Date(capture.at).toLocaleTimeString("en-US", { timeStyle: "short" })}`,
      { size: 13, bold: true, gap: 2 },
    );

    if (image) {
      ensure(h + 2);
      doc.addImage(image.dataUrl, "JPEG", PAGE.margin, y, w, h);
      y += h + 3;
    }

    if (capture.detections.length === 0) {
      write("No parts were detected in this capture.", { gap: 3 });
      return;
    }
    for (const d of capture.detections) {
      const score = d.score === null ? "" : ` (${Math.round(d.score * 100)} %)`;
      const marked = input.markedIds.includes(d.id) ? " [in the report]" : "";
      write(`- ${d.label}: ${STATUS_TEXT[d.status]}${score}${marked}`, {
        bold: d.status !== "ok",
        gap: d.reason ? 0 : 0.8,
      });
      if (d.reason) write(d.reason, { size: 9, indent: 4, gap: 1 });
    }
  });

  // Diagnoses, once per part, at the end.
  const seen = new Set<string>();
  const diagnosed = input.captures
    .flatMap((c) => c.detections)
    .filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return input.diagnoses[d.id]?.status === "ready";
    });
  if (diagnosed.length > 0) {
    ensure(20);
    y += 4;
    write("Diagnoses", { size: 14, bold: true, gap: 2 });
    for (const d of diagnosed) {
      const entry = input.diagnoses[d.id];
      if (entry?.status !== "ready") continue;
      ensure(24);
      write(`${d.label} - severity ${SEVERITY_TEXT[entry.data.severity]}`, {
        size: 11,
        bold: true,
        gap: 1,
      });
      write(entry.data.summary, { gap: 1.5 });
      if (entry.data.confirmed === false) {
        write("The AI could not confirm this finding from the crop.", {
          size: 9,
          gap: 1.5,
        });
      }
      const done = input.completed[d.id];
      const skipped = input.skipped[d.id];
      write(stepsSummary(entry.data.steps.length, done, skipped), {
        size: 9,
        gap: 1,
      });
      entry.data.steps.forEach((step, i) => {
        write(`${stepMark(i, done, skipped)} ${i + 1}. ${step}`, {
          indent: 4,
          gap: 0.8,
        });
      });
      y += 3;
    }
  }

  return doc.output("blob");
}
