import type { CapturedFrame } from "../camera/capture-frame";
import type { SessionStore } from "../session/store";

const frames = new WeakMap<SessionStore, CapturedFrame>();

/** The frame the models looked at last: the diagnosis crops are cut from it. */
export function setAnalyzedFrame(store: SessionStore, frame: CapturedFrame) {
  frames.set(store, frame);
}

export function clearAnalyzedFrame(store: SessionStore) {
  frames.delete(store);
}

export function getAnalyzedFrame(store: SessionStore): CapturedFrame | null {
  return frames.get(store) ?? null;
}
