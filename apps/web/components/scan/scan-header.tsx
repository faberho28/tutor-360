"use client";

import { LabCaseChip } from "@/components/scan/lab-case-chip";
import { SessionName } from "@/components/scan/session-name";
import { useSession } from "@/lib/session/session-provider";

/**
 * What the top bar shows on the scanner: the session name, what is being
 * scanned (a link back to the Laboratorio) and its description.
 */
export function ScanHeader() {
  const labCase = useSession((s) => s.labCase);

  return (
    <div className="flex min-w-0 items-center gap-2">
      <div className="min-w-0 shrink">
        <SessionName />
      </div>
      {labCase ? (
        <>
          <LabCaseChip />
          {/* Hidden on small screens: there is no room in the bar. */}
          <p className="hidden min-w-0 flex-1 truncate text-xs text-muted-foreground md:block">
            {labCase.description}
          </p>
        </>
      ) : null}
    </div>
  );
}
