"use client";

import { useEffect, useState } from "react";
import { listVideoDevices, loadPreferredDevice } from "@/lib/camera/devices";
import {
  stageForCameraError,
  stageForMissingMediaDevices,
} from "@/lib/camera/errors";
import { useSession, useSessionStore } from "@/lib/session/session-provider";

/**
 * Opens the selected camera while `enabled`, keeps the device list fresh and
 * stops every track on cleanup. Returns the live stream (null until ready).
 */
export function useCamera(enabled: boolean, deviceId: string | null) {
  const store = useSessionStore();
  const attempt = useSession((s) => s.cameraAttempt);
  const [stream, setStream] = useState<MediaStream | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const { setStage, setCameraDevices, setCameraActiveId } = store.getState();
    if (!navigator.mediaDevices?.getUserMedia) {
      setStage(stageForMissingMediaDevices());
      return;
    }

    let cancelled = false;
    let current: MediaStream | null = null;

    const refresh = async () => {
      try {
        const devices = await listVideoDevices();
        if (!cancelled) setCameraDevices(devices);
      } catch {
        // keep the previous list
      }
    };

    const requested = deviceId ?? loadPreferredDevice();
    navigator.mediaDevices
      .getUserMedia({
        audio: false,
        video: {
          ...(requested ? { deviceId: { ideal: requested } } : {}),
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      })
      .then((s) => {
        if (cancelled) {
          s.getTracks().forEach((t) => t.stop());
          return;
        }
        current = s;
        const track = s.getVideoTracks()[0];
        setCameraActiveId(track?.getSettings().deviceId ?? null);
        track?.addEventListener("ended", () => {
          if (!cancelled) store.getState().retryCamera();
        });
        setStream(s);
        void refresh();
      })
      .catch((error: unknown) => {
        if (!cancelled) setStage(stageForCameraError(error));
      });

    const onChange = () => void refresh();
    navigator.mediaDevices.addEventListener("devicechange", onChange);
    void refresh();

    return () => {
      cancelled = true;
      navigator.mediaDevices.removeEventListener("devicechange", onChange);
      current?.getTracks().forEach((t) => t.stop());
      setStream(null);
    };
  }, [enabled, deviceId, attempt, store]);

  return stream;
}
