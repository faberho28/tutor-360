import type { Diagnosis } from "../types";

/** What the voice reads: the summary, then the steps in order. */
export function speechText(diagnosis: Diagnosis): string {
  const end = (text: string) => (/[.!?]$/.test(text) ? text : `${text}.`);
  const steps = diagnosis.steps
    .map((step, i) => `Paso ${i + 1}. ${end(step.trim())}`)
    .join(" ");
  return `${end(diagnosis.summary.trim())} ${steps}`.trim();
}
