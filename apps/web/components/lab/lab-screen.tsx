import { LabCases } from "@/components/lab/lab-cases";
import { TopBar } from "@/components/scan/top-bar";

/** Where the user chooses what they are about to scan. */
export function LabScreen() {
  return (
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[52px_minmax(0,1fr)] bg-background">
      <TopBar />
      <main className="flex min-h-0 flex-col items-center overflow-y-auto p-6">
        <div className="my-auto flex w-full max-w-4xl flex-col gap-8 py-8">
          <div className="flex flex-col gap-2">
            <h2 className="text-balance text-3xl font-semibold tracking-tight">
              Lab
            </h2>
            <p className="max-w-xl text-pretty text-sm text-muted-foreground">
              Choose your level and what you are going to inspect. The AI uses
              this context to know what to look for, how to interpret what the
              camera sees and how much to explain.
            </p>
          </div>
          <LabCases />
        </div>
      </main>
    </div>
  );
}
