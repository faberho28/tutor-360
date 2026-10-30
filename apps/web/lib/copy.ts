import type { ComponentStatus } from "./component-status";
import type { AnalysisState } from "./types";

/** User-facing texts (es-CO) shared by several components. */
export const copy = {
  status: {
    idle: "Listo",
    preparing: "Preparando el seguimiento",
    waiting: "Esperando imagen estable",
    analyzing: "Analizando",
    paused: "En pausa",
    offline: "Sin conexión con la IA",
    quota: "Cuota de la IA agotada",
    error: "Algo salió mal al analizar",
  } satisfies Record<AnalysisState["phase"], string>,
  /** What the failure toast says under the title, per failed phase. */
  failure: {
    offline: "Revisa tu conexión y vuelve a intentar el análisis.",
    quota:
      "Pausamos el análisis automático. Actívalo de nuevo cuando haya créditos disponibles.",
    error: "Conservamos los últimos componentes detectados.",
  } satisfies Record<"offline" | "quota" | "error", string>,
  controls: {
    capture: "Capturar",
    autoOn: "Activar análisis automático",
    autoOff: "Pausar análisis automático",
    report: "Generar reporte",
    reportNeedsCapture: "Haz al menos una captura",
    more: "Más",
    reset: "Reiniciar contexto",
    changeGrid: "Ver grilla de cambios",
  },
} as const;

export const statusLabel: Record<ComponentStatus, string> = {
  anomaly: "Anomalía",
  warning: "Revisar",
  ok: "OK",
};

export const severityLabel = {
  high: { text: "Gravedad alta", variant: "anomaly" },
  medium: { text: "Gravedad media", variant: "warning" },
  low: { text: "Gravedad baja", variant: "ok" },
} as const;

export const listCopy = {
  title: "Componentes detectados",
  empty: "Apunta la cámara al interior de la PC para empezar",
} as const;

/** "hace 3 s", "hace 2 min"; "ahora" under five seconds or before the clock is known. */
export function formatAgo(now: number, seenAt: number): string {
  const seconds = Math.floor((now - seenAt) / 1000);
  if (now === 0 || seconds < 5) return "ahora";
  if (seconds < 60) return `hace ${seconds} s`;
  return `hace ${Math.floor(seconds / 60)} min`;
}

/** 754 -> "00:12:34" */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
