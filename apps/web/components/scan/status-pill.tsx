"use client";

import { cn } from "cn";
import { Badge } from "@/components/ui/badge";
import { useElapsed } from "@/hooks/use-elapsed";
import { copy, formatElapsed } from "@/lib/copy";
import { useSession } from "@/lib/session/session-provider";

/** "● Analizando 00:12:34", "En pausa", "Sin conexión con la IA", ... */
export function StatusPill() {
  const phase = useSession((s) => s.analysis.phase);
  const startedAt = useSession((s) => s.analysis.startedAt);
  const analyzing = phase === "analyzing";
  const elapsed = useElapsed(startedAt, analyzing);

  const failed = phase === "offline" || phase === "quota" || phase === "error";

  return (
    <Badge
      variant="inverse"
      role="status"
      aria-live="polite"
      className="h-8 gap-2 px-3 text-sm"
    >
      <span
        aria-hidden="true"
        className={cn(
          "size-2 rounded-full",
          analyzing && "bg-anomaly motion-safe:animate-pulse",
          failed && "bg-warning",
          !analyzing && !failed && "bg-muted-foreground",
        )}
      />
      <span>{copy.status[phase]}</span>
      {analyzing ? (
        <span className="font-semibold tabular-nums">
          {formatElapsed(elapsed)}
        </span>
      ) : null}
    </Badge>
  );
}
