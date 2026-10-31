import { API_KEY_HEADER } from "../settings/api-key";
import type { GuideVerdict } from "../types";

/** Spark compares two pictures in a few seconds; this leaves room for a slow one. */
const TIMEOUT_MS = 30_000;

const VERDICTS: readonly string[] = ["resolved", "unchanged", "cannot_tell"];

export type VerifyResult = { verdict: GuideVerdict; comment: string };

function isResult(value: unknown): value is VerifyResult {
  if (typeof value !== "object" || value === null) return false;
  const { verdict, comment } = value as {
    verdict?: unknown;
    comment?: unknown;
  };
  return (
    typeof verdict === "string" &&
    VERDICTS.includes(verdict) &&
    typeof comment === "string" &&
    comment.length > 0
  );
}

/**
 * Asks `/api/verify` whether the problem looks solved: `image` is the picture
 * from before and the one from now side by side. Rejects on any failure.
 */
export async function requestVerify(
  image: string,
  options: {
    finding: string;
    goal: string;
    signal?: AbortSignal;
    apiKey?: string;
  },
): Promise<VerifyResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch("/api/verify", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.apiKey ? { [API_KEY_HEADER]: options.apiKey } : {}),
      },
      body: JSON.stringify({
        image,
        finding: options.finding,
        goal: options.goal,
      }),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    if (!response.ok || !isResult(body)) {
      throw new Error(`Verify failed (${response.status})`);
    }
    return { verdict: body.verdict, comment: body.comment };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
