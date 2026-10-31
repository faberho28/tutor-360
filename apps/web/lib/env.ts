import "server-only";
import { z } from "zod";

// Everything has a default. The key is optional here because the user can send
// their own from Ajustes; without either, the model calls fail as not_configured.
const envSchema = z.object({
  MODEL_API_KEY: z.string().min(1).optional(),
  MODEL_API_BASE_URL: z.string().min(1).default("https://api.meta.ai/v1"),
  SEGMENTATION_MODEL: z.string().min(1).default("sam-3.1"),
  /** Reads the scene: names and locates what is in the frame (Muse Spark). */
  SCENE_MODEL: z.string().min(1).default("muse-spark-1.3"),
  /** Turns what the student says into text (Muse Voice Transcribe). */
  TRANSCRIPTION_MODEL: z.string().min(1).default("muse-voice-transcribe-1.0"),
  DIAGNOSIS_MODEL: z.string().min(1).default("muse-spark-1.3"),
  /** Standard-mode model the diagnosis falls back to (never a contributor one). */
  DIAGNOSIS_FALLBACK_MODEL: z.string().min(1).default("muse-spark-1.2"),
  SEGMENT_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  // Treat empty strings as absent so `.env` entries like `FOO=` use the default.
  const cleaned = Object.fromEntries(
    Object.entries(source).filter(([, value]) => value !== ""),
  );
  const result = envSchema.safeParse(cleaned);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Invalid environment variables: ${details}`);
  }
  return result.data;
}

let cached: Env | undefined;

/** Lazy on purpose: the app must boot without a key until a model is called. */
export function getEnv(): Env {
  cached ??= parseEnv(process.env);
  return cached;
}
