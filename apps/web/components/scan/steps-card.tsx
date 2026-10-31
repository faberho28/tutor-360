"use client";

import { cn } from "cn";
import { useEffect } from "react";
import { PANEL_CARD } from "@/components/scan/panel-card";
import { StepItem } from "@/components/scan/step-item";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { useServices } from "@/lib/services/context";
import { useSession, useSessionStore } from "@/lib/session/session-provider";
import { currentStepIndex, stepProgress, stepStatus } from "@/lib/steps";

const NO_STEPS: number[] = [];

/**
 * Step by step for the selected part, from its diagnosis. It also asks for
 * the diagnosis of the selection, so it works even if the list is collapsed.
 */
export function StepsCard() {
  const store = useSessionStore();
  const { requestDiagnosis } = useServices();
  const hasDetections = useSession((s) => s.detections.length > 0);
  const selected = useSession((s) =>
    s.detections.find((d) => d.id === s.selectedId),
  );
  const needsDiagnosis = selected !== undefined && selected.status !== "ok";
  const entry = useSession((s) =>
    selected ? s.diagnoses[selected.id] : undefined,
  );

  useEffect(() => {
    if (selected && needsDiagnosis && !entry) {
      requestDiagnosis(store, selected);
    }
  }, [store, requestDiagnosis, selected, needsDiagnosis, entry]);

  const key = selected?.id ?? "";
  const done = useSession((s) => s.completedSteps[key] ?? NO_STEPS);
  const skipped = useSession((s) => s.skippedSteps[key] ?? NO_STEPS);
  const toggleStep = useSession((s) => s.toggleStep);
  const skipStep = useSession((s) => s.skipStep);

  const steps: readonly string[] | null =
    entry?.status === "ready" ? entry.data.steps : null;
  // What to say while there are no steps to show.
  const failed = entry?.status === "error" || entry?.status === "unavailable";

  const total = steps?.length ?? 0;
  const current = steps ? currentStepIndex(total, done, skipped) : null;
  const progress = stepProgress(total, done, skipped);

  // Only a selected part that needs fixing has steps here: the guided
  // procedure covers the whole scene.
  if (!hasDetections || !selected || !needsDiagnosis) return null;

  const counter = !steps
    ? ""
    : current === null
      ? "Completado"
      : `${current + 1} de ${total}`;

  return (
    <Card
      size="sm"
      className={cn(PANEL_CARD, "max-h-[40%] min-h-0 shrink-0 px-4")}
    >
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-xs font-semibold">Paso a paso</h2>
        <p
          className="text-xs text-muted-foreground tabular-nums"
          aria-live="polite"
        >
          {counter}
        </p>
      </div>
      {steps ? (
        <>
          <Progress
            value={progress}
            aria-label="Progreso de los pasos"
            className="h-1"
          />
          <ul className="-my-1 min-h-0 flex-1 overflow-y-auto">
            {steps.map((text, index) => (
              <StepItem
                key={`${key}-${index}`}
                idPrefix={key}
                index={index}
                text={text}
                status={stepStatus(index, done, skipped)}
                current={index === current}
                onToggle={() => toggleStep(key, index)}
                onSkip={() => skipStep(key, index)}
              />
            ))}
          </ul>
        </>
      ) : failed ? (
        <p className="text-xs text-muted-foreground">
          Los pasos aparecen cuando el diagnóstico se carga.
        </p>
      ) : (
        <div className="flex flex-col gap-2" role="status">
          <Skeleton className="h-5 rounded-md" />
          <Skeleton className="h-5 w-3/4 rounded-md" />
        </div>
      )}
    </Card>
  );
}
