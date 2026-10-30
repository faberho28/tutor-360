import { API_KEY_HEADER } from "../settings/api-key";

const TIMEOUT_MS = 20_000;

/** Asks `/api/steps` for the general procedure of the scene. Rejects on any failure. */
export async function requestGeneralSteps(
  imageDataUrl: string,
  options: { signal?: AbortSignal; context?: string; apiKey?: string } = {},
): Promise<string[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch("/api/steps", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.apiKey ? { [API_KEY_HEADER]: options.apiKey } : {}),
      },
      body: JSON.stringify({ image: imageDataUrl, context: options.context }),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    const steps = (body as { steps?: unknown } | null)?.steps;
    if (
      !response.ok ||
      !Array.isArray(steps) ||
      steps.length === 0 ||
      !steps.every((step) => typeof step === "string")
    ) {
      throw new Error(`Steps failed (${response.status})`);
    }
    return steps as string[];
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
