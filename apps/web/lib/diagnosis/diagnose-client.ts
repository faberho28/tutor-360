import { API_KEY_HEADER } from "../settings/api-key";
import type { Diagnosis } from "../types";

/** Spark writes a few sentences and steps: slower than a review. */
const TIMEOUT_MS = 30_000;

function isDiagnosis(body: unknown): body is Diagnosis {
  if (typeof body !== "object" || body === null) return false;
  const value = body as Partial<Diagnosis>;
  return (
    typeof value.summary === "string" &&
    (value.severity === "low" ||
      value.severity === "medium" ||
      value.severity === "high") &&
    Array.isArray(value.steps) &&
    value.steps.length > 0 &&
    value.steps.every((step) => typeof step === "string")
  );
}

/** Asks `/api/diagnose` for the diagnosis of one part. Rejects on any failure. */
export async function requestDiagnosisFor(
  input: {
    image: string;
    label: string;
    status: string;
    reason: string | null;
  },
  options: { signal?: AbortSignal; context?: string; apiKey?: string } = {},
): Promise<Diagnosis> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch("/api/diagnose", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.apiKey ? { [API_KEY_HEADER]: options.apiKey } : {}),
      },
      body: JSON.stringify({ ...input, context: options.context }),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isDiagnosis(body)) {
      throw new Error(`Diagnosis failed (${response.status})`);
    }
    return body;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
