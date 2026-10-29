"use client";

import {
  AnalysisProvider,
  useAnalysis,
} from "@/components/scan/analysis-provider";
import { CameraStage } from "@/components/scan/camera-stage";
import { ScanHeader } from "@/components/scan/scan-header";
import { SidePanel } from "@/components/scan/side-panel";
import { StatusPill } from "@/components/scan/status-pill";
import { ShortcutsHelp } from "@/components/scan/shortcuts-help";
import { TopBar } from "@/components/scan/top-bar";
import { useAnalysisFailureToast } from "@/hooks/use-analysis-failure-toast";
import { useNewAnomalyToast } from "@/hooks/use-new-anomaly-toast";

export function ScanScreen() {
  return (
    <AnalysisProvider>
      <ScanLayout />
    </AnalysisProvider>
  );
}

/**
 * Same frame as the other screens (transparent top bar, 16px margins aligned
 * with the logo) but fluid: the scanner uses the whole width. The heading
 * lives in the top bar; below it, the stage and (>= 1024px) a panel that grows
 * from 380px to 480px with the screen; on smaller screens it is a bottom drawer.
 * Analysis failures show as a toast, so the stage keeps all its height.
 */
function ScanLayout() {
  const { analysis } = useAnalysis();
  useNewAnomalyToast();
  useAnalysisFailureToast(analysis);

  return (
    // minmax(0, 1fr) on the single mobile column: without it the track grows
    // to the widest content and the page scrolls sideways.
    <div className="grid h-dvh grid-cols-[minmax(0,1fr)] grid-rows-[52px_minmax(0,1fr)] bg-background">
      <TopBar trailing={<StatusPill />}>
        <ScanHeader />
      </TopBar>
      <ShortcutsHelp />
      {/* Room at the bottom on small screens for the drawer's peek. */}
      <main className="grid min-h-0 gap-4 px-4 pt-1 pb-28 lg:grid-cols-[minmax(0,1fr)_clamp(380px,28vw,480px)] lg:pb-4">
        <div className="min-h-0">
          <CameraStage />
        </div>
        <SidePanel />
      </main>
    </div>
  );
}
