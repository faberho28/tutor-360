"use client";

import { Progress } from "@/components/ui/progress";
import { useOpenCv } from "@/hooks/use-opencv";
import { useSession } from "@/lib/session/session-provider";

/**
 * Shown over the camera when the automatic mode is turned on before the local
 * tracking finished downloading; the loop starts as soon as it does.
 */
export function TrackingPreparation() {
  const preparing = useSession((s) => s.analysis.phase === "preparing");
  const opencv = useOpenCv();
  if (!preparing) return null;

  const failed = opencv.status === "error";
  const percent =
    opencv.status === "loading"
      ? Math.round(opencv.progress * 100)
      : opencv.status === "ready"
        ? 100
        : 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="absolute inset-0 z-10 flex items-center justify-center bg-black/55 px-6 text-white"
    >
      <div className="w-full max-w-xs space-y-3 text-center">
        <p className="text-sm font-medium">
          {failed
            ? "Seguimos sin seguimiento local"
            : "Preparando el seguimiento"}
        </p>
        {failed ? (
          <p className="text-xs text-white/80">
            No se pudo preparar. El análisis seguirá, pero volverá a consultar a
            la IA cada vez que muevas la cámara.
          </p>
        ) : (
          <>
            <Progress
              value={percent}
              aria-label="Progreso de la descarga"
              className="bg-white/25"
            />
            <p className="text-xs text-white/80">
              Se descarga una sola vez (unos 13 MB). {percent} %
            </p>
          </>
        )}
      </div>
    </div>
  );
}
