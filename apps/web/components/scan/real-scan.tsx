"use client";

import { ScanScreen } from "@/components/scan/scan-screen";
import type { LabCaseSnapshot } from "@/lib/lab/cases";
import { ServicesProvider } from "@/lib/services/context";
import { realServices } from "@/lib/services/real";
import { SessionProvider } from "@/lib/session/session-provider";

/**
 * The real scan screen: real camera and no simulated results. Nothing here may
 * depend on lib/fixtures or components/demo.
 */
export function RealScan({ labCase }: { labCase: LabCaseSnapshot }) {
  return (
    <ServicesProvider services={realServices}>
      <SessionProvider initialState={{ labCase }}>
        <ScanScreen />
      </SessionProvider>
    </ServicesProvider>
  );
}
