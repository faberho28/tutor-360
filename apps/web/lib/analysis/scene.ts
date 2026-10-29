import { z } from "zod";
import { COMPONENT_STATUSES } from "../component-status";

/** Most objects one analysis will segment: bounds cost and latency. */
export const MAX_SCENE_OBJECTS = 12;

/** Side of the grid Muse Spark reports boxes on. */
export const GRID = 1000;

/**
 * One thing the AI found in the frame, before it is segmented. This is what
 * Muse Spark returns (validated) and what SAM receives as an object prompt.
 */
export const sceneObjectSchema = z.object({
  /** Name for the user, in Spanish. */
  label: z.string().trim().min(1).max(60),
  /** Short English noun phrase naming the object. */
  concept: z.string().trim().min(1).max(60),
  /** [x_min, y_min, x_max, y_max] on a 0..1000 grid over the frame. */
  box: z.tuple([
    z.number().min(0).max(GRID),
    z.number().min(0).max(GRID),
    z.number().min(0).max(GRID),
    z.number().min(0).max(GRID),
  ]),
  status: z.enum(COMPONENT_STATUSES),
  /** One sentence in Spanish saying why; empty when the object is fine. */
  reason: z.string().trim().max(200),
});

export type SceneObject = z.infer<typeof sceneObjectSchema>;

export const sceneSchema = z.object({
  objects: z.array(sceneObjectSchema),
});
