"use client";

import { Keyboard } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const EDITABLE =
  "input, textarea, select, button, a, [role='checkbox'], [role='combobox'], [role='menuitem'], [role='option'], [contenteditable='true']";

const SHORTCUTS = [
  ["Espacio", "Capturar"],
  ["A", "Activar o pausar análisis automático"],
  ["↑ / ↓", "Recorrer componentes"],
  ["Enter", "Seleccionar componente"],
  ["R", "Generar reporte"],
] as const;

export function ShortcutsHelp() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "?" || event.defaultPrevented) return;
      const target = event.target;
      if (target instanceof Element && target.closest(EDITABLE)) return;
      setOpen(true);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent showCloseButton={false}>
        <DialogHeader>
          <DialogTitle>Atajos de teclado</DialogTitle>
          <DialogDescription>
            Usa estos atajos cuando el foco no esté en un control o campo de
            texto.
          </DialogDescription>
        </DialogHeader>
        <dl className="grid gap-3">
          {SHORTCUTS.map(([key, action]) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <dt className="text-xs text-muted-foreground">{action}</dt>
              <dd>
                <kbd className="inline-flex min-w-8 items-center justify-center rounded border bg-muted px-2 py-1 text-xs font-medium">
                  {key}
                </kbd>
              </dd>
            </div>
          ))}
        </dl>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-full px-4 text-xs"
            onClick={() => setOpen(false)}
          >
            <Keyboard aria-hidden="true" data-icon="inline-start" />
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
