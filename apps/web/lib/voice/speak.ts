const PREFERRED = ["es-CO", "es-MX", "es-US", "es-419", "es-ES"];

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = window.speechSynthesis.getVoices();
  for (const lang of PREFERRED) {
    const found = voices.find((voice) => voice.lang.replace("_", "-") === lang);
    if (found) return found;
  }
  return (
    voices.find((voice) => voice.lang.toLowerCase().startsWith("es")) ?? null
  );
}

export function canSpeak(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/** Says `text` out loud in Spanish and resolves when it ends (or is cancelled). */
export function speak(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (!canSpeak() || !text.trim()) {
      resolve();
      return;
    }
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) {
      utterance.voice = voice;
      utterance.lang = voice.lang;
    } else {
      utterance.lang = "es-CO";
    }
    utterance.rate = 1.02;
    // Some browsers and voices never fire the end event: without a way out the
    // microphone would stay paused for good.
    const timer = window.setTimeout(resolve, 3000 + text.length * 120);
    const done = () => {
      window.clearTimeout(timer);
      resolve();
    };
    utterance.onend = done;
    utterance.onerror = done;
    window.speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if (canSpeak()) window.speechSynthesis.cancel();
}
