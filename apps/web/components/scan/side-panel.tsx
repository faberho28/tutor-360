"use client";

import { cn } from "cn";
import { useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { ComponentsCard } from "@/components/scan/components-card";
import { StepsCard } from "@/components/scan/steps-card";
import { SummaryPill } from "@/components/scan/summary-pill";
import { FirstAnalysisSkeleton } from "@/components/scan/first-analysis-skeleton";
import { useIsDesktop } from "@/hooks/use-is-desktop";
import { useSession } from "@/lib/session/session-provider";

const PEEK = "96px";
// vaul offsets the panel assuming it is as tall as the screen, so the panel
// stays h-full and the snap points set how much of it shows: peek, half, and
// almost full (the top bar stays visible).
const FULL = 0.92;
const SNAP_POINTS = [PEEK, 0.5, FULL];

function DesktopPanel() {
  const initialAnalysis = useSession(
    (s) => s.analysis.phase === "analyzing" && s.detections.length === 0,
  );

  return (
    <aside
      aria-label="Componentes y pasos"
      className="flex min-h-0 flex-col gap-4 overflow-hidden p-4 pl-0"
    >
      {initialAnalysis ? (
        <FirstAnalysisSkeleton />
      ) : (
        <>
          <SummaryPill />
          <ComponentsCard />
          <StepsCard />
        </>
      )}
    </aside>
  );
}

function MobilePanel() {
  const [snap, setSnap] = useState<number | string | null>(PEEK);
  const expanded = snap === FULL;
  const initialAnalysis = useSession(
    (s) => s.analysis.phase === "analyzing" && s.detections.length === 0,
  );

  return (
    <DrawerPrimitive.Root
      open
      onOpenChange={() => {}}
      modal={false}
      dismissible={false}
      snapPoints={SNAP_POINTS}
      activeSnapPoint={snap}
      setActiveSnapPoint={setSnap}
    >
      <DrawerPrimitive.Portal>
        <DrawerPrimitive.Content
          aria-label="Componentes y pasos"
          className="fixed inset-x-0 bottom-0 z-40 mx-auto flex h-full flex-col rounded-t-3xl border border-b-0 bg-background outline-none"
        >
          <DrawerPrimitive.Title className="sr-only">
            Componentes y pasos
          </DrawerPrimitive.Title>
          <DrawerPrimitive.Description className="sr-only">
            Arrastra hacia arriba para ver la lista de componentes y el paso a
            paso.
          </DrawerPrimitive.Description>
          <DrawerPrimitive.Handle className="mt-3 mb-2 h-1.5! w-12! bg-muted-foreground/30!" />
          <div
            className={cn(
              "flex min-h-0 flex-1 flex-col gap-3 px-4 pb-4",
              expanded ? "overflow-y-auto" : "overflow-hidden",
            )}
          >
            {initialAnalysis ? (
              <FirstAnalysisSkeleton />
            ) : (
              <>
                <SummaryPill />
                <ComponentsCard />
                <StepsCard />
              </>
            )}
          </div>
        </DrawerPrimitive.Content>
      </DrawerPrimitive.Portal>
    </DrawerPrimitive.Root>
  );
}

export function SidePanel() {
  const isDesktop = useIsDesktop();

  // The server does not know the width: keep the desktop column's space
  // reserved until the browser answers, then mount the right variant.
  if (isDesktop === undefined) {
    return <div aria-hidden="true" className="hidden lg:block" />;
  }
  return isDesktop ? <DesktopPanel /> : <MobilePanel />;
}
