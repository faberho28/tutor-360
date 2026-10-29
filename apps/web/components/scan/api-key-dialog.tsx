"use client";

import { useState, useSyncExternalStore, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  API_KEY_PATTERN,
  clearApiKey,
  maskApiKey,
  readApiKey,
  saveApiKey,
  subscribeApiKey,
} from "@/lib/settings/api-key";

function ApiKeyForm() {
  const saved = useSyncExternalStore(subscribeApiKey, readApiKey, () => null);
  const [draft, setDraft] = useState("");
  const [failed, setFailed] = useState(false);
  const valid = API_KEY_PATTERN.test(draft.trim());

  function save() {
    const stored = saveApiKey(draft);
    setFailed(!stored);
    if (stored) setDraft("");
  }

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (valid) save();
      }}
    >
      <label htmlFor="model-api-key" className="text-xs font-medium">
        Llave de la API de Meta
      </label>
      <Input
        id="model-api-key"
        type="password"
        autoComplete="off"
        spellCheck={false}
        value={draft}
        onChange={(event) => {
          setDraft(event.target.value);
          setFailed(false);
        }}
        placeholder={saved ? maskApiKey(saved) : "Pega tu llave"}
        aria-invalid={failed}
        aria-describedby="model-api-key-help"
      />
      <p
        id="model-api-key-help"
        className="text-xs text-muted-foreground"
        aria-live="polite"
      >
        {failed
          ? "No pudimos guardar la llave. Revísala e inténtalo de nuevo."
          : saved
            ? "Usando tu llave. Se borra al cerrar la pestaña."
            : "Sin llave propia se usa la del servidor, si está configurada. Tu llave solo vive en esta pestaña."}
      </p>
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={!valid}>
          Guardar
        </Button>
        {saved ? (
          <Button
            type="button"
            size="sm"
            variant="secondary"
            onClick={() => {
              clearApiKey();
              setDraft("");
            }}
          >
            Borrar
          </Button>
        ) : null}
      </div>
    </form>
  );
}

/** Dialog to set the user's own AI key; `children` is the element that opens it. */
export function ApiKeyDialog({ children }: { children: ReactNode }) {
  return (
    <Dialog>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Llave de la IA</DialogTitle>
          <DialogDescription>
            Usa tu propia llave de Meta en lugar de la del servidor.
          </DialogDescription>
        </DialogHeader>
        <ApiKeyForm />
      </DialogContent>
    </Dialog>
  );
}
