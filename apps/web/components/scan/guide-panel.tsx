"use client";

import { Check, CircleHelp, Loader, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useAnalysis } from "@/components/scan/analysis-provider";
import { PANEL_CARD } from "@/components/scan/panel-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { splitStep } from "@/lib/guide/focus";
import { useSession } from "@/lib/session/session-provider";
import type { GuideOutcome, GuideReport, GuideVerdict } from "@/lib/types";

/**
 * The guided procedure: the step the student is on, why, and the part it is
 * about (highlighted on the camera). After each step the student says whether
 * it happened as the step said (and may write what they saw); the tutor then
 * works out what comes next. While it prepares, or once it is ready, it
 * replaces the list of parts.
 */
export function GuidePanel({ onShowParts }: { onShowParts: () => void }) {
  const guide = useSession((s) => s.guide);
  const { analysis } = useAnalysis();
  const [note, setNote] = useState("");

  const answer = (result: GuideReport["result"]) => {
    analysis.answerGuideStep(
      note.trim() ? { result, note: note.trim() } : { result },
    );
    setNote("");
  };

  if (guide.status === "loading") {
    return (
      <Card className={PANEL_CARD}>
        <div
          role="status"
          className="flex items-center gap-3 px-4 py-3 text-sm text-muted-foreground"
        >
          <Loader
            aria-hidden="true"
            className="size-4 motion-safe:animate-spin"
          />
          Preparando la guía…
        </div>
      </Card>
    );
  }
  if (guide.status !== "ready") return null;

  const total = guide.steps.length;
  const thinking = guide.thinking;
  const finished = guide.current >= total && !thinking;
  const step = guide.steps[guide.current];
  const { action, reason } = step
    ? splitStep(step.text)
    : { action: "", reason: "" };

  return (
    <Card className={PANEL_CARD}>
      <div className="flex flex-col gap-3 px-4 py-4">
        <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
          <span>
            {finished
              ? "Guía completa"
              : `Paso ${guide.current + 1} de ${total}`}
          </span>
          <button
            type="button"
            onClick={onShowParts}
            className="underline-offset-2 hover:underline"
          >
            Ver las piezas
          </button>
        </div>
        <p className="text-sm leading-snug font-semibold">
          <span className="font-medium text-muted-foreground">Objetivo: </span>
          {guide.goal}
        </p>
        <Progress
          value={Math.round((Math.min(guide.current, total) / total) * 100)}
          aria-label="Avance de la guía"
        />

        {thinking ? (
          <p
            role="status"
            className="flex items-center gap-2 text-sm text-muted-foreground"
          >
            <Loader
              aria-hidden="true"
              className="size-4 motion-safe:animate-spin"
            />
            Pensando lo que sigue…
          </p>
        ) : finished ? (
          <Finished />
        ) : (
          <>
            <p className="text-base leading-snug font-semibold">{action}</p>
            {reason ? (
              <p className="text-sm leading-snug text-muted-foreground">
                {reason}
              </p>
            ) : null}
            <Input
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="Qué viste o mediste (opcional)"
              aria-label="Nota del paso"
              maxLength={400}
            />
            <div className="flex flex-wrap gap-2">
              <Button type="button" onClick={() => answer("yes")}>
                <Check aria-hidden="true" data-icon="inline-start" />
                Sí pasó
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => answer("no")}
              >
                <X aria-hidden="true" data-icon="inline-start" />
                No pasó
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => answer("unsure")}
              >
                <CircleHelp aria-hidden="true" data-icon="inline-start" />
                No sé
              </Button>
            </div>
          </>
        )}
      </div>
    </Card>
  );
}

const VERDICT_TITLE: Record<GuideVerdict, string> = {
  resolved: "La cámara ve el problema resuelto",
  unchanged: "La cámara no ve cambios",
  cannot_tell: "La cámara no puede confirmarlo",
};

const OUTCOMES: { value: GuideOutcome; label: string }[] = [
  { value: "yes", label: "Sí" },
  { value: "no", label: "No" },
  { value: "unsure", label: "No sé" },
];

/**
 * The end of the steps: the camera compares the scene with the one the guide
 * started from (once, by itself) and the student says whether it worked. The
 * student's answer is the one that counts; the camera only accompanies it.
 */
function Finished() {
  const { analysis } = useAnalysis();
  const guide = useSession((s) => s.guide);
  const answer = useSession((s) => s.answerGuide);

  useEffect(() => {
    analysis.checkGuide();
  }, [analysis]);

  if (guide.status !== "ready") return null;
  const { check, outcome, conclusion } = guide;

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Check aria-hidden="true" className="size-4 text-ok" />
        Terminaste los pasos.
      </p>

      {conclusion ? (
        <p className="rounded-lg bg-muted p-3 text-sm leading-snug">
          <span className="font-medium">Conclusión: </span>
          {conclusion}
        </p>
      ) : null}

      <div className="flex flex-col gap-2" role="group" aria-label="Resultado">
        <p className="text-sm font-semibold">¿Se solucionó?</p>
        <div className="flex flex-wrap gap-2">
          {OUTCOMES.map(({ value, label }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={outcome === value ? "default" : "outline"}
              aria-pressed={outcome === value}
              onClick={() => answer(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {check.status === "loading" ? (
        <p
          role="status"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Loader
            aria-hidden="true"
            className="size-3.5 motion-safe:animate-spin"
          />
          Comparando con la imagen inicial…
        </p>
      ) : check.status === "ready" ? (
        <div className="flex flex-col gap-1 text-sm leading-snug">
          <p className="flex items-center gap-2 font-medium">
            {check.verdict === "resolved" ? (
              <Check aria-hidden="true" className="size-4 text-ok" />
            ) : check.verdict === "unchanged" ? (
              <X aria-hidden="true" className="size-4 text-anomaly" />
            ) : (
              <CircleHelp aria-hidden="true" className="size-4" />
            )}
            {VERDICT_TITLE[check.verdict]}
          </p>
          <p className="text-muted-foreground">{check.comment}</p>
        </div>
      ) : check.status === "error" ? (
        <p className="text-xs text-muted-foreground">
          No pudimos comparar con la cámara. Tu respuesta es la que cuenta.
        </p>
      ) : null}
    </div>
  );
}
