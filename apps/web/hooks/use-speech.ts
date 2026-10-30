"use client";

import { useCallback, useEffect, useState, useSyncExternalStore } from "react";

const noop = () => () => {};
const supported = () =>
  typeof window !== "undefined" && "speechSynthesis" in window;

/** Spanish voices in the order they sound best for Colombia. */
const PREFERRED_LANGS = ["es-CO", "es-MX", "es-US", "es-419", "es-ES"];

function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  for (const lang of PREFERRED_LANGS) {
    const match = voices.find((v) => v.lang.replace("_", "-") === lang);
    if (match) return match;
  }
  return voices.find((v) => v.lang.toLowerCase().startsWith("es"));
}

/**
 * Reads a text aloud with the browser's voice, in Spanish. `available` is false
 * where the browser has no speech synthesis (the button should not show).
 */
export function useSpeech() {
  const available = useSyncExternalStore(noop, supported, () => false);
  const [speaking, setSpeaking] = useState(false);

  const stop = useCallback(() => {
    if (!supported()) return;
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }, []);

  const speak = useCallback((text: string) => {
    if (!supported()) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "es-CO";
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(utterance);
  }, []);

  // Leaving the screen silences the voice.
  useEffect(
    () => () => {
      if (supported()) window.speechSynthesis.cancel();
    },
    [],
  );

  return { available, speaking, speak, stop };
}
