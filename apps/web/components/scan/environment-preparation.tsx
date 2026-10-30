"use client";

import { Loader } from "lucide-react";
import { useSession } from "@/lib/session/session-provider";

/**
 * The first reading of a scene is the slow one (Spark plans what to look for
 * before SAM paints anything), so while it runs with nothing on screen yet a
 * small notice says so. It never blocks: the camera stays visible and the
 * controls keep working. Later updates are silent on purpose.
 */
export function EnvironmentPreparation() {
  const preparing = useSession(
    (s) => s.analysis.busy && s.detections.length === 0,
  );
  if (!preparing) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none absolute inset-0 z-10 flex items-center justify-center px-6"
    >
      <div className="flex items-center gap-2.5 rounded-full bg-black/60 px-4 py-2.5 text-white shadow-lg backdrop-blur-sm">
        <Loader
          aria-hidden="true"
          className="size-4 shrink-0 motion-safe:animate-spin"
        />
        <div className="leading-tight">
          <p className="text-sm font-medium">Preparando ambiente…</p>
          <p className="text-xs text-white/75">
            La primera lectura tarda unos segundos.
          </p>
        </div>
      </div>
    </div>
  );
}
