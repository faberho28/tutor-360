"use client";

import { useEffect, useRef } from "react";

type Handlers = {
  capture: () => void;
  toggleAuto: () => void;
  report: () => void;
};

const INTERACTIVE =
  "input, textarea, select, button, a, [role='checkbox'], [role='combobox'], [role='menuitem'], [role='option'], [contenteditable='true']";

/** Space captures, A toggles auto-analysis, R opens the report. */
export function useScanShortcuts(handlers: Handlers) {
  const ref = useRef(handlers);
  useEffect(() => {
    ref.current = handlers;
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.defaultPrevented || event.repeat) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;

      // Do not steal keys from controls, fields or open dialogs.
      const target = event.target;
      if (target instanceof Element && target.closest(INTERACTIVE)) return;
      if (document.querySelector("[role='dialog']")) return;

      if (event.key === " ") {
        event.preventDefault();
        ref.current.capture();
      } else if (event.key.toLowerCase() === "a") {
        ref.current.toggleAuto();
      } else if (event.key.toLowerCase() === "r") {
        ref.current.report();
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
