import type { SessionStore } from "../session/store";
import { readApiKey } from "../settings/api-key";
import type { Detection } from "../types";
import { getAnalyzedFrame } from "./analyzed-frame";
import { cropFrame } from "./crop";
import { requestDiagnosisFor } from "./diagnose-client";

/**
 * Spark looks at a crop of the analyzed frame and writes the diagnosis. Only on
 * demand (the user selects the part or the report needs it). The answer is kept
 * per part, so selecting another part never overwrites it.
 */
export function requestDiagnosis(store: SessionStore, detection: Detection) {
  const { diagnoses, labCase, level, setDiagnosis } = store.getState();
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
          // The tutor reads what the user says they work on, never the
          // analysis prompt (`labCase.context`).
          context: labCase?.description || undefined,
          level,
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
            "The AI could not confirm the anomaly in the close-up: check it by eye.",
        });
      }
    } catch {
      store.getState().setDiagnosis(detection.id, { status: "error" });
    }
  })();
}
