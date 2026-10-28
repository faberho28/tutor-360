import { ScanScreen } from "@/components/scan/scan-screen";
import { DEFAULT_SCENARIO, resolveScenario } from "@/lib/fixtures/dev-scenario";
import { getScenario } from "@/lib/fixtures/scenarios";
import { SessionProvider } from "@/lib/session/session-provider";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // In production the scenario parameter is ignored, so the page is not even
  // read per request and stays static.
  let scenario = DEFAULT_SCENARIO;
  if (process.env.NODE_ENV !== "production") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (typeof value === "string") params.set(key, value);
    }
    scenario = resolveScenario(params);
  }

  return (
    <SessionProvider initialState={{ detections: getScenario(scenario) }}>
      <ScanScreen />
    </SessionProvider>
  );
}
