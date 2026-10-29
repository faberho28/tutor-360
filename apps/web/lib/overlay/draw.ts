import {
  LABEL_BG,
  OVERLAY,
  SELECTED_DIM_FILL,
  STROKE_REDUCED_MOTION,
  pulseAlpha,
} from "../overlay-theme";
import type { BoundingBox, Detection, Point } from "../types";
import {
  boundsOf,
  coverTransform,
  pointInPolygon,
  pointInRect,
  polygonArea,
  toCanvasPoint,
} from "./geometry";
import {
  LABEL_HEIGHT,
  LABEL_PADDING_X,
  placeLabels,
  type LabelSpec,
} from "./labels";

export type OverlayScene = {
  /** Canvas size in CSS pixels. */
  width: number;
  height: number;
  /** Size of the image or video the polygons are normalized against. */
  source: { width: number; height: number };
  detections: readonly Detection[];
  selectedId: string | null;
  /** Detection under the pointer (mouse only), or null. */
  hoveredId: string | null;
  now: number;
  reducedMotion: boolean;
  /** Canvas font, e.g. "500 12px Inter". */
  font: string;
  /**
   * The masks no longer match the image (the camera moved): they are drawn
   * faint, without names and without pulsing, until a new analysis arrives.
   */
  stale?: boolean;
};

/** Opacity of the masks while they are out of date. */
export const STALE_ALPHA = 0.33;

type Shape = {
  id: string;
  points: Point[];
  bounds: BoundingBox;
  area: number;
};

/** What was drawn, kept for hit-testing. */
export type OverlayLayout = {
  shapes: Shape[];
  labels: Array<{ id: string; rect: BoundingBox }>;
};

function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
}

function tracePath(ctx: CanvasRenderingContext2D, points: readonly Point[]) {
  ctx.beginPath();
  points.forEach(([x, y], i) =>
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y),
  );
  ctx.closePath();
}

/**
 * Paints the masks. Names are shown only for the hovered and the selected
 * component, so a crowded board stays readable. Returns the layout used for
 * hit-testing.
 */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  scene: OverlayScene,
): OverlayLayout {
  const { width, height, source, selectedId, hoveredId, now, reducedMotion } =
    scene;
  const stale = scene.stale === true;
  ctx.clearRect(0, 0, width, height);
  ctx.globalAlpha = stale ? STALE_ALPHA : 1;

  const transform = coverTransform(source.width, source.height, width, height);

  const shapes: Shape[] = scene.detections.map((d) => {
    const points = d.polygon.map((p) =>
      toCanvasPoint(p, transform, source.width, source.height),
    );
    return {
      id: d.id,
      points,
      bounds: boundsOf(points),
      area: polygonArea(points),
    };
  });
  const byId = new Map(shapes.map((s) => [s.id, s]));

  // Selected last so it sits on top.
  const ordered = [...scene.detections].sort(
    (a, b) => Number(a.id === selectedId) - Number(b.id === selectedId),
  );

  for (const d of ordered) {
    const shape = byId.get(d.id)!;
    const style = OVERLAY[d.status];
    const isSelected = d.id === selectedId;
    const isHovered = d.id === hoveredId && !isSelected;
    const dimmed = selectedId !== null && !isSelected;
    const pulsing = Boolean(style.pulse) && !stale;

    let fillAlpha = dimmed
      ? SELECTED_DIM_FILL
      : pulsing
        ? pulseAlpha(now, reducedMotion)
        : style.fill;
    if (isHovered) fillAlpha = Math.min(1, fillAlpha + 0.2);
    const lineWidth =
      (pulsing && reducedMotion ? STROKE_REDUCED_MOTION : style.stroke) +
      (isHovered ? 1.5 : 0);

    tracePath(ctx, shape.points);
    ctx.fillStyle = hexToRgba(style.color, fillAlpha);
    ctx.fill();

    if (isSelected) {
      // White border with a ring in the status color around it.
      ctx.lineJoin = "round";
      ctx.setLineDash([]);
      ctx.strokeStyle = style.color;
      ctx.lineWidth = 8;
      ctx.stroke();
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 4;
      ctx.stroke();
    } else {
      ctx.setLineDash("dashed" in style && style.dashed ? [6, 4] : []);
      ctx.strokeStyle = style.color;
      ctx.lineWidth = lineWidth;
      ctx.lineJoin = "round";
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  ctx.globalAlpha = 1;
  ctx.font = scene.font;
  const measure = (text: string) => ctx.measureText(text).width;
  const detectionById = new Map(scene.detections.map((d) => [d.id, d]));

  // Selected first, then hovered; each only if it still exists. A stale mask
  // has no name: it would label something that may no longer be there.
  const labeled = [selectedId, hoveredId].filter(
    (id, index, all): id is string =>
      !stale &&
      id !== null &&
      detectionById.has(id) &&
      all.indexOf(id) === index,
  );
  const specs: LabelSpec[] = labeled.map((id, index) => ({
    id,
    text: detectionById.get(id)!.label,
    anchor: byId.get(id)!.bounds,
    priority: index,
  }));
  const placements = placeLabels(specs, measure, { w: width, h: height });

  const labels: OverlayLayout["labels"] = [];
  ctx.textBaseline = "middle";
  for (const placement of placements) {
    if (!placement.rect) continue;
    const r = placement.rect;
    const text = detectionById.get(placement.id)!.label;
    ctx.fillStyle = LABEL_BG;
    ctx.beginPath();
    ctx.roundRect(r.x, r.y, r.w, r.h, LABEL_HEIGHT / 2);
    ctx.fill();
    ctx.fillStyle = "#FFFFFF";
    ctx.fillText(text, r.x + LABEL_PADDING_X, r.y + r.h / 2 + 0.5);
    labels.push({ id: placement.id, rect: r });
  }

  return { shapes, labels };
}

/** The detection under a point (canvas pixels), or null. Small shapes win. */
export function hitTest(
  layout: OverlayLayout | null,
  x: number,
  y: number,
): string | null {
  if (!layout) return null;

  for (const label of layout.labels) {
    if (pointInRect(x, y, label.rect)) return label.id;
  }

  const hits = layout.shapes
    .filter((s) => pointInPolygon(x, y, s.points))
    .sort((a, b) => a.area - b.area);
  return hits[0]?.id ?? null;
}
