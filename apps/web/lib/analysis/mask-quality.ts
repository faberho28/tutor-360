import type { Point } from "../types";

/**
 * SAM paints more than parts: the whole board when it fills the camera, specks
 * of noise, holes. These checks keep only masks that look like a part. The
 * numbers come from 1,600 masks of real lab runs: a ragged-outline rule was
 * tried and dropped because nearly every low-solidity mask there was a cable.
 */
export const MASK_LIMITS = {
  /** A mask over this share of the frame is the surface, whatever it holds. */
  maxArea: 0.6,
  /** A mask over this share that holds other masks is the body, not a part. */
  containerArea: 0.25,
  /** How many masks it must hold to count as a body. */
  containerHolds: 3,
  /** A mask under this share of the frame is a speck. */
  minArea: 0.0004,
} as const;

export type MaskRejection = "too-large" | "too-small" | "container" | "overlap";

type Shape = {
  polygon: readonly Point[];
  bbox: { x: number; y: number; w: number; h: number };
};

/** Shoelace area of a polygon in normalized coordinates (share of the frame). */
export function polygonArea(polygon: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < polygon.length; i++) {
    const [x1, y1] = polygon[i]!;
    const [x2, y2] = polygon[(i + 1) % polygon.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Ray casting. */
export function pointInPolygon(
  [px, py]: Point,
  polygon: readonly Point[],
): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]!;
    const [xj, yj] = polygon[j]!;
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Why a mask is not a part by its size alone, or null. */
export function rejectBySize(polygon: readonly Point[]): MaskRejection | null {
  if (polygon.length < 3) return "too-small";
  const area = polygonArea(polygon);
  if (area > MASK_LIMITS.maxArea) return "too-large";
  if (area < MASK_LIMITS.minArea) return "too-small";
  return null;
}

/**
 * Keeps the masks that look like parts: drops specks, the surface that covers
 * the camera, and any big mask that holds other masks (the board under its own
 * components, the keyboard under its keys). `onDrop` hears each reason.
 */
export function keepParts<T extends Shape>(
  masks: readonly T[],
  onDrop?: (reason: MaskRejection) => void,
): T[] {
  const sized = masks.filter((mask) => {
    const reason = rejectBySize(mask.polygon);
    if (reason) onDrop?.(reason);
    return reason === null;
  });
  return sized.filter((mask) => {
    if (polygonArea(mask.polygon) < MASK_LIMITS.containerArea) return true;
    let held = 0;
    for (const other of sized) {
      if (other === mask) continue;
      const center: Point = [
        other.bbox.x + other.bbox.w / 2,
        other.bbox.y + other.bbox.h / 2,
      ];
      if (pointInPolygon(center, mask.polygon)) held++;
      if (held >= MASK_LIMITS.containerHolds) {
        onDrop?.("container");
        return false;
      }
    }
    return true;
  });
}

/** Two masks over this IoU are one object seen by two parts of the plan. */
export const OVERLAP_IOU = 0.5;
/** Resolution of the grid the overlap is measured on. */
const OVERLAP_GRID = 160;

/** The grid cells a mask covers (centres inside its polygon). */
function cellsOf(mask: Shape): Set<number> {
  const n = OVERLAP_GRID;
  const cells = new Set<number>();
  const { x, y, w, h } = mask.bbox;
  const x0 = Math.max(0, Math.floor(x * n));
  const x1 = Math.min(n - 1, Math.ceil((x + w) * n));
  const y0 = Math.max(0, Math.floor(y * n));
  const y1 = Math.min(n - 1, Math.ceil((y + h) * n));
  for (let gy = y0; gy <= y1; gy++) {
    for (let gx = x0; gx <= x1; gx++) {
      if (pointInPolygon([(gx + 0.5) / n, (gy + 0.5) / n], mask.polygon)) {
        cells.add(gy * n + gx);
      }
    }
  }
  return cells;
}

/**
 * Two parts of the plan can land on the same object ("black square chip" and
 * "tiny integrated circuit"), and then the same mask is painted twice, reviewed
 * twice and diagnosed twice. Of two masks that overlap (IoU at or over
 * `OVERLAP_IOU`) the more confident one stays; on a tie, the first. `onDrop`
 * hears each removal.
 */
export function dropOverlaps<T extends Shape & { score: number | null }>(
  masks: readonly T[],
  onDrop?: (reason: MaskRejection) => void,
): T[] {
  const cells = masks.map(cellsOf);
  const order = masks
    .map((_, i) => i)
    .sort((a, b) => (masks[b]!.score ?? -1) - (masks[a]!.score ?? -1) || a - b);
  const kept: number[] = [];
  for (const i of order) {
    const a = masks[i]!;
    const overlaps = kept.some((j) => {
      const b = masks[j]!;
      const apart =
        a.bbox.x > b.bbox.x + b.bbox.w ||
        b.bbox.x > a.bbox.x + a.bbox.w ||
        a.bbox.y > b.bbox.y + b.bbox.h ||
        b.bbox.y > a.bbox.y + a.bbox.h;
      if (apart) return false;
      const [small, big] =
        cells[i]!.size < cells[j]!.size
          ? [cells[i]!, cells[j]!]
          : [cells[j]!, cells[i]!];
      let inter = 0;
      for (const cell of small) if (big.has(cell)) inter++;
      const union = cells[i]!.size + cells[j]!.size - inter;
      return union > 0 && inter / union >= OVERLAP_IOU;
    });
    if (overlaps) onDrop?.("overlap");
    else kept.push(i);
  }
  const keep = new Set(kept);
  return masks.filter((_, i) => keep.has(i));
}

/** Holes, vias and screw holes are not parts: nobody inspects a hole. */
const HOLE = /\b(holes?|orificios?|agujeros?|taladros?)\b/i;

export function isHoleLike(text: string): boolean {
  return HOLE.test(text);
}
