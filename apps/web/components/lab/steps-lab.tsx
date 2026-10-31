"use client";

import { useEffect, useRef, useState } from "react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { requestAnalysis } from "@/lib/analysis/analyze-client";
import { partSchema, type PlannedPart } from "@/lib/analysis/scene";
import { captureFrame, type CapturedFrame } from "@/lib/camera/capture-frame";
import {
  listVideoDevices,
  loadPreferredDevice,
  savePreferredDevice,
} from "@/lib/camera/devices";
import { guideParts } from "@/lib/guide/limits";
import { markFrame } from "@/lib/guide/mark-frame";
import { LAB_CASES } from "@/lib/lab/cases";
import type { CameraDevice, Detection } from "@/lib/types";

type Stage = "plan" | "sam" | "guide";

type PlanResult = {
  prompt: string;
  parts: PlannedPart[];
  ms: number;
};
type SamResult = { detections: Detection[]; marked: string; ms: number };
type GuideStepResult = { text: string; target: string | null };
type GuideResult = {
  prompt: string;
  goal: string;
  steps: GuideStepResult[];
  /** Said when no step is left. */
  conclusion?: string;
  ms: number;
};
type Report = { result: "yes" | "no" | "unsure"; note?: string };
/** The procedure being followed: what the student reported after each step. */
type GuideRun = {
  goal: string;
  steps: GuideStepResult[];
  reports: Report[];
  current: number;
  conclusion: string;
  prompt: string;
  ms: number;
};

async function post<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  const json = (await response.json().catch(() => null)) as
    (T & { error?: string; message?: string }) | null;
  if (!response.ok || !json || json.error) {
    throw new Error(json?.message ?? json?.error ?? `HTTP ${response.status}`);
  }
  return json;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("No se pudo leer la imagen"));
    image.src = src;
  });
}

/**
 * A bench for the prompts: the three stages of the scan, one button each. 1) What
 * Spark says about the state of the object and what it would ask SAM for; 2) what
 * SAM paints for that; 3) the guide Spark writes from both. Every stage can run
 * with an edited prompt. Development only.
 */
export function StepsLab() {
  const [frame, setFrame] = useState<CapturedFrame | null>(null);
  const [caseId, setCaseId] = useState(LAB_CASES[0]!.id);
  const [context, setContext] = useState(LAB_CASES[0]!.context);
  // The tutor never gets the analysis prompt: only what the user says they are doing.
  const tutorContext =
    caseId === "personalizado"
      ? context
      : (LAB_CASES.find((c) => c.id === caseId)?.description ?? "");
  const [busy, setBusy] = useState<Stage | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [planPrompt, setPlanPrompt] = useState("");
  const [plan, setPlan] = useState<PlanResult | null>(null);
  const [planJson, setPlanJson] = useState("");
  const [sam, setSam] = useState<SamResult | null>(null);
  const [guidePrompt, setGuidePrompt] = useState("");
  const [guide, setGuide] = useState<GuideRun | null>(null);
  const [note, setNote] = useState("");
  const [effort, setEffort] = useState<"minimal" | "low" | "medium" | "high">(
    "minimal",
  );

  const [cameraOn, setCameraOn] = useState(false);
  const [devices, setDevices] = useState<CameraDevice[]>([]);
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraOn(false);
  };
  useEffect(() => () => stopCamera(), []);

  const reset = () => {
    setPlan(null);
    setPlanJson("");
    setSam(null);
    setGuide(null);
    setError(null);
  };

  const run = async (stage: Stage, task: () => Promise<void>) => {
    setBusy(stage);
    setError(null);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(null);
    }
  };

  const onFile = async (file: File | undefined) => {
    if (!file) return;
    const url = URL.createObjectURL(file);
    try {
      setFrame(await captureFrame(await loadImage(url)));
      reset();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      URL.revokeObjectURL(url);
    }
  };

  /** Opens `wanted` (or the saved camera, or the default one); the list of cameras is read once there is permission, so it has names. */
  const startCamera = async (wanted?: string | null) => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    const id = wanted ?? loadPreferredDevice();
    try {
      const open = (exact: string | null) =>
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: exact ? { deviceId: { exact } } : true,
        });
      let stream: MediaStream;
      try {
        stream = await open(id);
      } catch (e) {
        // The saved camera may be gone: the default one.
        if (
          !id ||
          !(e instanceof DOMException) ||
          e.name !== "OverconstrainedError"
        )
          throw e;
        stream = await open(null);
      }
      streamRef.current = stream;
      setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? null);
      setDevices(await listVideoDevices());
      setCameraOn(true);
      // The <video> mounts on the next render.
      requestAnimationFrame(() => {
        if (videoRef.current) videoRef.current.srcObject = stream;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };

  const chooseCamera = (id: string) => {
    savePreferredDevice(id);
    void startCamera(id);
  };

  const takePhoto = async () => {
    const video = videoRef.current;
    if (!video) return;
    setFrame(await captureFrame(video));
    reset();
    stopCamera();
  };

  const loadPrompt = (stage: "plan" | "guide") =>
    run(stage === "plan" ? "plan" : "guide", async () => {
      if (!frame) return;
      if (stage === "plan") {
        const { prompt } = await post<{ prompt: string }>("/api/lab/plan", {
          image: frame.dataUrl,
          context,
          dryRun: true,
        });
        setPlanPrompt(prompt);
      } else {
        const parts = guideParts(sam?.detections ?? []).map(toPart);
        const { prompt } = await post<{ prompt: string }>("/api/lab/guide", {
          image: sam?.marked ?? frame.dataUrl,
          context: tutorContext,
          parts,
          dryRun: true,
        });
        setGuidePrompt(prompt);
      }
    });

  const askState = () =>
    run("plan", async () => {
      if (!frame) return;
      setSam(null);
      setGuide(null);
      const result = await post<PlanResult>("/api/lab/plan", {
        image: frame.dataUrl,
        context,
        prompt: planPrompt.trim() || undefined,
      });
      setPlan(result);
      setPlanJson(JSON.stringify(result.parts, null, 2));
    });

  const paintWithSam = () =>
    run("sam", async () => {
      if (!frame) return;
      setGuide(null);
      const parts = z.array(partSchema).parse(JSON.parse(planJson));
      const startedAt = performance.now();
      const response = await requestAnalysis(frame, "lab-pasos", {
        plan: parts,
        context,
        judgesCondition: false,
      });
      const detections = response.components;
      const marked = await markFrame(frame, guideParts(detections));
      setSam({
        detections,
        marked,
        ms: Math.round(performance.now() - startedAt),
      });
    });

  const writeGuide = () =>
    run("guide", async () => {
      if (!frame || !sam) return;
      const parts = guideParts(sam.detections).map(toPart);
      const result = await post<GuideResult>("/api/lab/guide", {
        image: sam.marked,
        context: tutorContext,
        parts,
        prompt: guidePrompt.trim() || undefined,
        effort,
      });
      setNote("");
      setGuide({
        goal: result.goal,
        steps: result.steps,
        reports: [],
        current: 0,
        conclusion: result.conclusion ?? "",
        prompt: result.prompt,
        ms: result.ms,
      });
    });

  /** The student says what happened in the current step: Spark decides what comes next. */
  const answerStep = (result: Report["result"]) =>
    run("guide", async () => {
      if (!sam || !guide) return;
      const reports: Report[] = [
        ...guide.reports,
        note.trim() ? { result, note: note.trim() } : { result },
      ];
      const next = await post<GuideResult>("/api/lab/guide", {
        image: sam.marked,
        context: tutorContext,
        parts: guideParts(sam.detections).map(toPart),
        progress: {
          goal: guide.goal,
          steps: guide.steps.map((step) => step.text),
          current: guide.current + 1,
          reports,
        },
        effort,
      });
      setNote("");
      setGuide({
        goal: next.goal,
        steps: [...guide.steps.slice(0, guide.current + 1), ...next.steps],
        reports,
        current: guide.current + 1,
        conclusion: next.conclusion ?? "",
        prompt: next.prompt,
        ms: next.ms,
      });
    });

  const counts = new Map<string, number>();
  sam?.detections.forEach((d) =>
    counts.set(kind(d.label), (counts.get(kind(d.label)) ?? 0) + 1),
  );
  const numbered = guideParts(sam?.detections ?? []);

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 px-4 py-6">
      <header>
        <h1 className="text-lg font-semibold">Laboratorio de pasos</h1>
        <p className="text-sm text-muted-foreground">
          Solo desarrollo. Corre cada etapa por separado y ajusta su prompt.
        </p>
      </header>

      <Card className="gap-3 p-4">
        <h2 className="text-sm font-semibold">Imagen y contexto</h2>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="file"
            accept="image/*"
            onChange={(e) => void onFile(e.target.files?.[0])}
            className="text-sm"
          />
          {cameraOn ? (
            <>
              <Button type="button" size="sm" onClick={() => void takePhoto()}>
                Tomar foto
              </Button>
              <select
                value={deviceId ?? ""}
                onChange={(e) => chooseCamera(e.target.value)}
                className="h-8 max-w-64 rounded-lg border border-input bg-background px-2 text-sm"
                aria-label="Cámara"
              >
                {devices.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.label}
                  </option>
                ))}
              </select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={stopCamera}
              >
                Cerrar cámara
              </Button>
            </>
          ) : (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => void startCamera()}
            >
              Usar cámara
            </Button>
          )}
          <select
            value={caseId}
            onChange={(e) => {
              const found = LAB_CASES.find((c) => c.id === e.target.value);
              if (!found) return;
              setCaseId(found.id);
              setContext(found.context);
            }}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            aria-label="Caso"
          >
            {LAB_CASES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
        <Textarea
          value={context}
          onChange={(e) => setContext(e.target.value)}
          aria-label="Contexto del caso (en inglés)"
          className="min-h-16"
        />
        {cameraOn ? (
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="max-h-72 rounded-lg"
          />
        ) : frame ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={frame.dataUrl}
            alt="Imagen de prueba"
            className="max-h-72 w-fit rounded-lg"
          />
        ) : null}
      </Card>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">1. Plan para SAM (Spark)</h2>
          <Button
            type="button"
            disabled={!frame || busy !== null}
            onClick={() => void askState()}
          >
            {busy === "plan" ? "Preguntando…" : "Obtener el plan"}
          </Button>
        </div>
        <PromptBox
          value={planPrompt}
          onChange={setPlanPrompt}
          onLoad={() => void loadPrompt("plan")}
          disabled={!frame || busy !== null}
        />
        {plan ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              <span className="font-medium">Tipos de pieza: </span>
              {plan.parts.length}{" "}
              <span className="text-muted-foreground">({plan.ms} ms)</span>
            </p>
            <p className="font-medium">Lo que le pediría a SAM (editable):</p>
            <Textarea
              value={planJson}
              onChange={(e) => setPlanJson(e.target.value)}
              aria-label="Plan para SAM"
              className="min-h-40 font-mono text-xs"
            />
          </div>
        ) : null}
      </Card>

      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">2. Máscaras (SAM)</h2>
          <Button
            type="button"
            disabled={!plan || busy !== null}
            onClick={() => void paintWithSam()}
          >
            {busy === "sam" ? "Pintando…" : "Generar máscaras"}
          </Button>
        </div>
        {sam ? (
          <div className="flex flex-col gap-2 text-sm">
            <p>
              {sam.detections.length} máscaras en {sam.ms} ms
              {numbered.length < sam.detections.length
                ? ` (la guía ve las ${numbered.length} mayores)`
                : ""}
              :{" "}
              {[...counts.entries()]
                .map(([label, n]) => `${label} ×${n}`)
                .join(", ") || "ninguna"}
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={sam.marked}
              alt="Piezas numeradas"
              className="max-h-[28rem] w-fit rounded-lg"
            />
          </div>
        ) : null}
      </Card>

      <Card className="gap-3 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">3. Guía (Spark)</h2>
          <select
            value={effort}
            onChange={(e) => setEffort(e.target.value as typeof effort)}
            className="h-8 rounded-lg border border-input bg-background px-2 text-sm"
            aria-label="Esfuerzo de razonamiento"
          >
            {["minimal", "low", "medium", "high"].map((value) => (
              <option key={value} value={value}>
                Esfuerzo: {value}
              </option>
            ))}
          </select>
          <Button
            type="button"
            disabled={!sam || busy !== null}
            onClick={() => void writeGuide()}
          >
            {busy === "guide" ? "Escribiendo…" : "Generar la guía"}
          </Button>
        </div>
        <PromptBox
          value={guidePrompt}
          onChange={setGuidePrompt}
          onLoad={() => void loadPrompt("guide")}
          disabled={!sam || busy !== null}
        />
        {guide ? (
          <div className="flex flex-col gap-3 text-sm">
            <p>
              <span className="font-medium">Objetivo: </span>
              {guide.goal}{" "}
              <span className="text-muted-foreground">({guide.ms} ms)</span>
            </p>
            <ol className="flex list-decimal flex-col gap-3 pl-5">
              {guide.steps.map((step, i) => {
                const n = numbered.findIndex((d) => d.id === step.target) + 1;
                const report = guide.reports[i];
                return (
                  <li key={i} className={i < guide.current ? "opacity-70" : ""}>
                    {step.text}{" "}
                    <span className="text-muted-foreground">
                      {n > 0 ? `[pieza ${n}]` : "[sin pieza]"}
                    </span>
                    {report ? (
                      <p className="text-muted-foreground">
                        Respuesta:{" "}
                        {report.result === "yes"
                          ? "sí pasó"
                          : report.result === "no"
                            ? "no pasó"
                            : "no sé"}
                        {report.note ? ` — "${report.note}"` : ""}
                      </p>
                    ) : null}
                    {i === guide.current ? (
                      <div className="mt-2 flex flex-col gap-2">
                        <Textarea
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Qué viste o mediste (opcional)"
                          aria-label="Nota del paso"
                          className="min-h-14"
                        />
                        <div className="flex flex-wrap gap-2">
                          {(
                            [
                              ["yes", "Sí pasó"],
                              ["no", "No pasó"],
                              ["unsure", "No sé"],
                            ] as const
                          ).map(([result, label]) => (
                            <Button
                              key={result}
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={busy !== null}
                              onClick={() => void answerStep(result)}
                            >
                              {label}
                            </Button>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ol>
            {guide.current >= guide.steps.length ? (
              <p className="rounded-lg bg-muted p-3">
                <span className="font-medium">Conclusión: </span>
                {guide.conclusion || "(la guía terminó sin conclusión)"}
              </p>
            ) : null}
            <details>
              <summary className="cursor-pointer text-muted-foreground">
                Último prompt enviado
              </summary>
              <pre className="mt-2 max-h-96 overflow-auto rounded-lg bg-muted p-3 text-xs whitespace-pre-wrap">
                {guide.prompt}
              </pre>
            </details>
          </div>
        ) : null}
      </Card>
    </main>
  );
}

/** Repeated names come back numbered ("tecla 3"): count them as one kind. */
function kind(label: string) {
  return label.replace(/\s+\d+$/, "");
}

function toPart(d: Detection) {
  return { id: d.id, label: d.label, status: d.status };
}

/** The prompt of a stage: empty means "the real one"; load it to edit it. */
function PromptBox({
  value,
  onChange,
  onLoad,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  onLoad: () => void;
  disabled: boolean;
}) {
  return (
    <details>
      <summary className="cursor-pointer text-sm text-muted-foreground">
        Prompt {value.trim() ? "(editado)" : "(el del código)"}
      </summary>
      <div className="mt-2 flex flex-col gap-2">
        <div className="flex gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={disabled}
            onClick={onLoad}
          >
            Cargar el prompt actual
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onChange("")}
          >
            Usar el del código
          </Button>
        </div>
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-label="Prompt"
          className="min-h-48 font-mono text-xs"
        />
      </div>
    </details>
  );
}
