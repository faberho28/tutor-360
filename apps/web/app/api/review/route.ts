import { failure as fail } from "@/lib/analysis/error-response";
import { MAX_BODY_BYTES } from "@/lib/analysis/request";
import {
  reviewRequestSchema,
  type ReviewResponse,
} from "@/lib/analysis/review";
import { ModelError, toModelError } from "@/lib/models/errors";
import { MetaPartReviewer } from "@/lib/models/part-reviewer";
import { getEnv } from "@/lib/env";
import { API_KEY_HEADER, API_KEY_PATTERN } from "@/lib/settings/api-key";

/**
 * One kind of part, outlined on a copy of the frame: Spark gives its final
 * name and its condition. Runs after `/api/analyze` has painted the masks.
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
  const parsed = reviewRequestSchema.safeParse(payload);
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
    const review = await new MetaPartReviewer().review({
      imageDataUrl: parsed.data.image,
      context: parsed.data.context,
      label: parsed.data.part.label,
      count: parsed.data.part.count,
      judgesCondition: parsed.data.judgesCondition,
      apiKey: sentKey ?? undefined,
      signal: request.signal,
    });
    const body: ReviewResponse = {
      name: review.name,
      status: review.status,
      reason: review.reason || null,
    };
    return Response.json(body);
  } catch (error) {
    const modelError = toModelError(error);
    // Kind and status only: neither the image nor SDK messages go to the log.
    console.error(
      `[review] ${modelError.kind} status=${modelError.status ?? "-"}`,
    );
    return fail(modelError.kind);
  }
}
