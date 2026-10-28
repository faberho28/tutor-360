// Parts traced by hand on public/demo/board.webp (1200x678 px).
// Pixel coordinates of the photo; scenarios.ts normalizes them to 0..1.
// If the photo changes, these must be traced again.

export type PixelPoint = [number, number];

export const BOARD = { width: 1200, height: 678 } as const;

/** Rectangle with chamfered corners, as a mask-like polygon. */
function box(x: number, y: number, w: number, h: number, r = 3): PixelPoint[] {
  return [
    [x + r, y],
    [x + w - r, y],
    [x + w, y + r],
    [x + w, y + h - r],
    [x + w - r, y + h],
    [x + r, y + h],
    [x, y + h - r],
    [x, y + r],
  ];
}

/**
 * Black polymer capacitors. Row 1 (a-f) are the PC11xx parts above the
 * inductors; row 2 (g-i) are the small PC10xx parts below them.
 */
export const CAPACITORS = {
  a: box(404, 479, 20, 38),
  b: box(425, 478, 21, 37),
  c: box(480, 480, 21, 36),
  d: box(534, 480, 22, 36),
  e: box(590, 468, 21, 38),
  f: box(613, 468, 22, 38),
  g: box(410, 547, 14, 19, 2),
  h: box(486, 547, 15, 20, 2),
  i: box(589, 550, 14, 19, 2),
} as const;

/** Simulated dust region over a clean area of the board. */
export const DUST_REGION: PixelPoint[] = [
  [712, 452],
  [752, 448],
  [782, 466],
  [768, 486],
  [728, 490],
  [706, 472],
];
