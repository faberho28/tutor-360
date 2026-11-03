"use client";

import { Mic, MicOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVoice, type VoiceStatus } from "@/hooks/use-voice";

const STATUS_TEXT: Record<VoiceStatus, string> = {
  off: "Talk to the tutor",
  starting: "Opening the microphone…",
  listening: "Listening",
  hearing: "I hear you…",
  thinking: "Understanding…",
  speaking: "The tutor is speaking",
};

/**
 * The microphone switch of the guide. Once on it keeps listening: say what
 * happened in the step ("it happened", "it did not happen, it feels loose") or call the tutor
 * with a question ("Tutor, why do I measure the voltage?"). Steps are read aloud.
 */
export function VoiceControl() {
  const voice = useVoice();
  if (!voice.supported) return null;
  const on = voice.status !== "off";

  return (
    <div className="flex flex-col gap-2 rounded-xl border bg-card px-3 py-2.5">
      <div className="flex items-center gap-3">
        <Button
          type="button"
          size="sm"
          variant={on ? "default" : "outline"}
          aria-pressed={on}
          onClick={() => (on ? voice.stop() : void voice.start())}
        >
          {on ? (
            <Mic aria-hidden="true" data-icon="inline-start" />
          ) : (
            <MicOff aria-hidden="true" data-icon="inline-start" />
          )}
          {on ? "Turn voice off" : "Turn voice on"}
        </Button>
        <span
          role="status"
          className="flex-1 truncate text-xs font-medium text-muted-foreground"
        >
          {STATUS_TEXT[voice.status]}
        </span>
        {on ? (
          <span
            aria-hidden="true"
            className="h-1.5 w-16 overflow-hidden rounded-full bg-muted"
          >
            <span
              className="block h-full rounded-full bg-primary transition-[width] duration-100"
              style={{ width: `${Math.round(voice.level * 100)}%` }}
            />
          </span>
        ) : null}
      </div>
      {on && !voice.heard && !voice.reply ? (
        <p className="text-xs leading-snug text-muted-foreground">
          Say “it happened”, “it did not happen” or “Tutor, …” to ask.
        </p>
      ) : null}
      {voice.heard ? (
        <p className="text-xs leading-snug text-muted-foreground">
          <span className="font-medium">I heard: </span>“{voice.heard}”
        </p>
      ) : null}
      {voice.reply ? (
        <p className="text-sm leading-snug">
          <span className="font-medium">Tutor: </span>
          {voice.reply}
        </p>
      ) : null}
      {voice.error ? (
        <p role="alert" className="text-xs text-destructive">
          {voice.error}
        </p>
      ) : null}
    </div>
  );
}
