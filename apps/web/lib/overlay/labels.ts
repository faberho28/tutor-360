import type { BoundingBox } from "../types";

export const LABEL_HEIGHT = 20;
export const LABEL_PADDING_X = 8;
const GAP = 4;
const MARGIN = 4;

export type LabelSpec = {
  id: string;
  text: string;
  /** Bounding box of the masked part, in canvas pixels. */
  anchor: BoundingBox;
  /** Lower goes first: 0 selected, 1 anomaly, 2 warning, 3 ok. */
  priority: number;
};

export type LabelPlacement = {
  id: string;
  /** null when there is no free spot: the part is shown as a dot. */
  rect: BoundingBox | null;
};

function overlaps(a: BoundingBox, b: BoundingBox, gap = 2): boolean {
  return !(
    a.x + a.w + gap <= b.x ||
    b.x + b.w + gap <= a.x ||
    a.y + a.h + gap <= b.y ||
    b.y + b.h + gap <= a.y
  );
}

/**
 * Greedy label placement: higher priority first; each label takes the first
 * candidate position (above, below, aligned right, beside) that stays inside
 * the canvas and does not touch a label already placed. The selected label is
 * always placed, even if it has to overlap.
 */
export function placeLabels(
  specs: readonly LabelSpec[],
  measure: (text: string) => number,
  bounds: { w: number; h: number },
): LabelPlacement[] {
  const order = specs
    .map((spec, index) => ({ spec, index }))
    .sort((a, b) => a.spec.priority - b.spec.priority || a.index - b.index);

  const placed: BoundingBox[] = [];
  const result = new Map<string, BoundingBox | null>();

  for (const { spec } of order) {
    const w = measure(spec.text) + LABEL_PADDING_X * 2;
    const h = LABEL_HEIGHT;
    const { x: ax, y: ay, w: aw, h: ah } = spec.anchor;

    const candidates: Array<[number, number]> = [
      [ax, ay - h - GAP],
      [ax, ay + ah + GAP],
      [ax + aw - w, ay - h - GAP],
      [ax + aw - w, ay + ah + GAP],
      [ax + aw + GAP, ay],
      [ax - w - GAP, ay],
      [ax, ay - 2 * h - 2 * GAP],
      [ax, ay + ah + h + 2 * GAP],
    ];

    const fits = (x: number, y: number) =>
      y >= MARGIN &&
      y + h <= bounds.h - MARGIN &&
      x >= MARGIN &&
      x + w <= bounds.w - MARGIN;

    let chosen: BoundingBox | null = null;
    for (const [cx, cy] of candidates) {
      // Slide horizontally into view before testing the rest.
      const x = Math.min(Math.max(cx, MARGIN), bounds.w - w - MARGIN);
      const rect = { x, y: cy, w, h };
      if (!fits(rect.x, rect.y)) continue;
      if (placed.some((other) => overlaps(rect, other))) continue;
      chosen = rect;
      break;
    }

    if (!chosen && spec.priority === 0) {
      const [cx, cy] = candidates[0]!;
      chosen = {
        x: Math.min(Math.max(cx, MARGIN), bounds.w - w - MARGIN),
        y: Math.min(Math.max(cy, MARGIN), bounds.h - h - MARGIN),
        w,
        h,
      };
    }

    if (chosen) placed.push(chosen);
    result.set(spec.id, chosen);
  }

  return specs.map((spec) => ({
    id: spec.id,
    rect: result.get(spec.id) ?? null,
  }));
}
