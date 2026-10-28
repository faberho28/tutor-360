"use client";

import dynamic from "next/dynamic";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useReturnFocus } from "@/hooks/use-return-focus";
import {
  closeMockModel,
  requestMockModel,
} from "@/lib/fixtures/mock-reconstruction";
import { LABELS_ES } from "@/lib/overlay-theme";
import { useSession, useSessionStore } from "@/lib/session/session-provider";

// Keeps three.js out of the initial bundle.
const ModelViewer = dynamic(() => import("@/components/scan/model-viewer"), {
  ssr: false,
  loading: () => <Skeleton className="size-full" />,
});

/**
 * The 3D dialog: generating, ready or error. It is open whenever a
 * reconstruction exists in the store; closing it cancels any in progress.
 */
export function ModelViewerDialog() {
  const store = useSessionStore();
  const model = useSession((s) => s.model3d);
  const detections = useSession((s) => s.detections);
  const open = model.status !== "idle";
  const returnFocus = useReturnFocus(open);
  const cls =
    model.status === "idle"
      ? null
      : (detections.find((d) => d.id === model.detectionId)?.cls ?? null);
  const name = cls ? LABELS_ES[cls] : "Componente";

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) closeMockModel(store);
      }}
    >
      <DialogContent
        showCloseButton={false}
        onCloseAutoFocus={returnFocus}
        className="sm:max-w-md"
      >
        <DialogHeader>
          <DialogTitle>Modelo 3D · {name}</DialogTitle>
          <DialogDescription>
            {model.status === "ready"
              ? "Arrastra para rotar y usa la rueda o dos dedos para acercar."
              : model.status === "error"
                ? "No pudimos generar el modelo."
                : "Esto puede tardar unos segundos."}
          </DialogDescription>
        </DialogHeader>

        <div className="aspect-square w-full overflow-hidden rounded-xl bg-muted">
          {model.status === "ready" ? (
            <ModelViewer glbUrl={model.glbUrl} alt={`Modelo 3D de ${name}`} />
          ) : model.status === "error" ? (
            <div
              role="alert"
              className="flex size-full flex-col items-center justify-center gap-1 p-6 text-center"
            >
              <p className="font-medium">No pudimos generar el modelo 3D</p>
              <p className="text-muted-foreground">
                Revisa tu conexión e inténtalo de nuevo.
              </p>
            </div>
          ) : model.status === "generating" ? (
            <div className="relative size-full">
              <Skeleton className="size-full rounded-none" />
              <p
                role="status"
                className="absolute inset-0 flex items-center justify-center text-xs font-medium"
              >
                Generando modelo 3D…
              </p>
            </div>
          ) : null}
        </div>

        <DialogFooter>
          {model.status === "generating" ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-full px-4 text-xs"
              onClick={() => closeMockModel(store)}
            >
              Cancelar
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-full px-4 text-xs"
                onClick={() => closeMockModel(store)}
              >
                Cerrar
              </Button>
              {model.status === "error" ? (
                <Button
                  type="button"
                  variant="inverse"
                  size="sm"
                  className="rounded-full px-4 text-xs"
                  onClick={() => {
                    // requestMockModel ignores calls while generating, so the
                    // retry goes through from the error state.
                    requestMockModel(store, model.detectionId);
                  }}
                >
                  Reintentar
                </Button>
              ) : null}
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
