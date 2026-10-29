import { API_KEY_HEADER } from "../settings/api-key";
import type { ReviewResponse } from "./review";

/** Spark looks at a single kind of part: far faster than the whole analysis. */
const TIMEOUT_MS = 15_000;

function isReview(body: unknown): body is ReviewResponse {
  if (typeof body !== "object" || body === null) return false;
  const value = body as Partial<ReviewResponse>;
  return (
    typeof value.name === "string" &&
    (value.status === "ok" ||
      value.status === "warning" ||
      value.status === "anomaly")
  );
}

/**
 * Asks `/api/review` for the final name and condition of one kind of part.
 * Rejects on any failure: the caller keeps the provisional name.
 */
export async function requestReview(
  imageDataUrl: string,
  part: { label: string; count: number },
  options: {
    signal?: AbortSignal;
    context?: string;
    judgesCondition?: boolean;
    apiKey?: string;
  } = {},
): Promise<ReviewResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch("/api/review", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.apiKey ? { [API_KEY_HEADER]: options.apiKey } : {}),
      },
      body: JSON.stringify({
        image: imageDataUrl,
        context: options.context,
        judgesCondition: options.judgesCondition,
        part,
      }),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isReview(body)) {
      throw new Error(`Review failed (${response.status})`);
    }
    return body;
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
