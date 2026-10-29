"use client";

import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/session/session-provider";

/** The case being scanned, with the way back to the Laboratorio to change it. */
export function LabCaseChip() {
  const labCase = useSession((s) => s.labCase);
  if (!labCase) return null;

  return (
    <Link
      href="/laboratorio"
      title="Cambiar el caso en el Laboratorio"
      className="inline-flex max-w-40 shrink-0 items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <FlaskConical
        aria-hidden="true"
        className="size-3.5 shrink-0 text-primary"
        strokeWidth={1.75}
      />
      <span className="sr-only">Caso: </span>
      <span className="truncate">{labCase.title}</span>
      <span className="sr-only">. Cambiar</span>
    </Link>
  );
}
