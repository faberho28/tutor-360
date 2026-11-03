import { z } from "zod";
import { MAX_GUIDE_PARTS } from "./limits";

/** What the tutor is told about each part: the review's guess, its reason and where it sits. */
export const guidePartSchema = z.object({
  id: z.string().min(1).max(64),
  label: z.string().min(1).max(120),
  status: z.enum(["ok", "warning", "anomaly"]),
  /** Why the review gave that status (one sentence). */
  reason: z.string().max(400).nullish(),
  /** Appeared after the tutor last looked. */
  isNew: z.boolean().optional(),
  /** Normalized (0..1) over the picture. */
  bbox: z.object({
    x: z.number().min(0).max(1),
    y: z.number().min(0).max(1),
    w: z.number().min(0).max(1),
    h: z.number().min(0).max(1),
  }),
});

export const guidePartsSchema = z.array(guidePartSchema).max(MAX_GUIDE_PARTS);
