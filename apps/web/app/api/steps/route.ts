import { z } from "zod";
import { failure as fail } from "@/lib/analysis/error-response";
import { analyzeRequestSchema, MAX_BODY_BYTES } from "@/lib/analysis/request";
import { ModelError, toModelError } from "@/lib/models/errors";
import { MetaStepsWriter } from "@/lib/models/steps-writer";
import { getEnv } from "@/lib/env";
import { API_KEY_HEADER, API_KEY_PATTERN } from "@/lib/settings/api-key";

const requestSchema = z.object({
  image: analyzeRequestSchema.shape.image,
  context: analyzeRequestSchema.shape.context,
});

/**
 * The general step-by-step for the scene on screen (what to do before looking at
 * any single part). Asked once per scan, with the analyzed frame.
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
  const parsed = requestSchema.safeParse(payload);
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
    const steps = await new MetaStepsWriter().write({
      imageDataUrl: parsed.data.image,
      context: parsed.data.context,
      apiKey: sentKey ?? undefined,
      signal: request.signal,
    });
    return Response.json({ steps });
  } catch (error) {
    const modelError = toModelError(error);
    // Kind and status only: neither the image nor SDK messages go to the log.
    console.error(
      `[steps] ${modelError.kind} status=${modelError.status ?? "-"}`,
    );
    return fail(modelError.kind);
  }
}

/** A single Spark call, like the diagnosis. */
export const maxDuration = 60;
