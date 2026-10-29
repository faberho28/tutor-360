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
      className="h-7 gap-1.5 border-0 bg-foreground/5 px-2.5 text-xs text-foreground"
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
