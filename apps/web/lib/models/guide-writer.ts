import "server-only";
import { z } from "zod";
import { ModelError, toModelError } from "./errors";
import { partLine } from "./part-line";
import { callSpark } from "./spark-call";

/** A part the models found, as the tutor sees it: enough to point at it. */
export type GuidePart = {
  id: string;
  /** Name shown to the user (Spanish). */
  label: string;
  status: "ok" | "warning" | "anomaly";
};

export type GuideStep = {
  /** What to do and why, for the student (Spanish). */
  text: string;
  /** The part this step is about, or null when it is not about one part. */
  target: string | null;
};

export type Guide = {
  /** What the student will have achieved at the end (Spanish). */
  goal: string;
  steps: GuideStep[];
  /** Said when no step is left: what was found and done (Spanish). Empty otherwise. */
  conclusion: string;
};

/** What the student says happened after a step: it came out as the step said, not, or they could not tell. */
export type StepReport = {
  result: "yes" | "no" | "unsure";
  /** Their own words, when they wrote something. */
  note?: string;
};

const REPORT_TEXT = {
  yes: "it happened as the step said it would",
  no: "it did NOT happen as the step said",
  unsure: "the student could not tell",
} as const;

export type GuideInput = {
  /** `data:image/jpeg;base64,...` of the analyzed frame. */
  imageDataUrl: string;
  /** The Laboratorio case context (English prompt text). */
  context?: string;
  /** Spark's first judgment of the state of the scene (Spanish). */
  assessment?: string;
  /** The n-th part is the one marked n in the image (see `markFrame`). */
  parts: readonly GuidePart[];
  /**
   * The procedure the student is already following: the picture is how things
   * look now and the answer is only the steps still to do.
   */
  progress?: {
    goal: string;
    steps: readonly string[];
    current: number;
    /** What the student reported after each step done (same order as `steps`). */
    reports?: readonly (StepReport | null)[];
  };
  /** Replaces the built prompt (the prompt lab only). */
  promptOverride?: string;
  /** How hard Spark thinks; the scan uses `minimal`. */
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  apiKey?: string;
  signal?: AbortSignal;
};

/**
 * Not a length the tutor aims for: the procedure has the steps it needs. Only a
 * guard against a runaway answer.
 */
const SAFETY_MAX_STEPS = 60;
/** What a step uses when it is not about any single part. */
export const NO_TARGET = "none";

const guideSchema = z.object({
  goal: z.string().trim().min(1).max(220),
  steps: z
    .array(
      z.object({
        text: z.string().trim().min(1).max(420),
        target: z.string().trim().min(1).max(64),
      }),
    )
    // No steps left is allowed when the procedure is over (see `conclusion`).
    .max(SAFETY_MAX_STEPS),
  conclusion: z.string().trim().max(700),
});

const RESPONSE_FORMAT = {
  type: "json_schema",
  name: "guided_procedure",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["goal", "steps", "conclusion"],
    properties: {
      goal: { type: "string" },
      conclusion: { type: "string" },
      steps: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["text", "target"],
          properties: {
            text: { type: "string" },
            target: { type: "string" },
          },
        },
      },
    },
  },
} as const;

export function buildGuidePrompt(
  input: Pick<GuideInput, "context" | "assessment" | "parts" | "progress">,
): string {
  return [
    "You are a patient tutor for a student apprentice technician who points a camera at something and works on it with their hands. You guide them one step at a time while a camera shows what is in front of them.",
    input.context ? `Task context: ${input.context}` : null,
    input.assessment
      ? `The first look at this object, made when it appeared, concluded: "${input.assessment}". The procedure answers to that conclusion: it is about what that look found.`
      : null,
    "The image shows the parts the vision system found, each one outlined in magenta with its number on a magenta tag. This is the condition of each numbered part. Their names are NOT given on purpose: another model named them and often got them wrong, so identify every part by LOOKING at it in the image:",
    ...input.parts.map(partLine),
    input.progress
      ? [
          'The student is already following a procedure, and the image is how things look NOW. The goal so far: "' +
            input.progress.goal +
            '". Its steps (the ones before step ' +
            (input.progress.current + 1) +
            " are already done or skipped):",
          ...input.progress.steps.map((step, i) => {
            const progress = input.progress!;
            if (i >= progress.current) return `${i + 1}. ${step}`;
            const report = progress.reports?.[i];
            if (!report) return `${i + 1}. (done) ${step}`;
            const note = report.note
              ? ` The student wrote: "${report.note}".`
              : "";
            return `${i + 1}. (done) ${step} STUDENT REPORT: ${REPORT_TEXT[report.result]}.${note}`;
          }),
          input.progress.reports?.some(Boolean)
            ? 'Decide what comes next from what the student reported. Write ONLY the steps still to do, in the order to do them, in Spanish (Colombia) with correct spelling, accents included. Each one follows from the reports: a test that came out as expected moves toward its conclusion, one that did not points to another cause or another check, and the student\'s own words may add facts. Drop the planned steps the reports make pointless and add the ones they make necessary. If a cause is already found, the steps carry out the fix and then confirm it. When the goal has been reached (the problem is solved, or its cause is found and the student has nothing else to do), write NO steps and put in "conclusion" what was found and done, addressed to the student. A conclusion must be supported by the reports: never say that everything is fine while a report said the step did NOT happen, or that the student could not tell, and no later step settled it. A report like that opens something to follow: the next steps repeat or refine the check, look for its cause or fix it, until it is settled; and if the student cannot settle it, the conclusion says what stays unresolved and what to do about it.'
            : "Write ONLY the steps that are still to do from now on, in the order to do them, in Spanish (Colombia) with correct spelling, accents included. Keep them word for word when what you see agrees with them. Drop a step the picture shows is already achieved, rewrite one that the new situation changed, and add one that a new situation needs. Keep the goal unless the situation changed it. If nothing relevant changed, answer the remaining steps unchanged.",
        ].join("\n")
      : `Look at the image and write the procedure the student should follow now: a goal and every step the procedure really needs (as many as it takes to reach the goal, no fewer and none that is filler), in the order to do them, in Spanish (Colombia) with correct spelling, accents included.`,
    "Rules:",
    '- "goal": ONE sentence starting with an infinitive verb: what the student will have ACHIEVED when the procedure ends, which is to FIX what the first look found or to find out its cause (or, when it found nothing wrong, to find out whether something fails). When the task context says what the student wants to do or find, the goal is that. Recognizing or naming parts is never a goal. Do not name a specific part in it.',
    "- The steps are a diagnosis and repair path toward the goal. Each one is something the student DOES that they have not done yet and that either fixes something or produces information: press, move, wiggle, clean, reseat, replace, power on and watch, connect something else, compare with a part that works. The student already sees the outlined parts: NEVER write a step that only asks them to look at, find or point at a part.",
    '- Write every step as the action, a colon, and then the reason, always addressing the student as "tú" (imperative: "Pulsa", "Mueve", never "Pulse"). When the step is a test, the part after the colon says what to expect and what it means, as "si pasa X, entonces Y" (for example "Pulsa la tecla que parpadea varias veces: si no vuelve a subir, el mecanismo está trabado"). Go from the simplest and safest action to the more invasive one.',
    '- Every "si X, entonces Y" must be sound: Y has to follow necessarily from X, so say only what X really proves. When X could come from several causes, do not conclude: the next step is the check that tells those causes apart.',
    '- Do not stop at finding the cause, or at "it cannot be fixed" or "replace it all". Give the whole path: find the cause, then carry out the fix on what can be fixed (say what stays as it is and what is the safe order), and last confirm that it worked. Only when something truly cannot be fixed by the student, say so and what to do instead.',
    `- Every step has a "target": the number, as in the list above, of the ONE outlined part the step is about, or "${NO_TARGET}" when it is not about a single part (for example unplugging the whole device). Choose it by looking at the outlined part in the image: make sure the number tag is the one sitting on the part your step talks about, and never guess or invent a number.`,
    '- The student sees the part of the step blinking in magenta on the screen. The names shown on the screen for each part come from another model and will not match yours, so NEVER say which specific part it is (not "la tecla Shift", not "el módulo de RAM"). Refer to it only by its general kind and the blinking: "la tecla que parpadea", "el componente que parpadea", "la pieza que parpadea". Say what to do with it, not what it is called.',
    "- Start with safety only when it applies to this kind of object (for example unplugging or powering off something connected to the mains).",
    "- Parts in warning or anomaly condition come first among the parts to work on.",
    "- Adapt it to what the image and the task context show. Do not mention a PC, a cover or a motherboard unless that is what it is.",
    '- "conclusion" is an empty string while there are steps to do.',
    "- No numbering, no emojis.",
  ]
    .filter((line) => line !== null)
    .join("\n");
}

/**
 * Parses Spark's answer. A target that is not one of the parts it was given is
 * not trusted: the step stays, without a part to highlight.
 */
export function parseGuide(
  text: string,
  parts: readonly Pick<GuidePart, "id">[],
): Guide {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new ModelError("invalid_response", "The guide is not valid JSON", {
      cause: error,
    });
  }
  const parsed = guideSchema.safeParse(json);
  if (!parsed.success) {
    throw new ModelError(
      "invalid_response",
      `The guide does not match the contract: ${z.prettifyError(parsed.error)}`,
    );
  }
  if (parsed.data.steps.length === 0 && parsed.data.conclusion.length === 0) {
    throw new ModelError(
      "invalid_response",
      "The guide has neither steps nor a conclusion",
    );
  }
  // The target comes back as the number the image marks; the part is its id.
  const steps = parsed.data.steps.map(({ text: step, target }) => {
    const n = /^\d{1,3}$/.test(target) ? Number(target) : 0;
    return { text: step, target: parts[n - 1]?.id ?? null };
  });
  return {
    goal: parsed.data.goal,
    steps,
    conclusion: parsed.data.conclusion,
  };
}

/** Low: the same scene should get the same procedure. */
const GUIDE_TEMPERATURE = 0.3;

/** The guided procedure for the scene being scanned, written by Muse Spark. */
export class MetaGuideWriter {
  async write(input: GuideInput): Promise<Guide> {
    try {
      const text = await callSpark({
        imageDataUrl: input.imageDataUrl,
        prompt: input.promptOverride ?? buildGuidePrompt(input),
        format: RESPONSE_FORMAT,
        reasoningEffort: input.reasoningEffort ?? "minimal",
        temperature: GUIDE_TEMPERATURE,
        apiKey: input.apiKey,
        signal: input.signal,
      });
      return parseGuide(text, input.parts);
    } catch (error) {
      throw toModelError(error);
    }
  }
}
