import { Aperture, FileDown, SwitchCamera } from "lucide-react";
import { notFound } from "next/navigation";
import { ThemeToggle } from "@/components/theme-toggle";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { COMPONENT_STATUSES } from "@/lib/component-status";
import { OVERLAY } from "@/lib/overlay-theme";

// Static class names so Tailwind can generate each utility.
const SWATCHES = [
  { token: "background", className: "bg-background" },
  { token: "card", className: "bg-card" },
  { token: "muted", className: "bg-muted" },
  { token: "accent", className: "bg-accent" },
  { token: "primary", className: "bg-primary" },
  { token: "secondary", className: "bg-secondary" },
  { token: "inverse", className: "bg-inverse" },
  { token: "destructive", className: "bg-destructive" },
  { token: "anomaly", className: "bg-anomaly" },
  { token: "warning", className: "bg-warning" },
  { token: "ok", className: "bg-ok" },
  { token: "info", className: "bg-info" },
] as const;

const RADII = [
  { name: "rounded-md", className: "rounded-md", px: "12 px" },
  { name: "rounded-xl", className: "rounded-xl", px: "12 px (list items)" },
  { name: "rounded-2xl", className: "rounded-2xl", px: "20 px (cards)" },
  { name: "rounded-3xl", className: "rounded-3xl", px: "24 px (camera stage)" },
] as const;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="gap-4 rounded-2xl p-5">
      <h2 className="text-base font-semibold">{title}</h2>
      {children}
    </Card>
  );
}

export default function DesignPage() {
  // Style guide for development only; it must not be reachable in production.
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-4 p-4 md:p-8">
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold">Sistema de diseño</h1>
          <p className="text-xs text-muted-foreground">
            Guía visual de desarrollo. No se publica en producción.
          </p>
        </div>
        <ThemeToggle />
      </header>

      <Section title="Paleta">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {SWATCHES.map(({ token, className }) => (
            <div key={token} className="flex flex-col gap-1">
              <div className={`h-12 rounded-xl border ${className}`} />
              <span className="text-xs text-muted-foreground">--{token}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Estados">
        <div className="flex flex-wrap gap-2">
          <Badge variant="anomaly">Anomalía</Badge>
          <Badge variant="warning">Revisar</Badge>
          <Badge variant="ok">OK</Badge>
          <Badge variant="inverse">Analizando 00:12:34</Badge>
        </div>
      </Section>

      <Section title="Botones">
        <div className="flex flex-wrap items-center gap-2">
          <Button>Principal</Button>
          <Button variant="secondary">Secundario</Button>
          <Button variant="outline">Contorno</Button>
          <Button variant="ghost">Fantasma</Button>
          <Button variant="destructive">Borrar captura</Button>
          <Button variant="inverse">
            <FileDown aria-hidden="true" data-icon="inline-start" />
            Generar reporte
          </Button>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="control"
            variant="secondary"
            aria-label="Cambiar cámara"
          >
            <SwitchCamera aria-hidden="true" />
          </Button>
          <Button size="control" variant="secondary" aria-label="Capturar">
            <Aperture aria-hidden="true" />
          </Button>
        </div>
      </Section>

      <Section title="Overlay por estado">
        <ul className="grid gap-2 sm:grid-cols-2">
          {COMPONENT_STATUSES.map((status) => {
            const entry = OVERLAY[status];
            return (
              <li
                key={status}
                className="flex items-center gap-3 rounded-xl bg-muted p-3"
              >
                <span
                  aria-hidden="true"
                  className="size-10 shrink-0 rounded-lg"
                  style={{
                    backgroundColor: `${entry.color}${Math.round(
                      entry.fill * 255,
                    )
                      .toString(16)
                      .padStart(2, "0")}`,
                    border: `${entry.stroke}px ${
                      "dashed" in entry && entry.dashed ? "dashed" : "solid"
                    } ${entry.color}`,
                  }}
                />
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="text-sm font-medium">
                    {status === "anomaly"
                      ? "Anomalía"
                      : status === "warning"
                        ? "Revisar"
                        : "OK"}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {status} · {entry.color}
                  </span>
                </div>
                <Badge variant={status}>
                  {status === "anomaly"
                    ? "Anomalía"
                    : status === "warning"
                      ? "Revisar"
                      : "OK"}
                </Badge>
              </li>
            );
          })}
        </ul>
      </Section>

      <Section title="Radios">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {RADII.map(({ name, className, px }) => (
            <div key={name} className="flex flex-col gap-1">
              <div className={`h-16 border bg-muted ${className}`} />
              <span className="text-xs text-muted-foreground">
                {name} · {px}
              </span>
            </div>
          ))}
        </div>
      </Section>
    </main>
  );
}
