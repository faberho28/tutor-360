"use client";

import { FlaskConical } from "lucide-react";
import Link from "next/link";
import { useSession } from "@/lib/session/session-provider";
import { TUTOR_LEVEL_INFO } from "@/lib/tutor/levels";

/** The case and level being used, with the way back to the Lab to change them. */
export function LabCaseChip() {
  const labCase = useSession((s) => s.labCase);
  const level = useSession((s) => s.level);
  if (!labCase) return null;
  const levelTitle = TUTOR_LEVEL_INFO[level].title;

  return (
    <Link
      href="/lab"
      title={`${levelTitle}. Change the case or the level in the Lab`}
      className="inline-flex max-w-56 shrink-0 items-center gap-1.5 rounded-full bg-foreground/5 px-2.5 py-1 text-xs font-medium outline-none hover:bg-foreground/10 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <FlaskConical
        aria-hidden="true"
        className="size-3.5 shrink-0 text-primary"
        strokeWidth={1.75}
      />
      <span className="sr-only">Case: </span>
      <span className="truncate">
        {labCase.title}
        <span className="text-muted-foreground"> · {levelTitle}</span>
      </span>
      <span className="sr-only">. Change</span>
    </Link>
  );
}
