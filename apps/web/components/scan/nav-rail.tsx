"use client";

import {
  FileText,
  History,
  House,
  ScanLine,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import { SettingsDialog } from "@/components/scan/settings-dialog";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const RAIL_BUTTON = "size-9 rounded-lg";

function Item({
  label,
  Icon,
  active = false,
  soon = false,
}: {
  label: string;
  Icon: LucideIcon;
  active?: boolean;
  soon?: boolean;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          // aria-disabled (not disabled) keeps the item focusable so the
          // tooltip also shows with the keyboard.
          aria-disabled={soon || undefined}
          aria-current={active ? "page" : undefined}
          aria-label={soon ? `${label} (próximamente)` : label}
          onClick={soon ? (event) => event.preventDefault() : undefined}
          className={cn(
            RAIL_BUTTON,
            active && "bg-accent text-primary",
            soon &&
              "cursor-not-allowed text-muted-foreground opacity-50 hover:bg-transparent hover:text-muted-foreground",
          )}
        >
          <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
        </Button>
      </TooltipTrigger>
      <TooltipContent side="right">
        {soon ? `${label} · Próximamente` : label}
      </TooltipContent>
    </Tooltip>
  );
}

export function NavRail({ className }: { className?: string }) {
  return (
    <nav
      aria-label="Principal"
      className={cn(
        "flex flex-col items-center gap-1.5 border-r bg-card py-3",
        className,
      )}
    >
      <Item label="Inicio" Icon={House} soon />
      <Item label="Sesiones" Icon={History} soon />
      <Item label="Escanear" Icon={ScanLine} active />
      <Item label="Reportes" Icon={FileText} soon />
      <div className="mt-auto">
        <Tooltip>
          <SettingsDialog>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                aria-label="Ajustes"
                className={RAIL_BUTTON}
              >
                <Settings
                  aria-hidden="true"
                  className="size-4"
                  strokeWidth={1.75}
                />
              </Button>
            </TooltipTrigger>
          </SettingsDialog>
          <TooltipContent side="right">Ajustes</TooltipContent>
        </Tooltip>
      </div>
    </nav>
  );
}
