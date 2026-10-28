"use client";

import { useEffect } from "react";
import {
  playLiveScenario,
  stopLiveScenario,
} from "@/lib/fixtures/live-scenario";
import { useSessionStore } from "@/lib/session/session-provider";

/** Starts the live demo script on mount (used by `?scenario=live`). */
export function LiveAutoplay() {
  const store = useSessionStore();

  useEffect(() => {
    playLiveScenario(store);
    return stopLiveScenario;
  }, [store]);

  return null;
}
