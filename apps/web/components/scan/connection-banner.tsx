"use client";

import { CircleAlert, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { copy } from "@/lib/copy";
import type { AnalysisState } from "@/lib/types";

type FailedPhase = Extract<
  AnalysisState["phase"],
  "offline" | "quota" | "error"
>;

const DETAILS: Record<
  FailedPhase,
  { description: string; icon: typeof WifiOff }
> = {
  offline: {
    description: "Revisa tu conexión y vuelve a intentar el análisis.",
    icon: WifiOff,
  },
  quota: {
    description: "El análisis se reanudará cuando haya créditos disponibles.",
    icon: CircleAlert,
  },
  error: {
    description: "Conservamos los últimos componentes detectados.",
    icon: CircleAlert,
  },
};

export function ConnectionBanner({
  phase,
  onRetry,
}: {
  phase: FailedPhase;
  onRetry: () => void;
}) {
  const { description, icon: Icon } = DETAILS[phase];
  const canRetry = phase !== "quota";

  return (
    <section
      aria-labelledby="connection-banner-title"
      className="flex items-center gap-3 rounded-xl border border-warning/30 bg-warning-soft px-4 py-3 text-warning-text"
    >
      <Icon aria-hidden="true" className="size-5 shrink-0" />
      <div className="min-w-0 flex-1">
        <h2 id="connection-banner-title" className="text-sm font-semibold">
          {copy.status[phase]}
        </h2>
        <p className="text-xs">{description}</p>
      </div>
      {canRetry ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onRetry}
          className="shrink-0"
        >
          <RefreshCw aria-hidden="true" data-icon="inline-start" />
          Reintentar
        </Button>
      ) : null}
    </section>
  );
}
