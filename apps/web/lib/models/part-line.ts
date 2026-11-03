/** A part as the tutor is told about it. */
export type PartForPrompt = {
  /** The review's guess at the name (Spanish): often wrong for a group of masks. */
  label: string;
  status: "ok" | "warning" | "anomaly";
  /** Why the review gave that status. */
  reason?: string | null;
  /** Normalized (0..1) over the picture. */
  bbox: { x: number; y: number; w: number; h: number };
  /** Appeared after the tutor last looked. */
  isNew?: boolean;
};

const THIRDS = ["left", "center", "right"] as const;
const BANDS = ["top", "middle", "bottom"] as const;

/** Where the part sits in the picture, in words ("top left", "center"). */
export function zoneOf({ x, y, w, h }: PartForPrompt["bbox"]): string {
  const third = (v: number) => Math.min(2, Math.max(0, Math.floor(v * 3)));
  const col = THIRDS[third(x + w / 2)];
  const row = BANDS[third(y + h / 2)];
  if (row === "middle" && col === "center") return "center";
  return `${row} ${col}`;
}

/**
 * One line per part, numbered as the image marks it (the n-th part is n). The
 * name is only a weak hint: the review names whole groups of masks and often
 * gets it wrong, so the tutor must still choose by looking at the part.
 */
export function partLine(part: PartForPrompt, index: number): string {
  const reason = part.reason ? `; review's reason: ${part.reason}` : "";
  const fresh = part.isNew ? " [NEW: not in the picture last time]" : "";
  return `- ${index + 1}: ${zoneOf(part.bbox)}, ${part.status}; review's guess at the name: "${part.label}"${reason}${fresh}`;
}
