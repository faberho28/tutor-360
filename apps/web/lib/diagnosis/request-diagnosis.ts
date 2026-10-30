import type { SessionStore } from "../session/store";
import { readApiKey } from "../settings/api-key";
import type { Detection } from "../types";
import { getAnalyzedFrame } from "./analyzed-frame";
import { cropFrame } from "./crop";
import { requestDiagnosisFor } from "./diagnose-client";

/** Diagnoses that run at the same time (each one is a Spark call). */
export const AUTO_PARALLEL = 3;
/**
 * Diagnoses the scan asks for by itself: the rest wait for the user to select
 * the part. Bounds the cost of a board full of warnings.
 */
export const AUTO_MAX = 8;

/**
 * Spark looks at a crop of the analyzed frame and writes the diagnosis. The
 * answer is kept per part, so selecting another part never overwrites it.
 */
export function requestDiagnosis(store: SessionStore, detection: Detection) {
  const { diagnoses, labCase, setDiagnosis } = store.getState();
  if (diagnoses[detection.id]?.status === "loading") return;
  const frame = getAnalyzedFrame(store);
  if (!frame) {
    setDiagnosis(detection.id, { status: "error" });
    return;
  }
  setDiagnosis(detection.id, { status: "loading" });
  void (async () => {
    try {
      const image = await cropFrame(frame, detection);
      const data = await requestDiagnosisFor(
        {
          image,
          label: detection.label,
          status: detection.status,
          reason: detection.reason,
        },
        {
          context: labCase?.context || undefined,
          apiKey: readApiKey() ?? undefined,
        },
      );
      store.getState().setDiagnosis(detection.id, { status: "ready", data });
      // The close-up could not confirm the fault: calling the part an anomaly
      // while the text says "cannot confirm" would contradict itself.
      const current = store
        .getState()
        .detections.find((d) => d.id === detection.id);
      if (data.confirmed === false && current?.status === "anomaly") {
        store.getState().overrideStatus(detection.id, {
          status: "warning",
          reason:
            "La IA no pudo confirmar la anomalía en el acercamiento: revísala a simple vista.",
        });
      }
    } catch {
      store.getState().setDiagnosis(detection.id, { status: "error" });
    }
    // One slot is free: the next part in line may start.
    autoDiagnose(store);
  })();
}

/**
 * Asks for the diagnosis of the parts that came out of Spark's review as
 * "anomaly" or "warning", anomalies first, so it is ready when the user selects
 * them. Called whenever the names and statuses change. A part whose review is
 * still out is skipped (its status is only provisional); one that failed is not
 * retried here (the user retries it from the detail).
 */
export function autoDiagnose(store: SessionStore) {
  const { detections, diagnoses } = store.getState();
  const started = Object.keys(diagnoses).length;
  const loading = Object.values(diagnoses).filter(
    (entry) => entry.status === "loading",
  ).length;
  const room = Math.min(AUTO_PARALLEL - loading, AUTO_MAX - started);
  if (room <= 0) return;
  const rank = (d: Detection) => (d.status === "anomaly" ? 0 : 1);
  detections
    .filter((d) => d.status !== "ok" && !d.reviewing && !diagnoses[d.id])
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, room)
    .forEach((d) => requestDiagnosis(store, d));
}
