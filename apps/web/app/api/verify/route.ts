import { z } from "zod";
import { failure as fail } from "@/lib/analysis/error-response";
import { analyzeRequestSchema, MAX_BODY_BYTES } from "@/lib/analysis/request";
import { getEnv } from "@/lib/env";
import { ModelError, toModelError } from "@/lib/models/errors";
import { MetaVerifyWriter } from "@/lib/models/verify-writer";
import { API_KEY_HEADER, API_KEY_PATTERN } from "@/lib/settings/api-key";

const requestSchema = z.object({
  /** The picture from before and the one from now, side by side. */
  image: analyzeRequestSchema.shape.image,
  finding: z.string().min(1).max(400),
  goal: z.string().min(1).max(300),
});

/**
 * The check at the end of a guided procedure: Spark compares the scene from
 * before with the one now and says whether the problem looks solved. One call.
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
    const verification = await new MetaVerifyWriter().write({
      imageDataUrl: parsed.data.image,
      finding: parsed.data.finding,
      goal: parsed.data.goal,
      apiKey: sentKey ?? undefined,
      signal: request.signal,
    });
    return Response.json(verification);
  } catch (error) {
    const modelError = toModelError(error);
    // Kind and status only: neither the image nor SDK messages go to the log.
    console.error(
      `[verify] ${modelError.kind} status=${modelError.status ?? "-"}`,
    );
    return fail(modelError.kind);
  }
}

/** A single Spark call, like the guide. */
export const maxDuration = 60;
