"use client";

import { CameraOff, Loader } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { StageState } from "@/lib/types";
import { useSession } from "@/lib/session/session-provider";

/** Shown in place of the video when the camera is not available yet. */
export function StageEmptyState({
  state,
}: {
  state: Exclude<StageState, "ready">;
}) {
  const retry = useSession((s) => s.retryCamera);

  if (state === "loading-model") {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted p-6 text-center">
        <Skeleton className="absolute inset-0 rounded-none" />
        <div className="relative flex flex-col items-center gap-3">
          <Loader
            aria-hidden="true"
            className="size-8 text-muted-foreground motion-safe:animate-spin"
          />
          <p role="status" className="text-xs font-medium">
            Preparing analysis…
          </p>
        </div>
      </div>
    );
  }

  const noPermission = state === "no-permission";
  const insecure = state === "insecure";
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-muted p-6 text-center">
      <CameraOff
        aria-hidden="true"
        className="size-10 text-muted-foreground"
        strokeWidth={1.5}
      />
      <div className="flex max-w-sm flex-col gap-1">
        <p className="text-sm font-semibold">
          {insecure
            ? "The camera needs a secure connection"
            : noPermission
              ? "We need your camera to see the PC"
              : "We found no camera"}
        </p>
        <p className="text-xs text-muted-foreground">
          {insecure
            ? "The browser only allows the camera on HTTPS pages (or localhost). Open the app with a secure address."
            : noPermission
              ? "Allow camera access in your browser and try again."
              : "Connect your iPhone over USB-C (Mac: Continuity Camera · Windows: Camo or Iriun) or a webcam."}
        </p>
      </div>
      {insecure ? null : (
        <Button type="button" onClick={retry}>
          Try again
        </Button>
      )}
    </div>
  );
}
