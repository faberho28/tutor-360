"use client";

import { Check, FileDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { CapturesStrip } from "@/components/scan/captures-strip";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useReturnFocus } from "@/hooks/use-return-focus";
import { REPORT_LATENCY_MS, reportDemo } from "@/lib/fixtures/mock-report";
import { useSession } from "@/lib/session/session-provider";

type ReportPhase = "idle" | "generating" | "done" | "error";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-muted/60 p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-xl font-semibold tabular-nums">{value}</dd>
    </div>
  );
}

/**
 * Session summary and captures, with the (simulated) report generation.
 * HU-26 and HU-27 make the generation and the PDF download real.
 */
export function ReportDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const captures = useSession((s) => s.captures);
  const included = useSession((s) => s.reportIds.length);
  const [phase, setPhase] = useState<ReportPhase>("idle");
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const returnFocus = useReturnFocus(open);

  const anomalies = captures.reduce(
    (sum, c) => sum + c.detections.filter((d) => d.status === "anomaly").length,
    0,
  );
  const warnings = captures.reduce(
    (sum, c) => sum + c.detections.filter((d) => d.status === "warning").length,
    0,
  );

  // Closing the dialog cancels a generation in progress.
  function handleOpenChange(next: boolean) {
    if (!next) {
      clearTimeout(timer.current);
      setPhase("idle");
    }
    onOpenChange(next);
  }

  useEffect(() => () => clearTimeout(timer.current), []);

  function generate() {
    if (captures.length === 0) return;
    setPhase("generating");
    timer.current = setTimeout(() => {
      if (reportDemo.fail) {
        setPhase("error");
        return;
      }
      setPhase("done");
      toast.success("Reporte generado");
    }, REPORT_LATENCY_MS);
  }

  const generating = phase === "generating";

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={returnFocus}
        className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-2xl"
      >
        <DialogHeader>
          <DialogTitle>Reporte de la sesión</DialogTitle>
          <DialogDescription>
            Revisa las capturas antes de generar el reporte.
          </DialogDescription>
        </DialogHeader>

        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Stat label="Capturas" value={captures.length} />
          <Stat label="Anomalías" value={anomalies} />
          <Stat label="Por revisar" value={warnings} />
          <Stat label="Agregados al reporte" value={included} />
        </dl>

        <CapturesStrip />

        {generating ? (
          <div
            role="progressbar"
            aria-label="Generando el reporte"
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
          >
            <div className="h-full w-1/3 rounded-full bg-inverse motion-safe:animate-pulse" />
          </div>
        ) : null}
        {phase === "error" ? (
          <p role="alert" className="text-sm text-destructive">
            No pudimos generar el reporte. Inténtalo de nuevo.
          </p>
        ) : null}

        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="rounded-full px-5"
            onClick={() => handleOpenChange(false)}
          >
            Cerrar
          </Button>
          <Button
            type="button"
            variant="inverse"
            size="lg"
            disabled={captures.length === 0 || generating}
            onClick={generate}
          >
            {phase === "done" ? (
              <Check aria-hidden="true" className="size-5" />
            ) : (
              <FileDown aria-hidden="true" className="size-5" />
            )}
            {generating
              ? "Generando…"
              : phase === "done"
                ? "Generar de nuevo"
                : phase === "error"
                  ? "Reintentar"
                  : "Generar reporte"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
