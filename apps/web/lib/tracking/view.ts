import type { Homography } from "./homography";

/**
 * Where the scene is now relative to the frame the detections were found on.
 * Each object moves by itself (the keyboard that was turned around, the cable
 * beside it that was not), so there is one motion per object and each detection
 * follows the one it was assigned. The detections themselves never change: the
 * overlay applies this when it draws.
 */
export type View = {
  /** The motions found, the main object's first. */
  models: readonly Homography[];
  /** Which motion each detection follows, by id (an unlisted one follows the first). */
  assign: Readonly<Record<string, number>>;
};

/** The motion a detection follows, or null when nothing is being tracked. */
export function viewFor(view: View | null, id: string): Homography | null {
  if (!view) return null;
  return view.models[view.assign[id] ?? 0] ?? view.models[0] ?? null;
}
