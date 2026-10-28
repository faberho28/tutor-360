import { notFound } from "next/navigation";
import {
  resolveScenario,
  resolveSource,
  resolveStage,
} from "@/lib/fixtures/dev-scenario";
import { DemoScan } from "./demo-scan";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * The simulated experience: demo photo, scenarios and mock results. It is a
 * development tool, so it does not exist in production.
 */
export default async function DemoPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  if (process.env.NODE_ENV === "production") notFound();

  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (typeof value === "string") params.set(key, value);
  }

  return (
    <DemoScan
      scenario={resolveScenario(params)}
      source={resolveSource(params)}
      stage={resolveStage(params)}
    />
  );
}
