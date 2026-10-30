import { ModelError, toModelError } from "../models/errors";
import type { PhrasePlanner } from "../models/phrase-planner";
import type { Segmenter } from "../models/segmenter";
import type { Detection } from "../types";
import { isHoleLike, keepParts } from "./mask-quality";
import { mergeNamedMasks, type PhraseCandidate } from "./merge-phrases";
import { MAX_SAM_PHRASES, MAX_VARIANTS, type PlannedPart } from "./scene";
import type { AnalyzeFrameInput, AnalyzeResponse } from "./types";
import { rankWordings } from "./variants";

/**
 * SAM never returned a mask under 0.50 in the lab, so this only guards against
 * a change on their side. The real threshold (`SEGMENT_SCORE_THRESHOLD`) is
 * about which masks count as "sure" when choosing between wordings: on boards
 * most correct masks score 0.50 to 0.85, so it cannot be a cut-off.
 */
export const MIN_MASK_SCORE = 0.5;

/** Most SAM calls one analysis sends: every part, every wording. */
export const MAX_PHRASES = MAX_SAM_PHRASES * MAX_VARIANTS;

export type AnalyzeByPhrasesOptions = {
  segmenter: Segmenter;
  /** Each one names ONE kind of object (SAM takes one per request), e.g. "keyboard key". */
  phrases: readonly string[];
  /** Spanish name per phrase for the labels; a phrase without one is its own label. */
  labels?: Readonly<Record<string, string>>;
  /**
   * Wordings of the same part: only the one SAM understood best keeps its
   * masks. A phrase in no group stands alone.
   */
  groups?: readonly (readonly string[])[];
  apiKey?: string;
  /** Masks at or above this confidence are "sure" when choosing a wording. */
  threshold: number;
  signal?: AbortSignal;
};

/** Reading order: rows from top to bottom, each row from left to right. */
function readingOrder<T extends { bbox: Detection["bbox"] }>(items: T[]): T[] {
  const heights = items.map((i) => i.bbox.h).sort((a, b) => a - b);
  const row = (heights[Math.floor(heights.length / 2)] ?? 0.05) * 0.6;
  const rowOf = (i: T) => Math.round((i.bbox.y + i.bbox.h / 2) / row);
  return [...items].sort((a, b) => rowOf(a) - rowOf(b) || a.bbox.x - b.bbox.x);
}

/** Trimmed, deduplicated and capped. */
function uniquePhrases(input: readonly string[]): string[] {
  return [
    ...new Set(input.map((line) => line.trim().slice(0, 60)).filter(Boolean)),
  ].slice(0, MAX_PHRASES);
}

/**
 * One SAM call per phrase, all in parallel, each finding every instance of its
 * phrase with mask and confidence. Nobody judges them here (status is always
 * ok). A phrase that fails does not sink the others; only when every phrase
 * fails does this throw.
 */
async function segmentPhrases(
  frame: AnalyzeFrameInput,
  options: AnalyzeByPhrasesOptions,
): Promise<{
  components: Detection[];
  /** Wordings that lost to a better one that did find something. */
  pruned: ReadonlySet<string>;
}> {
  const startedAt = Date.now();
  const { segmenter, threshold } = options;
  const phrases = uniquePhrases(options.phrases);
  if (phrases.length === 0) {
    throw new ModelError("invalid_response", "No phrase to look for");
  }

  const dropped: Record<string, number> = {};
  const drop = (reason: string) => {
    dropped[reason] = (dropped[reason] ?? 0) + 1;
  };

  const settled = await Promise.all(
    phrases.map(async (phrase) => {
      try {
        const instances = await segmenter.segment({
          imageDataUrl: frame.imageDataUrl,
          frameWidth: frame.width,
          frameHeight: frame.height,
          phrase,
          apiKey: options.apiKey,
          signal: options.signal,
        });
        // Noise, holes' specks, the surface that covers the camera and bodies
        // that hold other masks are not parts: they must not win a wording.
        return { phrase, instances: keepParts(instances, drop), error: null };
      } catch (error) {
        return { phrase, instances: [], error: toModelError(error) };
      }
    }),
  );
  const failed = settled.filter((s) => s.error);
  if (failed.length === settled.length) throw failed[0]!.error;

  // Wordings of one part compete: only the one SAM understood best keeps its masks.
  const losers = new Set<string>();
  const pruned = new Set<string>();
  const asked = new Set(phrases);
  for (const group of options.groups ?? []) {
    const members = group.filter((phrase) => asked.has(phrase));
    if (members.length < 2) continue;
    const ranked = rankWordings(
      members.map((phrase) => ({
        phrase,
        scores:
          settled
            .find((s) => s.phrase === phrase)
            ?.instances.map((instance) => instance.score) ?? [],
      })),
      threshold,
    );
    for (const rank of ranked.slice(1)) losers.add(rank.phrase);
    // The next analyses of this scene ask only for the winner, but only when it
    // found something: a part nobody found keeps every wording for another try.
    if (ranked[0]!.masks > 0) {
      for (const rank of ranked.slice(1)) pruned.add(rank.phrase);
    }
  }

  if (process.env.NODE_ENV !== "production") {
    // Development only: what each wording returned, to tell a weak analysis
    // from a failed call (a failed phrase is otherwise silent).
    const byPhrase = new Map(settled.map((s) => [s.phrase, s]));
    const describe = (phrase: string) => {
      const s = byPhrase.get(phrase)!;
      const count = s.error ? `ERROR ${s.error.kind}` : s.instances.length;
      return `"${phrase}" -> ${count}${losers.has(phrase) ? " (dropped)" : ""}`;
    };
    const lines = (options.groups ?? []).map(
      (group) =>
        `  ${group
          .filter((phrase) => byPhrase.has(phrase))
          .map(describe)
          .join(" | ")}`,
    );
    console.info(
      `[analyze] SAM: ${phrases.length} wordings, ${failed.length} failed, ${Date.now() - startedAt} ms, filtered ${JSON.stringify(dropped)}\n${lines.join("\n")}`,
    );
  }

  // Every mask of every phrase, in reading order inside its phrase.
  const candidates: PhraseCandidate[] = settled.flatMap(
    ({ phrase, instances }, phraseIndex) =>
      readingOrder(losers.has(phrase) ? [] : instances).map(
        (instance, ordinal) => ({
          id: `phrase-${phraseIndex}-${instance.objectId}`,
          label: "",
          concept: phrase,
          polygon: instance.polygon,
          bbox: instance.bbox,
          score: instance.score,
          status: "ok" as const,
          reason: null,
          seenAt: startedAt,
          phrase,
          phraseCount: instances.length,
          ordinal,
          baseLabel: options.labels?.[phrase] ?? phrase,
        }),
      ),
  );
  const { kept } = mergeNamedMasks(candidates);

  const components = kept
    .filter((c) => c.score === null || c.score >= MIN_MASK_SCORE)
    .map((c) => ({
      id: c.id,
      label: c.label,
      concept: c.concept,
      polygon: c.polygon,
      bbox: c.bbox,
      score: c.score,
      status: c.status,
      reason: c.reason,
      seenAt: c.seenAt,
    }));
  return { components, pruned };
}

export type AnalyzeSceneOptions = {
  planner: PhrasePlanner;
  segmenter: Segmenter;
  /** The Laboratorio case context for the planner. */
  context?: string;
  /**
   * The parts a previous analysis of this same scene already planned. When
   * present Spark is not called: only SAM runs.
   */
  plan?: readonly PlannedPart[];
  /** The user's own model API key; when absent the server's is used. */
  apiKey?: string;
  /** Masks at or above this confidence are "sure" when choosing a wording. */
  threshold: number;
  signal?: AbortSignal;
};

/**
 * Muse Spark decides which parts to look for (each with several wordings, never
 * boxes), then SAM answers every wording in its own parallel call and the one
 * SAM understood best is kept for each part. The plan comes back so the next
 * analysis of the same scene can skip Spark. If Spark asks for nothing, SAM is
 * not called.
 */
export async function analyzeScene(
  frame: AnalyzeFrameInput,
  options: AnalyzeSceneOptions,
): Promise<AnalyzeResponse> {
  const startedAt = Date.now();
  const { planner, segmenter, threshold, signal, apiKey } = options;

  const planned = options.plan?.length
    ? [...options.plan]
    : await planner.planParts({
        imageDataUrl: frame.imageDataUrl,
        context: options.context,
        reasoningEffort: "minimal",
        variants: MAX_VARIANTS,
        apiKey,
        signal,
      });
  // Nobody inspects a hole: whatever Spark (or an older plan) asked for.
  const parts = planned.filter(
    (part) => ![part.label, ...part.phrases].some(isHoleLike),
  );

  const planMs = Date.now() - startedAt;
  if (parts.length === 0) {
    return {
      components: [],
      plan: [],
      timestamp: Date.now(),
      latencyMs: Date.now() - startedAt,
    };
  }

  const { components, pruned } = await segmentPhrases(frame, {
    segmenter,
    phrases: parts.flatMap((part) => part.phrases),
    groups: parts.map((part) => part.phrases),
    labels: Object.fromEntries(
      parts.flatMap((part) =>
        part.phrases.map((phrase) => [phrase, part.label]),
      ),
    ),
    apiKey,
    threshold,
    signal,
  });

  if (process.env.NODE_ENV !== "production") {
    console.info(
      `[analyze] ${options.plan?.length ? "plan reused" : "plan asked to Spark"}: ${parts.length} parts in ${planMs} ms · total ${Date.now() - startedAt} ms · ${components.length} masks`,
    );
  }
  return {
    components,
    // The plan the next analyses of this scene reuse: each part keeps only the
    // wording SAM understood best (one call per wording becomes one per part). A manual
    // capture or a new scene plans again, with every wording.
    plan: parts.map((part) => ({
      ...part,
      phrases: part.phrases.filter((phrase) => !pruned.has(phrase)),
    })),
    timestamp: Date.now(),
    latencyMs: Date.now() - startedAt,
  };
}
