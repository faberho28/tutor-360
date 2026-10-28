"use client";

import { Trash2 } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session/session-provider";
import type { Capture } from "@/lib/types";

const timeFormat = new Intl.DateTimeFormat("es-CO", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
});

function findings(capture: Capture): number {
  return capture.detections.filter((d) => d.status !== "ok").length;
}

/**
 * The session's captures (image plus masks) with the time and the number of
 * findings. Deleting asks for confirmation inside the card.
 */
export function CapturesStrip() {
  const captures = useSession((s) => s.captures);
  const removeCapture = useSession((s) => s.removeCapture);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const deleteButtons = useRef(new Map<string, HTMLButtonElement>());

  if (captures.length === 0) {
    return (
      <p className="rounded-xl border border-dashed p-6 text-center text-muted-foreground">
        Aún no hay capturas. Usa el botón de captura para guardar una.
      </p>
    );
  }

  return (
    <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {captures.map((capture, index) => {
        const count = findings(capture);
        const confirming = confirmingId === capture.id;
        return (
          <li
            key={capture.id}
            className="flex flex-col overflow-hidden rounded-xl border bg-card"
          >
            <div className="relative aspect-video bg-muted">
              <Image
                src={capture.imageDataUrl}
                alt={`Captura ${index + 1} con las máscaras de los componentes`}
                fill
                unoptimized
                sizes="200px"
                className="object-cover"
              />
            </div>
            <div className="flex items-center justify-between gap-2 p-2">
              {confirming ? (
                <>
                  <span className="text-xs font-medium">¿Borrar?</span>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      size="xs"
                      variant="outline"
                      autoFocus
                      onClick={() => {
                        setConfirmingId(null);
                        requestAnimationFrame(() =>
                          deleteButtons.current.get(capture.id)?.focus(),
                        );
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      size="xs"
                      variant="destructive"
                      onClick={() => {
                        setConfirmingId(null);
                        removeCapture(capture.id);
                      }}
                    >
                      Borrar
                    </Button>
                  </div>
                </>
              ) : (
                <>
                  <div className="min-w-0 text-xs">
                    <p className="font-medium">
                      {timeFormat.format(capture.at)}
                    </p>
                    <p className="text-muted-foreground">
                      {count === 1 ? "1 hallazgo" : `${count} hallazgos`}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Borrar captura ${index + 1}`}
                    ref={(node) => {
                      if (node) deleteButtons.current.set(capture.id, node);
                      else deleteButtons.current.delete(capture.id);
                    }}
                    onClick={() => setConfirmingId(capture.id)}
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </>
              )}
            </div>
          </li>
        );
      })}
    </ul>
  );
}
