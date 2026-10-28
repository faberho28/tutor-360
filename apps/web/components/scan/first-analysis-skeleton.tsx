import { Skeleton } from "@/components/ui/skeleton";

export function FirstAnalysisSkeleton() {
  return (
    <div
      aria-label="Analizando la PC"
      className="flex min-h-0 flex-1 flex-col gap-4"
    >
      <Skeleton className="h-12 w-full rounded-xl" />
      <div className="flex min-h-0 flex-1 flex-col gap-2 rounded-xl border bg-card p-4">
        <Skeleton className="h-5 w-40" />
        <div className="flex flex-col gap-3 pt-2">
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </div>
      </div>
    </div>
  );
}
