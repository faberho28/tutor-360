import type { ComponentStatus } from "../component-status";
import type { Diagnosis } from "../types";

export type DiagnoseInput = {
  /** Name of the object (Spanish) and what the scene reading said about it. */
  label: string;
  status: ComponentStatus;
  reason: string | null;
  /** `data:image/jpeg;base64,...` of the component crop. */
  cropDataUrl: string;
  signal?: AbortSignal;
};

/** Contract only: the Muse Spark implementation lands with HU-20. */
export interface Diagnoser {
  diagnose(input: DiagnoseInput): Promise<Diagnosis>;
}
