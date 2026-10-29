export const COMPONENT_STATUSES = ["ok", "warning", "anomaly"] as const;

/** Condition of a detected object; the AI decides it, there is no class table. */
export type ComponentStatus = (typeof COMPONENT_STATUSES)[number];
