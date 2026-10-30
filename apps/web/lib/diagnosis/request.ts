import { z } from "zod";
import { COMPONENT_STATUSES } from "../component-status";
import { analyzeRequestSchema } from "../analysis/request";

/** Body of `POST /api/diagnose`: one part, cropped from the analyzed frame. */
export const diagnoseRequestSchema = z.object({
  /** The crop of the part, JPEG. */
  image: analyzeRequestSchema.shape.image,
  context: analyzeRequestSchema.shape.context,
  /** What the review called it (Spanish). */
  label: z.string().trim().min(1).max(80),
  status: z.enum(COMPONENT_STATUSES),
  /** Why the review gave that status; absent when it gave none. */
  reason: z.string().trim().max(300).nullish(),
});

export type DiagnoseRequest = z.infer<typeof diagnoseRequestSchema>;
