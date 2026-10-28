import "server-only";
import OpenAI from "openai";
import { getEnv } from "../env";
import { ModelError } from "./errors";

const TIMEOUT_MS = 15_000;
// The SDK backs off exponentially and honors Retry-After on 429/5xx.
const MAX_RETRIES = 2;

let client: OpenAI | undefined;

/** The Meta Model API speaks the OpenAI Responses format. */
export function getModelClient(): OpenAI {
  if (client) return client;

  let env;
  try {
    env = getEnv();
  } catch (error) {
    throw new ModelError(
      "not_configured",
      error instanceof Error
        ? error.message
        : "The model API is not configured",
      { cause: error },
    );
  }

  client = new OpenAI({
    apiKey: env.MODEL_API_KEY,
    baseURL: env.MODEL_API_BASE_URL,
    timeout: TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
  return client;
}
