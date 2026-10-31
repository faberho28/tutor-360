import { z } from "zod";

/** Most parts (what Spark asks SAM to find) one analysis may plan. */
export const MAX_SAM_PHRASES = 5;

/**
 * Wordings Spark gives for each part (each one is a SAM call): the best of
 * three is kept. Once SAM has chosen, the next analyses of the scene ask only
 * for the winner.
 */
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
  /** Spark's first judgment of the state of what it sees (Spanish). */
  assessment: z.string().trim().max(400),
  parts: z.array(partSchema),
});

export type PlannedPart = z.infer<typeof partSchema>;

/** What Spark made of the scene: the state it sees and what to ask SAM for. */
export type ScenePlan = z.infer<typeof partPlanSchema>;
