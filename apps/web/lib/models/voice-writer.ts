import "server-only";
import { z } from "zod";
import { ModelError, toModelError } from "./errors";
import { callSpark } from "./spark-call";

export type VoiceContext = {
  /** What the student wants to achieve (Spanish). */
  goal: string;
  /** Spark's first judgment of the state of the scene (Spanish), when there is one. */
  assessment?: string;
  steps: readonly string[];
  /** The step the student is on (0-based). Equal to the length when it is over. */
  current: number;
  /** What the student reported after each step done. */
  reports: readonly ({
    result: "yes" | "no" | "unsure";
    note?: string;
  } | null)[];
  /** The step is waiting for the student to say what happened. */
  awaiting: boolean;
  /** How it ended, once there is no step left. */
  conclusion?: string;
};

export type VoiceInput = {
  /** What the student said, as the speech-to-text heard it (Spanish, may be noisy). */
  transcript: string;
  /** `data:image/jpeg;base64,...` of what the camera sees now. */
  imageDataUrl: string;
  /** The Laboratorio case context (English prompt text). */
  caseContext?: string;
  context: VoiceContext;
  apiKey?: string;
  signal?: AbortSignal;
};

export type VoiceTurn = {
  /** "answer": what happened in the step; "question": asks the tutor; "ignore": not for the tutor. */
  intent: "answer" | "question" | "ignore";
  result: "yes" | "no" | "unsure" | null;
  /** What the student added to an answer, in their words. Empty when nothing. */
  note: string;
  /** What the tutor says out loud (a question only). Empty otherwise. */
  reply: string;
};

const voiceSchema = z.object({
  intent: z.enum(["answer", "question", "ignore"]),
  result: z.enum(["yes", "no", "unsure", "none"]),
  note: z.string().trim().max(400),
  reply: z.string().trim().max(500),
});

const RESPONSE_FORMAT = {
  type: "json_schema",
  name: "voice_turn",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["intent", "result", "note", "reply"],
    properties: {
      intent: { type: "string", enum: ["answer", "question", "ignore"] },
      result: { type: "string", enum: ["yes", "no", "unsure", "none"] },
      note: { type: "string" },
      reply: { type: "string" },
    },
  },
} as const;

export function buildVoicePrompt(
  input: Pick<VoiceInput, "transcript" | "caseContext" | "context">,
): string {
  const { context } = input;
  const over = context.current >= context.steps.length;
  return [
    "You are the voice of PC-Tutor 360, a patient tutor talking out loud with a student apprentice who has both hands busy working on something while a camera shows it. What you receive is what the student just said, written by an automatic speech-to-text that is often wrong: words may be changed, accents lost, and strange junk words may appear. Read it by meaning and by how it sounds, never literally.",
    input.caseContext ? `Task context: ${input.caseContext}` : null,
    `The goal of the procedure: ${context.goal}`,
    context.assessment
      ? `The first look at the object concluded: ${context.assessment}`
      : null,
    "The procedure (the student is on the step marked with >>):",
    ...context.steps.map((step, i) => {
      const report = context.reports[i];
      const state =
        i < context.current
          ? ` [done${report ? `: ${report.result === "yes" ? "it happened as the step said" : report.result === "no" ? "it did NOT happen" : "could not tell"}${report.note ? `, they said: ${report.note}` : ""}` : ""}]`
          : "";
      return `${i === context.current ? ">> " : ""}${i + 1}. ${step}${state}`;
    }),
    over
      ? `The steps are over.${context.conclusion ? ` How it ended: ${context.conclusion}` : ""}`
      : context.awaiting
        ? "The current step is waiting for the student to say what happened."
        : "The tutor is still working out what comes after the last answer.",
    "The image is what the camera sees right now.",
    `What the student said: "${input.transcript}"`,
    "Decide:",
    `- "intent": "answer" ONLY when the current step is waiting and the student tells what happened in it (yes, no, or that they cannot tell), with or without extra words. "question" when they ask the tutor something about the procedure or about what they have in front of them, or call the tutor ("tutor"). "ignore" for anything else: chatter, noise, a fragment, someone else, a word or two with no meaning for the task. When unsure between answering and ignoring, ignore.`,
    '- "result": for an answer, "yes" if it happened as the step said, "no" if it did not, "unsure" if they could not tell. "none" for question and ignore. When the student says an explicit yes or no ("sí", "no", "pasó", "no pasó", "listo", "no funcionó"), THAT decides the result, even if what they add seems to point the other way: the words they chose are their answer. Judge by what they describe only when they give no explicit yes or no. Keep in mind the speech-to-text may have garbled the yes/no word itself ("sí pasó" heard as "esa pasa", "no pasó" as "no pasa").',
    '- "note": for an answer, what the student added about what they saw or measured, cleaned up, in Spanish, in their own words. Empty string when they added nothing.',
    '- "reply": for a question only, what you say out loud: at most two short sentences in Spanish (Colombia), spoken language, concrete, using the image and the procedure. Address the student as "tú" (never "usted": "mueve", not "mueva"). Say what you can see; when the camera does not show what they ask about, say so and do not guess. Never invent. Empty string for answer and ignore.',
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function parseVoiceTurn(text: string): VoiceTurn {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new ModelError(
      "invalid_response",
      "The voice turn is not valid JSON",
      { cause: error },
    );
  }
  const parsed = voiceSchema.safeParse(json);
  if (!parsed.success) {
    throw new ModelError(
      "invalid_response",
      `The voice turn does not match the contract: ${z.prettifyError(parsed.error)}`,
    );
  }
  const { intent, result, note, reply } = parsed.data;
  return {
    intent,
    result: intent === "answer" && result !== "none" ? result : null,
    note: intent === "answer" ? note : "",
    reply: intent === "question" ? reply : "",
  };
}

/** Low: the same words should get the same decision. */
const VOICE_TEMPERATURE = 0.2;

/** Understands one thing the student said and, when it is a question, answers it. */
export class MetaVoiceWriter {
  async write(input: VoiceInput): Promise<VoiceTurn> {
    try {
      const text = await callSpark({
        imageDataUrl: input.imageDataUrl,
        prompt: buildVoicePrompt(input),
        format: RESPONSE_FORMAT,
        reasoningEffort: "minimal",
        temperature: VOICE_TEMPERATURE,
        apiKey: input.apiKey,
        signal: input.signal,
      });
      return parseVoiceTurn(text);
    } catch (error) {
      throw toModelError(error);
    }
  }
}
