import type { CapturedFrame } from "../camera/capture-frame";
import type { ComponentStatus } from "../component-status";
import type { Detection } from "../types";
import type { PlannedPart } from "./scene";
import { requestReview } from "./review-client";
import { outlineMasks } from "./review-image";

type Review =
  | { state: "pending" }
  | {
      state: "done";
      name: string;
      status: ComponentStatus;
      reason: string | null;
    }
  | { state: "failed" };

export type ReviewOptions = {
  context?: string;
  judgesCondition?: boolean;
  apiKey?: string;
};

/**
 * Spark's second look. The masks are already painted with the provisional name
 * SAM's wording gave them; here every kind of part (one per entry of the plan)
 * is sent to Spark, outlined on a copy of the frame, and comes back with its
 * final name and condition. One request per kind, all in parallel, so each name
 * appears as soon as its review finishes.
 *
 * Reviews belong to a scene: they are kept while it lasts (new masks of an
 * already reviewed kind inherit the verdict) and dropped with `reset`.
 */
export class PartReviews {
  private readonly reviews = new Map<string, Review>();
  /** Every wording of the plan -> the part it names. */
  private readonly partOf = new Map<string, string>();
  private controller = new AbortController();

  /** A new scene: forget every review and cancel the ones in flight. */
  reset() {
    this.controller.abort();
    this.controller = new AbortController();
    this.reviews.clear();
    this.partOf.clear();
  }

  /** Learns which part each wording of the plan belongs to. */
  learn(plan: readonly PlannedPart[]) {
    for (const part of plan) {
      for (const phrase of part.phrases) this.partOf.set(phrase, part.label);
    }
  }

  /** The detections of each part, in the order they come. */
  private groupByPart(detections: readonly Detection[]) {
    const groups = new Map<string, Detection[]>();
    for (const detection of detections) {
      const part = this.partOf.get(detection.concept);
      if (!part) continue;
      const group = groups.get(part);
      if (group) group.push(detection);
      else groups.set(part, [detection]);
    }
    return groups;
  }

  /**
   * The detections with what the reviews know: the final name (numbered when
   * the part has several), the status and the reason, and `reviewing` while a
   * review is still out. A part with no review yet is left as it is.
   */
  decorate(detections: readonly Detection[]): Detection[] {
    const patches = new Map<string, Partial<Detection>>();
    for (const [part, group] of this.groupByPart(detections)) {
      const review = this.reviews.get(part);
      if (!review) continue;
      group.forEach((detection, index) => {
        patches.set(
          detection.id,
          review.state === "done"
            ? {
                reviewing: false,
                label:
                  group.length > 1
                    ? `${review.name} ${index + 1}`
                    : review.name,
                status: review.status,
                reason: review.reason,
              }
            : { reviewing: review.state === "pending" },
        );
      });
    }
    return detections.map((d) => {
      const patch = patches.get(d.id);
      return patch ? { ...d, ...patch } : d;
    });
  }

  /**
   * Starts a review for every part that has none yet. `onSettled` runs each
   * time one finishes (done or failed) so the caller can redraw; a review that
   * was cancelled by `reset` stays silent.
   */
  begin(
    detections: readonly Detection[],
    frame: CapturedFrame,
    options: ReviewOptions,
    onSettled: () => void,
  ) {
    const signal = this.controller.signal;
    for (const [part, group] of this.groupByPart(detections)) {
      if (this.reviews.has(part)) continue;
      this.reviews.set(part, { state: "pending" });

      void (async () => {
        try {
          const image = await outlineMasks(frame, group);
          const review = await requestReview(
            image,
            { label: part, count: group.length },
            { ...options, signal },
          );
          if (signal.aborted) return;
          this.reviews.set(part, {
            state: "done",
            name: review.name,
            status: review.status,
            reason: review.reason,
          });
        } catch {
          // The provisional name stays: a failed review is not an error
          // worth interrupting the scan for.
          if (signal.aborted) return;
          this.reviews.set(part, { state: "failed" });
        }
        onSettled();
      })();
    }
  }
}
