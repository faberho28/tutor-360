"use client";

import { useRef, useState } from "react";
import { ControlBar } from "@/components/scan/control-bar";
import { DemoControls } from "@/components/scan/demo-controls";
import { LiveCameraSource } from "@/components/scan/live-camera-source";
import { OverlayCanvas } from "@/components/scan/overlay-canvas";
import { StageCornerControls } from "@/components/scan/stage-corner-controls";
import { StageEmptyState } from "@/components/scan/stage-empty-state";
import { DEMO_SOURCE, DemoImageSource } from "@/components/scan/stage-source";
import { PortalContainerProvider } from "@/components/ui/portal-container";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { useCamera } from "@/lib/camera/use-camera";
import { useSession } from "@/lib/session/session-provider";

/**
 * The camera stage: the live camera (the demo photo only with demo params),
 * the mask overlay on top, and the corner controls.
 */
export function CameraStage() {
  const stage = useSession((s) => s.stage);
  const source = useSession((s) => s.source);
  const deviceId = useSession((s) => s.cameraDeviceId);
  const demo = source === "demo";
  const [element, setElement] = useState<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ width: 1280, height: 720 });
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const fullscreen = useFullscreen();
  const stream = useCamera(!demo, deviceId);

  return (
    // While the stage is fullscreen, menus must be drawn inside it or the
    // browser hides them (it only shows the fullscreen element's subtree).
    <PortalContainerProvider value={fullscreen.active ? element : null}>
      <div
        ref={setElement}
        className="relative size-full overflow-hidden rounded-3xl bg-black [&:fullscreen]:rounded-none"
      >
        {stage === "ready" ? (
          demo ? (
            <>
              <DemoImageSource />
              <OverlayCanvas source={DEMO_SOURCE} />
            </>
          ) : (
            <>
              <LiveCameraSource
                stream={stream}
                videoRef={videoRef}
                onDimensions={setDims}
              />
              <OverlayCanvas source={dims} />
            </>
          )
        ) : (
          <StageEmptyState state={stage} />
        )}
        <StageCornerControls fullscreenTarget={element} />
        <div className="pointer-events-none absolute inset-x-0 bottom-5 z-10 flex justify-center px-3">
          <ControlBar getVideo={() => videoRef.current} />
        </div>
        {demo && process.env.NODE_ENV !== "production" ? (
          <DemoControls />
        ) : null}
      </div>
    </PortalContainerProvider>
  );
}
