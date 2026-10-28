"use client";

import { Pencil } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useSession } from "@/lib/session/session-provider";

const MAX_LENGTH = 40;

/** Session name with in-place editing: Enter saves, Esc cancels. */
export function SessionName() {
  const name = useSession((s) => s.name);
  const setName = useSession((s) => s.setName);
  // null means "not editing".
  const [draft, setDraft] = useState<string | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocus = useRef(false);

  useEffect(() => {
    if (draft === null && restoreFocus.current) {
      restoreFocus.current = false;
      buttonRef.current?.focus();
    }
  }, [draft]);

  function finish(save: boolean, restore: boolean) {
    const next = (draft ?? "").trim().slice(0, MAX_LENGTH);
    if (save && next) setName(next);
    restoreFocus.current = restore;
    setDraft(null);
  }

  if (draft !== null) {
    return (
      <input
        autoFocus
        value={draft}
        maxLength={MAX_LENGTH}
        aria-label="Nombre de la sesión"
        onChange={(event) => setDraft(event.target.value)}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={() => finish(true, false)}
        onKeyDown={(event) => {
          if (event.key === "Enter") finish(true, true);
          if (event.key === "Escape") finish(false, true);
        }}
        className="h-8 w-full min-w-0 max-w-[28ch] rounded-lg border border-input bg-background px-2 text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    );
  }

  return (
    <button
      ref={buttonRef}
      type="button"
      onClick={() => setDraft(name)}
      className="group flex max-w-full min-w-0 items-center gap-2 rounded-lg px-2 py-1 text-sm font-semibold outline-none hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring"
    >
      <span className="min-w-0 truncate">{name}</span>
      <Pencil
        aria-hidden="true"
        className="size-4 shrink-0 text-muted-foreground opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
      />
      <span className="sr-only">(editar)</span>
    </button>
  );
}
