import { failure as fail } from "@/lib/analysis/error-response";
import { MAX_BODY_BYTES } from "@/lib/analysis/request";
import { diagnoseRequestSchema } from "@/lib/diagnosis/request";
import { ModelError, toModelError } from "@/lib/models/errors";
import { MetaDiagnoser } from "@/lib/models/diagnoser";
import { getEnv } from "@/lib/env";
import { API_KEY_HEADER, API_KEY_PATTERN } from "@/lib/settings/api-key";
import type { Diagnosis } from "@/lib/types";

/**
 * A diagnosis with steps for one part, from a crop of the analyzed frame.
 * Runs when the user selects a part that is not ok.
 */
export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail("invalid_input");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("invalid_input");
  }
  const parsed = diagnoseRequestSchema.safeParse(payload);
  if (!parsed.success) return fail("invalid_input");

  // The user's own key wins over the server's; it is never stored or logged.
  const sentKey = request.headers.get(API_KEY_HEADER);
  if (sentKey !== null && !API_KEY_PATTERN.test(sentKey)) return fail("auth");

  try {
    try {
      getEnv();
    } catch (error) {
      throw new ModelError("not_configured", "Invalid environment", {
        cause: error,
      });
    }
    const diagnoser = new MetaDiagnoser();
    const diagnosis: Diagnosis = await diagnoser.diagnose({
      cropDataUrl: parsed.data.image,
      context: parsed.data.context,
      label: parsed.data.label,
      status: parsed.data.status,
      reason: parsed.data.reason ?? null,
      apiKey: sentKey ?? undefined,
      signal: request.signal,
    });
    // Which model answered (the fallback may have): the model name only.
    console.info(`[diagnose] model=${diagnoser.lastModel ?? "-"}`);
    return Response.json(diagnosis);
  } catch (error) {
    const modelError = toModelError(error);
    // Kind and status only: neither the image nor SDK messages go to the log.
    console.error(
      `[diagnose] ${modelError.kind} status=${modelError.status ?? "-"}`,
    );
    return fail(modelError.kind);
  }
}

/** Vercel cuts a function at its default limit: the first analysis runs one SAM call per wording. */
export const maxDuration = 60;
