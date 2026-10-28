import type { BoundingBox, Point } from "../types";

/**
 * How a source of srcW x srcH is shown inside a dstW x dstH box with
 * `object-fit: cover` (centered): scaled up until it fills, then cropped.
 */
export type CoverTransform = {
  scale: number;
  offsetX: number;
  offsetY: number;
};

export function coverTransform(
  srcW: number,
  srcH: number,
  dstW: number,
  dstH: number,
): CoverTransform {
  const scale = Math.max(dstW / srcW, dstH / srcH);
  return {
    scale,
    offsetX: (dstW - srcW * scale) / 2,
    offsetY: (dstH - srcH * scale) / 2,
  };
}

/** Normalized (0..1) point over the source -> pixel point over the box. */
export function toCanvasPoint(
  [nx, ny]: Point,
  transform: CoverTransform,
  srcW: number,
  srcH: number,
): Point {
  return [
    nx * srcW * transform.scale + transform.offsetX,
    ny * srcH * transform.scale + transform.offsetY,
  ];
}

export function boundsOf(points: readonly Point[]): BoundingBox {
  const xs = points.map(([x]) => x);
  const ys = points.map(([, y]) => y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Shoelace formula. */
export function polygonArea(points: readonly Point[]): number {
  let sum = 0;
  for (let i = 0; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x2, y2] = points[(i + 1) % points.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

/** Ray casting. */
export function pointInPolygon(
  x: number,
  y: number,
  points: readonly Point[],
): boolean {
  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const [xi, yi] = points[i]!;
    const [xj, yj] = points[j]!;
    const crosses =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function pointInRect(x: number, y: number, r: BoundingBox): boolean {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}
