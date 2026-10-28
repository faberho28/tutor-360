import {
  COMPONENT_CLASSES,
  STATUS_BY_CLASS,
  type ComponentClass,
  type ComponentStatus,
} from "./component-status";

export type OverlayEntry = {
  color: string;
  fill: number;
  stroke: number;
  status: ComponentStatus;
  pulse?: boolean;
  dashed?: boolean;
};

type OverlayStyle = Omit<OverlayEntry, "status">;

// Fixed hex values on purpose: the overlay is painted on a canvas over the
// video and must look the same in light and dark themes.
const STYLE: Record<ComponentClass, OverlayStyle> = {
  RAM: { color: "#007AFF", fill: 0.3, stroke: 2 },
  SSD: { color: "#5856D6", fill: 0.3, stroke: 2 },
  PSU: { color: "#8E8E93", fill: 0.25, stroke: 2 },
  CPU_FAN: { color: "#32ADE6", fill: 0.3, stroke: 2 },
  CAPACITOR_NORMAL: { color: "#30B0C7", fill: 0.3, stroke: 2 },
  CABLE_SATA: { color: "#A2845E", fill: 0.3, stroke: 2 },
  CAPACITOR_INFLATED: { color: "#FF3B30", fill: 0.5, stroke: 3, pulse: true },
  DUST_REGION: { color: "#FF9F0A", fill: 0.4, stroke: 2, dashed: true },
  CABLE_POWER_LOOSE: { color: "#FF3B30", fill: 0.5, stroke: 3, pulse: true },
};

export const OVERLAY = Object.fromEntries(
  COMPONENT_CLASSES.map((cls) => [
    cls,
    { ...STYLE[cls], status: STATUS_BY_CLASS[cls] },
  ]),
) as Record<ComponentClass, OverlayEntry>;

export const LABELS_ES: Record<ComponentClass, string> = {
  RAM: "Memoria RAM",
  SSD: "Unidad SSD",
  PSU: "Fuente de poder",
  CPU_FAN: "Ventilador CPU",
  CAPACITOR_NORMAL: "Capacitor",
  CABLE_SATA: "Cable SATA",
  CAPACITOR_INFLATED: "Capacitor inflado",
  DUST_REGION: "Región con polvo",
  CABLE_POWER_LOOSE: "Cable de poder suelto",
};

/** Fill opacity of the other masks while one component is selected. */
export const SELECTED_DIM_FILL = 0.15;
export const LABEL_BG = "rgba(0,0,0,0.7)";
export const LABEL_FONT = "500 12px Inter, system-ui, sans-serif";

export const PULSE = { periodMs: 1200, min: 0.2, max: 0.5 } as const;
export const STROKE_REDUCED_MOTION = 4;

/** Fill opacity of a pulsing mask at time `nowMs`. */
export function pulseAlpha(nowMs: number, reducedMotion: boolean): number {
  if (reducedMotion) return PULSE.max;
  const phase = (nowMs % PULSE.periodMs) / PULSE.periodMs;
  // 1 -> 0 -> 1 with soft extremes.
  const wave = (1 + Math.cos(2 * Math.PI * phase)) / 2;
  return PULSE.min + (PULSE.max - PULSE.min) * wave;
}
