import type { GuideEntry } from "../types";

const NONE: readonly string[] = [];

/**
 * The part the current step is about, for the overlay to highlight: its id, or
 * nothing when the step is not about one part, the guide is not running or it
 * is finished.
 */
export function guideTargets(guide: GuideEntry): readonly string[] {
  if (guide.status !== "ready") return NONE;
  const target = guide.steps[guide.current]?.target;
  return target ? [target] : NONE;
}

/** Splits "Retira el módulo: así revisas sus contactos" into the action and its reason. */
export function splitStep(text: string): { action: string; reason: string } {
  const at = text.indexOf(":");
  if (at < 0) return { action: text.trim(), reason: "" };
  return {
    action: text.slice(0, at).trim(),
    reason: text.slice(at + 1).trim(),
  };
}
