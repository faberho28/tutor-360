import type { ComponentClass } from "../component-status";
import type { Diagnosis } from "../types";

export type DiagnoseInput = {
  cls: ComponentClass;
  /** `data:image/jpeg;base64,...` of the component crop. */
  cropDataUrl: string;
  signal?: AbortSignal;
};

/** Contract only: the Muse Spark implementation lands with HU-20. */
export interface Diagnoser {
  diagnose(input: DiagnoseInput): Promise<Diagnosis>;
}
