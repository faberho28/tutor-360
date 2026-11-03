import type { ComponentStatus } from "./component-status";
import type { AnalysisState } from "./types";

/** User-facing texts (en) shared by several components. */
export const copy = {
  status: {
    idle: "Ready",
    preparing: "Preparing tracking",
    waiting: "Waiting for a steady image",
    analyzing: "Analyzing",
    paused: "Paused",
    offline: "No connection to the AI",
    quota: "AI quota exhausted",
    error: "Something went wrong while analyzing",
  } satisfies Record<AnalysisState["phase"], string>,
  /** What the failure toast says under the title, per failed phase. */
  failure: {
    offline: "Check your connection and try the analysis again.",
    quota:
      "We paused the automatic analysis. Turn it on again when credits are available.",
    error: "We kept the last components detected.",
  } satisfies Record<"offline" | "quota" | "error", string>,
  controls: {
    capture: "Capture",
    autoOn: "Turn on automatic analysis",
    autoOff: "Pause automatic analysis",
    report: "Generate report",
    reportNeedsCapture: "Take at least one capture",
    more: "More",
    reset: "Reset context",
    changeGrid: "Show change grid",
  },
} as const;

export const statusLabel: Record<ComponentStatus, string> = {
  anomaly: "Anomaly",
  warning: "Check",
  ok: "OK",
};

export const severityLabel = {
  high: { text: "High severity", variant: "anomaly" },
  medium: { text: "Medium severity", variant: "warning" },
  low: { text: "Low severity", variant: "ok" },
} as const;

export const listCopy = {
  title: "Detected components",
  empty: "Point the camera at the inside of the PC to start",
} as const;

/** "3 s ago", "2 min ago"; "now" under five seconds or before the clock is known. */
export function formatAgo(now: number, seenAt: number): string {
  const seconds = Math.floor((now - seenAt) / 1000);
  if (now === 0 || seconds < 5) return "now";
  if (seconds < 60) return `${seconds} s ago`;
  return `${Math.floor(seconds / 60)} min ago`;
}

/** 754 -> "00:12:34" */
export function formatElapsed(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
}
