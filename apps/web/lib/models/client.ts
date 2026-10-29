import "server-only";
import OpenAI from "openai";
import { getEnv, type Env } from "../env";
import { ModelError } from "./errors";

const TIMEOUT_MS = 15_000;
// The SDK backs off exponentially and honors Retry-After on 429/5xx.
const MAX_RETRIES = 2;

let serverClient: OpenAI | undefined;

function build(apiKey: string, env: Env): OpenAI {
  return new OpenAI({
    apiKey,
    baseURL: env.MODEL_API_BASE_URL,
    timeout: TIMEOUT_MS,
    maxRetries: MAX_RETRIES,
  });
}

/**
 * The Meta Model API speaks the OpenAI Responses format. A key sent by the
 * user wins over the server's `MODEL_API_KEY`; theirs gets a client of its own
 * for this call (never cached, so one user's key can't serve another), and the
 * base URL always comes from the server.
 */
export function getModelClient(userApiKey?: string): OpenAI {
  let env: Env;
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

  if (userApiKey) return build(userApiKey, env);

  if (!env.MODEL_API_KEY) {
    throw new ModelError("not_configured", "No model API key is available");
  }
  serverClient ??= build(env.MODEL_API_KEY, env);
  return serverClient;
}
