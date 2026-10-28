import { NavRail } from "@/components/scan/nav-rail";
import { SidePanel } from "@/components/scan/side-panel";
import { StagePlaceholder } from "@/components/scan/stage-placeholder";
import { TopBar } from "@/components/scan/top-bar";

/**
 * Desktop (>= 1024px): rail | stage | 360px panel.
 * Below that: top bar + stage, with the panel as a bottom drawer.
 */
export function ScanScreen() {
  return (
    <div className="grid h-dvh grid-rows-[64px_minmax(0,1fr)] bg-background lg:grid-cols-[72px_minmax(0,1fr)_360px]">
      <TopBar className="lg:col-span-3" />
      <NavRail className="hidden lg:flex" />
      <main className="min-h-0 p-4 pb-28 lg:pb-4">
        <StagePlaceholder />
      </main>
      <SidePanel />
    </div>
  );
}
