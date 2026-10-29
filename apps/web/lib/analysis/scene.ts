import { z } from "zod";

/** Most parts (what Spark asks SAM to find) one analysis may plan. */
export const MAX_SAM_PHRASES = 8;

/** Most wordings Spark may give for one part (each one is a SAM call). */
export const MAX_VARIANTS = 3;

/**
 * One part of what Muse Spark sees that is worth inspecting, with several
 * wordings of it: SAM reacts very differently to near-synonyms, so the analysis
 * asks with all of them and keeps the one SAM understood best.
 */
export const partSchema = z.object({
  /** Name for the user, in Spanish. */
  label: z.string().trim().min(1).max(60),
  /** Different English wordings of the SAME single part. */
  phrases: z.array(z.string().trim().min(1).max(60)).min(1).max(MAX_VARIANTS),
});

export const partPlanSchema = z.object({
  parts: z.array(partSchema),
});

export type PlannedPart = z.infer<typeof partSchema>;
