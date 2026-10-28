"use client";

import { ChevronDown, ChevronUp, ScanLine } from "lucide-react";
import { cn } from "cn";
import { useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useShallow } from "zustand/react/shallow";
import { ComponentDetail } from "@/components/scan/component-detail";
import { ComponentRow, rowId } from "@/components/scan/component-row";
import { PANEL_CARD } from "@/components/scan/panel-card";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useNow } from "@/hooks/use-now";
import { listCopy } from "@/lib/copy";
import { sortDetections } from "@/lib/session/selectors";
import { useSession } from "@/lib/session/session-provider";

/**
 * Detected components, anomalies first. Selecting a row highlights its mask
 * on the stage and the other way around (both read `selectedId`).
 */
export function ComponentsCard() {
  const detections = useSession(useShallow((s) => s.detections));
  const selectedId = useSession((s) => s.selectedId);
  const select = useSession((s) => s.select);
  const clearSelection = useSession((s) => s.clearSelection);
  const now = useNow();
  const [collapsed, setCollapsed] = useState(false);

  const sorted = useMemo(() => sortDetections(detections), [detections]);

  // Rows that were already there on first render do not animate in.
  const [initialIds] = useState(() => new Set(detections.map((d) => d.id)));

  useEffect(() => {
    if (selectedId) {
      document
        .getElementById(rowId(selectedId))
        ?.scrollIntoView({ block: "nearest" });
    }
  }, [selectedId]);

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const ids = sorted.map((d) => d.id);
    if (ids.length === 0) return;
    const index = selectedId ? ids.indexOf(selectedId) : -1;

    let next: string | undefined;
    switch (event.key) {
      case "ArrowDown":
        next = ids[Math.min(index + 1, ids.length - 1)];
        break;
      case "ArrowUp":
        next = ids[index <= 0 ? 0 : index - 1];
        break;
      case "Home":
        next = ids[0];
        break;
      case "End":
        next = ids[ids.length - 1];
        break;
      case "Enter":
        next = index === -1 ? ids[0] : undefined;
        break;
      case "Escape":
        clearSelection();
        return;
      default:
        return;
    }
    event.preventDefault();
    if (next) select(next);
  }

  return (
    <Card
      size="sm"
      className={cn(PANEL_CARD, "min-h-0 px-4", !collapsed && "flex-1")}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id="components-title" className="text-base font-semibold">
          {listCopy.title}
        </h2>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-expanded={!collapsed}
          aria-controls="components-list"
          aria-label={collapsed ? "Mostrar la lista" : "Ocultar la lista"}
          onClick={() => setCollapsed((value) => !value)}
        >
          {collapsed ? (
            <ChevronDown aria-hidden="true" className="size-4" />
          ) : (
            <ChevronUp aria-hidden="true" className="size-4" />
          )}
        </Button>
      </div>

      {collapsed ? null : sorted.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 py-6 text-center">
          <ScanLine
            aria-hidden="true"
            className="size-8 text-muted-foreground"
            strokeWidth={1.5}
          />
          <p className="max-w-[24ch] text-sm text-muted-foreground">
            {listCopy.empty}
          </p>
        </div>
      ) : (
        <div
          id="components-list"
          role="listbox"
          tabIndex={0}
          aria-labelledby="components-title"
          aria-activedescendant={selectedId ? rowId(selectedId) : undefined}
          onKeyDown={onKeyDown}
          className="-mx-1 flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto rounded-xl p-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          {sorted.map((detection) => (
            <div key={detection.id} role="presentation">
              <ComponentRow
                detection={detection}
                selected={detection.id === selectedId}
                now={now}
                animateIn={!initialIds.has(detection.id)}
                onSelect={select}
              />
              {detection.id === selectedId && detection.status !== "ok" ? (
                <ComponentDetail detection={detection} />
              ) : null}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
