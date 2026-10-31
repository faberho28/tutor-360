import "server-only";
import { z } from "zod";
import { ModelError, toModelError } from "./errors";
import { callSpark } from "./spark-call";

export const VERDICTS = ["resolved", "unchanged", "cannot_tell"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type VerifyInput = {
  /** `data:image/jpeg;base64,...`: the picture from before (left) and now (right). */
  imageDataUrl: string;
  /** What looked wrong at the start (Spanish), from the guide. */
  finding: string;
  /** What the student wanted to achieve (Spanish), from the guide. */
  goal: string;
  apiKey?: string;
  signal?: AbortSignal;
};

export type Verification = {
  verdict: Verdict;
  /** What changed between the two pictures, for the student (Spanish). */
  comment: string;
};

const verifySchema = z.object({
  verdict: z.enum(VERDICTS),
  comment: z.string().trim().min(1).max(320),
});

const RESPONSE_FORMAT = {
  type: "json_schema",
  name: "verify_procedure",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["verdict", "comment"],
    properties: {
      verdict: { type: "string", enum: [...VERDICTS] },
      comment: { type: "string" },
    },
  },
} as const;

export function buildVerifyPrompt(
  input: Pick<VerifyInput, "finding" | "goal">,
): string {
  return [
    "You are a patient tutor for a student apprentice technician. The student just followed a guided procedure with their hands while a camera watched.",
    `At the start the tutor wrote what looked wrong: "${input.finding}"`,
    `The goal of the procedure was: "${input.goal}"`,
    "The image has two pictures side by side: on the LEFT what the camera saw before the procedure, on the RIGHT what it sees now.",
    "Decide, by comparing them:",
    '- "resolved": the problem described at the start is visibly gone or fixed in the right picture.',
    '- "unchanged": the problem is still there, or nothing relevant changed.',
    '- "cannot_tell": what the procedure checks cannot be seen by a camera (it was a functional test, nothing was visibly wrong at the start, the picture does not show the part, or the scene is different). Prefer this over guessing.',
    '- "comment": ONE or TWO sentences in Spanish (Colombia), with correct spelling and accents, speaking directly to the student in the imperative or second person, without opening with "Tú": what you see that changed (or did not) and what it means for the goal. Say it by general kind, never by a specific part name. A hand, a shadow or a change of light is not a change.',
  ].join("\n");
}

export function parseVerification(text: string): Verification {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new ModelError("invalid_response", "The verdict is not valid JSON", {
      cause: error,
    });
  }
  const parsed = verifySchema.safeParse(json);
  if (!parsed.success) {
    throw new ModelError(
      "invalid_response",
      `The verdict does not match the contract: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

/** Low: the same two pictures should get the same verdict. */
const VERIFY_TEMPERATURE = 0.2;

/** Compares the scene before and after the procedure, written by Muse Spark. */
export class MetaVerifyWriter {
  async write(input: VerifyInput): Promise<Verification> {
    try {
      const text = await callSpark({
        imageDataUrl: input.imageDataUrl,
        prompt: buildVerifyPrompt(input),
        format: RESPONSE_FORMAT,
        reasoningEffort: "minimal",
        temperature: VERIFY_TEMPERATURE,
        apiKey: input.apiKey,
        signal: input.signal,
      });
      return parseVerification(text);
    } catch (error) {
      throw toModelError(error);
    }
  }
}
