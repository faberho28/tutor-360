import { toast } from "sonner";
import { RealAnalysis } from "../analysis/real-analysis";
import { requestDiagnosis } from "../diagnosis/request-diagnosis";
import { generateReport } from "../report/generate-report";
import type { ScanServices } from "./types";

/**
 * Services of the scan page: where a real implementation does not exist yet,
 * it says so instead of faking a result.
 */
export const realServices: ScanServices = {
  // The diagnosis also starts by itself after Spark's review (autoDiagnose);
  // selecting a part that has none asks for it here.
  requestDiagnosis,
  // The real 3D reconstruction arrives with HU-30.
  requestModel() {
    toast("El modelo 3D estará disponible pronto");
  },
  closeModel(store) {
    store.getState().setModel3d({ status: "idle" });
  },
  // The PDF is built in the browser (HU-26, HU-27): the pictures stay local.
  reportAvailable: true,
  generateReport,
  createAnalysis: (store, getVideo) => new RealAnalysis(store, getVideo),
};
