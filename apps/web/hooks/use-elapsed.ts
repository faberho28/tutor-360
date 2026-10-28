"use client";

import { useCallback, useSyncExternalStore } from "react";

/**
 * Whole seconds since `startedAt` (epoch ms). It re-renders once per second
 * while `running`; when it stops, the last value stays.
 */
export function useElapsed(startedAt: number | null, running: boolean): number {
  const subscribe = useCallback(
    (onTick: () => void) => {
      if (!running) return () => {};
      const id = setInterval(onTick, 1000);
      return () => clearInterval(id);
    },
    [running],
  );

  // A snapshot with second resolution is stable within the same second.
  const nowSecond = useSyncExternalStore(
    subscribe,
    () => Math.floor(Date.now() / 1000),
    () => 0,
  );

  if (startedAt === null || nowSecond === 0) return 0;
  return Math.max(0, nowSecond - Math.floor(startedAt / 1000));
}
