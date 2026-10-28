import type { ComponentStatus } from "../component-status";
import {
  LABEL_BG,
  LABELS_ES,
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
  now: number;
  reducedMotion: boolean;
  /** Canvas font, e.g. "500 12px Inter". */
  font: string;
};

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
  dots: Array<{ id: string; x: number; y: number }>;
};

const DOT_RADIUS = 5;
const DOT_HIT_RADIUS = 12;
const STATUS_PRIORITY: Record<ComponentStatus, number> = {
  anomaly: 1,
  warning: 2,
  ok: 3,
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

/** Paints masks, labels and dots. Returns the layout used for hit-testing. */
export function drawOverlay(
  ctx: CanvasRenderingContext2D,
  scene: OverlayScene,
): OverlayLayout {
  const { width, height, source, selectedId, now, reducedMotion } = scene;
  ctx.clearRect(0, 0, width, height);

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
    const style = OVERLAY[d.cls];
    const isSelected = d.id === selectedId;
    const dimmed = selectedId !== null && !isSelected;
    const pulsing = Boolean(style.pulse);

    const fillAlpha = dimmed
      ? SELECTED_DIM_FILL
      : pulsing
        ? pulseAlpha(now, reducedMotion)
        : style.fill;
    const lineWidth =
      pulsing && reducedMotion ? STROKE_REDUCED_MOTION : style.stroke;

    tracePath(ctx, shape.points);
    ctx.fillStyle = hexToRgba(style.color, fillAlpha);
    ctx.fill();

    if (isSelected) {
      // White border with a ring in the class color around it.
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

  ctx.font = scene.font;
  const measure = (text: string) => ctx.measureText(text).width;
  const specs: LabelSpec[] = scene.detections.map((d) => ({
    id: d.id,
    text: LABELS_ES[d.cls],
    anchor: byId.get(d.id)!.bounds,
    priority: d.id === selectedId ? 0 : STATUS_PRIORITY[d.status],
  }));
  const placements = placeLabels(specs, measure, { w: width, h: height });

  const labels: OverlayLayout["labels"] = [];
  const dots: OverlayLayout["dots"] = [];
  const detectionById = new Map(scene.detections.map((d) => [d.id, d]));

  ctx.textBaseline = "middle";
  for (const placement of placements) {
    const d = detectionById.get(placement.id)!;
    const shape = byId.get(placement.id)!;
    const color = OVERLAY[d.cls].color;

    if (placement.rect) {
      const r = placement.rect;
      ctx.fillStyle = LABEL_BG;
      ctx.beginPath();
      ctx.roundRect(r.x, r.y, r.w, r.h, LABEL_HEIGHT / 2);
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.fillText(
        LABELS_ES[d.cls],
        r.x + LABEL_PADDING_X,
        r.y + r.h / 2 + 0.5,
      );
      labels.push({ id: d.id, rect: r });
    } else {
      // No room for the name: a dot in the class color marks the part.
      const x = shape.bounds.x + shape.bounds.w / 2;
      const y = shape.bounds.y + shape.bounds.h / 2;
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS, 0, Math.PI * 2);
      ctx.fillStyle = color;
      ctx.fill();
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = "#FFFFFF";
      ctx.stroke();
      dots.push({ id: d.id, x, y });
    }
  }

  return { shapes, labels, dots };
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
  for (const dot of layout.dots) {
    if (Math.hypot(x - dot.x, y - dot.y) <= DOT_HIT_RADIUS) return dot.id;
  }

  const hits = layout.shapes
    .filter((s) => pointInPolygon(x, y, s.points))
    .sort((a, b) => a.area - b.area);
  return hits[0]?.id ?? null;
}
