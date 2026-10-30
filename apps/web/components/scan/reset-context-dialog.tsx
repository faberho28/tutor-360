"use client";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSession } from "@/lib/session/session-provider";

/**
 * Asks before throwing the scan away when there is something to lose: captures
 * that were not turned into a report yet.
 */
export function ResetContextDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const captures = useSession((s) => s.captures.length);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>¿Reiniciar el contexto?</DialogTitle>
          <DialogDescription>
            Se borran las piezas detectadas, los diagnósticos, los pasos
            {captures > 0
              ? ` y las ${captures} captura${captures > 1 ? "s" : ""} (no se podrán usar en el reporte)`
              : ""}
            . La cámara y el caso se mantienen.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full px-4 text-xs"
            onClick={() => onOpenChange(false)}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            variant="inverse"
            size="sm"
            className="rounded-full px-4 text-xs"
            onClick={() => {
              onConfirm();
              onOpenChange(false);
            }}
          >
            Reiniciar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
