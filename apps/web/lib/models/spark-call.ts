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
  /** Model to use instead of `SCENE_MODEL`. */
  model?: string;
  apiKey?: string;
  signal?: AbortSignal;
  /** Per-attempt timeout instead of the client's 15 s (long answers need more). */
  timeoutMs?: number;
  /** Retries instead of the client's 2 (a retry after a long timeout outlives the route). */
  maxRetries?: number;
  /** When set, logs how long the call took and its tokens under this name. */
  logAs?: string;
};

/**
 * One call to Muse Spark (`SCENE_MODEL`) with an image and a strict JSON
 * schema; returns the text it produced.
 */
export async function callSpark(call: SparkCall): Promise<string> {
  const client = getModelClient(call.apiKey);
  const startedAt = Date.now();
  const response = await client.responses.create(
    {
      model: call.model ?? getEnv().SCENE_MODEL,
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
    {
      signal: call.signal,
      ...(call.timeoutMs !== undefined ? { timeout: call.timeoutMs } : {}),
      ...(call.maxRetries !== undefined ? { maxRetries: call.maxRetries } : {}),
    },
  );
  if (call.logAs) {
    console.info(
      `[${call.logAs}] spark ${Date.now() - startedAt} ms, tokens in=${response.usage?.input_tokens ?? "-"} out=${response.usage?.output_tokens ?? "-"}`,
    );
  }
  return response.output_text;
}
