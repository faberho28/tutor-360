"use client";

import { CameraStage } from "@/components/scan/camera-stage";
import { ConnectionBanner } from "@/components/scan/connection-banner";
import { NavRail } from "@/components/scan/nav-rail";
import { SidePanel } from "@/components/scan/side-panel";
import { ShortcutsHelp } from "@/components/scan/shortcuts-help";
import { TopBar } from "@/components/scan/top-bar";
import { useNewAnomalyToast } from "@/hooks/use-new-anomaly-toast";
import { useServices } from "@/lib/services/context";
import { useSession, useSessionStore } from "@/lib/session/session-provider";

/**
 * Desktop (>= 1024px): rail | stage | 360px panel.
 * Below that: top bar + stage, with the panel as a bottom drawer.
 */
export function ScanScreen() {
  const store = useSessionStore();
  const services = useServices();
  const phase = useSession((s) => s.analysis.phase);
  useNewAnomalyToast();

  const failed = phase === "offline" || phase === "quota" || phase === "error";

  return (
    // minmax(0, 1fr) on the single mobile column: without it the track grows
    // to the widest content (the top bar) and the page scrolls sideways.
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[52px_minmax(0,1fr)] bg-background lg:grid-cols-[56px_minmax(0,1fr)_360px]">
      <TopBar className="lg:col-span-3" />
      <NavRail className="hidden lg:flex" />
      <ShortcutsHelp />
      <main className="flex min-h-0 flex-col gap-3 p-4 pb-28 lg:pb-4">
        {failed ? (
          <ConnectionBanner
            phase={phase}
            onRetry={() => services.retryAnalysis(store)}
          />
        ) : null}
        <div className="min-h-0 flex-1">
          <CameraStage />
        </div>
      </main>
      <SidePanel />
    </div>
  );
}
