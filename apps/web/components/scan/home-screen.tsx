import { Camera, ScanSearch, Stethoscope, ArrowRight } from "lucide-react";
import Link from "next/link";
import { TopBar } from "@/components/scan/top-bar";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    Icon: Camera,
    title: "Apunta la cámara",
    text: "Muestra el interior del equipo con buena luz.",
  },
  {
    Icon: ScanSearch,
    title: "Identifica los componentes",
    text: "La IA reconoce y marca cada pieza y señala anomalías.",
  },
  {
    Icon: Stethoscope,
    title: "Recibe el diagnóstico",
    text: "Revisa qué falla y sigue los pasos para resolverlo.",
  },
] as const;

/** Welcome screen: what the product does and the way into the scanner. */
export function HomeScreen() {
  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[52px_minmax(0,1fr)] bg-background">
      <TopBar />
      <main className="flex min-h-0 flex-col items-center overflow-y-auto p-6">
        <div className="my-auto flex w-full max-w-3xl flex-col items-center gap-10 py-8 text-center">
          <div className="flex flex-col items-center gap-4">
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Diagnostica el interior de un PC con la cámara
            </h2>
            <p className="max-w-xl text-pretty text-sm text-muted-foreground">
              PC-Tutor 360 identifica cada componente en vivo, marca lo que está
              mal y te guía paso a paso para repararlo.
            </p>
            <Button asChild size="lg" className="mt-2 rounded-full px-6">
              <Link href="/laboratorio">
                Escanear un equipo
                <ArrowRight aria-hidden="true" className="size-4" />
              </Link>
            </Button>
          </div>

          <ol className="grid w-full gap-3 sm:grid-cols-3">
            {STEPS.map(({ Icon, title, text }, index) => (
              <li
                key={title}
                className="flex flex-col items-center gap-2 rounded-2xl border bg-card p-5 text-center"
              >
                <span className="flex size-9 items-center justify-center rounded-lg bg-accent text-primary">
                  <Icon
                    aria-hidden="true"
                    className="size-4"
                    strokeWidth={1.75}
                  />
                </span>
                <h3 className="text-sm font-semibold">
                  <span className="sr-only">{index + 1}. </span>
                  {title}
                </h3>
                <p className="text-xs text-muted-foreground">{text}</p>
              </li>
            ))}
          </ol>
        </div>
      </main>
    </div>
  );
}
