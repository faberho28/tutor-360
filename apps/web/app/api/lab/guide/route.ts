import { z } from "zod";
import { analyzeRequestSchema } from "@/lib/analysis/request";
import { getEnv } from "@/lib/env";
import { MAX_GUIDE_PARTS } from "@/lib/guide/limits";
import { toModelError } from "@/lib/models/errors";
import { buildGuidePrompt, MetaGuideWriter } from "@/lib/models/guide-writer";
import { API_KEY_HEADER, API_KEY_PATTERN } from "@/lib/settings/api-key";

const requestSchema = z.object({
  /** The picture with every part outlined and numbered. */
  image: analyzeRequestSchema.shape.image,
  context: analyzeRequestSchema.shape.context,
  assessment: z.string().max(400).optional(),
  parts: z
    .array(
      z.object({
        id: z.string().min(1).max(64),
        label: z.string().min(1).max(120),
        status: z.enum(["ok", "warning", "anomaly"]),
      }),
    )
    .max(MAX_GUIDE_PARTS),
  /** The procedure being followed, with what the student reported. */
  progress: z
    .object({
      goal: z.string().max(300),
      steps: z.array(z.string().max(500)).max(80),
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
        .max(80)
        .optional(),
    })
    .optional(),
  /** Replaces the built prompt. */
  prompt: z.string().max(30_000).optional(),
  /** Only returns the prompt that would be sent. */
  dryRun: z.boolean().optional(),
  effort: z.enum(["minimal", "low", "medium", "high"]).optional(),
});

/**
 * Prompt lab, step 3: the guide Spark writes for the state it found and the
 * parts SAM painted. Development only.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return new Response("Not found", { status: 404 });
  }
  const parsed = requestSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success)
    return Response.json({ error: "invalid" }, { status: 400 });
  const {
    image,
    context,
    assessment,
    parts,
    prompt,
    dryRun,
    effort,
    progress,
  } = parsed.data;
  const built = buildGuidePrompt({ context, assessment, parts, progress });
  if (dryRun) return Response.json({ prompt: built });

  const sentKey = request.headers.get(API_KEY_HEADER);
  if (sentKey !== null && !API_KEY_PATTERN.test(sentKey)) {
    return Response.json({ error: "auth" }, { status: 401 });
  }
  try {
    getEnv();
    const startedAt = Date.now();
    const guide = await new MetaGuideWriter().write({
      imageDataUrl: image,
      context,
      assessment,
      parts,
      progress,
      promptOverride: prompt,
      reasoningEffort: effort,
      apiKey: sentKey ?? undefined,
      signal: request.signal,
    });
    return Response.json({
      prompt: prompt ?? built,
      goal: guide.goal,
      steps: guide.steps,
      conclusion: guide.conclusion,
      ms: Date.now() - startedAt,
    });
  } catch (error) {
    const modelError = toModelError(error);
    return Response.json(
      { error: modelError.kind, message: modelError.message },
      { status: 502 },
    );
  }
}

export const maxDuration = 60;
