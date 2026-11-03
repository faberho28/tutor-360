"use client";

import { Check, Plus } from "lucide-react";
import { useEffect, useRef } from "react";
import { DiagnosisView } from "@/components/scan/diagnosis-view";
import { Button } from "@/components/ui/button";
import { useServices } from "@/lib/services/context";
import { useSession, useSessionStore } from "@/lib/session/session-provider";
import type { Detection } from "@/lib/types";

/**
 * Expands under the selected row: diagnosis, and the actions for that part.
 * It also asks for the diagnosis of a part that needs one and has none yet (the
 * scan only asks by itself for the first few).
 */
export function ComponentDetail({ detection }: { detection: Detection }) {
  const store = useSessionStore();
  const { requestDiagnosis } = useServices();
  const entry = useSession((s) => s.diagnoses[detection.id]);

  useEffect(() => {
    if (detection.status !== "ok" && !entry) requestDiagnosis(store, detection);
  }, [store, requestDiagnosis, detection, entry]);
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
        onRetry={() => requestDiagnosis(store, detection)}
      />
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-pressed={inReport}
          onClick={() => toggleReportItem(detection.id)}
        >
          {inReport ? (
            <Check aria-hidden="true" data-icon="inline-start" />
          ) : (
            <Plus aria-hidden="true" data-icon="inline-start" />
          )}
          {inReport ? "Added to the report" : "Add to the report"}
        </Button>
      </div>
    </div>
  );
}
