/**
 * Development only: what the local tracking sees, for the debug view of the
 * overlay (press D). It lives outside the store on purpose: it changes with
 * every tick and nothing but that view reads it.
 */
export type TrackingDebug = {
  status: "off" | "tracking" | "lost";
  /** Motions found: the main object's first. */
  objects: number;
  /** Whether a region differs from the analyzed frame. */
  changed: boolean;
  /** An analysis is in flight and its reference is being followed. */
  analyzing: boolean;
  /** How long the last look took, in ms. */
  tickMs: number;
  /** The corners followed, normalized, with the motion each belongs to (-1: none). */
  points: { x: number; y: number; object: number }[];
};

let snapshot: TrackingDebug | null = null;
const listeners = new Set<() => void>();

export function setTrackingDebug(next: TrackingDebug | null) {
  snapshot = next;
  listeners.forEach((listener) => listener());
}

export function getTrackingDebug(): TrackingDebug | null {
  return snapshot;
}

export function subscribeTrackingDebug(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
