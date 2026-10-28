"use client";

import { useState } from "react";
import { DemoControls } from "@/components/scan/demo-controls";
import { OverlayCanvas } from "@/components/scan/overlay-canvas";
import { StageCornerControls } from "@/components/scan/stage-corner-controls";
import { StageEmptyState } from "@/components/scan/stage-empty-state";
import { DEMO_SOURCE, DemoImageSource } from "@/components/scan/stage-source";
import { PortalContainerProvider } from "@/components/ui/portal-container";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useSession } from "@/lib/session/session-provider";

/**
 * The camera stage: video (the demo photo for now), the mask overlay on top,
 * and the corner controls. It fills all the space the layout gives it.
 */
export function CameraStage() {
  const stage = useSession((s) => s.stage);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const fullscreen = useFullscreen();

  return (
    // While the stage is fullscreen, menus must be drawn inside it or the
    // browser hides them (it only shows the fullscreen element's subtree).
    <PortalContainerProvider value={fullscreen.active ? element : null}>
      <div
        ref={setElement}
        className="relative size-full overflow-hidden rounded-3xl bg-black [&:fullscreen]:rounded-none"
      >
        {stage === "ready" ? (
          <>
            <DemoImageSource />
            <OverlayCanvas source={DEMO_SOURCE} />
          </>
        ) : (
          <StageEmptyState state={stage} />
        )}
        <StageCornerControls fullscreenTarget={element} />
        {process.env.NODE_ENV !== "production" ? <DemoControls /> : null}
      </div>
    </PortalContainerProvider>
  );
}
