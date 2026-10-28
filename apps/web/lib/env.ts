import "server-only";
import { z } from "zod";
import { COMPONENT_CLASSES } from "./component-status";

const classListSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean),
  )
  .pipe(z.array(z.enum(COMPONENT_CLASSES)).min(1))
  .default([...COMPONENT_CLASSES]);

// Only the key is mandatory; everything else has a documented default.
const envSchema = z.object({
  MODEL_API_KEY: z.string().min(1),
  MODEL_API_BASE_URL: z.string().min(1).default("https://api.meta.ai/v1"),
  SEGMENTATION_MODEL: z.string().min(1).default("sam-3.1"),
  DIAGNOSIS_MODEL: z.string().min(1).default("muse-spark-1.3"),
  SEGMENT_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
  /** Comma-separated subset of component classes to analyze. */
  ANALYSIS_CLASSES: classListSchema,
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
