import type { FrameSource, StageState } from "../types";
import { SCENARIO_NAMES, type ScenarioName } from "./scenarios";

export const DEFAULT_SCENARIO: ScenarioName = "findings";

export const STAGE_NAMES = [
  "ready",
  "no-permission",
  "no-camera",
  "loading-model",
  "insecure",
] as const satisfies readonly StageState[];

/**
 * Reads the parameters of /demo. That route does not exist in production, so
 * none of this needs its own production guard.
 */

/** The demo photo, unless `?source=camera` keeps the real camera. */
export function resolveSource(params: URLSearchParams): FrameSource {
  return params.get("source") === "camera" ? "camera" : "demo";
}

/** Picks the scenario from `?scenario=`. */
export function resolveScenario(params: URLSearchParams): ScenarioName {
  const value = params.get("scenario") ?? "";
  return (SCENARIO_NAMES as readonly string[]).includes(value)
    ? (value as ScenarioName)
    : DEFAULT_SCENARIO;
}

/** Picks the camera state from `?stage=`. */
export function resolveStage(params: URLSearchParams): StageState {
  const value = params.get("stage") ?? "";
  return (STAGE_NAMES as readonly string[]).includes(value)
    ? (value as StageState)
    : "ready";
}
