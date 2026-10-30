"use client";

import { useEffect } from "react";

/**
 * Captures live only in memory: while there are some, closing or reloading the
 * tab asks for confirmation (the browser shows its own text).
 */
export function useUnsavedCapturesWarning(hasCaptures: boolean) {
  useEffect(() => {
    if (!hasCaptures) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Older browsers need a return value to show the prompt.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasCaptures]);
}
