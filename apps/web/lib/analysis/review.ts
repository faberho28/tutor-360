import { z } from "zod";
import type { ComponentStatus } from "../component-status";
import { analyzeRequestSchema } from "./request";

/** Body of `POST /api/review`: one kind of part, outlined on a copy of the frame. */
export const reviewRequestSchema = z.object({
  /** The frame with the part's masks outlined, drawn by the browser. */
  image: analyzeRequestSchema.shape.image,
  context: analyzeRequestSchema.shape.context,
  /** False for inventory cases: the status is always ok. */
  judgesCondition: z.boolean().default(true),
  part: z.object({
    /** What the segmentation provisionally called it. */
    label: z.string().trim().min(1).max(60),
    /** How many instances are outlined. */
    count: z.number().int().min(1).max(500),
  }),
});

export type ReviewRequest = z.infer<typeof reviewRequestSchema>;

/** Body of a 200 response from `POST /api/review`. */
export type ReviewResponse = {
  /** Final name in Spanish, singular. */
  name: string;
  status: ComponentStatus;
  /** Why, in one sentence; null when the status is ok. */
  reason: string | null;
};
