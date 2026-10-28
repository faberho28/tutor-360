import { createStore } from "zustand/vanilla";
import type {
  AnalysisState,
  CameraDevice,
  Capture,
  Detection,
  DiagnosisEntry,
  FrameSource,
  Model3DState,
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
  /** The 3D reconstruction in progress or on screen; one at a time. */
  model3d: Model3DState;
  /** Diagnosis per detection id. */
  diagnoses: Record<string, DiagnosisEntry>;
  /** Step indexes marked done / skipped, per detection id ("general" for the generic list). */
  completedSteps: Record<string, number[]>;
  skippedSteps: Record<string, number[]>;
  /** Detections the user added to the report. */
  reportIds: string[];
  /** "demo" only when requested via URL params. */
  source: FrameSource;
  cameraDevices: CameraDevice[];
  /** Requested device (null = default). */
  cameraDeviceId: string | null;
  cameraActiveId: string | null;
  cameraAttempt: number;
};

export type SessionActions = {
  setSource: (source: FrameSource) => void;
  setCameraDevices: (devices: CameraDevice[]) => void;
  setCameraDeviceId: (id: string | null) => void;
  setCameraActiveId: (id: string | null) => void;
  retryCamera: () => void;
  setName: (name: string) => void;
  setStage: (stage: StageState) => void;
  setAnalysis: (patch: Partial<AnalysisState>) => void;
  replaceDetections: (detections: Detection[]) => void;
  select: (id: string) => void;
  clearSelection: () => void;
  /** Saves the given detections and their composed image; returns the capture. */
  addCapture: (detections: Detection[], imageDataUrl: string) => Capture;
  removeCapture: (id: string) => void;
  setModel3d: (model3d: Model3DState) => void;
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
    model3d: { status: "idle" },
    diagnoses: {},
    completedSteps: {},
    skippedSteps: {},
    reportIds: [],
    source: "camera",
    cameraDevices: [],
    cameraDeviceId: null,
    cameraActiveId: null,
    cameraAttempt: 0,
    ...overrides,
  };
}

/**
 * One store per SessionProvider: a module-level singleton would be shared
 * between server requests and between tests.
 */
export function createSessionStore(initial: Partial<SessionState> = {}) {
  let captureCounter = 0;
  return createStore<SessionSlice>()((set) => ({
    ...freshState(initial),

    setSource: (source) => set({ source }),
    setCameraDevices: (cameraDevices) => set({ cameraDevices }),
    setCameraDeviceId: (cameraDeviceId) => set({ cameraDeviceId }),
    setCameraActiveId: (cameraActiveId) => set({ cameraActiveId }),
    retryCamera: () =>
      set((state) => ({
        stage: "ready",
        cameraAttempt: state.cameraAttempt + 1,
      })),

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

    addCapture: (detections, imageDataUrl) => {
      // Counter instead of length + 1: ids must stay unique after deletions.
      captureCounter += 1;
      const capture: Capture = {
        id: `capture-${captureCounter}`,
        at: Date.now(),
        detections: structuredClone(detections),
        imageDataUrl,
      };
      set((state) => ({ captures: [...state.captures, capture] }));
      return capture;
    },

    removeCapture: (id) =>
      set((state) => ({ captures: state.captures.filter((c) => c.id !== id) })),

    setModel3d: (model3d) => set({ model3d }),

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
