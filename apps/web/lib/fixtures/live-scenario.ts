import type { SessionStore } from "../session/store";
import { getScenario } from "./scenarios";

/**
 * "Live" demo script: the components of the `findings` scenario show up one
 * group at a time, as if the camera were discovering them. It lets the list
 * animations, the pulse and the status pill be seen without a camera or the AI.
 */
const STEPS: ReadonlyArray<{ atMs: number; ids: readonly string[] }> = [
  { atMs: 1500, ids: ["cap-a", "cap-b", "cap-c"] },
  { atMs: 3500, ids: ["cap-d", "cap-e"] },
  { atMs: 5500, ids: ["dust-1"] },
  { atMs: 8000, ids: ["cap-f"] },
  { atMs: 10000, ids: ["cap-h"] },
];
const FINISH_AFTER_MS = 1000;

let cancelCurrent: (() => void) | null = null;

export function stopLiveScenario() {
  cancelCurrent?.();
  cancelCurrent = null;
}

/** Starts (or restarts) the script. Returns a function that cancels it. */
export function playLiveScenario(store: SessionStore): () => void {
  stopLiveScenario();

  const target = getScenario("findings");
  const state = store.getState();
  state.replaceDetections([]);
  state.setAnalysis({
    phase: "analyzing",
    startedAt: Date.now(),
    latencyMs: 900,
  });

  const revealed = new Set<string>();
  const timers: Array<ReturnType<typeof setTimeout>> = [];

  for (const step of STEPS) {
    timers.push(
      setTimeout(() => {
        step.ids.forEach((id) => revealed.add(id));
        const current = store.getState();
        const known = new Map(current.detections.map((d) => [d.id, d]));
        current.replaceDetections(
          target
            .filter((d) => revealed.has(d.id))
            .map((d) => known.get(d.id) ?? { ...d, seenAt: Date.now() }),
        );
      }, step.atMs),
    );
  }

  const last = STEPS[STEPS.length - 1]!.atMs;
  timers.push(
    setTimeout(
      () => store.getState().setAnalysis({ phase: "idle" }),
      last + FINISH_AFTER_MS,
    ),
  );

  const cancel = () => timers.forEach(clearTimeout);
  cancelCurrent = cancel;
  return cancel;
}
