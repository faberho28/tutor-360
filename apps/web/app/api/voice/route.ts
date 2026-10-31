import { z } from "zod";
import { failure as fail } from "@/lib/analysis/error-response";
import { analyzeRequestSchema, MAX_BODY_BYTES } from "@/lib/analysis/request";
import { getEnv } from "@/lib/env";
import { ModelError, toModelError } from "@/lib/models/errors";
import { MetaVoiceWriter } from "@/lib/models/voice-writer";
import { API_KEY_HEADER, API_KEY_PATTERN } from "@/lib/settings/api-key";

const requestSchema = z.object({
  transcript: z.string().trim().min(1).max(600),
  image: analyzeRequestSchema.shape.image,
  caseContext: analyzeRequestSchema.shape.context,
  context: z.object({
    goal: z.string().max(400),
    assessment: z.string().max(500).optional(),
    steps: z.array(z.string().max(600)).max(80),
    current: z.number().int().min(0).max(80),
    reports: z
      .array(
        z
          .object({
            result: z.enum(["yes", "no", "unsure"]),
            note: z.string().max(500).optional(),
          })
          .nullable(),
      )
      .max(80),
    awaiting: z.boolean(),
    conclusion: z.string().max(800).optional(),
  }),
});

/**
 * One thing the student said out loud: Spark decides if it answers the current
 * step, asks the tutor something or is noise, and answers a question in the same
 * call (looking at the live frame). Nothing here keeps the audio or the text.
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
    const turn = await new MetaVoiceWriter().write({
      transcript: parsed.data.transcript,
      imageDataUrl: parsed.data.image,
      caseContext: parsed.data.caseContext,
      context: parsed.data.context,
      apiKey: sentKey ?? undefined,
      signal: request.signal,
    });
    return Response.json(turn);
  } catch (error) {
    const modelError = toModelError(error);
    // Kind and status only: neither the image nor what was said goes to the log.
    console.error(
      `[voice] ${modelError.kind} status=${modelError.status ?? "-"}`,
    );
    return fail(modelError.kind);
  }
}

/** A single Spark call, like the guide. */
export const maxDuration = 60;
