"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { CARD_CLASS, LabCardBody } from "@/components/lab/lab-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  CUSTOM_MAX,
  CUSTOM_MIN,
  cleanCustomText,
  scanHref,
  type LabCase,
} from "@/lib/lab/cases";

/** The free-form case: the user says what they will show and what to look for. */
export function CustomCaseCard({ labCase }: { labCase: LabCase }) {
  const router = useRouter();
  const [text, setText] = useState("");
  const valid = cleanCustomText(text) !== null;

  function start(event: FormEvent) {
    event.preventDefault();
    if (valid) router.push(scanHref("personalizado", text));
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className={CARD_CLASS}>
          <LabCardBody labCase={labCase} />
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={start} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Caso personalizado</DialogTitle>
            <DialogDescription>
              Cuéntale a la IA qué vas a mostrar y qué quieres encontrar.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="custom-case" className="text-xs font-medium">
              ¿Qué vas a revisar?
            </label>
            <Textarea
              id="custom-case"
              value={text}
              maxLength={CUSTOM_MAX}
              onChange={(event) => setText(event.target.value)}
              placeholder="Ej.: una consola de videojuegos abierta; busco partes quemadas o sueltas"
              aria-describedby="custom-case-hint"
            />
            <p
              id="custom-case-hint"
              className="flex justify-between text-xs text-muted-foreground"
            >
              <span>
                {valid
                  ? "Listo para empezar."
                  : `Escribe al menos ${CUSTOM_MIN} caracteres.`}
              </span>
              <span className="tabular-nums">
                {text.length}/{CUSTOM_MAX}
              </span>
            </p>
          </div>
          <DialogFooter>
            <Button
              type="submit"
              disabled={!valid}
              className="rounded-full px-5"
            >
              Empezar a escanear
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
