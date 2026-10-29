"use client";

import { useEffect, useState } from "react";
import { useAnalysis } from "@/components/scan/analysis-provider";
import { ChangeIndicator } from "@/components/scan/change-indicator";
import { ControlBar } from "@/components/scan/control-bar";
import { LiveCameraSource } from "@/components/scan/live-camera-source";
import { OverlayCanvas } from "@/components/scan/overlay-canvas";
import { StageCornerControls } from "@/components/scan/stage-corner-controls";
import { StageEmptyState } from "@/components/scan/stage-empty-state";
import { PortalContainerProvider } from "@/components/ui/portal-container";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useChangeDetection } from "@/hooks/use-change-detection";
import { useCamera } from "@/lib/camera/use-camera";
import { useSession } from "@/lib/session/session-provider";

/**
 * The camera stage: the live camera, the mask overlay on top, and the corner
 * controls.
 */
export function CameraStage() {
  const stage = useSession((s) => s.stage);
  const deviceId = useSession((s) => s.cameraDeviceId);
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ width: 1280, height: 720 });
  const { analysis, videoRef } = useAnalysis();
  const fullscreen = useFullscreen();
  const stream = useCamera(true, deviceId);
  const live = stage === "ready" && stream !== null;
  const change = useChangeDetection(() => videoRef.current, live);

  // The analysis reacts to the engine: when to analyze, and when masks are stale.
  useEffect(() => {
    analysis.report(change.reading.status);
  }, [analysis, change.reading.status]);

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
            <LiveCameraSource
              stream={stream}
              videoRef={videoRef}
              onDimensions={setDims}
            />
            <OverlayCanvas source={dims} />
          </>
        ) : (
          <StageEmptyState state={stage} />
        )}
        <StageCornerControls fullscreenTarget={element}>
          {live ? (
            <ChangeIndicator reading={change.reading} onReset={change.reset} />
          ) : null}
        </StageCornerControls>
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-3">
          <ControlBar />
        </div>
      </div>
    </PortalContainerProvider>
  );
}
