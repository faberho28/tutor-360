"use client";

import { useSyncExternalStore } from "react";

const QUERY = "(min-width: 1024px)";

function subscribe(onChange: () => void) {
  const media = window.matchMedia(QUERY);
  media.addEventListener("change", onChange);
  return () => media.removeEventListener("change", onChange);
}

/**
 * true on desktop (>= 1024px), false below, undefined until the browser
 * answers (the server does not know the screen width).
 */
export function useIsDesktop(): boolean | undefined {
  return useSyncExternalStore<boolean | undefined>(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => undefined,
  );
}
