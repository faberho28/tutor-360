import type { BoundingBox } from "../types";

/** Top-left corner of the guide's card on the stage (stage pixels). */
export type GuidePos = { x: number; y: number };

type Size = { w: number; h: number };

/** Distance to the stage edge. */
const MARGIN = 12;
/** Below the corner controls. */
const TOP = 60;
/** Above the control bar (its top is 92 px from the edge). */
const BOTTOM = 104;
/** How close to the part the card is put. */
const GAP = 16;
/** Past this distance from the part the card comes back to it. */
const MAX_GAP = 140;

/** Where the card may be: not under the corner controls nor the control bar. */
function freeArea(stage: Size): BoundingBox {
  return {
    x: MARGIN,
    y: TOP,
    w: Math.max(0, stage.w - 2 * MARGIN),
    h: Math.max(0, stage.h - TOP - BOTTOM),
  };
}

/** The position moved the least so the card sits inside the free area. */
function fit(pos: GuidePos, card: Size, free: BoundingBox): GuidePos {
  return {
    x: Math.max(free.x, Math.min(pos.x, free.x + free.w - card.w)),
    y: Math.max(free.y, Math.min(pos.y, free.y + free.h - card.h)),
  };
}

function overlap(a: BoundingBox, b: BoundingBox): number {
  const w = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
  const h = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
  return w > 0 && h > 0 ? w * h : 0;
}

/** The distance between two boxes: 0 when they touch or overlap. */
function gapBetween(a: BoundingBox, b: BoundingBox): number {
  const dx = Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), 0);
  const dy = Math.max(b.y - (a.y + a.h), a.y - (b.y + b.h), 0);
  return Math.hypot(dx, dy);
}

/**
 * The places next to the part, in order of preference (a tie goes to the
 * first): at its sides, above and below it, and at its corners.
 */
function around(card: Size, target: BoundingBox): GuidePos[] {
  const right = target.x + target.w + GAP;
  const left = target.x - GAP - card.w;
  const below = target.y + target.h + GAP;
  const above = target.y - GAP - card.h;
  const midX = target.x + target.w / 2 - card.w / 2;
  const midY = target.y + target.h / 2 - card.h / 2;
  return [
    { x: right, y: midY },
    { x: left, y: midY },
    { x: midX, y: below },
    { x: midX, y: above },
    { x: right, y: below },
    { x: left, y: below },
    { x: right, y: above },
    { x: left, y: above },
  ];
}

/**
 * Where the guide's card should be: next to the part of the step and never over
 * it. Covering the other parts does not matter. The masks move with the
 * tracking, so the card does not follow them every frame: it stays where it is
 * until it covers the part or ends up too far from it, and then it goes to the
 * closest place that leaves the part clear.
 */
export function placeGuideCard(input: {
  /** Where the card is now (its destination, if it is sliding), or null. */
  current: GuidePos | null;
  stage: Size;
  card: Size;
  /** The outline box of the part of the step, if it is on screen. */
  target: BoundingBox | null;
}): GuidePos {
  const { stage, card, target } = input;
  const free = freeArea(stage);
  const home = fit({ x: free.x, y: free.y + free.h - card.h }, card, free);

  // A step that is not about one part, or one that is not on screen: the card
  // stays where it was (or at the bottom left the first time).
  if (!target) return input.current ? fit(input.current, card, free) : home;

  const clear = (pos: GuidePos) =>
    overlap({ ...pos, w: card.w, h: card.h }, target);
  const apart = (pos: GuidePos) =>
    gapBetween({ ...pos, w: card.w, h: card.h }, target);

  // The card may have grown or the stage shrunk: keep it inside the free area.
  const current = input.current ? fit(input.current, card, free) : null;
  if (current && clear(current) === 0 && apart(current) <= MAX_GAP) {
    return current;
  }

  // Among the places around the part, the ones that leave it clear and the
  // closest to it; if none does (a huge part), the one that covers the least.
  let best = home;
  let bestScore = Infinity;
  for (const place of around(card, target)) {
    const pos = fit(place, card, free);
    const score = clear(pos) * 1000 + apart(pos);
    if (score < bestScore) {
      best = pos;
      bestScore = score;
    }
  }
  return best;
}
