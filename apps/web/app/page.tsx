import { LiveAutoplay } from "@/components/scan/live-autoplay";
import { ScanScreen } from "@/components/scan/scan-screen";
import {
  DEFAULT_SCENARIO,
  resolveScenario,
  resolveSource,
  resolveStage,
} from "@/lib/fixtures/dev-scenario";
import { getScenario, getScenarioPhase } from "@/lib/fixtures/scenarios";
import { SessionProvider } from "@/lib/session/session-provider";
import type { FrameSource, StageState } from "@/lib/types";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  // In production the demo parameters are ignored, so the page is not even
  // read per request and stays static.
  let scenario = DEFAULT_SCENARIO;
  let stage: StageState = "ready";
  let source: FrameSource = "camera";
  if (process.env.NODE_ENV !== "production") {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(await searchParams)) {
      if (typeof value === "string") params.set(key, value);
    }
    scenario = resolveScenario(params);
    stage = resolveStage(params);
    source = resolveSource(params);
  }
  const demo = source === "demo";

  return (
    <SessionProvider
      initialState={{
        source,
        stage,
        ...(demo
          ? {
              detections: getScenario(scenario),
              // Simulated until the real analysis reports its own latency.
              analysis: {
                mode: "manual" as const,
                phase: getScenarioPhase(scenario),
                latencyMs: 900,
                startedAt: null,
              },
            }
          : {}),
      }}
    >
      {demo && scenario === "live" ? <LiveAutoplay /> : null}
      <ScanScreen />
    </SessionProvider>
  );
}
