"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { severityLabel } from "@/lib/copy";
import type { Diagnosis, DiagnosisEntry } from "@/lib/types";

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

  if (entry.status === "unavailable") {
    return (
      <p className="text-xs text-muted-foreground" role="status">
        El diagnóstico con IA estará disponible pronto.
      </p>
    );
  }

  if (entry.status === "error") {
    return (
      <div className="flex flex-col items-start gap-2" role="alert">
        <p className="text-xs">No pudimos generar el diagnóstico.</p>
        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }

  return <ReadyDiagnosis data={entry.data} />;
}

function ReadyDiagnosis({ data }: { data: Diagnosis }) {
  const severity = severityLabel[data.severity];
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Badge variant={severity.variant}>{severity.text}</Badge>
      </div>
      <p className="text-xs leading-relaxed">{data.summary}</p>
      {data.confirmed === false ? (
        <p className="text-xs text-muted-foreground">
          La IA no pudo confirmar este hallazgo con el recorte. Compruébalo a
          simple vista.
        </p>
      ) : null}
    </div>
  );
}
