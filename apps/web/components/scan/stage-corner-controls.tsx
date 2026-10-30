"use client";

import { Maximize, Minimize } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "cn";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { savePreferredDevice } from "@/lib/camera/devices";
import { useSession } from "@/lib/session/session-provider";

/** Green under 1.5 s, amber under 3 s, red from there (PRD target: < 1.5 s). */
function latencyTone(ms: number): { dot: string; word: string } {
  if (ms < 1500) return { dot: "bg-ok", word: "rápida" };
  if (ms < 3000) return { dot: "bg-warning", word: "lenta" };
  return { dot: "bg-anomaly", word: "muy lenta" };
}

const GLASS = "bg-black/50 text-white backdrop-blur";

export function StageCornerControls({
  fullscreenTarget,
  children,
}: {
  fullscreenTarget: HTMLElement | null;
  children?: ReactNode;
}) {
  const latencyMs = useSession((s) => s.analysis.latencyMs);
  const ready = useSession((s) => s.stage === "ready");
  const devices = useSession((s) => s.cameraDevices);
  const activeId = useSession((s) => s.cameraActiveId);
  const setCameraDeviceId = useSession((s) => s.setCameraDeviceId);
  const value = activeId ?? "";
  const fullscreen = useFullscreen();

  function toggleFullscreen() {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void fullscreenTarget?.requestFullscreen();
  }

  // The latency only means something while the camera is running.
  const tone = latencyMs === null || !ready ? null : latencyTone(latencyMs);

  return (
    <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex items-start justify-between gap-2">
      <div className="pointer-events-auto flex items-center gap-2">
        {tone && latencyMs !== null ? (
          <p
            className={cn(
              "flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium tabular-nums",
              GLASS,
            )}
            aria-label={`Latencia de la IA ${tone.word}`}
          >
            <span
              aria-hidden="true"
              className={cn("size-2 rounded-full", tone.dot)}
            />
            IA
          </p>
        ) : null}
        {children}
      </div>

      <div className="pointer-events-auto flex items-center gap-2">
        <Select
          value={value}
          onValueChange={(id) => {
            setCameraDeviceId(id);
            savePreferredDevice(id);
          }}
          disabled={devices.length === 0}
        >
          <SelectTrigger
            aria-label="Cámara"
            className={cn(
              "h-9 w-auto max-w-[200px] gap-2 rounded-full border-0 px-3 text-xs shadow-none ring-0 [&_svg]:text-white",
              GLASS,
            )}
          >
            <SelectValue placeholder="Sin cámaras" />
          </SelectTrigger>
          <SelectContent align="end">
            {devices.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {fullscreen.supported ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={
              fullscreen.active
                ? "Salir de pantalla completa"
                : "Pantalla completa"
            }
            onClick={toggleFullscreen}
            className={cn(
              "size-9 rounded-full hover:bg-black/60 hover:text-white",
              GLASS,
            )}
          >
            {fullscreen.active ? (
              <Minimize aria-hidden="true" className="size-4" />
            ) : (
              <Maximize aria-hidden="true" className="size-4" />
            )}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
