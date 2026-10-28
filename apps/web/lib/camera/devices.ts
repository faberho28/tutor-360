import type { CameraDevice } from "@/lib/types";

const STORAGE_KEY = "tutor360.cameraDeviceId";

export async function listVideoDevices(): Promise<CameraDevice[]> {
  const all = await navigator.mediaDevices.enumerateDevices();
  return all
    .filter((d) => d.kind === "videoinput")
    .map((d, i) => ({
      id: d.deviceId,
      label: d.label || `Cámara ${i + 1}`,
    }));
}

export function loadPreferredDevice(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

export function savePreferredDevice(id: string): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id);
  } catch {
    // storage unavailable
  }
}
