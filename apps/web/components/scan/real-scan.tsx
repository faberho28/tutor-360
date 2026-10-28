"use client";

import { ScanScreen } from "@/components/scan/scan-screen";
import { ServicesProvider } from "@/lib/services/context";
import { realServices } from "@/lib/services/real";
import { SessionProvider } from "@/lib/session/session-provider";

/**
 * The real scan screen: real camera and no simulated results. Nothing here may
 * depend on lib/fixtures or components/demo.
 */
export function RealScan() {
  return (
    <ServicesProvider services={realServices}>
      <SessionProvider>
        <ScanScreen />
      </SessionProvider>
    </ServicesProvider>
  );
}
