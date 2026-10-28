import type { ComponentType } from "react";
import type { AnalysisSource } from "../analysis-source";
import type { SessionStore } from "../session/store";
import type { Detection } from "../types";
import type { ChangeStatus } from "../vision/change-detector";

/** An analysis source plus what the screen needs to drive it. */
export type ScanAnalysis = AnalysisSource & {
  /** Whether the automatic loop can run. */
  autoAvailable: boolean;
  /** The local change engine's latest status (the real analysis reacts to it). */
  report(status: ChangeStatus): void;
  /** The "retry" button of the connection banner. */
  retry(): void;
  /**
   * The image to save in a capture, or null when it is not ready. A simulated
   * source runs one analysis first so the capture has detections.
   */
  snapshot(): Promise<HTMLImageElement | HTMLVideoElement | null>;
};

/**
 * Everything the scan screen needs that can be simulated. The real page and
 * the demo page provide different implementations (see lib/services/real.tsx
 * and demo.tsx), so shared components never import fixtures.
 */
export type ScanServices = {
  /** Writes the progress of a diagnosis for `detection` into the store. */
  requestDiagnosis(store: SessionStore, detection: Detection): void;
  /** Starts a 3D reconstruction; the dialog follows `model3d` in the store. */
  requestModel(store: SessionStore, detectionId: string): void;
  closeModel(store: SessionStore): void;
  reportAvailable: boolean;
  /** Resolves when the report is ready; rejects when it cannot be produced. */
  generateReport(): Promise<void>;
  /** Small picture of a detection for the list. */
  Thumbnail: ComponentType<{ detection: Detection }>;
  createAnalysis(
    store: SessionStore,
    getVideo: () => HTMLVideoElement | null,
  ): ScanAnalysis;
  /** The demo photo and its overlay, in place of the camera. Demo only. */
  DemoStage: ComponentType | null;
  /** The development menu to switch scenarios. Demo only. */
  DevTools: ComponentType | null;
};
