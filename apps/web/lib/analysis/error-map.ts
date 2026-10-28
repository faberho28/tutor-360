import type { AnalysisState } from "../types";
import { AnalyzeClientError } from "./analyze-client";

export type FailedPhase = Extract<
  AnalysisState["phase"],
  "offline" | "quota" | "error"
>;

/** Which banner an analysis failure shows. */
export function phaseFor(error: unknown): FailedPhase {
  if (!(error instanceof AnalyzeClientError)) return "error";
  if (error.kind === "network" || error.kind === "timeout") return "offline";
  if (error.kind === "quota") return "quota";
  return "error";
}

/** Text for the user: client and server messages are already in Spanish. */
export function messageFor(error: unknown): string {
  return error instanceof AnalyzeClientError
    ? error.message
    : "Algo salió mal al analizar";
}
