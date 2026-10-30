import { createStore } from "zustand/vanilla";
import type { ComponentStatus } from "../component-status";
import type {
  AnalysisState,
  CameraDevice,
  Capture,
  Detection,
  DiagnosisEntry,
  GeneralStepsEntry,
  StageState,
} from "../types";

export const DEFAULT_SESSION_NAME = "Escaneo · Sesión nueva";

import type { LabCaseSnapshot } from "../lab/cases";
import type { View } from "../tracking/view";

export type StatusOverride = { status: ComponentStatus; reason: string };

export type SessionState = {
  sessionId: string;
  name: string;
  /** What the user chose to scan in the Laboratorio. */
  labCase: LabCaseSnapshot | null;
  stage: StageState;
  analysis: AnalysisState;
  detections: Detection[];
  /**
   * Where the scene is now relative to the frame the detections were found on,
   * one motion per object while the local tracking follows it; null draws them
   * as they are. The detections themselves never change with it: the overlay
   * applies it.
   */
  view: View | null;
  selectedId: string | null;
  /**
   * Parts whose mask the user hid (double click) to see the camera without
   * noise. They stay in the list and keep their diagnosis.
   */
  hiddenIds: string[];
  /** Paints the change detector's grid over the camera (to tune it). */
  showChangeGrid: boolean;
  captures: Capture[];
  /** Diagnosis per detection id. */
  diagnoses: Record<string, DiagnosisEntry>;
  /** The step-by-step shown when no part needs fixing (the "general" key). */
  generalSteps: GeneralStepsEntry;
  /**
   * What the diagnosis decided about a part after a closer look (it could not
   * confirm the fault), per detection id. It wins over the review's verdict.
   */
  statusOverrides: Record<string, StatusOverride>;
  /** Step indexes marked done / skipped, per detection id ("general" for the generic list). */
  completedSteps: Record<string, number[]>;
  skippedSteps: Record<string, number[]>;
  /** Detections the user added to the report. */
  reportIds: string[];
  cameraDevices: CameraDevice[];
  /** Requested device (null = default). */
  cameraDeviceId: string | null;
  cameraActiveId: string | null;
  cameraAttempt: number;
};

export type SessionActions = {
  setCameraDevices: (devices: CameraDevice[]) => void;
  setCameraDeviceId: (id: string | null) => void;
  setCameraActiveId: (id: string | null) => void;
  retryCamera: () => void;
  setName: (name: string) => void;
  setStage: (stage: StageState) => void;
  setAnalysis: (patch: Partial<AnalysisState>) => void;
  replaceDetections: (detections: Detection[]) => void;
  setView: (view: View | null) => void;
  select: (id: string) => void;
  clearSelection: () => void;
  /** Hides the mask of a part, or shows it again. */
  toggleHidden: (id: string) => void;
  /** Shows or hides the change detector's grid over the camera. */
  toggleChangeGrid: () => void;
  /** Saves the given detections and their composed image; returns the capture. */
  addCapture: (detections: Detection[], imageDataUrl: string) => Capture;
  removeCapture: (id: string) => void;
  setDiagnosis: (id: string, entry: DiagnosisEntry) => void;
  /** A new list of general steps starts with none of them marked. */
  setGeneralSteps: (entry: GeneralStepsEntry) => void;
  /** Changes a part's status now and in every later analysis of the session. */
  overrideStatus: (id: string, override: StatusOverride) => void;
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
  return {
    mode: "manual",
    phase: "idle",
    latencyMs: null,
    busy: false,
    startedAt: null,
    reason: null,
    stale: false,
  };
}

function freshState(overrides: Partial<SessionState> = {}): SessionState {
  return {
    sessionId: newSessionId(),
    name: DEFAULT_SESSION_NAME,
    labCase: null,
    stage: "ready",
    analysis: initialAnalysis(),
    detections: [],
    view: null,
    selectedId: null,
    hiddenIds: [],
    showChangeGrid: false,
    captures: [],
    diagnoses: {},
    generalSteps: { status: "idle" },
    statusOverrides: {},
    completedSteps: {},
    skippedSteps: {},
    reportIds: [],
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

    setView: (view) => set({ view }),

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

    setDiagnosis: (id, entry) =>
      set((state) => ({ diagnoses: { ...state.diagnoses, [id]: entry } })),

    setGeneralSteps: (entry) =>
      set((state) => {
        if (entry.status !== "ready") return { generalSteps: entry };
        return {
          generalSteps: entry,
          completedSteps: { ...state.completedSteps, general: [] },
          skippedSteps: { ...state.skippedSteps, general: [] },
        };
      }),

    toggleChangeGrid: () =>
      set((state) => ({ showChangeGrid: !state.showChangeGrid })),

    toggleHidden: (id) =>
      set((state) => ({
        hiddenIds: state.hiddenIds.includes(id)
          ? state.hiddenIds.filter((x) => x !== id)
          : [...state.hiddenIds, id],
      })),

    overrideStatus: (id, override) =>
      set((state) => ({
        statusOverrides: { ...state.statusOverrides, [id]: override },
        detections: state.detections.map((d) =>
          d.id === id ? { ...d, ...override } : d,
        ),
      })),

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

    // A new scan context keeps the case the user chose and the camera they
    // are using (the stage would flicker and might pick another one).
    reset: () =>
      set((state) =>
        freshState({
          labCase: state.labCase,
          showChangeGrid: state.showChangeGrid,
          stage: state.stage,
          cameraDevices: state.cameraDevices,
          cameraDeviceId: state.cameraDeviceId,
          cameraActiveId: state.cameraActiveId,
          cameraAttempt: state.cameraAttempt,
        }),
      ),
  }));
}

export type SessionStore = ReturnType<typeof createSessionStore>;
