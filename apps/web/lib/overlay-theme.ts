import type { ComponentStatus } from "./component-status";

export type OverlayEntry = {
  color: string;
  fill: number;
  stroke: number;
  pulse?: boolean;
  dashed?: boolean;
};

// Fixed hex values on purpose: the overlay is painted on a canvas over the
// video and must look the same in light and dark themes. The look comes from
// the status only: the name is what tells two objects apart.
export const OVERLAY: Record<ComponentStatus, OverlayEntry> = {
  ok: { color: "#007AFF", fill: 0.3, stroke: 2 },
  warning: { color: "#FF9F0A", fill: 0.4, stroke: 2, dashed: true },
  anomaly: { color: "#FF3B30", fill: 0.5, stroke: 3, pulse: true },
};

/** Fill opacity of the other masks while one component is selected. */
export const SELECTED_DIM_FILL = 0.15;
export const LABEL_BG = "rgba(0,0,0,0.7)";
export const LABEL_FONT = "500 12px Inter, system-ui, sans-serif";

export const PULSE = { periodMs: 1200, min: 0.2, max: 0.5 } as const;

/**
 * The part the guided procedure is on. A color no status uses (blue, amber and
 * red are taken) so it is never mistaken for one, and a soft blink of 1 Hz: well
 * under the three flashes per second that can bother people.
 */
export const GUIDE = {
  color: "#FF2BD6",
  periodMs: 1000,
  fillMin: 0.2,
  fillMax: 0.65,
} as const;

/** Fill opacity of the guide's part at time `nowMs` (steady when motion is reduced). */
export function guideAlpha(nowMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return GUIDE.fillMax;
  const phase = (nowMs % GUIDE.periodMs) / GUIDE.periodMs;
  const wave = (1 + Math.cos(2 * Math.PI * phase)) / 2;
  return GUIDE.fillMin + (GUIDE.fillMax - GUIDE.fillMin) * wave;
}
export const STROKE_REDUCED_MOTION = 4;

/** Fill opacity of a pulsing mask at time `nowMs`. */
export function pulseAlpha(nowMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return PULSE.max;
  const phase = (nowMs % PULSE.periodMs) / PULSE.periodMs;
  // 1 -> 0 -> 1 with soft extremes.
  const wave = (1 + Math.cos(2 * Math.PI * phase)) / 2;
  return PULSE.min + (PULSE.max - PULSE.min) * wave;
}
