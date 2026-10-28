"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import type { ChangeReading } from "@/lib/vision/change-detector";

/**
 * Result of the local change detector. It does not trigger any analysis yet:
 * the image is either stable or being recalibrated against a new reference.
 */
export function ChangeIndicator({
  reading,
  onReset,
}: {
  reading: ChangeReading;
  onReset: () => void;
}) {
  const stable = reading.status === "stable";

  return (
    <div className="pointer-events-auto flex items-center gap-1 rounded-full bg-black/50 py-1 pl-3 pr-1 text-xs font-medium text-white backdrop-blur">
      <span
        aria-hidden="true"
        className={cn("size-2 rounded-full", stable ? "bg-ok" : "bg-warning")}
      />
      <span role="status" aria-live="polite" className="px-1">
        {stable ? "Imagen estable" : "Recalibrando imagen"}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Fijar nueva referencia"
        title="Fijar nueva referencia"
        onClick={onReset}
        className="size-6 rounded-full text-white hover:bg-black/60 hover:text-white"
      >
        <RefreshCw aria-hidden="true" className="size-3" />
      </Button>
    </div>
  );
}
