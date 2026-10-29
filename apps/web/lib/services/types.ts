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
  /** The image to save in a capture, or null when it is not ready. */
  snapshot(): Promise<HTMLImageElement | HTMLVideoElement | null>;
};

/**
 * Everything the scan screen needs from the outside world (analysis,
 * diagnosis, 3D, report). Where a real implementation does not exist yet,
 * lib/services/real.ts says so instead of faking a result.
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
};
