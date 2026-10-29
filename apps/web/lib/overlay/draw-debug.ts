import type { TrackingDebug } from "../tracking/debug";
import { coverTransform, toCanvasPoint } from "./geometry";

/** One color per motion: the main object first. */
const COLORS = ["#00E5FF", "#FFD600", "#FF4081", "#76FF03", "#FFFFFF"];
/** Corners that follow no motion (an object with too few points). */
const NO_MOTION = "#9E9E9E";

/**
 * Development only (press D): the corners the tracking follows, colored by the
 * motion they belong to, and a line with its state. If the points sit on the
 * object and move with it, the tracking works; if they sit on the table, it
 * latched onto the wrong thing.
 */
export function drawTrackingDebug(
  ctx: CanvasRenderingContext2D,
  debug: TrackingDebug | null,
  scene: {
    width: number;
    height: number;
    source: { width: number; height: number };
  },
) {
  const { width, height, source } = scene;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.setLineDash([]);

  if (debug) {
    const t = coverTransform(source.width, source.height, width, height);
    for (const p of debug.points) {
      const [x, y] = toCanvasPoint([p.x, p.y], t, source.width, source.height);
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, Math.PI * 2);
      ctx.fillStyle =
        p.object >= 0 ? COLORS[p.object % COLORS.length]! : NO_MOTION;
      ctx.fill();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "#000000";
      ctx.stroke();
    }
  }

  const lines = debug
    ? [
        `Seguimiento: ${debug.status}${debug.analyzing ? " · analizando" : ""}`,
        `${debug.objects} movimientos · ${debug.points.length} puntos · cambio ${debug.changed ? "sí" : "no"} · ${debug.tickMs.toFixed(0)} ms`,
      ]
    : ["Seguimiento: sin datos todavía"];
  ctx.font = "600 12px ui-monospace, monospace";
  ctx.textBaseline = "top";
  const boxWidth = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 16;
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  ctx.fillRect(8, 8, boxWidth, lines.length * 16 + 12);
  ctx.fillStyle = "#FFFFFF";
  lines.forEach((line, i) => ctx.fillText(line, 16, 14 + i * 16));
  ctx.restore();
}
