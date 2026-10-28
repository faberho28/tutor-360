"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useTheme } from "next-themes";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";

const OPTIONS = [
  { value: "system", label: "Sistema", Icon: Monitor },
  { value: "light", label: "Claro", Icon: Sun },
  { value: "dark", label: "Oscuro", Icon: Moon },
] as const;

const subscribe = () => () => {};

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  // The stored theme is unknown on the server; avoid a hydration mismatch.
  const mounted = useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );

  return (
    <div role="group" aria-label="Tema" className="inline-flex gap-1">
      {OPTIONS.map(({ value, label, Icon }) => (
        <Button
          key={value}
          type="button"
          size="sm"
          className="text-xs [&_svg:not([class*='size-'])]:size-3.5"
          variant={mounted && theme === value ? "default" : "secondary"}
          aria-pressed={mounted && theme === value}
          onClick={() => setTheme(value)}
        >
          <Icon aria-hidden="true" data-icon="inline-start" />
          {label}
        </Button>
      ))}
    </div>
  );
}
