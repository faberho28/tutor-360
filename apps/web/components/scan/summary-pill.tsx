"use client";

import { cn } from "cn";
import { useMemo } from "react";
import { useShallow } from "zustand/react/shallow";
import { PANEL_CARD } from "@/components/scan/panel-card";
import { Card } from "@/components/ui/card";
import { OVERLAY } from "@/lib/overlay-theme";
import { sortDetections, summarize } from "@/lib/session/selectors";
import { useSession } from "@/lib/session/session-provider";

const MAX_DOTS = 4;

/** "8 componentes · 2 anomalías · 1 por revisar" with a dot per class found. */
export function SummaryPill() {
  const detections = useSession(useShallow((s) => s.detections));

  const text = useMemo(
    () => summarize(sortDetections(detections)),
    [detections],
  );
  const colors = useMemo(
    () => [...new Set(detections.map((d) => OVERLAY[d.cls].color))],
    [detections],
  );

  return (
    <Card
      size="sm"
      className={cn(PANEL_CARD, "flex-row items-center gap-3 px-5")}
    >
      {colors.length > 0 ? (
        <span aria-hidden="true" className="flex shrink-0 -space-x-1.5">
          {colors.slice(0, MAX_DOTS).map((color) => (
            <span
              key={color}
              className="size-4 rounded-full border-2 border-card"
              style={{ backgroundColor: color }}
            />
          ))}
        </span>
      ) : null}
      <p className="min-w-0 text-xs leading-snug font-medium">{text}</p>
    </Card>
  );
}
