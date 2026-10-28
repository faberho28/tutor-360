import { z } from "zod";

/** About 3 MB of JPEG once decoded; a 1280 px frame is far smaller. */
const MAX_IMAGE_CHARS = 4_000_000;
/** Headroom over the image for the JSON around it. */
export const MAX_BODY_BYTES = MAX_IMAGE_CHARS + 4_096;

export const analyzeRequestSchema = z.object({
  image: z
    .string()
    .max(MAX_IMAGE_CHARS)
    .regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/),
  /** Size in pixels of the JPEG, as reported by `captureFrame`. */
  width: z.number().int().min(1).max(4096),
  height: z.number().int().min(1).max(4096),
  sessionId: z.string().min(1).max(64),
});

export type AnalyzeRequest = z.infer<typeof analyzeRequestSchema>;
