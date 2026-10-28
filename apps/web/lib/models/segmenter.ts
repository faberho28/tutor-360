import "server-only";
import { getEnv } from "../env";
import { getModelClient } from "./client";
import { toModelError } from "./errors";
import { readSegmentation, type SegmentedInstance } from "./read-segmentation";

export type SegmentInput = {
  /** `data:image/jpeg;base64,...` of the frame. */
  imageDataUrl: string;
  /** Size in pixels of the image sent: the API reports masks in this space. */
  frameWidth: number;
  frameHeight: number;
  /** One short noun phrase naming one kind of object (see concepts.ts). */
  concept: string;
  signal?: AbortSignal;
};

export interface Segmenter {
  segment(input: SegmentInput): Promise<SegmentedInstance[]>;
}

export class MetaSegmenter implements Segmenter {
  async segment(input: SegmentInput): Promise<SegmentedInstance[]> {
    try {
      const client = getModelClient();
      const events = await client.responses.create(
        {
          model: getEnv().SEGMENTATION_MODEL,
          input: [
            {
              type: "message",
              role: "user",
              content: [
                { type: "input_text", text: input.concept },
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
          `[segmenter] "${input.concept}": ${diagnostics.length} unreadable line(s), first: ${diagnostics[0]?.code}`,
        );
      }
      return instances;
    } catch (error) {
      throw toModelError(error);
    }
  }
}
