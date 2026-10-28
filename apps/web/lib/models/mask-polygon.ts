import {
  decodeMaskToSVGPath,
  type SegmentationMaskRecord,
} from "@meta-sam/parser";
import type { BoundingBox, Point } from "../types";

export type FrameSize = { width: number; height: number };

export type MaskShape = { polygon: Point[]; bbox: BoundingBox };

type PixelPoint = [number, number];

// Keeps the outline smooth enough to draw while dropping the staircase points.
const SIMPLIFY_TOLERANCE_PX = 1.5;
const MIN_POLYGON_POINTS = 3;

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

/** The parser emits repeated `M x yL x y...Z` with no separator between rings. */
function parseRings(path: string): PixelPoint[][] {
  const rings: PixelPoint[][] = [];
  for (const chunk of path.split("Z")) {
    const points = [
      ...chunk.matchAll(/[ML](-?\d+(?:\.\d+)?) (-?\d+(?:\.\d+)?)/g),
    ].map((match): PixelPoint => [Number(match[1]), Number(match[2])]);
    if (points.length >= MIN_POLYGON_POINTS) rings.push(points);
  }
  return rings;
}

function area(ring: PixelPoint[]): number {
  let sum = 0;
  ring.forEach(([x1, y1], i) => {
    const next = ring[(i + 1) % ring.length];
    if (next) sum += x1 * next[1] - next[0] * y1;
  });
  return Math.abs(sum) / 2;
}

function distanceToLine(p: PixelPoint, a: PixelPoint, b: PixelPoint): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return Math.hypot(p[0] - a[0], p[1] - a[1]);
  return Math.abs(dy * p[0] - dx * p[1] + b[0] * a[1] - b[1] * a[0]) / length;
}

/** Ramer-Douglas-Peucker over an open polyline. */
function simplifyOpen(points: PixelPoint[], tolerance: number): PixelPoint[] {
  const first = points[0];
  const last = points[points.length - 1];
  if (points.length <= 2 || !first || !last) return points;
  let farthest = 0;
  let index = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const point = points[i];
    if (!point) continue;
    const distance = distanceToLine(point, first, last);
    if (distance > farthest) {
      farthest = distance;
      index = i;
    }
  }
  if (farthest <= tolerance) return [first, last];
  const left = simplifyOpen(points.slice(0, index + 1), tolerance);
  const right = simplifyOpen(points.slice(index), tolerance);
  return [...left.slice(0, -1), ...right];
}

/** A closed ring has no endpoints, so split it at the point farthest from the start. */
function simplifyRing(ring: PixelPoint[], tolerance: number): PixelPoint[] {
  const start = ring[0];
  if (!start) return ring;
  let split = 0;
  let farthest = 0;
  for (let i = 1; i < ring.length; i++) {
    const point = ring[i];
    if (!point) continue;
    const distance = Math.hypot(point[0] - start[0], point[1] - start[1]);
    if (distance > farthest) {
      farthest = distance;
      split = i;
    }
  }
  if (split === 0) return ring;
  const head = simplifyOpen(ring.slice(0, split + 1), tolerance);
  const tail = simplifyOpen([...ring.slice(split), start], tolerance);
  return [...head.slice(0, -1), ...tail.slice(0, -1)];
}

/**
 * Turns a SAM mask record into a normalized polygon. Returns null when the mask
 * has no usable outline. Only the largest outer ring is kept: a detection with
 * disconnected specks should still read as one component on screen.
 */
export function maskToShape(
  record: SegmentationMaskRecord,
  frame: FrameSize,
): MaskShape | null {
  const rings = parseRings(decodeMaskToSVGPath(record.mask));
  if (rings.length === 0) return null;

  const outer = rings.reduce((best, ring) =>
    area(ring) > area(best) ? ring : best,
  );
  const simplified = simplifyRing(outer, SIMPLIFY_TOLERANCE_PX);
  if (simplified.length < MIN_POLYGON_POINTS) return null;

  const { left, top, right, bottom } = record.bounds;
  // The tracer puts pixel centers on integers; +0.5 moves to pixel edges, and
  // the raster is a crop whose origin is `bounds`.
  const polygon = simplified.map(([x, y]): Point => [
    clamp01((x + 0.5 + left) / frame.width),
    clamp01((y + 0.5 + top) / frame.height),
  ]);
  const bbox: BoundingBox = {
    x: clamp01(left / frame.width),
    y: clamp01(top / frame.height),
    w: clamp01((right - left) / frame.width),
    h: clamp01((bottom - top) / frame.height),
  };
  return { polygon, bbox };
}
