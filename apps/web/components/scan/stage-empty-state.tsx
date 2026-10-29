"use client";

import { CameraOff, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StageState } from "@/lib/types";
import { useSession } from "@/lib/session/session-provider";

/** Shown in place of the video when the camera is not available yet. */
export function StageEmptyState({
  state,
}: {
  state: Exclude<StageState, "ready">;
}) {
  const retry = useSession((s) => s.retryCamera);

  if (state === "loading-model") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted p-6 text-center">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="relative flex flex-col items-center gap-3">
          <Loader
            aria-hidden="true"
            className="size-8 text-muted-foreground motion-safe:animate-spin"
          />
          <p role="status" className="text-xs font-medium">
            Preparando análisis…
          </p>
        </div>
      </div>
    );
  }

  const noPermission = state === "no-permission";
  const insecure = state === "insecure";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted p-6 text-center">
      <CameraOff
        aria-hidden="true"
        className="size-10 text-muted-foreground"
        strokeWidth={1.5}
      />
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-sm font-semibold">
          {insecure
            ? "La cámara requiere una conexión segura"
            : noPermission
              ? "Necesitamos tu cámara para ver la PC"
              : "No encontramos ninguna cámara"}
        </p>
        <p className="text-xs text-muted-foreground">
          {insecure
            ? "El navegador solo permite usar la cámara en páginas HTTPS (o localhost). Abre la app con una dirección segura."
            : noPermission
              ? "Permite el acceso a la cámara en tu navegador y vuelve a intentarlo."
              : "Conecta tu iPhone por USB-C (Mac: Continuity Camera · Windows: Camo o Iriun) o una webcam."}
        </p>
      </div>
      {insecure ? null : (
        <Button type="button" onClick={retry}>
          Reintentar
        </Button>
      )}
    </div>
  );
}
