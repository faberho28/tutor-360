import { z } from "zod";
import { failure as fail } from "@/lib/analysis/error-response";
import { analyzeRequestSchema, MAX_BODY_BYTES } from "@/lib/analysis/request";
import { MAX_GUIDE_PARTS } from "@/lib/guide/limits";
import { ModelError, toModelError } from "@/lib/models/errors";
import { MetaGuideWriter } from "@/lib/models/guide-writer";
import { getEnv } from "@/lib/env";
import { API_KEY_HEADER, API_KEY_PATTERN } from "@/lib/settings/api-key";

const requestSchema = z.object({
  image: analyzeRequestSchema.shape.image,
  context: analyzeRequestSchema.shape.context,
  assessment: z.string().max(400).optional(),
  /** The procedure being followed, when the steps are revised. */
  progress: z
    .object({
      goal: z.string().max(300),
      steps: z.array(z.string().max(500)).max(80),
      current: z.number().int().min(0).max(80),
    })
    .optional(),
  parts: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        label: z.string().min(1).max(120),
        status: z.enum(["ok", "warning", "anomaly"]),
      }),
    )
    .max(MAX_GUIDE_PARTS),
});

/**
 * The guided procedure for the scene on screen: the steps the student follows,
 * each one pointing at the part it is about. Asked once per scan, with the
 * analyzed frame and the parts the models already found and named.
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
    const guide = await new MetaGuideWriter().write({
      imageDataUrl: parsed.data.image,
      context: parsed.data.context,
      assessment: parsed.data.assessment,
      progress: parsed.data.progress,
      parts: parsed.data.parts,
      apiKey: sentKey ?? undefined,
      signal: request.signal,
    });
    return Response.json(guide);
  } catch (error) {
    const modelError = toModelError(error);
    // Kind and status only: neither the image nor SDK messages go to the log.
    console.error(
      `[guide] ${modelError.kind} status=${modelError.status ?? "-"}`,
    );
    return fail(modelError.kind);
  }
}

/** A single Spark call, like the diagnosis. */
export const maxDuration = 60;
