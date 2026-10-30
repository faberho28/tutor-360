import { THRESHOLDS, type ChangeStatus } from "../vision/change-detector";
import { GRID_COLS, GRID_ROWS } from "../vision/signature";
import { coverTransform, toCanvasPoint } from "./geometry";

/** Diffs under this are noise: not worth painting. */
const FAINT = 0.02;

const STATUS_TEXT: Record<ChangeStatus, string> = {
  calibrating: "calibrando",
  moving: "en movimiento",
  stable: "estable",
  "camera-moved": "cámara movida",
  "scene-lost": "escena perdida",
  changed: "cambió",
};

/**
 * The change detector's view, over the camera: the diff of every cell of its
 * grid against the reference scene. Amber is a difference below the threshold;
 * red is a cell over it, which is what makes a region count as "changed".
 * `heat` is row-major (`GRID_COLS` x `GRID_ROWS`) and empty while there is no
 * reference yet.
 */
export function drawChangeGrid(
  ctx: CanvasRenderingContext2D,
  heat: readonly number[],
  scene: {
    width: number;
    height: number;
    source: { width: number; height: number };
    status: ChangeStatus;
  },
) {
  const { width, height, source } = scene;
  const transform = coverTransform(source.width, source.height, width, height);
  const at = (col: number, row: number) =>
    toCanvasPoint(
      [col / GRID_COLS, row / GRID_ROWS],
      transform,
      source.width,
      source.height,
    );

  let over = 0;
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const diff = heat[row * GRID_COLS + col];
      if (diff === undefined || diff < FAINT) continue;
      const [x0, y0] = at(col, row);
      const [x1, y1] = at(col + 1, row + 1);
      if (x1 < 0 || y1 < 0 || x0 > width || y0 > height) continue;
      if (diff > THRESHOLDS.cell) {
        over++;
        ctx.fillStyle = "rgba(255, 59, 48, 0.6)";
      } else {
        const strength = Math.min(1, diff / THRESHOLDS.cell);
        ctx.fillStyle = `rgba(255, 190, 0, ${0.1 + 0.35 * strength})`;
      }
      // +0.5 closes the hairline gaps between neighbouring cells.
      ctx.fillRect(x0, y0, x1 - x0 + 0.5, y1 - y0 + 0.5);
    }
  }

  const text =
    heat.length === 0
      ? `Grilla de cambios · ${STATUS_TEXT[scene.status]} · sin referencia todavía`
      : `Grilla de cambios · ${STATUS_TEXT[scene.status]} · rojo: cambio (> ${THRESHOLDS.cell}), ${over} celdas · ámbar: diferencia leve`;
  ctx.font = "500 12px sans-serif";
  ctx.textBaseline = "middle";
  const textWidth = ctx.measureText(text).width;
  ctx.fillStyle = "rgba(0, 0, 0, 0.65)";
  ctx.beginPath();
  // Top left, under the status pills: the bottom edge belongs to the controls.
  ctx.roundRect(12, 52, textWidth + 20, 24, 12);
  ctx.fill();
  ctx.fillStyle = "#FFFFFF";
  ctx.fillText(text, 22, 64.5);
}
