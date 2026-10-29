import "server-only";
import { getEnv } from "../env";
import { getModelClient } from "./client";
import { toModelError } from "./errors";
import { readSegmentation, type SegmentedInstance } from "./read-segmentation";

/**
 * What SAM is asked: one noun phrase naming ONE kind of object, and it finds
 * every instance of it. A list of phrases, or a generic one, comes back as an
 * empty stream, so the caller sends one request per phrase.
 */
export type SegmentInput = {
  /** `data:image/jpeg;base64,...` of the frame. */
  imageDataUrl: string;
  /** Size in pixels of the image sent: the API reports masks in this space. */
  frameWidth: number;
  frameHeight: number;
  /** A short noun phrase naming ONE kind of object, e.g. "keyboard key". */
  phrase: string;
  /** The user's own key; when absent the server's key is used. */
  apiKey?: string;
  signal?: AbortSignal;
};

export interface Segmenter {
  segment(input: SegmentInput): Promise<SegmentedInstance[]>;
}

export class MetaSegmenter implements Segmenter {
  async segment(input: SegmentInput): Promise<SegmentedInstance[]> {
    const phrase = input.phrase.trim();
    if (!phrase) return [];
    try {
      const client = getModelClient(input.apiKey);
      // `c` is only sent on request; one_bit keeps the mask payload small.
      const { data: events } = await client.responses
        .create(
          {
            model: getEnv().SEGMENTATION_MODEL,
            input: [
              {
                type: "message",
                role: "user",
                content: [
                  { type: "input_text", text: phrase },
                  {
                    type: "input_image",
                    image_url: input.imageDataUrl,
                    detail: "auto",
                  },
                ],
              },
            ],
            stream: true,
            metadata: {
              include_confidence: "true",
              mask_encoding: "one_bit",
            },
          },
          { signal: input.signal },
        )
        .withResponse();

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
