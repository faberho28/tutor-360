import "server-only";
import { z } from "zod";
import {
  MAX_SAM_PHRASES,
  MAX_VARIANTS,
  partPlanSchema,
  type ScenePlan,
} from "../analysis/scene";
import { ModelError, toModelError } from "./errors";
import { callSpark } from "./spark-call";

export type PlanPartsInput = {
  /** `data:image/jpeg;base64,...` of the frame. */
  imageDataUrl: string;
  /** The Laboratorio case context (English prompt text). */
  context?: string;
  /** Reasoning effort to ask for; absent means Meta's default (high, slow). */
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  /** Replaces the built prompt (the prompt lab only). */
  promptOverride?: string;
  /** How many wordings of each part Spark gives (1 to `MAX_VARIANTS`). */
  variants: number;
  apiKey?: string;
  signal?: AbortSignal;
};

/**
 * Looks at the frame and decides what to ask SAM for. It returns parts with
 * several wordings each, never boxes: SAM finds the instances itself.
 */
export interface PhrasePlanner {
  planParts(input: PlanPartsInput): Promise<ScenePlan>;
}

function partsFormat(variants: number) {
  return {
    type: "json_schema",
    name: "parts",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: ["assessment", "parts"],
      properties: {
        assessment: { type: "string" },
        parts: {
          type: "array",
          maxItems: MAX_SAM_PHRASES,
          items: {
            type: "object",
            additionalProperties: false,
            required: ["label", "phrases"],
            properties: {
              label: { type: "string" },
              phrases: {
                type: "array",
                maxItems: variants,
                items: { type: "string" },
              },
            },
          },
        },
      },
    },
  } as const;
}

export function buildPartsPrompt(input: {
  context?: string;
  variants: number;
}): string {
  const { variants } = input;
  return [
    "You assist a technician who points a camera at something to inspect it. An image segmentation model will look for what you ask, one phrase at a time. Decide what to ask for.",
    input.context ? `Task context: ${input.context}` : null,
    "Rules:",
    '- "assessment": ONE or TWO sentences in Spanish (Colombia), with correct spelling and accents, saying in what state this object is, as a careful inspector of this kind of object would say it. Decide it first, by looking: say plainly when it looks fine, and never invent a problem.',
    "- Then decide what to ask the segmentation model for, so that it paints what your assessment is about: each problem you found and the parts worth inspecting. The problems go first.",
    "- Ask for the PARTS worth inspecting one by one, not for the whole device when its parts are what matters. For a keyboard ask for its keys and its notable parts; for a Rubik's cube ask for its faces by colour; for a ball ask for the markings on it.",
    '- Each phrase names ONE concrete kind of physical thing that is visible, as a short singular English noun phrase, for example "keyboard key", "space bar", "enter key", "touchpad", "usb cable", "white face of a rubik\'s cube".',
    '- Describe each thing by how it LOOKS (shape, colour, material), as someone who has never seen the device would, not by its technical name or jargon: "red plastic bottle cap", "long wooden handle", "yellow rubber duck", "thin glass tube", "tall steel cylinder". Plain names that are also what the thing looks like ("space bar", "usb port", "keyboard key") are fine.',
    '- For many identical parts (keys, screws, pins) give ONE entry for the kind ("keyboard key"): the segmentation model returns every one of them. Then add the few parts that have a name or a shape of their own.',
    '- Never single out one item among identical ones by a printed letter or number (not "letter L key"): the segmentation model cannot read them.',
    '- Never group things ("set of keys", "row of keys", "all cables").',
    `- Each part is ONE entry with exactly ${variants} different wordings in "phrases": the same single physical part described with different words (change the adjectives, the material or the noun, for example "red plastic bottle cap", "small red round lid", "red screw cap"). The segmentation model understands some wordings better than others, so give it ${variants} ways to recognise the part. Never put two different parts in one entry, and never make two entries for the same part.`,
    "- Never ask for holes (screw holes, mounting holes, vias, ring holes), solder pads, traces, printed markings, the empty background, or the surface or board that the other parts sit on: only separate parts that someone could inspect, replace or take out.",
    "- Only things you can actually see. Never invent.",
    `- At most ${MAX_SAM_PHRASES} parts, the most useful first.`,
    '- "label": a short name for the user in Spanish (Colombia). "phrases": the English wordings for the segmentation model.',
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/** Trims; each wording appears once in the whole plan (SAM is not asked twice). */
export function parsePartPlan(text: string): ScenePlan {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new ModelError("invalid_response", "The parts are not valid JSON", {
      cause: error,
    });
  }
  const parsed = partPlanSchema.safeParse(json);
  if (!parsed.success) {
    throw new ModelError(
      "invalid_response",
      `The parts do not match the contract: ${z.prettifyError(parsed.error)}`,
    );
  }
  const seen = new Set<string>();
  const parts = parsed.data.parts
    .map((part) => ({
      label: part.label,
      phrases: part.phrases.slice(0, MAX_VARIANTS).filter((phrase) => {
        const key = phrase.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }),
    }))
    .filter((part) => part.phrases.length > 0)
    .slice(0, MAX_SAM_PHRASES);
  return { assessment: parsed.data.assessment, parts };
}

/**
 * SAM answers very differently to near-synonyms ("metal usb port" found 4
 * masks, "metallic usb port" none), so the same frame must give the same
 * wording run after run. Low, not zero: a little room keeps the phrases natural.
 */
const PARTS_TEMPERATURE = 0.2;

export class MetaPhrasePlanner implements PhrasePlanner {
  async planParts(input: PlanPartsInput): Promise<ScenePlan> {
    const variants = Math.min(
      Math.max(Math.floor(input.variants), 1),
      MAX_VARIANTS,
    );
    try {
      const text = await callSpark({
        imageDataUrl: input.imageDataUrl,
        prompt:
          input.promptOverride ??
          buildPartsPrompt({ context: input.context, variants }),
        format: partsFormat(variants),
        reasoningEffort: input.reasoningEffort,
        temperature: PARTS_TEMPERATURE,
        apiKey: input.apiKey,
        signal: input.signal,
      });
      return parsePartPlan(text);
    } catch (error) {
      throw toModelError(error);
    }
  }
}
