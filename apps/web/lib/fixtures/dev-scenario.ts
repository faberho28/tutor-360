import { SCENARIO_NAMES, type ScenarioName } from "./scenarios";

export const DEFAULT_SCENARIO: ScenarioName = "findings";

/**
 * Picks the demo scenario from `?scenario=`. The parameter is honored only
 * outside production; in production the default scenario is always used.
 */
export function resolveScenario(
  search: string | URLSearchParams | undefined,
  nodeEnv: string | undefined = process.env.NODE_ENV,
): ScenarioName {
  if (nodeEnv === "production" || search === undefined) return DEFAULT_SCENARIO;

  const params =
    typeof search === "string" ? new URLSearchParams(search) : search;
  const value = params.get("scenario");

  return (SCENARIO_NAMES as readonly string[]).includes(value ?? "")
    ? (value as ScenarioName)
    : DEFAULT_SCENARIO;
}
