import "server-only";
import { buildObjectPrompt } from "@meta-sam/parser";
import { GRID } from "../analysis/scene";
import { getEnv } from "../env";
import { getModelClient } from "./client";
import { toModelError } from "./errors";
import { readSegmentation, type SegmentedInstance } from "./read-segmentation";

/** A box on the 0..1000 grid: [x_min, y_min, x_max, y_max]. */
export type GridBox = readonly [number, number, number, number];

export type SegmentInput = {
  /** `data:image/jpeg;base64,...` of the frame. */
  imageDataUrl: string;
  /** Size in pixels of the image sent: the API reports masks in this space. */
  frameWidth: number;
  frameHeight: number;
  /** One object per box; `id` comes back as the instance's `objectId`. */
  objects: readonly { id: number; box: GridBox }[];
  /** The user's own key; when absent the server's key is used. */
  apiKey?: string;
  signal?: AbortSignal;
};

export interface Segmenter {
  segment(input: SegmentInput): Promise<SegmentedInstance[]>;
}

/** Grid box -> pixel box with a half-open right/bottom, inside the frame. */
export function toPixelBox(box: GridBox, width: number, height: number) {
  const [x0, y0, x1, y1] = box;
  const left = Math.min(Math.floor((x0 / GRID) * width), width - 1);
  const top = Math.min(Math.floor((y0 / GRID) * height), height - 1);
  return {
    left,
    top,
    right: Math.min(Math.max(Math.ceil((x1 / GRID) * width), left + 1), width),
    bottom: Math.min(
      Math.max(Math.ceil((y1 / GRID) * height), top + 1),
      height,
    ),
  };
}

export class MetaSegmenter implements Segmenter {
  async segment(input: SegmentInput): Promise<SegmentedInstance[]> {
    if (input.objects.length === 0) return [];
    try {
      const client = getModelClient(input.apiKey);
      const prompt = buildObjectPrompt({
        size: { width: input.frameWidth, height: input.frameHeight },
        objects: input.objects.map(({ id, box }) => ({
          id,
          prompts: [
            { box: toPixelBox(box, input.frameWidth, input.frameHeight) },
          ],
        })),
      });
      const events = await client.responses.create(
        {
          model: getEnv().SEGMENTATION_MODEL,
          input: [
            {
              type: "message",
              role: "user",
              content: [
                { type: "input_text", text: prompt },
                {
                  type: "input_image",
                  image_url: input.imageDataUrl,
                  detail: "auto",
                },
              ],
            },
          ],
          stream: true,
          // `c` is only sent on request; one_bit keeps the mask payload small.
          metadata: { include_confidence: "true", mask_encoding: "one_bit" },
        },
        { signal: input.signal },
      );

      const { instances, diagnostics } = await readSegmentation(events, {
        width: input.frameWidth,
        height: input.frameHeight,
      });
      if (diagnostics.length > 0) {
        console.warn(
          `[segmenter] ${diagnostics.length} unreadable line(s), first: ${diagnostics[0]?.code}`,
        );
      }
      return instances;
    } catch (error) {
      throw toModelError(error);
    }
  }
}
