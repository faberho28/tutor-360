import type { ComponentStatus } from "../component-status";
import type { Detection } from "../types";

const STATUS_RANK: Record<ComponentStatus, number> = {
  anomaly: 0,
  warning: 1,
  ok: 2,
};

function compareText(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/** Anomalies first, then warnings, then ok; stable and non-mutating. */
export function sortDetections(detections: readonly Detection[]): Detection[] {
  return [...detections].sort((a, b) => {
    const byStatus = STATUS_RANK[a.status] - STATUS_RANK[b.status];
    if (byStatus !== 0) return byStatus;

    if (a.score !== b.score) {
      if (a.score === null) return 1;
      if (b.score === null) return -1;
      return b.score - a.score;
    }

    return compareText(a.label, b.label) || compareText(a.id, b.id);
  });
}

/** Text for the summary pill, e.g. "8 componentes · 2 anomalías · 1 por revisar". */
export function summarize(detections: readonly Detection[]): string {
  const total = detections.length;
  if (total === 0) return "Sin componentes";

  const anomalies = detections.filter((d) => d.status === "anomaly").length;
  const warnings = detections.filter((d) => d.status === "warning").length;

  const parts = [`${total} ${total === 1 ? "componente" : "componentes"}`];
  if (anomalies > 0) {
    parts.push(`${anomalies} ${anomalies === 1 ? "anomalía" : "anomalías"}`);
  }
  if (warnings > 0) parts.push(`${warnings} por revisar`);
  return parts.join(" · ");
}
