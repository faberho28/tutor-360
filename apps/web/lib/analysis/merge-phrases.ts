import type { Detection } from "../types";
import { bboxIou } from "./iou";

/** Two masks this much alike (box IoU) are the same thing seen by two phrases. */
export const MERGE_IOU = 0.9;

/** A mask from one phrase, with what the merge needs to know about its phrase. */
export type PhraseCandidate = Detection & {
  phrase: string;
  /** How many masks the whole phrase returned. */
  phraseCount: number;
  /** Position inside its phrase (reading order), from 0. */
  ordinal: number;
  /** The Spanish name of the phrase (or the phrase itself). */
  baseLabel: string;
};

export type Merge = {
  /** The phrase that returned more masks: the one whose geometry is kept. */
  generic: string;
  /** The phrase with fewer masks: it only lends its name. */
  specific: string;
  /** The specific phrase's name: given to the mask when `renamed`, else only a candidate. */
  label: string;
  iou: number;
  genericScore: number | null;
  specificScore: number | null;
  /**
   * False when the specific phrase was less sure than the type phrase about
   * this mask: the type phrase's name stays and the other is only noted.
   */
  renamed: boolean;
};

/** "tecla shift 2" when its phrase found several, plain "barra espaciadora" when one. */
export function nameOf(
  c: Pick<PhraseCandidate, "baseLabel" | "phraseCount" | "ordinal">,
): string {
  return c.phraseCount > 1 ? `${c.baseLabel} ${c.ordinal + 1}` : c.baseLabel;
}

/**
 * A phrase that names one part ("enter key") usually returns a mask that the
 * type phrase ("keyboard key") already found. Such a pair is one thing: keep
 * the type phrase's mask and confidence (the same mask scores differently under
 * each phrase, and the specific score must not sink the key). The specific
 * phrase's name goes to the mask only when that phrase is at least as sure of it
 * as the type phrase is: a loose phrase matches look-alikes (a "shift key" that
 * is a backspace, a "pin connector" that is a capacitor) and a lower score is
 * the only sign of it. Otherwise the type phrase's name stays and the other is
 * only a candidate in the log. Phrases that returned the same number of masks
 * cannot tell which is the type, so nothing is merged between them.
 */
export function mergeNamedMasks(candidates: readonly PhraseCandidate[]): {
  kept: PhraseCandidate[];
  merges: Merge[];
} {
  const result = candidates.map((c) => ({ ...c, label: nameOf(c) }));
  const named = new Set<number>();
  const removed = new Set<number>();
  const merges: Merge[] = [];

  // The phrases with fewer masks first: they are the candidates to be absorbed.
  const order = result
    .map((_, i) => i)
    .sort((a, b) => result[a]!.phraseCount - result[b]!.phraseCount || a - b);

  for (const i of order) {
    const specific = result[i]!;
    if (removed.has(i) || named.has(i)) continue;
    let best = -1;
    let bestIou = 0;
    result.forEach((generic, j) => {
      if (
        j === i ||
        removed.has(j) ||
        named.has(j) ||
        generic.phrase === specific.phrase ||
        generic.phraseCount <= specific.phraseCount
      ) {
        return;
      }
      const iou = bboxIou(generic.bbox, specific.bbox);
      if (iou >= MERGE_IOU && iou > bestIou) {
        best = j;
        bestIou = iou;
      }
    });
    if (best < 0) continue;

    const generic = result[best]!;
    // No score on the specific phrase is no evidence for its name.
    const renamed =
      specific.score !== null &&
      (generic.score === null || specific.score >= generic.score);
    merges.push({
      generic: generic.phrase,
      specific: specific.phrase,
      label: specific.label,
      iou: bestIou,
      genericScore: generic.score,
      specificScore: specific.score,
      renamed,
    });
    // The duplicate mask goes either way; the name only when it earned it.
    removed.add(i);
    if (renamed) {
      result[best] = {
        ...generic,
        label: specific.label,
        concept: specific.concept,
      };
      named.add(best);
    }
  }

  return { kept: result.filter((_, i) => !removed.has(i)), merges };
}
