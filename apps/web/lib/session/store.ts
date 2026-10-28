import { createStore } from "zustand/vanilla";
import type {
  AnalysisState,
  Capture,
  Detection,
  DiagnosisEntry,
  StageState,
} from "../types";

export const DEFAULT_SESSION_NAME = "Escaneo · Sesión nueva";

export type SessionState = {
  sessionId: string;
  name: string;
  stage: StageState;
  analysis: AnalysisState;
  detections: Detection[];
  selectedId: string | null;
  captures: Capture[];
  /** Diagnosis per detection id. */
  diagnoses: Record<string, DiagnosisEntry>;
  /** Step indexes marked done / skipped, per detection id ("general" for the generic list). */
  completedSteps: Record<string, number[]>;
  skippedSteps: Record<string, number[]>;
  /** Detections the user added to the report. */
  reportIds: string[];
};

export type SessionActions = {
  setName: (name: string) => void;
  setStage: (stage: StageState) => void;
  setAnalysis: (patch: Partial<AnalysisState>) => void;
  replaceDetections: (detections: Detection[]) => void;
  select: (id: string) => void;
  clearSelection: () => void;
  /** Saves the given detections as a capture and returns it. */
  addCapture: (detections: Detection[]) => Capture;
  setDiagnosis: (id: string, entry: DiagnosisEntry) => void;
  /** Marks a step done, or undoes it (also clears "skipped"). */
  toggleStep: (key: string, index: number) => void;
  skipStep: (key: string, index: number) => void;
  toggleReportItem: (id: string) => void;
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
    captures: [],
    diagnoses: {},
    completedSteps: {},
    skippedSteps: {},
    reportIds: [],
    ...overrides,
  };
}

/**
 * One store per SessionProvider: a module-level singleton would be shared
 * between server requests and between tests.
 */
export function createSessionStore(initial: Partial<SessionState> = {}) {
  return createStore<SessionSlice>()((set, get) => ({
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

    addCapture: (detections) => {
      const capture: Capture = {
        id: `capture-${get().captures.length + 1}`,
        at: Date.now(),
        detections: structuredClone(detections),
      };
      set((state) => ({ captures: [...state.captures, capture] }));
      return capture;
    },

    setDiagnosis: (id, entry) =>
      set((state) => ({ diagnoses: { ...state.diagnoses, [id]: entry } })),

    toggleStep: (key, index) =>
      set((state) => {
        const done = state.completedSteps[key] ?? [];
        return {
          completedSteps: {
            ...state.completedSteps,
            [key]: done.includes(index)
              ? done.filter((i) => i !== index)
              : [...done, index],
          },
          skippedSteps: {
            ...state.skippedSteps,
            [key]: (state.skippedSteps[key] ?? []).filter((i) => i !== index),
          },
        };
      }),

    skipStep: (key, index) =>
      set((state) => ({
        skippedSteps: {
          ...state.skippedSteps,
          [key]: [...new Set([...(state.skippedSteps[key] ?? []), index])],
        },
        completedSteps: {
          ...state.completedSteps,
          [key]: (state.completedSteps[key] ?? []).filter((i) => i !== index),
        },
      })),

    toggleReportItem: (id) =>
      set((state) => ({
        reportIds: state.reportIds.includes(id)
          ? state.reportIds.filter((x) => x !== id)
          : [...state.reportIds, id],
      })),

    reset: () => set(freshState()),
  }));
}

export type SessionStore = ReturnType<typeof createSessionStore>;
