"use client";

import { LiveAutoplay } from "@/components/demo/live-autoplay";
import { ScanScreen } from "@/components/scan/scan-screen";
import { getScenario, getScenarioPhase } from "@/lib/fixtures/scenarios";
import type { ScenarioName } from "@/lib/fixtures/scenarios";
import { ServicesProvider } from "@/lib/services/context";
import { demoServices } from "@/lib/services/demo";
import { SessionProvider } from "@/lib/session/session-provider";
import type { FrameSource, StageState } from "@/lib/types";

/** The scan screen with simulated results. Only /demo renders it. */
export function DemoScan({
  scenario,
  source,
  stage,
}: {
  scenario: ScenarioName;
  source: FrameSource;
  stage: StageState;
}) {
  const demo = source === "demo";
  return (
    <ServicesProvider services={demoServices}>
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
                  stale: false,
                },
              }
            : {}),
        }}
      >
        {demo && scenario === "live" ? <LiveAutoplay /> : null}
        <ScanScreen />
      </SessionProvider>
    </ServicesProvider>
  );
}
