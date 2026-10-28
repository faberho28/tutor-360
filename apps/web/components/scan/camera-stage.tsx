"use client";

import { useRef } from "react";
import { DemoControls } from "@/components/scan/demo-controls";
import { OverlayCanvas } from "@/components/scan/overlay-canvas";
import { StageCornerControls } from "@/components/scan/stage-corner-controls";
import { StageEmptyState } from "@/components/scan/stage-empty-state";
import { DEMO_SOURCE, DemoImageSource } from "@/components/scan/stage-source";
import { useSession } from "@/lib/session/session-provider";

/**
 * The camera stage: video (the demo photo for now), the mask overlay on top,
 * and the corner controls. It fills all the space the layout gives it.
 */
export function CameraStage() {
  const stage = useSession((s) => s.stage);
  const ref = useRef<HTMLDivElement>(null);

  return (
    <div
      ref={ref}
      className="relative size-full overflow-hidden rounded-3xl bg-black"
    >
      {stage === "ready" ? (
        <>
          <DemoImageSource />
          <OverlayCanvas source={DEMO_SOURCE} />
        </>
      ) : (
        <StageEmptyState state={stage} />
      )}
      <StageCornerControls targetRef={ref} />
      {process.env.NODE_ENV !== "production" ? <DemoControls /> : null}
    </div>
  );
}
