"use client";

import {
  FileText,
  History,
  House,
  ScanLine,
  Settings,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
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
  href,
  active = false,
  soon = false,
}: {
  label: string;
  Icon: LucideIcon;
  href?: string;
  active?: boolean;
  soon?: boolean;
}) {
  const className = cn(
    RAIL_BUTTON,
    active && "bg-accent text-primary",
    soon &&
      "cursor-not-allowed text-muted-foreground opacity-50 hover:bg-transparent hover:text-muted-foreground",
  );
  const icon = (
    <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {href && !soon && !active ? (
          <Button
            asChild
            variant="ghost"
            aria-current={active ? "page" : undefined}
            aria-label={label}
            className={className}
          >
            <Link href={href}>{icon}</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            // aria-disabled (not disabled) keeps the item focusable so the
            // tooltip also shows with the keyboard.
            aria-disabled={soon || undefined}
            aria-current={active ? "page" : undefined}
            aria-label={soon ? `${label} (próximamente)` : label}
            onClick={soon ? (event) => event.preventDefault() : undefined}
            className={className}
          >
            {icon}
          </Button>
        )}
      </TooltipTrigger>
      <TooltipContent side="right">
        {soon ? `${label} · Próximamente` : label}
      </TooltipContent>
    </Tooltip>
  );
}

export type NavSection = "home" | "scan";

export function NavRail({
  active,
  className,
}: {
  active: NavSection;
  className?: string;
}) {
  return (
    <nav
      aria-label="Principal"
      className={cn(
        "flex flex-col items-center gap-1.5 border-r bg-card py-3",
        className,
      )}
    >
      <Item label="Inicio" Icon={House} href="/" active={active === "home"} />
      <Item label="Sesiones" Icon={History} soon />
      <Item
        label="Escanear"
        Icon={ScanLine}
        href="/scan"
        active={active === "scan"}
      />
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
