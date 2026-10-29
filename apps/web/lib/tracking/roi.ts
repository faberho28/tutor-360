import type { BoundingBox } from "../types";

/**
 * The part of the frame that belongs to the object being followed: 1 where any
 * of the boxes (grown by `margin` pixels, so the board between two parts counts
 * too) covers it, 0 for the table, the hands and everything else that is not
 * the object. The tracker only looks at what is inside, because the background
 * does not move with the object and would otherwise out-vote it.
 */
export function boxesMask(
  boxes: readonly BoundingBox[],
  width: number,
  height: number,
  margin: number,
): Uint8Array {
  const mask = new Uint8Array(width * height);
  for (const box of boxes) {
    const x0 = Math.max(0, Math.floor(box.x * width - margin));
    const y0 = Math.max(0, Math.floor(box.y * height - margin));
    const x1 = Math.min(width, Math.ceil((box.x + box.w) * width + margin));
    const y1 = Math.min(height, Math.ceil((box.y + box.h) * height + margin));
    for (let y = y0; y < y1; y++) mask.fill(1, y * width + x0, y * width + x1);
  }
  return mask;
}

/**
 * Same as `boxesMask` but with the real outline of each shape (normalized
 * points): a thin diagonal cable fills a thin strip, not half the table that its
 * box encloses. Each shape is filled by scanlines and then grown by `margin`
 * pixels so that the board between two parts counts as part of the object.
 */
export function polygonsMask(
  shapes: readonly (readonly (readonly [number, number])[])[],
  width: number,
  height: number,
  margin: number,
): Uint8Array {
  const filled = new Uint8Array(width * height);
  for (const shape of shapes) {
    if (shape.length < 3) continue;
    const pts = shape.map(([x, y]) => [x * width, y * height] as const);
    const top = Math.max(0, Math.floor(Math.min(...pts.map((p) => p[1]))));
    const bottom = Math.min(
      height - 1,
      Math.ceil(Math.max(...pts.map((p) => p[1]))),
    );
    for (let y = top; y <= bottom; y++) {
      const crossings: number[] = [];
      const yc = y + 0.5;
      for (let i = 0; i < pts.length; i++) {
        const [x0, y0] = pts[i]!;
        const [x1, y1] = pts[(i + 1) % pts.length]!;
        if (y0 === y1 || yc < Math.min(y0, y1) || yc >= Math.max(y0, y1))
          continue;
        crossings.push(x0 + ((yc - y0) / (y1 - y0)) * (x1 - x0));
      }
      crossings.sort((a, b) => a - b);
      for (let k = 0; k + 1 < crossings.length; k += 2) {
        const from = Math.max(0, Math.round(crossings[k]!));
        const to = Math.min(width, Math.round(crossings[k + 1]!));
        if (to > from) filled.fill(1, y * width + from, y * width + to);
      }
    }
  }
  return growMask(filled, width, height, margin);
}

/**
 * The same region grown by `margin` pixels in every direction (a square
 * neighbourhood), with two passes of a running maximum: rows, then columns.
 */
export function growMask(
  mask: Uint8Array,
  width: number,
  height: number,
  margin: number,
): Uint8Array {
  if (margin <= 0) return mask;
  const r = Math.round(margin);
  const wide = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    let last = -Infinity;
    for (let x = 0; x < width; x++) {
      if (mask[y * width + x] === 1) last = x;
      if (x - last <= r) wide[y * width + x] = 1;
    }
    last = Infinity;
    for (let x = width - 1; x >= 0; x--) {
      if (mask[y * width + x] === 1) last = x;
      if (last - x <= r) wide[y * width + x] = 1;
    }
  }
  const grown = new Uint8Array(width * height);
  for (let x = 0; x < width; x++) {
    let last = -Infinity;
    for (let y = 0; y < height; y++) {
      if (wide[y * width + x] === 1) last = y;
      if (y - last <= r) grown[y * width + x] = 1;
    }
    last = Infinity;
    for (let y = height - 1; y >= 0; y--) {
      if (wide[y * width + x] === 1) last = y;
      if (last - y <= r) grown[y * width + x] = 1;
    }
  }
  return grown;
}

/**
 * Splits a region into its separate pieces (4-connected): the keyboard is one
 * piece, a cable lying apart from it is another. `labels` holds 1..N per pixel
 * (0 outside the region) and `sizes[k]` the pixel count of piece `k + 1`.
 * Objects are told apart by where they are, before looking at how they move,
 * because near the centre of a turn a body barely moves and would be taken for
 * a still one.
 */
export function labelComponents(
  mask: Uint8Array,
  width: number,
  height: number,
): { labels: Uint16Array; sizes: number[] } {
  const labels = new Uint16Array(width * height);
  const sizes: number[] = [];
  const stack = new Int32Array(width * height);
  for (let start = 0; start < mask.length; start++) {
    if (mask[start] !== 1 || labels[start] !== 0) continue;
    const label = sizes.length + 1;
    let top = 0;
    let count = 0;
    stack[top++] = start;
    labels[start] = label;
    while (top > 0) {
      const at = stack[--top]!;
      count++;
      const x = at % width;
      const y = (at - x) / width;
      if (x > 0 && mask[at - 1] === 1 && labels[at - 1] === 0) {
        labels[at - 1] = label;
        stack[top++] = at - 1;
      }
      if (x < width - 1 && mask[at + 1] === 1 && labels[at + 1] === 0) {
        labels[at + 1] = label;
        stack[top++] = at + 1;
      }
      if (y > 0 && mask[at - width] === 1 && labels[at - width] === 0) {
        labels[at - width] = label;
        stack[top++] = at - width;
      }
      if (
        y < height - 1 &&
        mask[at + width] === 1 &&
        labels[at + width] === 0
      ) {
        labels[at + width] = label;
        stack[top++] = at + width;
      }
    }
    sizes.push(count);
  }
  return { labels, sizes };
}

/** How many pixels the mask covers. */
export function maskArea(mask: Uint8Array): number {
  let n = 0;
  for (let i = 0; i < mask.length; i++) n += mask[i]!;
  return n;
}
