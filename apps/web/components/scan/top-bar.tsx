import { Cpu, Settings } from "lucide-react";
import { cn } from "cn";
import { SessionName } from "@/components/scan/session-name";
import { SettingsDialog } from "@/components/scan/settings-dialog";
import { StatusPill } from "@/components/scan/status-pill";
import { Button } from "@/components/ui/button";

export function TopBar({ className }: { className?: string }) {
  return (
    <header
      className={cn("flex items-center gap-2 border-b bg-card px-3", className)}
    >
      <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
        <Cpu aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </div>
      <h1 className="sr-only text-xs font-semibold text-muted-foreground sm:not-sr-only">
        PC-Tutor 360
      </h1>
      <span aria-hidden="true" className="hidden h-6 w-px bg-border sm:block" />
      <div className="min-w-0 flex-1">
        <SessionName />
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <StatusPill />
        <div className="lg:hidden">
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
      </div>
    </header>
  );
}
