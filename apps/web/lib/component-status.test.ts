import { describe, expect, it } from "vitest";
import {
  COMPONENT_CLASSES,
  STATUS_BY_CLASS,
  statusOf,
  type ComponentStatus,
} from "./component-status";

describe("component-status", () => {
  it("lists exactly the nine classes defined by the PRD", () => {
    expect([...COMPONENT_CLASSES].sort()).toEqual(
      [
        "CABLE_POWER_LOOSE",
        "CABLE_SATA",
        "CAPACITOR_INFLATED",
        "CAPACITOR_NORMAL",
        "CPU_FAN",
        "DUST_REGION",
        "PSU",
        "RAM",
        "SSD",
      ].sort(),
    );
  });

  it("maps every class to a status", () => {
    for (const cls of COMPONENT_CLASSES) {
      expect(["ok", "warning", "anomaly"]).toContain(STATUS_BY_CLASS[cls]);
    }
  });

  it.each<[string, ComponentStatus]>([
    ["CAPACITOR_INFLATED", "anomaly"],
    ["CABLE_POWER_LOOSE", "anomaly"],
    ["DUST_REGION", "warning"],
    ["RAM", "ok"],
    ["SSD", "ok"],
    ["PSU", "ok"],
    ["CPU_FAN", "ok"],
    ["CAPACITOR_NORMAL", "ok"],
    ["CABLE_SATA", "ok"],
  ])("%s has status %s", (cls, expected) => {
    expect(statusOf(cls as (typeof COMPONENT_CLASSES)[number])).toBe(expected);
  });
});
