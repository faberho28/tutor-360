import "server-only";
import { getEnv } from "../env";
import { ModelError } from "./errors";

const TIMEOUT_MS = 15_000;

/** Whatever `fetch` throws, as the same errors the Spark calls raise. */
function fromStatus(status: number, detail: string): ModelError {
  if (status === 401 || status === 403)
    return new ModelError("auth", detail, { status });
  if (status === 429) return new ModelError("quota", detail, { status });
  if (status === 400 || status === 413 || status === 415) {
    return new ModelError("invalid_response", detail, { status });
  }
  return new ModelError("unknown", detail, { status });
}

/**
 * Turns a short recording into text with Muse Voice Transcribe (one POST, the
 * whole clip, push-to-talk mode). The audio is a RIFF/WAVE container with mono
 * 16-bit PCM at 16 or 24 kHz. The text comes back as the model heard it: words
 * can be wrong, so whoever reads it must interpret it, not match it.
 */
export async function transcribeWav(
  wav: Uint8Array,
  options: { apiKey?: string; signal?: AbortSignal } = {},
): Promise<string> {
  let env;
  try {
    env = getEnv();
  } catch (error) {
    throw new ModelError("not_configured", "Invalid environment", {
      cause: error,
    });
  }
  const key = options.apiKey ?? env.MODEL_API_KEY;
  if (!key)
    throw new ModelError("not_configured", "No model API key is available");

  const form = new FormData();
  form.append(
    "request",
    new Blob(
      [
        JSON.stringify({
          model: env.TRANSCRIPTION_MODEL,
          audioEncoding: "WAV",
          mode: "PUSH_TO_TALK",
        }),
      ],
      { type: "application/json" },
    ),
  );
  form.append(
    "audio",
    new Blob([wav as BlobPart], { type: "audio/wav" }),
    "audio.wav",
  );

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch(`${env.MODEL_API_BASE_URL}/asr/transcribe`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, Accept: "application/json" },
      body: form,
      signal: controller.signal,
    });
    if (!response.ok) {
      throw fromStatus(
        response.status,
        `Transcription failed (${response.status})`,
      );
    }
    const body = (await response.json().catch(() => null)) as {
      transcript?: unknown;
    } | null;
    if (typeof body?.transcript !== "string") {
      throw new ModelError("invalid_response", "The transcription has no text");
    }
    return body.transcript.trim();
  } catch (error) {
    if (error instanceof ModelError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new ModelError(
        options.signal?.aborted ? "aborted" : "timeout",
        "Transcription aborted",
        {
          cause: error,
        },
      );
    }
    throw new ModelError("network", "Transcription could not be reached", {
      cause: error,
    });
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
