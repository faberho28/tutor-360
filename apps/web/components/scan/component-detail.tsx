"use client";

import { Box, Check, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { DiagnosisView } from "@/components/scan/diagnosis-view";
import { Button } from "@/components/ui/button";
import { requestMockDiagnosis } from "@/lib/fixtures/mock-diagnosis";
import { requestMockModel } from "@/lib/fixtures/mock-reconstruction";
import { useSession, useSessionStore } from "@/lib/session/session-provider";
import type { Detection } from "@/lib/types";

/**
 * Expands under the selected row: diagnosis, and the actions for that part.
 * The diagnosis is requested by StepsCard, which is always mounted.
 */
export function ComponentDetail({ detection }: { detection: Detection }) {
  const store = useSessionStore();
  const entry = useSession((s) => s.diagnoses[detection.id]);
  const inReport = useSession((s) => s.reportIds.includes(detection.id));
  const toggleReportItem = useSession((s) => s.toggleReportItem);
  const ref = useRef<HTMLDivElement>(null);

  // The detail grows when the diagnosis arrives; keep all of it in view.
  useEffect(() => {
    ref.current?.scrollIntoView({ block: "nearest" });
  }, [entry?.status]);

  return (
    <div
      ref={ref}
      className="mx-1 mt-1 mb-1 flex flex-col gap-3 rounded-xl border bg-muted/40 p-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1"
    >
      <DiagnosisView
        entry={entry}
        onRetry={() => requestMockDiagnosis(store, detection)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => requestMockModel(store, detection.id)}
        >
          <Box aria-hidden="true" data-icon="inline-start" />
          Ver en 3D
        </Button>
        <Button
          type="button"
          variant="ghost"
          aria-pressed={inReport}
          onClick={() => toggleReportItem(detection.id)}
        >
          {inReport ? (
            <Check aria-hidden="true" data-icon="inline-start" />
          ) : (
            <Plus aria-hidden="true" data-icon="inline-start" />
          )}
          {inReport ? "Agregado al reporte" : "Agregar al reporte"}
        </Button>
      </div>
    </div>
  );
}
