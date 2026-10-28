"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
  type RefObject,
} from "react";
import { useServices } from "@/lib/services/context";
import type { ScanAnalysis } from "@/lib/services/types";
import { useSessionStore } from "@/lib/session/session-provider";

type AnalysisContextValue = {
  analysis: ScanAnalysis;
  /** The camera's <video>: the stage fills it, the analysis reads frames from it. */
  videoRef: RefObject<HTMLVideoElement | null>;
};

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

/**
 * Owns the analysis for the whole screen: the stage feeds it the change
 * engine's readings, the control bar starts it and the banner retries it.
 */
export function AnalysisProvider({ children }: { children: ReactNode }) {
  const store = useSessionStore();
  const services = useServices();
  const [value] = useState<AnalysisContextValue>(() => {
    // A plain box with the shape of a ref: the stage fills it with the <video>.
    const video: { current: HTMLVideoElement | null } = { current: null };
    return {
      videoRef: video,
      analysis: services.createAnalysis(store, () => video.current),
    };
  });

  useEffect(() => () => value.analysis.dispose(), [value]);

  return <AnalysisContext value={value}>{children}</AnalysisContext>;
}

export function useAnalysis(): AnalysisContextValue {
  const value = useContext(AnalysisContext);
  if (!value) {
    throw new Error("useAnalysis must be used within an AnalysisProvider");
  }
  return value;
}
