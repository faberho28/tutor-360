import { CropThumbnail } from "@/components/demo/crop-thumbnail";
import { DemoControls } from "@/components/demo/demo-controls";
import { DemoStage } from "@/components/demo/demo-stage";
import { readyVideo } from "../camera/capture-frame";
import { requestMockDiagnosis } from "../fixtures/mock-diagnosis";
import {
  closeMockModel,
  requestMockModel,
} from "../fixtures/mock-reconstruction";
import { REPORT_LATENCY_MS, reportDemo } from "../fixtures/mock-report";
import { MockAnalysisSource } from "../fixtures/mock-source";
import { DEMO_IMAGE, getScenario } from "../fixtures/scenarios";
import { loadImage } from "../overlay/compose-capture";
import type { ScanAnalysis, ScanServices } from "./types";

/**
 * Services of the demo page: every result here is simulated. Only /demo
 * (404 in production) provides them.
 */

export const demoServices: ScanServices = {
  requestDiagnosis: requestMockDiagnosis,
  requestModel: requestMockModel,
  closeModel: closeMockModel,
  reportAvailable: true,
  generateReport: () =>
    new Promise((resolve, reject) => {
      setTimeout(
        () =>
          reportDemo.fail
            ? reject(new Error("Simulated report failure"))
            : resolve(),
        REPORT_LATENCY_MS,
      );
    }),
  Thumbnail: CropThumbnail,
  createAnalysis(store, getVideo): ScanAnalysis {
    const mock = new MockAnalysisSource(store);
    // `/demo?source=camera` keeps the real camera and simulates the rest.
    const onDemoPhoto = store.getState().source === "demo";
    return {
      autoAvailable: onDemoPhoto,
      start: () => mock.start(),
      stop: () => mock.stop(),
      captureOnce: () => mock.captureOnce(),
      dispose: () => mock.dispose(),
      async snapshot() {
        if (!onDemoPhoto) return readyVideo(getVideo());
        await mock.captureOnce();
        return loadImage(DEMO_IMAGE.src);
      },
    };
  },
  retryAnalysis(store) {
    if (store.getState().source !== "demo") return;
    store.getState().setAnalysis({
      phase: "analyzing",
      latencyMs: null,
      startedAt: Date.now(),
    });
    window.setTimeout(() => {
      const state = store.getState();
      state.replaceDetections(getScenario("findings"));
      state.setAnalysis({ phase: "idle", latencyMs: 900, startedAt: null });
    }, 650);
  },
  DemoStage,
  DevTools: DemoControls,
};
