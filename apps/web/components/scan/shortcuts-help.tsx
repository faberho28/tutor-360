"use client";

import { Keyboard } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EDITABLE =
  "input, textarea, select, button, a, [role='checkbox'], [role='combobox'], [role='menuitem'], [role='option'], [contenteditable='true']";

const SHORTCUTS = [
  ["Space", "Capture"],
  ["A", "Turn automatic analysis on or pause it"],
  ["↑ / ↓", "Move through components"],
  ["Enter", "Select component"],
  ["R", "Generate report"],
  ["M", "Turn the magnifier on or off"],
] as const;

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "?" || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof Element && target.closest(EDITABLE)) return;
      setOpen(true);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Keyboard shortcuts</DialogTitle>
          <DialogDescription>
            Use these shortcuts when focus is not on a control or text field.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3">
          {SHORTCUTS.map(([key, action]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <dt className="text-xs text-muted-foreground">{action}</dt>
              <dd>
                <kbd className="inline-flex min-w-8 items-center justify-center rounded border bg-muted px-2 py-1 text-xs font-medium">
                  {key}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full px-4 text-xs"
            onClick={() => setOpen(false)}
          >
            <Keyboard aria-hidden="true" data-icon="inline-start" />
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
