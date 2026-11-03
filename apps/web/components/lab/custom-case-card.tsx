"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CARD_CLASS, LabCardBody } from "@/components/lab/lab-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CUSTOM_MAX,
  CUSTOM_MIN,
  cleanCustomText,
  scanHref,
  type LabCase,
} from "@/lib/lab/cases";
import type { TutorLevel } from "@/lib/tutor/levels";

/** The free-form case: the user says what they will show and what to look for. */
export function CustomCaseCard({
  labCase,
  level,
}: {
  labCase: LabCase;
  level: TutorLevel;
}) {
  const router = useRouter();
  const [text, setText] = useState("");
  const valid = cleanCustomText(text) !== null;

  function start(event: FormEvent) {
    event.preventDefault();
    if (valid) router.push(scanHref("custom", level, text));
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={CARD_CLASS}>
          <LabCardBody labCase={labCase} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={start} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Custom case</DialogTitle>
            <DialogDescription>
              Tell the AI what you are going to show and what you want to find.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="custom-case" className="text-xs font-medium">
              What are you going to inspect?
            </label>
            <Textarea
              id="custom-case"
              value={text}
              maxLength={CUSTOM_MAX}
              onChange={(event) => setText(event.target.value)}
              placeholder="e.g. an open game console; I am looking for burnt or loose parts"
              aria-describedby="custom-case-hint"
            />
            <p
              id="custom-case-hint"
              className="flex justify-between text-xs text-muted-foreground"
            >
              <span>
                {valid
                  ? "Ready to start."
                  : `Write at least ${CUSTOM_MIN} characters.`}
              </span>
              <span className="tabular-nums">
                {text.length}/{CUSTOM_MAX}
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={!valid}
              className="rounded-full px-5"
            >
              Start scanning
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
