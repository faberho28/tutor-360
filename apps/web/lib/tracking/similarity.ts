/**
 * A similarity: shift, turn and uniform zoom, nothing else. With the camera
 * looking straight down this is every movement a flat scene can make, and it
 * has only four numbers, so noise cannot bend it into a tilt or a skew the way
 * it can bend a full homography.
 *
 *   x' = a x - b y + tx
 *   y' = b x + a y + ty        scale = hypot(a, b), angle = atan2(b, a)
 */
export type Similarity = { a: number; b: number; tx: number; ty: number };

type Points = Float32Array | readonly number[];

/** Least-squares similarity from `src` to `dst` over the given point indexes. */
export function fitSimilarity(
  src: Points,
  dst: Points,
  indexes: readonly number[],
): Similarity | null {
  const n = indexes.length;
  if (n < 2) return null;

  let spx = 0;
  let spy = 0;
  let sqx = 0;
  let sqy = 0;
  for (const i of indexes) {
    spx += src[2 * i]!;
    spy += src[2 * i + 1]!;
    sqx += dst[2 * i]!;
    sqy += dst[2 * i + 1]!;
  }
  const cpx = spx / n;
  const cpy = spy / n;
  const cqx = sqx / n;
  const cqy = sqy / n;

  // Treat each point as a complex number: the best rotation and zoom is the
  // single complex factor a + ib that takes the source offsets onto the target.
  let dot = 0;
  let cross = 0;
  let spread = 0;
  for (const i of indexes) {
    const px = src[2 * i]! - cpx;
    const py = src[2 * i + 1]! - cpy;
    const qx = dst[2 * i]! - cqx;
    const qy = dst[2 * i + 1]! - cqy;
    dot += px * qx + py * qy;
    cross += px * qy - py * qx;
    spread += px * px + py * py;
  }
  if (spread < 1e-6) return null;

  const a = dot / spread;
  const b = cross / spread;
  return { a, b, tx: cqx - (a * cpx - b * cpy), ty: cqy - (b * cpx + a * cpy) };
}

export type SimilarityFit = {
  similarity: Similarity;
  /** 1 for the points that agree with it, 0 for the ones that do not. */
  inliers: Uint8Array;
  count: number;
};

/**
 * Robust fit: random pairs of points propose a similarity, the one that most
 * points agree with wins, and it is then refined with all of them. Points that
 * moved on their own (a hand, a part pulled out) end up outside it.
 */
export function ransacSimilarity(
  src: Points,
  dst: Points,
  options: { threshold: number; iterations: number },
): SimilarityFit | null {
  const n = src.length / 2;
  if (n < 2) return null;
  const limit = options.threshold * options.threshold;

  // Fixed seed: the same points always give the same answer.
  let seed = 0x9e3779b9;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };

  const score = (s: Similarity) => {
    const inliers = new Uint8Array(n);
    let count = 0;
    for (let i = 0; i < n; i++) {
      const x = src[2 * i]!;
      const y = src[2 * i + 1]!;
      const ex = s.a * x - s.b * y + s.tx - dst[2 * i]!;
      const ey = s.b * x + s.a * y + s.ty - dst[2 * i + 1]!;
      if (ex * ex + ey * ey <= limit) {
        inliers[i] = 1;
        count++;
      }
    }
    return { inliers, count };
  };

  let best: {
    similarity: Similarity;
    inliers: Uint8Array;
    count: number;
  } | null = null;
  for (let it = 0; it < options.iterations; it++) {
    const i = Math.floor(random() * n);
    const j = Math.floor(random() * n);
    if (i === j) continue;
    // Two points almost on top of each other say nothing about the turn.
    const dx = src[2 * i]! - src[2 * j]!;
    const dy = src[2 * i + 1]! - src[2 * j + 1]!;
    if (dx * dx + dy * dy < 64) continue;
    const similarity = fitSimilarity(src, dst, [i, j]);
    if (!similarity) continue;
    const { inliers, count } = score(similarity);
    if (!best || count > best.count) best = { similarity, inliers, count };
    if (best.count > n * 0.9) break;
  }
  if (!best || best.count < 2) return null;

  // Refine with every point that agreed, twice: the pair was a rough guess.
  for (let round = 0; round < 2; round++) {
    const agreed: number[] = [];
    best.inliers.forEach((v, i) => {
      if (v === 1) agreed.push(i);
    });
    const refined = fitSimilarity(src, dst, agreed);
    if (!refined) break;
    best = { similarity: refined, ...score(refined) };
  }
  return best;
}
