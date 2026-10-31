import { API_KEY_HEADER } from "../settings/api-key";
import type { Detection, Guide, GuideStep } from "../types";

/** The first guide writes a goal, every step and a description: 10 s on a small board, 30 s or more on a crowded one. The route allows 60 s. */
const TIMEOUT_MS = 70_000;

/** What the tutor is told about each part. */
export type GuidePartInput = Pick<Detection, "id" | "label" | "status">;

function isStep(value: unknown): value is GuideStep {
  if (typeof value !== "object" || value === null) return false;
  const { text, target } = value as { text?: unknown; target?: unknown };
  return (
    typeof text === "string" &&
    text.length > 0 &&
    (target === null || typeof target === "string")
  );
}

/**
 * Asks `/api/guide` for the guided procedure of the scene: the steps, each one
 * pointing at the part it is about. Rejects on any failure.
 */
export async function requestGuide(
  imageDataUrl: string,
  options: {
    parts: readonly GuidePartInput[];
    signal?: AbortSignal;
    context?: string;
    /** The procedure being followed: the answer is the steps still to do. */
    progress?: {
      goal: string;
      steps: readonly string[];
      current: number;
      reports?: readonly ({
        result: "yes" | "no" | "unsure";
        note?: string;
      } | null)[];
      remarks?: readonly string[];
      scene?: string;
      log?: readonly string[];
    };
    apiKey?: string;
  },
): Promise<Guide> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onAbort = () => controller.abort();
  if (options.signal?.aborted) controller.abort();
  else options.signal?.addEventListener("abort", onAbort, { once: true });

  try {
    const response = await fetch("/api/guide", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(options.apiKey ? { [API_KEY_HEADER]: options.apiKey } : {}),
      },
      body: JSON.stringify({
        image: imageDataUrl,
        context: options.context,
        progress: options.progress,
        parts: options.parts.map(({ id, label, status }) => ({
          id,
          label,
          status,
        })),
      }),
      signal: controller.signal,
    });
    const body: unknown = await response.json().catch(() => null);
    const { goal, steps, conclusion, observation } = (body ?? {}) as {
      goal?: unknown;
      steps?: unknown;
      conclusion?: unknown;
      observation?: unknown;
    };
    if (
      !response.ok ||
      typeof goal !== "string" ||
      goal.length === 0 ||
      !Array.isArray(steps) ||
      !steps.every(isStep) ||
      typeof conclusion !== "string" ||
      // A procedure that is over has no steps but says how it ended.
      (steps.length === 0 && conclusion.length === 0)
    ) {
      throw new Error(`Guide failed (${response.status})`);
    }
    return {
      goal,
      steps,
      conclusion,
      observation: typeof observation === "string" ? observation : "",
    };
  } finally {
    clearTimeout(timer);
    options.signal?.removeEventListener("abort", onAbort);
  }
}
