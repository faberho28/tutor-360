"use client";

import { CameraStage } from "@/components/scan/camera-stage";
import { ConnectionBanner } from "@/components/scan/connection-banner";
import { NavRail } from "@/components/scan/nav-rail";
import { SidePanel } from "@/components/scan/side-panel";
import { ShortcutsHelp } from "@/components/scan/shortcuts-help";
import { TopBar } from "@/components/scan/top-bar";
import { useNewAnomalyToast } from "@/hooks/use-new-anomaly-toast";
import { getScenario } from "@/lib/fixtures/scenarios";
import { useSession, useSessionStore } from "@/lib/session/session-provider";

/**
 * Desktop (>= 1024px): rail | stage | 360px panel.
 * Below that: top bar + stage, with the panel as a bottom drawer.
 */
export function ScanScreen() {
  const store = useSessionStore();
  const phase = useSession((s) => s.analysis.phase);
  useNewAnomalyToast();

  function retryAnalysis() {
    const startedAt = Date.now();
    store.getState().setAnalysis({
      phase: "analyzing",
      latencyMs: null,
      startedAt,
    });
    window.setTimeout(() => {
      const state = store.getState();
      state.replaceDetections(getScenario("findings"));
      state.setAnalysis({
        phase: "idle",
        latencyMs: 900,
        startedAt: null,
      });
    }, 650);
  }

  const failed = phase === "offline" || phase === "quota" || phase === "error";

  return (
    // minmax(0, 1fr) on the single mobile column: without it the track grows
    // to the widest content (the top bar) and the page scrolls sideways.
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[64px_minmax(0,1fr)] bg-background lg:grid-cols-[72px_minmax(0,1fr)_360px]">
      <TopBar className="lg:col-span-3" />
      <NavRail className="hidden lg:flex" />
      <ShortcutsHelp />
      <main className="flex min-h-0 flex-col gap-3 p-4 pb-28 lg:pb-4">
        {failed ? (
          <ConnectionBanner phase={phase} onRetry={retryAnalysis} />
        ) : null}
        <div className="min-h-0 flex-1">
          <CameraStage />
        </div>
      </main>
      <SidePanel />
    </div>
  );
}
