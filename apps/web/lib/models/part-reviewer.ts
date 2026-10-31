import "server-only";
import { z } from "zod";
import { COMPONENT_STATUSES } from "../component-status";
import { ModelError, toModelError } from "./errors";
import { callSpark } from "./spark-call";

export type ReviewPartInput = {
  /** `data:image/jpeg;base64,...` of the frame with the part outlined. */
  imageDataUrl: string;
  /** The Laboratorio case context (English prompt text). */
  context?: string;
  /** What the segmentation provisionally called the part. */
  label: string;
  /** How many instances are outlined. */
  count: number;
  /** False for inventory cases: the status is always ok. */
  judgesCondition: boolean;
  apiKey?: string;
  signal?: AbortSignal;
};

export type PartReview = {
  /** Final name in Spanish, singular. */
  name: string;
  status: (typeof COMPONENT_STATUSES)[number];
  /** One sentence in Spanish; empty when the status is ok. */
  reason: string;
};

/**
 * Looks at one kind of part (outlined on the frame) and gives its final name
 * and its condition. It never draws or locates anything: the masks are SAM's.
 */
export interface PartReviewer {
  review(input: ReviewPartInput): Promise<PartReview>;
}

const reviewSchema = z.object({
  name: z.string().trim().min(1).max(60),
  status: z.enum(COMPONENT_STATUSES),
  reason: z.string().trim().max(200),
});

const RESPONSE_FORMAT = {
  type: "json_schema",
  name: "part_review",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["name", "status", "reason"],
    properties: {
      name: { type: "string" },
      status: { type: "string", enum: [...COMPONENT_STATUSES] },
      reason: { type: "string" },
    },
  },
} as const;

export function buildReviewPrompt(
  input: Pick<
    ReviewPartInput,
    "context" | "label" | "count" | "judgesCondition"
  >,
): string {
  const { count } = input;
  return [
    "You assist a technician who points a camera at something to inspect it.",
    input.context ? `Task context: ${input.context}` : null,
    `An image segmentation model outlined ${count === 1 ? "one instance" : `${count} instances`} of one kind of part in the image, in magenta. It provisionally called ${count === 1 ? "it" : "them"} "${input.label}". Only what is outlined is under review; ignore everything else in the image.`,
    "Rules:",
    '- "name": what the outlined part is, a short singular noun in Spanish (Colombia), generic enough to fit every outlined instance. If they are different things, name the most common one. Use the name a technician would use.',
    "- Look at what is really outlined. The provisional name is only a hint and may be wrong.",
    input.judgesCondition
      ? '- "status": "ok" when it looks fine, "warning" when it needs a closer look, "anomaly" when it shows a clear fault. Judge only what you can see (dirt, residue, corrosion, burns, swelling, cracks, bent or missing pieces). Something clean and normal-looking is "ok". Never invent a problem. "reason": one sentence in Spanish saying what you see when the status is not "ok", otherwise an empty string.'
      : '- Do not judge condition: "status" must be "ok" and "reason" an empty string.',
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function parseReview(text: string): PartReview {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new ModelError("invalid_response", "The review is not valid JSON", {
      cause: error,
    });
  }
  const parsed = reviewSchema.safeParse(json);
  if (!parsed.success) {
    throw new ModelError(
      "invalid_response",
      `The review does not match the contract: ${z.prettifyError(parsed.error)}`,
    );
  }
  return parsed.data;
}

/** Low temperature: the same part should get the same name and verdict. */
const REVIEW_TEMPERATURE = 0.2;

export class MetaPartReviewer implements PartReviewer {
  async review(input: ReviewPartInput): Promise<PartReview> {
    try {
      const text = await callSpark({
        imageDataUrl: input.imageDataUrl,
        prompt: buildReviewPrompt(input),
        format: RESPONSE_FORMAT,
        reasoningEffort: "minimal",
        temperature: REVIEW_TEMPERATURE,
        apiKey: input.apiKey,
        signal: input.signal,
      });
      const review = parseReview(text);
      // The model is not trusted to follow "do not judge".
      return input.judgesCondition
        ? review
        : { ...review, status: "ok", reason: "" };
    } catch (error) {
      throw toModelError(error);
    }
  }
}
