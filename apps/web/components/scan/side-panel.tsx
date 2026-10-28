"use client";

import { cn } from "cn";
import { useState } from "react";
import { Drawer as DrawerPrimitive } from "vaul";
import { ComponentsCard } from "@/components/scan/components-card";
import { PANEL_CARD } from "@/components/scan/panel-card";
import { SummaryPill } from "@/components/scan/summary-pill";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useIsDesktop } from "@/hooks/use-is-desktop";

const PEEK = "96px";
// vaul offsets the panel assuming it is as tall as the screen, so the panel
// stays h-full and the snap points set how much of it shows: peek, half, and
// almost full (the top bar stays visible).
const FULL = 0.92;
const SNAP_POINTS = [PEEK, 0.5, FULL];

// Placeholder: StepsCard (HU-08) replaces it.
function StepsPlaceholder() {
  return (
    <Card size="sm" className={cn(PANEL_CARD, "px-4")}>
      <h2 className="text-base font-semibold">Paso a paso</h2>
      <div className="flex flex-col gap-2">
        <Skeleton className="h-5 rounded-md" />
        <Skeleton className="h-5 w-3/4 rounded-md" />
      </div>
    </Card>
  );
}

function DesktopPanel() {
  return (
    <aside
      aria-label="Componentes y pasos"
      className="flex min-h-0 flex-col gap-4 overflow-hidden p-4 pl-0"
    >
      <SummaryPill />
      <ComponentsCard />
      <StepsPlaceholder />
    </aside>
  );
}

function MobilePanel() {
  const [snap, setSnap] = useState<number | string | null>(PEEK);
  const expanded = snap === FULL;

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
            <SummaryPill />
            <ComponentsCard />
            <StepsPlaceholder />
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
