"use client";

import { MoreHorizontal } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { StepStatus } from "@/lib/steps";

function Soon() {
  return (
    <span className="ml-auto pl-4 text-xs text-muted-foreground">
      Próximamente
    </span>
  );
}

/** One step: checkbox, text and a menu with its extra actions. */
export function StepItem({
  idPrefix,
  index,
  text,
  status,
  current,
  onToggle,
  onSkip,
}: {
  idPrefix: string;
  index: number;
  text: string;
  status: StepStatus;
  current: boolean;
  onToggle: () => void;
  onSkip: () => void;
}) {
  const id = `${idPrefix}-step-${index}`;

  return (
    <li className="flex items-start gap-3 py-1.5">
      <Checkbox
        id={id}
        className="mt-0.5"
        checked={status === "done"}
        onCheckedChange={onToggle}
      />
      <label
        htmlFor={id}
        className={cn(
          "flex-1 cursor-pointer text-sm leading-snug",
          current && "font-semibold",
          status === "done" && "text-muted-foreground line-through",
          status === "skipped" && "text-muted-foreground italic",
        )}
      >
        {text}
        {status === "skipped" ? (
          <span className="sr-only"> (saltado)</span>
        ) : null}
      </label>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={`Más acciones del paso ${index + 1}`}
          >
            <MoreHorizontal aria-hidden="true" className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-auto min-w-48">
          <DropdownMenuItem disabled={status !== "pending"} onSelect={onSkip}>
            Saltar paso
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            Explicar
            <Soon />
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            Ver imagen
            <Soon />
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </li>
  );
}
