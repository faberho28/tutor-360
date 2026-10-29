import { Cpu, KeyRound, Settings } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "cn";
import { ApiKeyDialog } from "@/components/scan/api-key-dialog";
import { SettingsDialog } from "@/components/scan/settings-dialog";
import { Button } from "@/components/ui/button";

/**
 * Brand bar shared by every screen. It does not read the session store, so it
 * also works outside a SessionProvider (the home screen).
 */
export function TopBar({
  className,
  children,
  trailing,
}: {
  className?: string;
  /** Fills the space between the brand and the right-hand controls. */
  children?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    // No fill and no line: the bar sits on the page and only its buttons show.
    <header className={cn("flex items-center gap-2 px-3", className)}>
      <Link
        href="/"
        aria-label="PC-Tutor 360, ir al inicio"
        className="flex shrink-0 items-center gap-2 rounded-lg py-1 pr-2 pl-1 outline-none hover:bg-foreground/5 focus-visible:ring-2 focus-visible:ring-ring"
      >
        <span className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Cpu aria-hidden="true" className="size-4" strokeWidth={1.75} />
        </span>
        <span
          aria-hidden="true"
          className="hidden text-xs font-semibold text-muted-foreground sm:block"
        >
          PC-Tutor 360
        </span>
      </Link>
      <div className="min-w-0 flex-1">{children}</div>
      <div className="flex shrink-0 items-center gap-2">
        {trailing}
        <ApiKeyDialog>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Llave de la IA"
          >
            <KeyRound
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
          </Button>
        </ApiKeyDialog>
        <SettingsDialog>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Ajustes"
          >
            <Settings
              aria-hidden="true"
              className="size-4"
              strokeWidth={1.75}
            />
          </Button>
        </SettingsDialog>
      </div>
    </header>
  );
}
