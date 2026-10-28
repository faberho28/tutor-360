import "server-only";
import { z } from "zod";

const envSchema = z.object({
  MODEL_API_KEY: z.string().min(1),
  MODEL_API_BASE_URL: z.string().min(1),
  SEGMENTATION_MODEL: z.string().min(1),
  DIAGNOSIS_MODEL: z.string().min(1),
  SEGMENT_SCORE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.85),
});

export type Env = z.infer<typeof envSchema>;

export function parseEnv(source: Record<string, string | undefined>): Env {
  // Treat empty strings as absent so `.env` entries like `FOO=` are reported.
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

export const env: Env = parseEnv(process.env);
