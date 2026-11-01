"use client";

import { ScanScreen } from "@/components/scan/scan-screen";
import type { LabCaseSnapshot } from "@/lib/lab/cases";
import { ServicesProvider } from "@/lib/services/context";
import { realServices } from "@/lib/services/real";
import { SessionProvider } from "@/lib/session/session-provider";
import type { TutorLevel } from "@/lib/tutor/levels";

/**
 * The scan screen: real camera and no simulated results.
 */
export function RealScan({
  labCase,
  level,
}: {
  labCase: LabCaseSnapshot;
  level: TutorLevel;
}) {
  return (
    <ServicesProvider services={realServices}>
      <SessionProvider initialState={{ labCase, level }}>
        <ScanScreen />
      </SessionProvider>
    </ServicesProvider>
  );
}
