"use client";

import { useCallback, useLayoutEffect, useRef } from "react";

/**
 * Radix returns focus only to its own trigger. Dialogs here are opened from
 * elsewhere (toolbar, shortcuts, buttons), so this remembers what had focus
 * when the dialog opened and gives it back on close. Pass the returned
 * handler to `DialogContent`'s `onCloseAutoFocus`.
 */
export function useReturnFocus(open: boolean) {
  const previous = useRef<HTMLElement | null>(null);

  // Layout effect: it runs before Radix moves focus into the dialog.
  useLayoutEffect(() => {
    if (open) previous.current = document.activeElement as HTMLElement | null;
  }, [open]);

  return useCallback((event: Event) => {
    event.preventDefault();
    previous.current?.focus();
  }, []);
}
