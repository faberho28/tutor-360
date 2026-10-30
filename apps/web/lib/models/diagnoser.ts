import "server-only";
import { z } from "zod";
import type { ComponentStatus } from "../component-status";
import { getEnv } from "../env";
import type { Diagnosis } from "../types";
import { ModelError, toModelError } from "./errors";
import { callSpark } from "./spark-call";

export type DiagnoseInput = {
  /** Name of the object (Spanish) and what the scene reading said about it. */
  label: string;
  status: ComponentStatus;
  reason: string | null;
  /** `data:image/jpeg;base64,...` of the component crop. */
  cropDataUrl: string;
  /** The Laboratorio case context (English prompt text). */
  context?: string;
  apiKey?: string;
  signal?: AbortSignal;
};

export interface Diagnoser {
  diagnose(input: DiagnoseInput): Promise<Diagnosis>;
}

const SEVERITIES = ["low", "medium", "high"] as const;
const MAX_STEPS = 6;

const diagnosisSchema = z.object({
  summary: z.string().trim().min(1).max(900),
  severity: z.enum(SEVERITIES),
  steps: z.array(z.string().trim().min(1).max(420)).min(1).max(MAX_STEPS),
  confirmed: z.boolean(),
});

const RESPONSE_FORMAT = {
  type: "json_schema",
  name: "diagnosis",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["summary", "severity", "steps", "confirmed"],
    properties: {
      summary: { type: "string" },
      severity: { type: "string", enum: [...SEVERITIES] },
      steps: { type: "array", items: { type: "string" } },
      confirmed: { type: "boolean" },
    },
  },
} as const;

export function buildDiagnosisPrompt(
  input: Pick<DiagnoseInput, "context" | "label" | "status" | "reason">,
): string {
  return [
    "You are a patient tutor for a student apprentice technician who points a camera at something to inspect it. The student is learning: they need to understand what they are looking at and how to act, not just to receive orders.",
    input.context ? `Task context: ${input.context}` : null,
    `The image shows one part with its surroundings. The part is outlined in magenta: diagnose only that part, and use the rest as context. An earlier look named it "${input.label}" and rated it "${input.status}"${input.reason ? `, saying: "${input.reason}"` : ""}. Use that only as a hint: look at the image and say what you really see. The magenta line is a drawing added for you, never a fault of the part.`,
    "Write the diagnosis in Spanish (Colombia) with correct spelling, accents included, in plain words an apprentice understands. Rules:",
    '- "summary": three or four sentences that teach. First say what the part is and what it does, in plain words, so the student knows what they are looking at. Then say what looks normal or wrong in this image and why it matters. If you cannot tell from the image, say what you can see and what would settle it.',
    '- "severity": "low" when it can wait, "medium" when it should be fixed soon, "high" when it should be handled before using the equipment. Never exaggerate.',
    `- "steps": a guide for the student, between 3 and ${MAX_STEPS} steps in the order to do them. Each step is ONE action starting with a verb, followed by a colon and a short reason why, so the student learns (for example "Desconecta el cargador de la corriente: así evitas una descarga mientras lo revisas"). Say what to look for ("busca un abultamiento en la parte de arriba") and explain any technical term in plain words. Begin with safety when it applies (power off, unplug, discharge). Do not recommend replacing a part before the cheaper checks.`,
    '- "confirmed": true only when the close-up really supports the reported condition. False when it looks like dust, a shadow, a reflection, or the image is too small or blurry to tell.',
    "- Judge only what you can see. Never invent a part number, a measurement or a fault that is not visible.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function parseDiagnosis(text: string): Diagnosis {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new ModelError(
      "invalid_response",
      "The diagnosis is not valid JSON",
      { cause: error },
    );
  }
  const parsed = diagnosisSchema.safeParse(json);
  if (!parsed.success) {
    throw new ModelError(
      "invalid_response",
      `The diagnosis does not match the contract: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

/** Low: advice should be steady, not creative. */
const DIAGNOSIS_TEMPERATURE = 0.3;

/**
 * Failures another model can get past: each model has its own rate limit, so a
 * 429 on one leaves the other free, and a server hiccup is not tied to a model.
 * An empty key, a bad request or a cancelled call fail the same on any model
 * (and running out of credits fails all of them).
 */
const FALLBACK_KINDS: ReadonlySet<ModelError["kind"]> = new Set([
  "quota",
  "timeout",
  "network",
  "invalid_response",
  "unknown",
]);

export class MetaDiagnoser implements Diagnoser {
  /** The model that wrote the last diagnosis (for the log). */
  lastModel: string | null = null;

  private async ask(input: DiagnoseInput, model: string): Promise<Diagnosis> {
    const text = await callSpark({
      imageDataUrl: input.cropDataUrl,
      prompt: buildDiagnosisPrompt(input),
      format: RESPONSE_FORMAT,
      reasoningEffort: "low",
      temperature: DIAGNOSIS_TEMPERATURE,
      model,
      apiKey: input.apiKey,
      signal: input.signal,
    });
    const diagnosis = parseDiagnosis(text);
    this.lastModel = model;
    return diagnosis;
  }

  async diagnose(input: DiagnoseInput): Promise<Diagnosis> {
    const { DIAGNOSIS_MODEL, DIAGNOSIS_FALLBACK_MODEL } = getEnv();
    try {
      return await this.ask(input, DIAGNOSIS_MODEL);
    } catch (error) {
      const primary = toModelError(error);
      const retry =
        FALLBACK_KINDS.has(primary.kind) &&
        DIAGNOSIS_FALLBACK_MODEL !== DIAGNOSIS_MODEL &&
        !input.signal?.aborted;
      if (!retry) throw primary;
      try {
        return await this.ask(input, DIAGNOSIS_FALLBACK_MODEL);
      } catch {
        // The first failure is the one worth reporting.
        throw primary;
      }
    }
  }
}
