import "server-only";
import { z } from "zod";
import { ModelError, toModelError } from "./errors";
import { callSpark } from "./spark-call";

export type StepsInput = {
  /** `data:image/jpeg;base64,...` of the analyzed frame. */
  imageDataUrl: string;
  /** The Laboratorio case context (English prompt text). */
  context?: string;
  apiKey?: string;
  signal?: AbortSignal;
};

const MIN_STEPS = 3;
const MAX_STEPS = 6;

const stepsSchema = z.object({
  steps: z
    .array(z.string().trim().min(1).max(420))
    .min(MIN_STEPS)
    .max(MAX_STEPS),
});

const RESPONSE_FORMAT = {
  type: "json_schema",
  name: "general_steps",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["steps"],
    properties: {
      steps: { type: "array", items: { type: "string" } },
    },
  },
} as const;

export function buildStepsPrompt(input: Pick<StepsInput, "context">): string {
  return [
    "You are a patient tutor for a student apprentice technician who points a camera at something to inspect it. The student is learning: they need to understand what they are looking at and how to act.",
    input.context ? `Task context: ${input.context}` : null,
    `Look at the image and write a guide for the student on how to approach what is in front of them, before looking at any single part: between ${MIN_STEPS} and ${MAX_STEPS} steps in the order to do them, in Spanish (Colombia) with correct spelling, accents included.`,
    "Rules:",
    "- The first step tells the student what they are looking at (what the object is and what it is for, in plain words) and what to observe first.",
    '- Every other step is ONE action starting with a verb, followed by a colon and a short reason why, so the student learns (for example "Desconecta el equipo de la corriente: así evitas una descarga mientras lo revisas"). Explain any technical term in plain words.',
    "- Adapt it to what the image and the task context show. Do not mention a PC, a cover or a motherboard unless that is what it is.",
    "- Start with safety only when it applies to this kind of object (for example unplugging or powering off something connected to the mains).",
    "- The last step tells the student to point the camera at each area to inspect it, and what to look for there.",
    "- No numbering, no emojis.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function parseSteps(text: string): string[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new ModelError("invalid_response", "The steps are not valid JSON", {
      cause: error,
    });
  }
  const parsed = stepsSchema.safeParse(json);
  if (!parsed.success) {
    throw new ModelError(
      "invalid_response",
      `The steps do not match the contract: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data.steps;
}

/** Low: the same scene should get the same procedure. */
const STEPS_TEMPERATURE = 0.3;

/** The general procedure for the scene being scanned, written by Muse Spark. */
export class MetaStepsWriter {
  async write(input: StepsInput): Promise<string[]> {
    try {
      const text = await callSpark({
        imageDataUrl: input.imageDataUrl,
        prompt: buildStepsPrompt(input),
        format: RESPONSE_FORMAT,
        reasoningEffort: "minimal",
        temperature: STEPS_TEMPERATURE,
        apiKey: input.apiKey,
        signal: input.signal,
      });
      return parseSteps(text);
    } catch (error) {
      throw toModelError(error);
    }
  }
}
