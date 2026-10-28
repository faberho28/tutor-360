import type { SessionStore } from "../session/store";

/** Development switch: the next reconstruction fails (Demo menu). */
export const modelDemo = { fail: false };

const LATENCY_MS = 2500;
const SAMPLE_GLB = "/demo/sample.glb";

let timer: ReturnType<typeof setTimeout> | undefined;

/**
 * Starts a (simulated) 3D reconstruction. HU-30 replaces it with the real
 * call. Only one runs at a time: while one is generating, this does nothing
 * and the dialog keeps showing it.
 */
export function requestMockModel(
  store: SessionStore,
  detectionId: string,
): void {
  const state = store.getState();
  if (state.model3d.status === "generating") return;

  state.setModel3d({ status: "generating", detectionId });
  clearTimeout(timer);
  timer = setTimeout(() => {
    timer = undefined;
    store
      .getState()
      .setModel3d(
        modelDemo.fail
          ? { status: "error", detectionId }
          : { status: "ready", detectionId, glbUrl: SAMPLE_GLB },
      );
  }, LATENCY_MS);
}

/** Cancels a running reconstruction and closes the viewer. */
export function closeMockModel(store: SessionStore): void {
  clearTimeout(timer);
  timer = undefined;
  store.getState().setModel3d({ status: "idle" });
}
