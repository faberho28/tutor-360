"use client";

import { useSyncExternalStore } from "react";
import {
  getOpenCvState,
  subscribeOpenCv,
  type OpenCvState,
} from "@/lib/tracking/opencv-loader";

const SERVER_STATE: OpenCvState = { status: "idle" };

/** Progress of the OpenCV download that the local tracking needs. */
export function useOpenCv(): OpenCvState {
  return useSyncExternalStore(
    subscribeOpenCv,
    getOpenCvState,
    () => SERVER_STATE,
  );
}
