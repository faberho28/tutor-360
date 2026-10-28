import type { StageState } from "@/lib/types";

export function stageForCameraError(error: unknown): StageState {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "no-permission";
  }
  return "no-camera";
}

export function stageForMissingMediaDevices(): StageState {
  return typeof window !== "undefined" && !window.isSecureContext
    ? "insecure"
    : "no-camera";
}
