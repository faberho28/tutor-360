"use client";

import { useSyncExternalStore } from "react";

const subscribe = (onTick: () => void) => {
  const id = setInterval(onTick, 1000);
  return () => clearInterval(id);
};

/** Current time in epoch ms with second resolution; 0 on the server. */
export function useNow(): number {
  return useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000) * 1000,
    () => 0,
  );
}
