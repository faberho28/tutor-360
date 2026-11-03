import { Camera, ScanSearch, Stethoscope, ArrowRight } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { TopBar } from "@/components/scan/top-bar";
import { Button } from "@/components/ui/button";

const STEPS = [
  {
    Icon: Camera,
    title: "Point the camera",
    text: "Show the inside of the device in good light.",
  },
  {
    Icon: ScanSearch,
    title: "Identify the components",
    text: "The AI recognizes and marks each part and flags anomalies.",
  },
  {
    Icon: Stethoscope,
    title: "Get the diagnosis",
    text: "See what is failing and follow the steps to fix it.",
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
            <Image
              src="/logo.svg"
              alt="Tutor AI 360"
              width={96}
              height={96}
              unoptimized
              priority
              className="size-24"
            />
            <h2 className="text-balance text-3xl font-semibold tracking-tight sm:text-4xl">
              Diagnose the inside of a PC with the camera
            </h2>
            <p className="max-w-xl text-pretty text-sm text-muted-foreground">
              Tutor AI 360 identifies every component live, marks what is wrong
              and guides you step by step to repair it.
            </p>
            <Button asChild size="lg" className="mt-2 rounded-full px-6">
              <Link href="/lab">
                Scan a device
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
