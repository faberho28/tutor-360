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
  /** A detailed description of what the picture shows (Spanish): it takes the place of the picture in the tutor's memory. */
  observation: string;
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
    /** What the student told the tutor out loud: facts or instructions, oldest first. */
    remarks?: readonly string[];
    /** A detailed description of the scene when the guide began. */
    scene?: string;
    /** What was asked, answered and seen along the way, oldest first. */
    log?: readonly string[];
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
  observation: z.string().trim().max(1500),
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
    required: ["observation", "goal", "steps", "conclusion"],
    properties: {
      observation: { type: "string" },
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
  input: Pick<GuideInput, "context" | "parts" | "progress">,
): string {
  return [
    "You are a technical coach for a systems technician with basic but solid foundations: they know their tools and the fundamentals (power, signals, connectors, soldering basics, how to measure) and do not need the elementary explained. What they need is the specific procedure, the order, the values or signs to look for, the risks and the reason behind each decision. They point a camera at something and work on it with their hands. You guide them one step at a time while a camera shows what is in front of them. They work at their own bench with the usual tools (multimeter, soldering iron, hot-air station, tweezers, flux, isopropyl alcohol, anti-static mat, magnification). Repairs, including reworking or replacing damaged components, are part of the job: explain them step by step with the safe order and the precautions, and never just send them away or tell them to stop.",
    input.context ? `Task context: ${input.context}` : null,
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
          ...(input.progress.scene
            ? [
                `What the scene looked like when the procedure began (described then): "${input.progress.scene}"`,
              ]
            : []),
          ...(input.progress.log?.length
            ? [
                "What else happened along the way, oldest first (what the student asked, what the tutor answered, and what the camera showed at each revision):",
                ...input.progress.log.map((line) => `- ${line}`),
              ]
            : []),
          ...(input.progress.remarks?.length
            ? [
                "Besides answering steps, the student told the tutor out loud (oldest first):",
                ...input.progress.remarks.map((remark) => `- "${remark}"`),
              ]
            : []),
          input.progress.reports?.some(Boolean) ||
          (input.progress.remarks?.length ?? 0) > 0
            ? 'Decide what comes next from what the student reported. Write ONLY the steps still to do, in the order to do them, in Spanish (Colombia) with correct spelling, accents included. Each one follows from the reports: a test that came out as expected moves toward its conclusion, one that did not points to another cause or another check, and the student\'s own words may add facts. What the student told the tutor out loud (listed above, when there is any) are facts or instructions too: take them into account even when they are not about the current step (a part they replaced, a step they want to skip or repeat, something new they found), and rewrite from the current step on. Drop the planned steps the reports make pointless and add the ones they make necessary. If a cause is already found, the steps carry out the fix and then confirm it. When the goal has been reached (the problem is solved, or its cause is found and the student has nothing else to do), write NO steps and put in "conclusion" what was found and done, addressed to the student. A conclusion must be supported by the reports: never say that everything is fine while a report said the step did NOT happen, or that the student could not tell, and no later step settled it. A report like that opens something to follow: the next steps repeat or refine the check, look for its cause or fix it, until it is settled; and if the student cannot settle it, the conclusion says what stays unresolved and what to do about it.'
            : "Write ONLY the steps that are still to do from now on, in the order to do them, in Spanish (Colombia) with correct spelling, accents included. Keep them word for word when what you see agrees with them. Drop a step the picture shows is already achieved, rewrite one that the new situation changed, and add one that a new situation needs. Keep the goal unless the situation changed it. If nothing relevant changed, answer the remaining steps unchanged.",
        ].join("\n")
      : `Look at the image and write the procedure the student should follow now: a goal and every step the procedure really needs (as many as it takes to reach the goal, no fewer and none that is filler), in the order to do them, in Spanish (Colombia) with correct spelling, accents included.`,
    "Rules:",
    '- "goal": ONE sentence starting with an infinitive verb: what the student will have ACHIEVED when the procedure ends, which is to FIX what you see wrong in the image or to find out its cause (or, when nothing looks wrong, to find out whether something fails). When the task context says what the student wants to do or find, the goal is that. Recognizing or naming parts is never a goal. Do not name a specific part in it.',
    "- The steps are a diagnosis and repair path toward the goal. Each one is something the student DOES that they have not done yet and that either fixes something or produces information: press, move, wiggle, clean, reseat, replace, power on and watch, connect something else, compare with a part that works. The student already sees the outlined parts: NEVER write a step that only asks them to look at, find or point at a part.",
    "- You are a technician who SOLVES. When you find damage, the procedure is how to fix it: replace, resolder, clean, repair or work around it, with the tools and the safe order. Safety is part of HOW the work is done (power off, discharge, protect from static, let it cool, the right temperature), never a reason to stop. A step that only says to abstain, keep something as it is, or not touch it is not a step. Only when the repair truly needs equipment or skills the student cannot have, say exactly what is missing and give the best steps they CAN do now (test the rest, document the damage, find the right part), so the procedure always moves forward.",
    '- Never repeat a step. The same action on several parts is ONE step: say it once (for example "en cada una de las que parpadean"), pointing at the most representative part. The number of steps follows the work that really has to be done, never the number of parts: do not write one step per part unless each part needs a different action.',
    "- The reader is a technician: skip the basics (what a tool or a connector is). Give the specific procedure, the values or signs to look for, and the reason behind each decision.",
    '- Write every step as the action, a colon, and then the reason, always addressing the student as "tú" (imperative: "Pulsa", "Mueve", never "Pulse"). When the step is a test, the part after the colon says what to expect and what it means, as "si pasa X, entonces Y" (for example "Pulsa la tecla que parpadea varias veces: si no vuelve a subir, el mecanismo está trabado"). Go from the simplest and safest action to the more invasive one.',
    '- Every "si X, entonces Y" must be sound: Y has to follow necessarily from X, so say only what X really proves. When X could come from several causes, do not conclude: the next step is the check that tells those causes apart.',
    '- Do not stop at finding the cause, or at "it cannot be fixed" or "replace it all". Give the whole path: find the cause, then carry out the fix on what can be fixed (say what stays as it is and what is the safe order), and last confirm that it worked. Only when something truly cannot be fixed by the student, say so and what to do instead.',
    `- Every step has a "target": the number, as in the list above, of the ONE outlined part the step is about, or "${NO_TARGET}" when it is not about a single part (for example unplugging the whole device). Choose it by looking at the outlined part in the image: make sure the number tag is the one sitting on the part your step talks about, and never guess or invent a number.`,
    '- The student sees the part of the step blinking in magenta on the screen. The names shown on the screen for each part come from another model and will not match yours, so NEVER say which specific part it is (not "la tecla Shift", not "el módulo de RAM"). Refer to it only by its general kind and the blinking: "la tecla que parpadea", "el componente que parpadea", "la pieza que parpadea". Say what to do with it, not what it is called.',
    "- Start with safety only when it applies to this kind of object (for example unplugging or powering off something connected to the mains).",
    "- Parts in warning or anomaly condition come first among the parts to work on.",
    "- Adapt it to what the image and the task context show. Do not mention a PC, a cover or a motherboard unless that is what it is.",
    input.progress
      ? '- "observation": a description in Spanish of what the image shows right now, as you would note it for someone who cannot see it: the layout, the state of each notable part, what the procedure has touched or changed, and anything that stands out with where it is. 2 to 4 sentences, under 80 words. The next calls will NOT see this image again: this description is all that is kept of it, so include whatever a later check would need. Write it first.'
      : '- "observation": the first description of this scene, as a technician would note it for someone who cannot see it: what the object is, how it is laid out and where each notable part is, the state of each one (clean, dirty, worn, broken, burnt, missing, loose...), and any mark or anomaly with exactly where it is. 4 to 8 sentences. Be careful: look closely at the condition of what you see and say it plainly, whether it is fine or not. It is the only record of this picture that will be kept, so include whatever a later check would need to compare against. Write it first.',
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
  // The same step never twice, whatever part it points at.
  const seen = new Set<string>();
  const unique = steps.filter((step) => {
    const key = step.text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return {
    observation: parsed.data.observation,
    goal: parsed.data.goal,
    steps: unique,
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
