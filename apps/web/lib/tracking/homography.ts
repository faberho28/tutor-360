import type { BoundingBox } from "../types";

/**
 * A 3x3 matrix, row-major, that maps NORMALIZED coordinates (0..1 over the
 * frame) of the reference frame to those of the current one. Normalized, so it
 * does not depend on the size the tracker looks at.
 */
export type Homography = readonly [
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
  number,
];

export const IDENTITY: Homography = [1, 0, 0, 0, 1, 0, 0, 0, 1];

/** Where a normalized point lands under the homography. */
export function applyHomography(
  h: Homography,
  x: number,
  y: number,
): [number, number] {
  const w = h[6] * x + h[7] * y + h[8];
  // A point sent to infinity is out of any frame; keep the math finite.
  const d = Math.abs(w) < 1e-9 ? 1e-9 : w;
  return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d];
}

/** The points of a shape after they go through the homography. */
export function movePolygon(
  points: readonly (readonly [number, number])[],
  h: Homography,
): [number, number][] {
  return points.map(([x, y]) => applyHomography(h, x, y));
}

/** The box that encloses `box` after it goes through the homography. */
export function moveBox(box: BoundingBox, h: Homography): BoundingBox {
  const corners = [
    applyHomography(h, box.x, box.y),
    applyHomography(h, box.x + box.w, box.y),
    applyHomography(h, box.x + box.w, box.y + box.h),
    applyHomography(h, box.x, box.y + box.h),
  ];
  const xs = corners.map((c) => c[0]);
  const ys = corners.map((c) => c[1]);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, w: Math.max(...xs) - x, h: Math.max(...ys) - y };
}

/** Converts a pixel homography (frames of `width` x `height`) to normalized. */
export function normalizeHomography(
  px: ArrayLike<number>,
  width: number,
  height: number,
): Homography {
  const scale = [width, height, 1];
  const out: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push((px[r * 3 + c]! * scale[c]!) / scale[r]!);
    }
  }
  // Divide by the last element so that equal transforms compare as equal.
  const last = out[8]!;
  return out.map((v) => v / last) as unknown as Homography;
}

/** Product `a * b`: applies `b` first and then `a`. */
export function multiplyHomography(a: Homography, b: Homography): Homography {
  const out: number[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 3; c++) {
      out.push(
        a[r * 3]! * b[c]! +
          a[r * 3 + 1]! * b[3 + c]! +
          a[r * 3 + 2]! * b[6 + c]!,
      );
    }
  }
  const last = out[8]!;
  return out.map((v) => v / last) as unknown as Homography;
}
