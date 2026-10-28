export const COMPONENT_CLASSES = [
  "RAM",
  "SSD",
  "PSU",
  "CPU_FAN",
  "CAPACITOR_NORMAL",
  "CAPACITOR_INFLATED",
  "DUST_REGION",
  "CABLE_SATA",
  "CABLE_POWER_LOOSE",
] as const;

export type ComponentClass = (typeof COMPONENT_CLASSES)[number];

export type ComponentStatus = "ok" | "warning" | "anomaly";

/** Single source of truth for the class -> status mapping. */
export const STATUS_BY_CLASS: Record<ComponentClass, ComponentStatus> = {
  RAM: "ok",
  SSD: "ok",
  PSU: "ok",
  CPU_FAN: "ok",
  CAPACITOR_NORMAL: "ok",
  CABLE_SATA: "ok",
  CAPACITOR_INFLATED: "anomaly",
  CABLE_POWER_LOOSE: "anomaly",
  DUST_REGION: "warning",
};

export function statusOf(cls: ComponentClass): ComponentStatus {
  return STATUS_BY_CLASS[cls];
}
