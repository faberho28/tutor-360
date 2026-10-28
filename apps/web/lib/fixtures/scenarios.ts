import type { ComponentClass } from "../component-status";
import { STATUS_BY_CLASS } from "../component-status";
import type { Detection, Point } from "../types";
import { BOARD, CAPACITORS, DUST_REGION, type PixelPoint } from "./board-parts";

export const DEMO_IMAGE = {
  src: "/demo/board.webp",
  width: BOARD.width,
  height: BOARD.height,
} as const;

export const SCENARIO_NAMES = ["empty", "healthy", "findings"] as const;
export type ScenarioName = (typeof SCENARIO_NAMES)[number];

const round = (n: number) => Math.round(n * 10_000) / 10_000;

function detection(
  id: string,
  cls: ComponentClass,
  pixels: readonly PixelPoint[],
  score: number,
  seenAt: number,
): Detection {
  const polygon: Point[] = pixels.map(([x, y]) => [
    round(x / BOARD.width),
    round(y / BOARD.height),
  ]);
  const xs = polygon.map(([x]) => x);
  const ys = polygon.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return {
    id,
    cls,
    polygon,
    bbox: {
      x,
      y,
      w: round(Math.max(...xs) - x),
      h: round(Math.max(...ys) - y),
    },
    score,
    status: STATUS_BY_CLASS[cls],
    seenAt,
  };
}

/**
 * Demo detections over public/demo/board.webp. The photo is a laptop board, so
 * only capacitors and a dust region can be labeled with the nine PRD classes.
 * The inflated capacitors and the dust region are simulated.
 */
export function getScenario(name: ScenarioName, now = Date.now()): Detection[] {
  const d = (
    id: string,
    cls: ComponentClass,
    pixels: readonly PixelPoint[],
    score: number,
  ) => detection(id, cls, pixels, score, now);

  switch (name) {
    case "empty":
      return [];
    case "healthy":
      return [
        d("cap-a", "CAPACITOR_NORMAL", CAPACITORS.a, 0.96),
        d("cap-b", "CAPACITOR_NORMAL", CAPACITORS.b, 0.94),
        d("cap-c", "CAPACITOR_NORMAL", CAPACITORS.c, 0.97),
        d("cap-d", "CAPACITOR_NORMAL", CAPACITORS.d, 0.92),
        d("cap-e", "CAPACITOR_NORMAL", CAPACITORS.e, 0.9),
        d("cap-f", "CAPACITOR_NORMAL", CAPACITORS.f, 0.93),
      ];
    case "findings":
      return [
        d("cap-a", "CAPACITOR_NORMAL", CAPACITORS.a, 0.96),
        d("cap-b", "CAPACITOR_NORMAL", CAPACITORS.b, 0.94),
        d("cap-c", "CAPACITOR_NORMAL", CAPACITORS.c, 0.97),
        d("cap-d", "CAPACITOR_NORMAL", CAPACITORS.d, 0.92),
        d("cap-e", "CAPACITOR_NORMAL", CAPACITORS.e, 0.9),
        d("cap-f", "CAPACITOR_INFLATED", CAPACITORS.f, 0.91),
        d("cap-h", "CAPACITOR_INFLATED", CAPACITORS.h, 0.88),
        d("dust-1", "DUST_REGION", DUST_REGION, 0.89),
      ];
  }
}
