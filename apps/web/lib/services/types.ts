import type { AnalysisSource } from "../analysis-source";
import type { SessionStore } from "../session/store";
import type { Detection } from "../types";
import type { GuideReport } from "../types";
import type { VoiceOutcome } from "../voice/voice-client";
import type { ChangeStatus } from "../vision/change-detector";

/** An analysis source plus what the screen needs to drive it. */
export type ScanAnalysis = AnalysisSource & {
  /** Whether the automatic loop can run. */
  autoAvailable: boolean;
  /** The local change engine's latest status (the real analysis reacts to it). */
  report(status: ChangeStatus): void;
  /** The "retry" button of the connection banner. */
  retry(): void;
  /** Forgets the whole scan (detections, plan, diagnoses, captures) and starts over. */
  reset(): void;
  /** The student says what happened in the current step; the tutor works out what comes next. */
  answerGuideStep(report: GuideReport): void;
  /**
   * Understands one thing the student said out loud (as the speech-to-text heard
   * it): an answer to the current step is applied, a question comes back with the
   * tutor's reply, anything else is ignored.
   */
  voiceTurn(transcript: string, signal?: AbortSignal): Promise<VoiceOutcome>;
  /** Compares the scene now with the one the guide started from (end of the steps). */
  checkGuide(): void;
  /** The image to save in a capture, or null when it is not ready. */
  snapshot(): Promise<HTMLImageElement | HTMLVideoElement | null>;
};

/**
 * Everything the scan screen needs from the outside world (analysis,
 * diagnosis, report). Where a real implementation does not exist yet,
 * lib/services/real.ts says so instead of faking a result.
 */
export type ScanServices = {
  /** Writes the progress of a diagnosis for `detection` into the store. */
  requestDiagnosis(store: SessionStore, detection: Detection): void;
  reportAvailable: boolean;
  /**
   * Resolves when the report is ready and downloaded; rejects when it cannot be
   * produced. An aborted `signal` stops it before the download.
   */
  generateReport(store: SessionStore, signal?: AbortSignal): Promise<void>;
  createAnalysis(
    store: SessionStore,
    getVideo: () => HTMLVideoElement | null,
  ): ScanAnalysis;
};
