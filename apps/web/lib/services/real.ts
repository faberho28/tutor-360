import { toast } from "sonner";
import { PlaceholderThumbnail } from "@/components/scan/placeholder-thumbnail";
import { RealAnalysis } from "../analysis/real-analysis";
import type { ScanServices } from "./types";

/**
 * Services of the real page. This file must not import anything from
 * lib/fixtures or components/demo (ESLint enforces it): where a real
 * implementation does not exist yet, it says so instead of faking a result.
 */
export const realServices: ScanServices = {
  // The real diagnosis arrives with HU-20 and HU-21.
  requestDiagnosis(store, detection) {
    store.getState().setDiagnosis(detection.id, { status: "unavailable" });
  },
  // The real 3D reconstruction arrives with HU-30.
  requestModel() {
    toast("El modelo 3D estará disponible pronto");
  },
  closeModel(store) {
    store.getState().setModel3d({ status: "idle" });
  },
  // The report arrives with HU-26 and HU-27.
  reportAvailable: false,
  generateReport: () =>
    Promise.reject(new Error("The report is not available yet")),
  // Cut from the analyzed frame once the diagnosis crops exist (HU-21).
  Thumbnail: PlaceholderThumbnail,
  createAnalysis: (store, getVideo) => new RealAnalysis(store, getVideo),
  DemoStage: null,
  DevTools: null,
};
