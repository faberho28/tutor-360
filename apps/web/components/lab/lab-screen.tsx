import Link from "next/link";
import { CustomCaseCard } from "@/components/lab/custom-case-card";
import { CARD_CLASS, LabCardBody } from "@/components/lab/lab-card";
import { TopBar } from "@/components/scan/top-bar";
import { LAB_CASES, scanHref } from "@/lib/lab/cases";

/** Where the user chooses what they are about to scan. */
export function LabScreen() {
  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[52px_minmax(0,1fr)] bg-background">
      <TopBar />
      <main className="flex min-h-0 flex-col items-center overflow-y-auto p-6">
        <div className="my-auto flex w-full max-w-4xl flex-col gap-8 py-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-balance text-3xl font-semibold tracking-tight">
              Laboratorio
            </h2>
            <p className="max-w-xl text-pretty text-sm text-muted-foreground">
              Elige qué vas a revisar. La IA usa este contexto para saber qué
              buscar y cómo interpretar lo que ve la cámara.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {LAB_CASES.map((labCase) => (
              <li key={labCase.id}>
                {labCase.id === "personalizado" ? (
                  <CustomCaseCard labCase={labCase} />
                ) : (
                  <Link href={scanHref(labCase.id)} className={CARD_CLASS}>
                    <LabCardBody labCase={labCase} />
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>
      </main>
    </div>
  );
}
