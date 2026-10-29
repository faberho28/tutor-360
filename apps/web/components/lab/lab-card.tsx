import {
  Blocks,
  Keyboard,
  Laptop,
  PencilLine,
  Smartphone,
  type LucideIcon,
} from "lucide-react";
import { cn } from "cn";
import type { LabCase, LabCaseId } from "@/lib/lab/cases";

const ICONS: Record<LabCaseId, LucideIcon> = {
  computador: Laptop,
  celular: Smartphone,
  teclado: Keyboard,
  legos: Blocks,
  personalizado: PencilLine,
};

export const CARD_CLASS = cn(
  "group flex h-full w-full flex-col gap-3 rounded-2xl border bg-card p-5 text-left outline-none transition-colors",
  "hover:border-primary/50 hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring",
);

/** What every card shows; the wrapper (link or button) is chosen by the caller. */
export function LabCardBody({ labCase }: { labCase: LabCase }) {
  const Icon = ICONS[labCase.id];
  return (
    <>
      <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary group-hover:bg-background">
        <Icon aria-hidden="true" className="size-4" strokeWidth={1.75} />
      </span>
      <div className="flex flex-col gap-1">
        <h3 className="text-sm font-semibold">{labCase.title}</h3>
        <p className="text-xs text-muted-foreground">{labCase.description}</p>
      </div>
      <ul className="mt-auto flex flex-wrap gap-1.5">
        {labCase.examples.map((example) => (
          <li
            key={example}
            className="rounded-full border px-2 py-0.5 text-[11px] text-muted-foreground"
          >
            {example}
          </li>
        ))}
      </ul>
    </>
  );
}
