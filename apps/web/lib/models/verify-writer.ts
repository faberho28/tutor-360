import "server-only";
import { z } from "zod";
import { ModelError, toModelError } from "./errors";
import { callSpark } from "./spark-call";

export const VERDICTS = ["resolved", "unchanged", "cannot_tell"] as const;
export type Verdict = (typeof VERDICTS)[number];

export type VerifyInput = {
  /** `data:image/jpeg;base64,...`: what the camera sees now. */
  imageDataUrl: string;
  /** What the student wanted to achieve (Spanish), from the guide. */
  goal: string;
  /** The scene as it was described when the procedure began (the picture itself is gone). */
  scene?: string;
  /** What the student reported after each step done. */
  reports?: readonly ({
    result: "yes" | "no" | "unsure";
    note?: string;
  } | null)[];
  /** What the student told the tutor out loud. */
  remarks?: readonly string[];
  /** What was asked, answered and seen along the way, oldest first. */
  log?: readonly string[];
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
  input: Pick<VerifyInput, "goal" | "scene" | "reports" | "remarks" | "log">,
): string {
  const reports = (input.reports ?? []).flatMap((report, i) =>
    report
      ? [
          `${i + 1}. ${report.result === "yes" ? "it happened as the step said" : report.result === "no" ? "it did NOT happen as the step said" : "the student could not tell"}${report.note ? `, they said: ${report.note}` : ""}`,
        ]
      : [],
  );
  return [
    "You are a technical coach for a systems technician with basic but solid foundations: they know their tools and the fundamentals (power, signals, connectors, soldering basics, how to measure) and do not need the elementary explained. What they need is the specific procedure, the order, the values or signs to look for, the risks and the reason behind each decision. They just followed a guided procedure with their hands while a camera watched.",
    `The goal of the procedure was: "${input.goal}"`,
    input.scene
      ? `The scene as it looked at the start (described then; that picture is not shown again): "${input.scene}"`
      : null,
    reports.length
      ? `What the student reported after each step:\n${reports.join("\n")}`
      : null,
    input.remarks?.length
      ? `What the student told the tutor out loud:\n${input.remarks.map((remark) => `- ${remark}`).join("\n")}`
      : null,
    input.log?.length
      ? `What else happened along the way, oldest first:\n${input.log.map((line) => `- ${line}`).join("\n")}`
      : null,
    "The image is what the camera sees NOW.",
    "Decide, by comparing it with the description of the start and with what the student did:",
    '- "resolved": the problem described at the start is visibly gone or fixed in the image.',
    '- "unchanged": the problem is still there, or nothing relevant changed.',
    '- "cannot_tell": what the procedure checks cannot be seen by a camera (it was a functional test, nothing was visibly wrong at the start, the image does not show the part, or the scene is different). Prefer this over guessing. Do not call it resolved while the student reported that something did not happen and nothing settled it.',
    '- "comment": ONE or TWO sentences in Spanish (Colombia), with correct spelling and accents, speaking directly to the student in the imperative or second person, without opening with "Tú": what you see that changed (or did not) and what it means for the goal. Say it by general kind, never by a specific part name. A hand, a shadow or a change of light is not a change.',
  ]
    .filter((line) => line !== null)
    .join("\n");
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
