/** A part as the tutor is told about it: only its condition. */
export type PartForPrompt = {
  status: "ok" | "warning" | "anomaly";
};

/**
 * One line per part, numbered as the image marks it (the n-th part is n). The
 * name is left out on purpose: the review names whole groups of masks and often
 * gets it wrong, and the tutor must choose by looking at the part.
 */
export function partLine(part: PartForPrompt, index: number): string {
  return `- ${index + 1}: ${part.status}`;
}
