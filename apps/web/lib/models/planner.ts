import "server-only";
import { z } from "zod";
import {
  GRID,
  MAX_SCENE_OBJECTS,
  sceneSchema,
  type SceneObject,
} from "../analysis/scene";
import { COMPONENT_STATUSES } from "../component-status";
import { getEnv } from "../env";
import { getModelClient } from "./client";
import { ModelError, toModelError } from "./errors";

export type PlanInput = {
  /** `data:image/jpeg;base64,...` of the frame. */
  imageDataUrl: string;
  /** The Laboratorio case context (English prompt text). */
  context?: string;
  /** False for inventory cases: every object is reported as ok. */
  judgesCondition: boolean;
  /** The user's own key; when absent the server's key is used. */
  apiKey?: string;
  signal?: AbortSignal;
};

/** Looks at the frame and lists what is in it; it does not draw any mask. */
export interface ScenePlanner {
  plan(input: PlanInput): Promise<SceneObject[]>;
}

/** The wire schema, written by hand because strict mode rejects tuples. */
const RESPONSE_FORMAT = {
  type: "json_schema",
  name: "scene",
  strict: true,
  schema: {
    type: "object",
    additionalProperties: false,
    required: ["objects"],
    properties: {
      objects: {
        type: "array",
        maxItems: MAX_SCENE_OBJECTS,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["label", "concept", "box", "status", "reason"],
          properties: {
            label: { type: "string" },
            concept: { type: "string" },
            box: {
              type: "array",
              items: { type: "number" },
              minItems: 4,
              maxItems: 4,
            },
            status: { type: "string", enum: [...COMPONENT_STATUSES] },
            reason: { type: "string" },
          },
        },
      },
    },
  },
} as const;

export function buildScenePrompt(input: {
  context?: string;
  judgesCondition: boolean;
}): string {
  const lines = [
    "You assist a technician who points a camera at something to inspect it. List the distinct objects in the image that matter for the task.",
    input.context ? `Task context: ${input.context}` : null,
    "Rules:",
    "- List only what you can actually see. Never invent objects, even if the context says they are expected.",
    `- At most ${MAX_SCENE_OBJECTS} objects, the most relevant first.`,
    '- "label": a short name in Spanish (Colombia).',
    '- "concept": a short English noun phrase naming one concrete kind of object, for example "RAM memory module".',
    `- "box": [x_min, y_min, x_max, y_max] on a 0 to ${GRID} grid over the whole image, tight around the object.`,
    input.judgesCondition
      ? '- "status": "ok" when it looks fine, "warning" when it needs a closer look, "anomaly" when it shows a clear fault. "reason": one sentence in Spanish saying why when the status is not "ok", otherwise an empty string.'
      : '- Do not judge condition: every "status" must be "ok" and every "reason" an empty string.',
  ];
  return lines.filter((line) => line !== null).join("\n");
}

/** Drops objects whose box is empty or upside down; the model is not trusted. */
function usable(objects: SceneObject[]): SceneObject[] {
  return objects
    .filter(({ box: [x0, y0, x1, y1] }) => x1 > x0 && y1 > y0)
    .slice(0, MAX_SCENE_OBJECTS);
}

export function parseScene(text: string): SceneObject[] {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch (error) {
    throw new ModelError("invalid_response", "The scene is not valid JSON", {
      cause: error,
    });
  }
  const parsed = sceneSchema.safeParse(json);
  if (!parsed.success) {
    throw new ModelError(
      "invalid_response",
      `The scene does not match the contract: ${z.prettifyError(parsed.error)}`,
    );
  }
  return usable(parsed.data.objects);
}

export class MetaScenePlanner implements ScenePlanner {
  async plan(input: PlanInput): Promise<SceneObject[]> {
    try {
      const client = getModelClient(input.apiKey);
      const response = await client.responses.create(
        {
          model: getEnv().SCENE_MODEL,
          input: [
            {
              type: "message",
              role: "user",
              content: [
                { type: "input_text", text: buildScenePrompt(input) },
                {
                  type: "input_image",
                  image_url: input.imageDataUrl,
                  detail: "auto",
                },
              ],
            },
          ],
          text: { format: RESPONSE_FORMAT },
        },
        { signal: input.signal },
      );
      const objects = parseScene(response.output_text);
      return input.judgesCondition
        ? objects
        : objects.map((object) => ({ ...object, status: "ok", reason: "" }));
    } catch (error) {
      throw toModelError(error);
    }
  }
}
