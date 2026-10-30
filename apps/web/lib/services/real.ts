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
  // The PDF is built in the browser (HU-26, HU-27): the pictures stay local.
  reportAvailable: true,
  generateReport,
  createAnalysis: (store, getVideo) => new RealAnalysis(store, getVideo),
};
