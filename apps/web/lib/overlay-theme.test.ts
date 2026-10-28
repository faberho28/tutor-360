import { describe, expect, it } from "vitest";
import { COMPONENT_CLASSES, STATUS_BY_CLASS } from "./component-status";
import {
  LABELS_ES,
  OVERLAY,
  PULSE,
  STROKE_REDUCED_MOTION,
  pulseAlpha,
} from "./overlay-theme";

describe("OVERLAY", () => {
  it("has an entry for each of the nine classes", () => {
    expect(Object.keys(OVERLAY).sort()).toEqual([...COMPONENT_CLASSES].sort());
  });

  it("gives every class a hex color, fill, stroke and status", () => {
    for (const cls of COMPONENT_CLASSES) {
      const entry = OVERLAY[cls];
      expect(entry.color).toMatch(/^#[0-9A-F]{6}$/);
      expect(entry.fill).toBeGreaterThan(0);
      expect(entry.fill).toBeLessThanOrEqual(1);
      expect(entry.stroke).toBeGreaterThanOrEqual(2);
      expect(entry.status).toBe(STATUS_BY_CLASS[cls]);
    }
  });

  it("uses the state colors for anomaly and warning classes", () => {
    expect(OVERLAY.CAPACITOR_INFLATED).toMatchObject({
      color: "#FF3B30",
      fill: 0.5,
      stroke: 3,
      pulse: true,
    });
    expect(OVERLAY.CABLE_POWER_LOOSE).toMatchObject({
      color: "#FF3B30",
      fill: 0.5,
      stroke: 3,
      pulse: true,
    });
    expect(OVERLAY.DUST_REGION).toMatchObject({
      color: "#FF9F0A",
      fill: 0.4,
      dashed: true,
    });
  });

  it("pulses only anomaly classes and dashes only warning classes", () => {
    for (const cls of COMPONENT_CLASSES) {
      const entry = OVERLAY[cls];
      expect("pulse" in entry && entry.pulse === true).toBe(
        entry.status === "anomaly",
      );
      expect("dashed" in entry && entry.dashed === true).toBe(
        entry.status === "warning",
      );
    }
  });

  it("never reuses the anomaly red for a normal class", () => {
    for (const cls of COMPONENT_CLASSES) {
      if (OVERLAY[cls].status === "ok") {
        expect(OVERLAY[cls].color).not.toBe("#FF3B30");
      }
    }
  });
});

describe("LABELS_ES", () => {
  it("has a non-empty Spanish label for every class", () => {
    for (const cls of COMPONENT_CLASSES) {
      expect(LABELS_ES[cls].length).toBeGreaterThan(0);
    }
    expect(LABELS_ES.CAPACITOR_INFLATED).toBe("Capacitor inflado");
    expect(LABELS_ES.DUST_REGION).toBe("Región con polvo");
  });
});

describe("pulseAlpha", () => {
  it("starts at the maximum", () => {
    expect(pulseAlpha(0, false)).toBeCloseTo(PULSE.max, 5);
  });

  it("reaches the minimum at half the period", () => {
    expect(pulseAlpha(PULSE.periodMs / 2, false)).toBeCloseTo(PULSE.min, 5);
  });

  it("returns to the maximum after a full period", () => {
    expect(pulseAlpha(PULSE.periodMs, false)).toBeCloseTo(PULSE.max, 5);
    expect(pulseAlpha(PULSE.periodMs * 3, false)).toBeCloseTo(PULSE.max, 5);
  });

  it("stays within the configured range", () => {
    for (let t = 0; t <= PULSE.periodMs * 2; t += 37) {
      const alpha = pulseAlpha(t, false);
      expect(alpha).toBeGreaterThanOrEqual(PULSE.min - 1e-9);
      expect(alpha).toBeLessThanOrEqual(PULSE.max + 1e-9);
    }
  });

  it("is constant at the maximum with reduced motion", () => {
    for (const t of [0, 100, PULSE.periodMs / 2, 987654]) {
      expect(pulseAlpha(t, true)).toBe(PULSE.max);
    }
  });

  it("uses a thicker stroke when motion is reduced", () => {
    expect(STROKE_REDUCED_MOTION).toBe(4);
  });
});
