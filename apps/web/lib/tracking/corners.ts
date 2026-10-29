/**
 * Picks the best corners from a corner-strength map (what Shi-Tomasi's "good
 * features to track" does). The compiled OpenCV.js build has the strength map
 * (`cornerMinEigenVal`) but not the picking step, so it lives here.
 *
 * A corner is a local maximum of the map above `quality` times the strongest
 * one; the strongest are kept first, no two closer than `minDistance`, and none
 * within `margin` of the border (the optical-flow window would fall outside).
 * Returns [x0, y0, x1, y1...] in pixels.
 */
export function pickCorners(
  strength: Float32Array,
  width: number,
  height: number,
  options: {
    max: number;
    quality: number;
    minDistance: number;
    margin: number;
    /** Only corners where this is 1 (the object, not its surroundings). */
    roi?: Uint8Array | null;
  },
): Float32Array {
  const { max, quality, minDistance, margin, roi } = options;

  // The quality floor is relative to the strongest corner INSIDE the region:
  // a bright, sharp background must not raise it above the object's own.
  let top = 0;
  for (let i = 0; i < strength.length; i++) {
    if (roi && roi[i] !== 1) continue;
    if (strength[i]! > top) top = strength[i]!;
  }
  if (top <= 0) return new Float32Array(0);
  const floor = top * quality;

  const candidates: { x: number; y: number; value: number }[] = [];
  for (let y = Math.max(1, margin); y < height - Math.max(1, margin); y++) {
    for (let x = Math.max(1, margin); x < width - Math.max(1, margin); x++) {
      if (roi && roi[y * width + x] !== 1) continue;
      const value = strength[y * width + x]!;
      if (value < floor) continue;
      let isMax = true;
      for (let dy = -1; dy <= 1 && isMax; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          if (
            (dx !== 0 || dy !== 0) &&
            strength[(y + dy) * width + (x + dx)]! > value
          ) {
            isMax = false;
            break;
          }
        }
      }
      if (isMax) candidates.push({ x, y, value });
    }
  }
  candidates.sort((a, b) => b.value - a.value);

  // A grid of cells the size of the minimum distance keeps the check local.
  const cell = Math.max(1, minDistance);
  const cols = Math.ceil(width / cell);
  const grid = new Map<number, { x: number; y: number }[]>();
  const picked: number[] = [];
  const minSq = minDistance * minDistance;
  for (const c of candidates) {
    if (picked.length >= max * 2) break;
    const cx = Math.floor(c.x / cell);
    const cy = Math.floor(c.y / cell);
    let free = true;
    for (let gy = cy - 1; gy <= cy + 1 && free; gy++) {
      for (let gx = cx - 1; gx <= cx + 1; gx++) {
        const near = grid.get(gy * cols + gx);
        if (near?.some((p) => (p.x - c.x) ** 2 + (p.y - c.y) ** 2 < minSq)) {
          free = false;
          break;
        }
      }
    }
    if (!free) continue;
    const key = cy * cols + cx;
    const list = grid.get(key);
    if (list) list.push({ x: c.x, y: c.y });
    else grid.set(key, [{ x: c.x, y: c.y }]);
    picked.push(c.x, c.y);
  }
  return Float32Array.from(picked.slice(0, max * 2));
}
