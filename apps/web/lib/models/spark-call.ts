import "server-only";
import type { ResponseFormatTextJSONSchemaConfig } from "openai/resources/responses/responses";
import { getEnv } from "../env";
import { getModelClient } from "./client";

export type SparkCall = {
  /** `data:image/jpeg;base64,...` of the frame. */
  imageDataUrl: string;
  prompt: string;
  format: ResponseFormatTextJSONSchemaConfig;
  /** Reasoning effort to ask for; absent means Meta's default (high, slow). */
  reasoningEffort?: "minimal" | "low" | "medium" | "high";
  /** Sampling temperature; absent means Meta's default (1). */
  temperature?: number;
  apiKey?: string;
  signal?: AbortSignal;
};

/**
 * One call to Muse Spark (`SCENE_MODEL`) with an image and a strict JSON
 * schema; returns the text it produced.
 */
export async function callSpark(call: SparkCall): Promise<string> {
  const client = getModelClient(call.apiKey);
  const response = await client.responses.create(
    {
      model: getEnv().SCENE_MODEL,
      input: [
        {
          type: "message",
          role: "user",
          content: [
            { type: "input_text", text: call.prompt },
            {
              type: "input_image",
              image_url: call.imageDataUrl,
              detail: "auto",
            },
          ],
        },
      ],
      text: { format: call.format },
      ...(call.reasoningEffort
        ? { reasoning: { effort: call.reasoningEffort } }
        : {}),
      ...(call.temperature !== undefined
        ? { temperature: call.temperature }
        : {}),
    },
    { signal: call.signal },
  );
  return response.output_text;
}
