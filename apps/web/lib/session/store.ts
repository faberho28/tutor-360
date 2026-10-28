import { createStore } from "zustand/vanilla";
import type { AnalysisState, Detection, StageState } from "../types";

export const DEFAULT_SESSION_NAME = "Escaneo · Sesión nueva";

export type SessionState = {
  sessionId: string;
  name: string;
  stage: StageState;
  analysis: AnalysisState;
  detections: Detection[];
  selectedId: string | null;
};

export type SessionActions = {
  setName: (name: string) => void;
  setStage: (stage: StageState) => void;
  setAnalysis: (patch: Partial<AnalysisState>) => void;
  replaceDetections: (detections: Detection[]) => void;
  select: (id: string) => void;
  clearSelection: () => void;
  reset: () => void;
};

export type SessionSlice = SessionState & SessionActions;

function newSessionId(): string {
  // randomUUID only exists in secure contexts (HTTPS or localhost).
  const uuid = globalThis.crypto?.randomUUID?.();
  return (
    uuid ??
    `s-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`
  );
}

function initialAnalysis(): AnalysisState {
  return { mode: "manual", phase: "idle", latencyMs: null, startedAt: null };
}

function freshState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    sessionId: newSessionId(),
    name: DEFAULT_SESSION_NAME,
    stage: "ready",
    analysis: initialAnalysis(),
    detections: [],
    selectedId: null,
    ...overrides,
  };
}

/**
 * One store per SessionProvider: a module-level singleton would be shared
 * between server requests and between tests.
 */
export function createSessionStore(initial: Partial<SessionState> = {}) {
  return createStore<SessionSlice>()((set) => ({
    ...freshState(initial),

    setName: (name) => set({ name }),
    setStage: (stage) => set({ stage }),
    setAnalysis: (patch) =>
      set((state) => ({ analysis: { ...state.analysis, ...patch } })),

    replaceDetections: (detections) =>
      set((state) => ({
        detections,
        selectedId: detections.some((d) => d.id === state.selectedId)
          ? state.selectedId
          : null,
      })),

    select: (id) =>
      set((state) =>
        state.detections.some((d) => d.id === id) ? { selectedId: id } : state,
      ),
    clearSelection: () => set({ selectedId: null }),

    reset: () => set(freshState()),
  }));
}

export type SessionStore = ReturnType<typeof createSessionStore>;
