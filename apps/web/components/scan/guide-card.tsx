"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  CircleHelp,
  Loader,
  SkipForward,
  X,
} from "lucide-react";
import { cn } from "cn";
import { useEffect, useState, type Ref } from "react";
import { useAnalysis } from "@/components/scan/analysis-provider";
import { VoiceControl } from "@/components/scan/voice-control";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { splitStep } from "@/lib/guide/focus";
import type { GuidePos } from "@/lib/overlay/guide-placement";
import { useSession } from "@/lib/session/session-provider";
import type {
  GuideOption,
  GuideOutcome,
  GuideReport,
  GuideVerdict,
} from "@/lib/types";

/** The card's look; where it sits comes from `place`. */
const DOCK =
  "pointer-events-auto absolute z-10 flex max-h-[60%] w-[min(26rem,calc(100%-1.5rem))] flex-col gap-2.5 overflow-y-auto rounded-2xl border bg-card/95 p-3.5 shadow-lg shadow-black/10 backdrop-blur";

/**
 * Where the card goes. `lib/overlay/guide-placement.ts` picks the place from
 * where the part of the step is, next to it and never over it, and the card
 * slides there. Until the first place is known it waits at the bottom left,
 * above the control bar.
 */
function place(pos: GuidePos | null) {
  return pos
    ? {
        className:
          "top-0 left-0 transition-transform duration-300 ease-out motion-reduce:transition-none",
        style: { transform: `translate(${pos.x}px, ${pos.y}px)` },
      }
    : { className: "bottom-[6.5rem] left-3", style: undefined };
}

/**
 * The guided procedure, on the image: the step the student is on, why, and the
 * part it is about (highlighted on the camera, with a line to this card). After
 * each step the student says whether it happened as the step said (and may write
 * what they saw); the tutor then works out what comes next. The microphone lives
 * here too: what it heard and what the tutor answered belong next to the step.
 */
export function GuideCard({
  cardRef,
  pos,
}: {
  cardRef: Ref<HTMLDivElement>;
  pos: GuidePos | null;
}) {
  const guide = useSession((s) => s.guide);
  const setPanelOpen = useSession((s) => s.setPanelOpen);
  const { analysis } = useAnalysis();
  const [note, setNote] = useState("");
  // Minimized to one line so the whole image can be seen.
  const [collapsed, setCollapsed] = useState(false);

  const answer = (result: GuideReport["result"]) => {
    analysis.answerGuideStep(
      note.trim() ? { result, note: note.trim() } : { result },
    );
    setNote("");
  };

  // An outcome the tutor offered: it says whether it is what the step expected,
  // and the note carries the outcome itself (plus what the student wrote).
  const answerOption = (option: GuideOption) => {
    analysis.answerGuideStep({
      result: option.expected ? "yes" : "no",
      note: [option.label, note.trim()].filter(Boolean).join(". "),
    });
    setNote("");
  };

  // The tutor drops this step and rewrites what follows: the note was for it.
  const skip = () => {
    analysis.skipGuideStep();
    setNote("");
  };

  const where = place(pos);

  if (guide.status === "loading") {
    return (
      <div
        ref={cardRef}
        className={cn(DOCK, where.className)}
        style={where.style}
      >
        <p
          role="status"
          className="flex items-center gap-3 text-sm text-muted-foreground"
        >
          <Loader
            aria-hidden="true"
            className="size-4 motion-safe:animate-spin"
          />
          Preparing the guide…
        </p>
      </div>
    );
  }
  if (guide.status !== "ready") return null;

  const total = guide.steps.length;
  const thinking = guide.thinking;
  const finished = guide.current >= total && !thinking;
  const step = guide.steps[guide.current];
  const { action, reason } = step
    ? splitStep(step.text)
    : { action: "", reason: "" };
  const options = step?.options ?? [];

  const answering = !thinking && !finished;
  const collapsedRow = (
    <div className="flex items-center gap-2">
      <span className="shrink-0 text-xs font-medium text-muted-foreground tabular-nums">
        {finished ? "Fin" : `${guide.current + 1}/${total}`}
      </span>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold">
        {thinking
          ? "Thinking about what comes next…"
          : finished
            ? "You finished the steps"
            : action}
      </p>
      {/* A step with its own outcomes is answered expanded; the plain answers fit in one line. */}
      {answering && options.length === 0 ? (
        <>
          <Button
            type="button"
            size="icon-sm"
            aria-label="It happened"
            onClick={() => answer("yes")}
          >
            <Check aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="It did not happen"
            onClick={() => answer("no")}
          >
            <X aria-hidden="true" />
          </Button>
          <Button
            type="button"
            size="icon-sm"
            variant="outline"
            aria-label="Not sure"
            onClick={() => answer("unsure")}
          >
            <CircleHelp aria-hidden="true" />
          </Button>
        </>
      ) : null}
      {answering ? (
        <Button
          type="button"
          size="icon-sm"
          variant="ghost"
          aria-label="Skip this step"
          onClick={skip}
        >
          <SkipForward aria-hidden="true" />
        </Button>
      ) : null}
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        aria-label="Show the full guide"
        onClick={() => setCollapsed(false)}
      >
        <ChevronUp aria-hidden="true" />
      </Button>
    </div>
  );

  const expanded = (
    <>
      <div className="flex items-center justify-between gap-3 text-xs font-medium text-muted-foreground">
        <span>
          {finished ? "Full guide" : `Step ${guide.current + 1} of ${total}`}
        </span>
        <span className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setPanelOpen(true)}
            className="underline-offset-2 hover:underline"
          >
            See the parts
          </button>
          <Button
            type="button"
            size="icon-sm"
            variant="ghost"
            aria-label="Minimize the guide"
            onClick={() => setCollapsed(true)}
          >
            <ChevronDown aria-hidden="true" />
          </Button>
        </span>
      </div>
      <p className="line-clamp-1 text-sm leading-snug font-semibold">
        <span className="font-medium text-muted-foreground">Goal: </span>
        {guide.goal}
      </p>

      {thinking ? (
        <p
          role="status"
          className="flex items-center gap-2 text-sm text-muted-foreground"
        >
          <Loader
            aria-hidden="true"
            className="size-4 motion-safe:animate-spin"
          />
          Thinking about what comes next…
        </p>
      ) : finished ? (
        <Finished />
      ) : (
        <>
          <p className="text-base leading-snug font-semibold">{action}</p>
          {reason ? (
            <p className="text-sm leading-snug text-muted-foreground">
              {reason}
            </p>
          ) : null}
          <Input
            value={note}
            onChange={(event) => setNote(event.target.value)}
            placeholder="What you saw or measured (optional)"
            aria-label="Step note"
            maxLength={400}
          />
          {/* The tutor says how the step can turn out; without it, the plain answers. */}
          {options.length > 0 ? (
            <div
              className="flex flex-wrap gap-2"
              role="group"
              aria-label="What happened?"
            >
              {options.map((option) => (
                <Button
                  key={option.label}
                  type="button"
                  variant="outline"
                  className="h-auto py-1.5 text-left whitespace-normal"
                  onClick={() => answerOption(option)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {options.length === 0 ? (
              <>
                <Button type="button" onClick={() => answer("yes")}>
                  <Check aria-hidden="true" data-icon="inline-start" />
                  It happened
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => answer("no")}
                >
                  <X aria-hidden="true" data-icon="inline-start" />
                  It did not happen
                </Button>
              </>
            ) : null}
            <Button
              type="button"
              variant={options.length > 0 ? "ghost" : "outline"}
              onClick={() => answer("unsure")}
            >
              <CircleHelp aria-hidden="true" data-icon="inline-start" />
              Not sure
            </Button>
            <Button type="button" variant="ghost" onClick={skip}>
              <SkipForward aria-hidden="true" data-icon="inline-start" />
              Skip
            </Button>
          </div>
        </>
      )}
    </>
  );

  // One tree for both sizes: the microphone stays mounted (and on) when the
  // card is minimized, only its panel is hidden.
  return (
    <div
      ref={cardRef}
      className={cn(DOCK, where.className, collapsed && "gap-2 p-2.5")}
      style={where.style}
    >
      {collapsed ? collapsedRow : expanded}
      <div className={collapsed ? "hidden" : undefined}>
        <VoiceControl />
      </div>
    </div>
  );
}

const VERDICT_TITLE: Record<GuideVerdict, string> = {
  resolved: "The camera sees the problem solved",
  unchanged: "The camera sees no changes",
  cannot_tell: "The camera cannot confirm it",
};

const OUTCOMES: { value: GuideOutcome; label: string }[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
  { value: "unsure", label: "Not sure" },
];

/**
 * The end of the steps: the camera compares the scene with the one the guide
 * started from (once, by itself) and the student says whether it worked. The
 * student's answer is the one that counts; the camera only accompanies it.
 */
function Finished() {
  const { analysis } = useAnalysis();
  const guide = useSession((s) => s.guide);
  const answer = useSession((s) => s.answerGuide);

  useEffect(() => {
    analysis.checkGuide();
  }, [analysis]);

  if (guide.status !== "ready") return null;
  const { check, outcome, conclusion } = guide;

  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm font-medium">
        <Check aria-hidden="true" className="size-4 text-ok" />
        You finished the steps.
      </p>

      {conclusion ? (
        <p className="rounded-lg bg-muted p-3 text-sm leading-snug">
          <span className="font-medium">Conclusion: </span>
          {conclusion}
        </p>
      ) : null}

      <div className="flex flex-col gap-2" role="group" aria-label="Result">
        <p className="text-sm font-semibold">Did it get fixed?</p>
        <div className="flex flex-wrap gap-2">
          {OUTCOMES.map(({ value, label }) => (
            <Button
              key={value}
              type="button"
              size="sm"
              variant={outcome === value ? "default" : "outline"}
              aria-pressed={outcome === value}
              onClick={() => answer(value)}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      {check.status === "loading" ? (
        <p
          role="status"
          className="flex items-center gap-2 text-xs text-muted-foreground"
        >
          <Loader
            aria-hidden="true"
            className="size-3.5 motion-safe:animate-spin"
          />
          Comparing with the starting image…
        </p>
      ) : check.status === "ready" ? (
        <div className="flex flex-col gap-1 text-sm leading-snug">
          <p className="flex items-center gap-2 font-medium">
            {check.verdict === "resolved" ? (
              <Check aria-hidden="true" className="size-4 text-ok" />
            ) : check.verdict === "unchanged" ? (
              <X aria-hidden="true" className="size-4 text-anomaly" />
            ) : (
              <CircleHelp aria-hidden="true" className="size-4" />
            )}
            {VERDICT_TITLE[check.verdict]}
          </p>
          <p className="text-muted-foreground">{check.comment}</p>
        </div>
      ) : check.status === "error" ? (
        <p className="text-xs text-muted-foreground">
          We could not compare with the camera. Your answer is the one that
          counts.
        </p>
      ) : null}
    </div>
  );
}
