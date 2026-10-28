import type { StageState } from "../types";
import { SCENARIO_NAMES, type ScenarioName } from "./scenarios";

export const DEFAULT_SCENARIO: ScenarioName = "findings";

export const STAGE_NAMES = [
  "ready",
  "no-permission",
  "no-camera",
  "loading-model",
] as const satisfies readonly StageState[];

function readParam(
  search: string | URLSearchParams | undefined,
  key: string,
  nodeEnv: string | undefined,
): string | null {
  if (nodeEnv === "production" || search === undefined) return null;
  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  return params.get(key);
}

/**
 * Picks the demo scenario from `?scenario=`. The parameter is honored only
 * outside production; in production the default scenario is always used.
 */
export function resolveScenario(
  search: string | URLSearchParams | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): ScenarioName {
  const value = readParam(search, "scenario", nodeEnv);
  return (SCENARIO_NAMES as readonly string[]).includes(value ?? "")
    ? (value as ScenarioName)
    : DEFAULT_SCENARIO;
}

/** Picks the camera state from `?stage=`, with the same production rule. */
export function resolveStage(
  search: string | URLSearchParams | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): StageState {
  const value = readParam(search, "stage", nodeEnv);
  return (STAGE_NAMES as readonly string[]).includes(value ?? "")
    ? (value as StageState)
    : "ready";
}
