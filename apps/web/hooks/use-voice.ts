"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useAnalysis } from "@/components/scan/analysis-provider";
import { splitStep } from "@/lib/guide/focus";
import { useSession, useSessionStore } from "@/lib/session/session-provider";
import { readApiKey } from "@/lib/settings/api-key";
import { worthAsking } from "@/lib/voice/gate";
import { VoiceListener } from "@/lib/voice/listener";
import { canSpeak, speak, stopSpeaking } from "@/lib/voice/speak";
import { transcribe } from "@/lib/voice/voice-client";

export type VoiceStatus =
  "off" | "starting" | "listening" | "hearing" | "thinking" | "speaking";

/** The tutor never talks over the student: it waits this long at most. */
const WAIT_FOR_SILENCE_MS = 8000;
/** Lets the speaker's echo die out before the microphone listens again. */
const ECHO_PAUSE_MS = 350;

/**
 * The voice of the scan: always listening once it is turned on. What is said is
 * transcribed (Muse Voice Transcribe) and Spark decides if it answers the step,
 * asks the tutor or is noise; answers move the guide on, questions are spoken
 * back, and every new step is read aloud. The microphone is paused while the
 * tutor talks so it never hears itself.
 */
export function useVoice() {
  const { analysis } = useAnalysis();
  const store = useSessionStore();
  const guide = useSession((s) => s.guide);

  const [status, setStatus] = useState<VoiceStatus>("off");
  const [level, setLevel] = useState(0);
  const [heard, setHeard] = useState("");
  const [reply, setReply] = useState("");
  const [error, setError] = useState<string | null>(null);

  const listener = useRef<VoiceListener | null>(null);
  const on = useRef(false);
  const busy = useRef(false);
  const speaking = useRef(0);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const spoken = useRef(new Set<string>());
  const abort = useRef(new AbortController());
  const handlers = useRef<{ utterance: (wav: Blob) => void }>({
    utterance: () => {},
  });

  /** Says `text` after whatever is being said, with the microphone paused. */
  const say = useCallback((text: string) => {
    if (!on.current || !canSpeak()) return;
    speaking.current++;
    queue.current = queue.current.then(async () => {
      if (!on.current) {
        speaking.current--;
        return;
      }
      // If the student is in the middle of a sentence, let them finish it.
      const startedWaiting = Date.now();
      while (
        on.current &&
        listener.current?.isSpeaking &&
        Date.now() - startedWaiting < WAIT_FOR_SILENCE_MS
      ) {
        await new Promise((resolve) => setTimeout(resolve, 200));
      }
      if (!on.current) {
        speaking.current--;
        return;
      }
      listener.current?.pause();
      setStatus("speaking");
      await speak(text);
      speaking.current--;
      if (!on.current || speaking.current > 0) return;
      await new Promise((resolve) => setTimeout(resolve, ECHO_PAUSE_MS));
      if (!on.current) return;
      listener.current?.resume();
      setStatus("listening");
    });
  }, []);

  const handleUtterance = async (wav: Blob) => {
    if (busy.current || !on.current) return;
    busy.current = true;
    setStatus("thinking");
    setError(null);
    const { signal } = abort.current;
    try {
      const apiKey = readApiKey() ?? undefined;
      const text = await transcribe(wav, { signal, apiKey });
      if (signal.aborted) return;
      setHeard(text);
      const current = store.getState().guide;
      const awaiting =
        current.status === "ready" &&
        !current.thinking &&
        current.current < current.steps.length;
      if (!worthAsking(text, awaiting)) return;
      const outcome = await analysis.voiceTurn(text, signal);
      if (signal.aborted) return;
      if (outcome.intent === "question" && outcome.reply) {
        setReply(outcome.reply);
        say(outcome.reply);
      }
    } catch {
      if (!signal.aborted)
        setError("No pude entender lo último. Sigo escuchando.");
    } finally {
      busy.current = false;
      if (on.current && speaking.current === 0) setStatus("listening");
    }
  };

  // The listener is built once: it calls whatever the latest render defined.
  useEffect(() => {
    handlers.current.utterance = handleUtterance;
  });

  const start = useCallback(async () => {
    if (on.current) return;
    setError(null);
    setStatus("starting");
    try {
      listener.current ??= new VoiceListener({
        onUtterance: (wav) => handlers.current.utterance(wav),
        onLevel: (value) =>
          setLevel((previous) =>
            Math.abs(previous - value) > 0.04 ? value : previous,
          ),
        onSpeech: (speaking) =>
          setStatus((previous) =>
            previous === "listening" || previous === "hearing"
              ? speaking
                ? "hearing"
                : "listening"
              : previous,
          ),
      });
      await listener.current.start();
      on.current = true;
      setStatus("listening");
    } catch {
      on.current = false;
      listener.current = null;
      setStatus("off");
      setError("No pude abrir el micrófono. Revisa el permiso del navegador.");
    }
  }, []);

  const stop = useCallback(() => {
    on.current = false;
    listener.current?.stop();
    listener.current = null;
    stopSpeaking();
    abort.current.abort();
    abort.current = new AbortController();
    queue.current = Promise.resolve();
    speaking.current = 0;
    busy.current = false;
    spoken.current.clear();
    setStatus("off");
    setLevel(0);
  }, []);

  useEffect(() => stop, [stop]);

  // Every new step is read aloud once (and how it ended, at the end).
  useEffect(() => {
    if (status === "off" || status === "starting") return;
    if (guide.status !== "ready" || guide.thinking) return;
    const over = guide.current >= guide.steps.length;
    const key = over
      ? `end:${guide.conclusion}`
      : `step:${guide.current}:${guide.steps[guide.current]!.text}`;
    if (spoken.current.has(key)) return;
    spoken.current.add(key);
    if (over) {
      say(
        guide.conclusion
          ? `Terminamos. ${guide.conclusion}`
          : "Terminamos los pasos.",
      );
      return;
    }
    // Only the action: the tutor cannot be interrupted while it talks (the
    // microphone is paused), so a long reading would leave the student mute. The
    // criterion ("si pasa X, entonces Y") is on screen or one question away.
    const { action } = splitStep(guide.steps[guide.current]!.text);
    say(`Paso ${guide.current + 1}. ${action}.`);
  }, [guide, status, say]);

  return {
    status,
    level,
    heard,
    reply,
    error,
    supported:
      typeof navigator !== "undefined" &&
      !!navigator.mediaDevices?.getUserMedia,
    start,
    stop,
  };
}
