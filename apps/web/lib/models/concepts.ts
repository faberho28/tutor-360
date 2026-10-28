import type { ComponentClass } from "../component-status";

/**
 * SAM takes one short noun phrase naming a concrete object per request, so each
 * class maps to an English phrase. These are starting points: HU-13 measures
 * which phrasing works best on real photos.
 */
export const CONCEPT_BY_CLASS: Record<ComponentClass, string> = {
  RAM: "RAM memory module",
  SSD: "solid state drive",
  PSU: "power supply unit",
  CPU_FAN: "CPU cooling fan",
  CAPACITOR_NORMAL: "capacitor",
  CAPACITOR_INFLATED: "swollen capacitor",
  DUST_REGION: "dust",
  CABLE_SATA: "SATA cable",
  CABLE_POWER_LOOSE: "loose power cable",
};
