export const GENERAL_STEPS_KEY = "general";

/** Shown when nothing needs fixing yet or no component is selected. */
export const GENERAL_STEPS: readonly string[] = [
  "Apaga la PC y desconéctala de la corriente.",
  "Descarga la electricidad estática tocando una parte metálica del chasis.",
  "Retira la tapa lateral con cuidado.",
  "Revisa a simple vista: capacitores abultados, polvo y cables sueltos.",
  "Apunta la cámara a cada zona para identificar los componentes.",
];

export type StepStatus = "done" | "skipped" | "pending";

export function stepStatus(
  index: number,
  done: readonly number[],
  skipped: readonly number[],
): StepStatus {
  if (done.includes(index)) return "done";
  if (skipped.includes(index)) return "skipped";
  return "pending";
}

/** First step that is neither done nor skipped, or null when all are handled. */
export function currentStepIndex(
  total: number,
  done: readonly number[],
  skipped: readonly number[],
): number | null {
  for (let i = 0; i < total; i++) {
    if (stepStatus(i, done, skipped) === "pending") return i;
  }
  return null;
}

/** Percentage of steps already handled (done or skipped). */
export function stepProgress(
  total: number,
  done: readonly number[],
  skipped: readonly number[],
): number {
  if (total === 0) return 0;
  const handled = new Set([...done, ...skipped]);
  return Math.round((Math.min(handled.size, total) / total) * 100);
}
