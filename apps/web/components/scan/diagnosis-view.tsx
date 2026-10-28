"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { severityLabel } from "@/lib/copy";
import type { DiagnosisEntry } from "@/lib/types";

/** Diagnosis text with its loading and error states. */
export function DiagnosisView({
  entry,
  onRetry,
}: {
  entry: DiagnosisEntry | undefined;
  onRetry: () => void;
}) {
  if (!entry || entry.status === "loading") {
    return (
      <div role="status" aria-label="Generando diagnóstico">
        <div className="flex flex-col gap-2">
          <Skeleton className="h-4 w-full rounded-md" />
          <Skeleton className="h-4 w-11/12 rounded-md" />
          <Skeleton className="h-4 w-2/3 rounded-md" />
        </div>
      </div>
    );
  }

  if (entry.status === "error") {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-sm">No pudimos generar el diagnóstico.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }

  const severity = severityLabel[entry.data.severity];
  return (
    <div className="flex flex-col gap-2">
      <Badge variant={severity.variant}>{severity.text}</Badge>
      <p className="text-sm leading-relaxed">{entry.data.summary}</p>
    </div>
  );
}
