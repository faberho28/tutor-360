import { analyzeScene } from "@/lib/analysis/analyze-phrase";
import { MAX_BODY_BYTES, analyzeRequestSchema } from "@/lib/analysis/request";
import { failure as fail } from "@/lib/analysis/error-response";
import { getEnv } from "@/lib/env";
import { API_KEY_HEADER, API_KEY_PATTERN } from "@/lib/settings/api-key";
import { ModelError, toModelError } from "@/lib/models/errors";
import { MetaPhrasePlanner } from "@/lib/models/phrase-planner";
import { MetaSegmenter } from "@/lib/models/segmenter";

export async function POST(request: Request) {
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES) return fail("invalid_input");

  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return fail("invalid_input");
  }
  const parsed = analyzeRequestSchema.safeParse(payload);
  if (!parsed.success) return fail("invalid_input");

  // The user's own key (from Ajustes) wins over the server's. It is only
  // passed on to the model client: never stored, never logged.
  const sentKey = request.headers.get(API_KEY_HEADER);
  if (sentKey !== null && !API_KEY_PATTERN.test(sentKey)) return fail("auth");

  try {
    let env;
    try {
      env = getEnv();
    } catch (error) {
      throw new ModelError("not_configured", "Invalid environment", {
        cause: error,
      });
    }
    const result = await analyzeScene(
      {
        imageDataUrl: parsed.data.image,
        width: parsed.data.width,
        height: parsed.data.height,
      },
      {
        planner: new MetaPhrasePlanner(),
        segmenter: new MetaSegmenter(),
        context: parsed.data.context,
        plan: parsed.data.plan,
        apiKey: sentKey ?? undefined,
        threshold: env.SEGMENT_SCORE_THRESHOLD,
        signal: request.signal,
      },
    );
    return Response.json(result);
  } catch (error) {
    const modelError = toModelError(error);
    // Kind and status only: neither the image nor SDK messages go to the log.
    console.error(
      `[analyze] ${modelError.kind} status=${modelError.status ?? "-"}`,
    );
    return fail(modelError.kind);
  }
}
