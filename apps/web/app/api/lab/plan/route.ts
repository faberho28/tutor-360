import { z } from "zod";
import { MAX_VARIANTS } from "@/lib/analysis/scene";
import { analyzeRequestSchema } from "@/lib/analysis/request";
import { getEnv } from "@/lib/env";
import { toModelError } from "@/lib/models/errors";
import {
  buildPartsPrompt,
  MetaPhrasePlanner,
} from "@/lib/models/phrase-planner";
import { API_KEY_HEADER, API_KEY_PATTERN } from "@/lib/settings/api-key";

const requestSchema = z.object({
  image: analyzeRequestSchema.shape.image,
  context: analyzeRequestSchema.shape.context,
  /** Replaces the built prompt. */
  prompt: z.string().max(20_000).optional(),
  /** Only returns the prompt that would be sent. */
  dryRun: z.boolean().optional(),
});

/**
 * Prompt lab, step 1: what Spark says about the state of the scene and what it
 * would ask SAM to paint. Development only.
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
  const { image, context, prompt, dryRun } = parsed.data;
  const built = buildPartsPrompt({ context, variants: MAX_VARIANTS });
  if (dryRun) return Response.json({ prompt: built });

  const sentKey = request.headers.get(API_KEY_HEADER);
  if (sentKey !== null && !API_KEY_PATTERN.test(sentKey)) {
    return Response.json({ error: "auth" }, { status: 401 });
  }
  try {
    getEnv();
    const startedAt = Date.now();
    const plan = await new MetaPhrasePlanner().planParts({
      imageDataUrl: image,
      context,
      reasoningEffort: "minimal",
      variants: MAX_VARIANTS,
      promptOverride: prompt,
      apiKey: sentKey ?? undefined,
      signal: request.signal,
    });
    return Response.json({
      prompt: prompt ?? built,
      parts: plan,
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
