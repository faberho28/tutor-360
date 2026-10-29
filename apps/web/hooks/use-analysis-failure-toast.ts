"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { copy } from "@/lib/copy";
import type { ScanAnalysis } from "@/lib/services/types";
import { useSession } from "@/lib/session/session-provider";

const TOAST_ID = "analysis-failure";

/**
 * Tells the user, in a toast that stays until it is solved or closed, that the
 * analysis failed. It follows the store, so the real and the demo analysis
 * share it. One toast: a failure that repeats updates it instead of stacking.
 */
export function useAnalysisFailureToast(analysis: ScanAnalysis) {
  const phase = useSession((s) => s.analysis.phase);
  const reason = useSession((s) => s.analysis.reason);

  useEffect(() => {
    if (phase !== "offline" && phase !== "quota" && phase !== "error") {
      toast.dismiss(TOAST_ID);
      return;
    }

    const title = copy.status[phase];
    // The specific reason first when it says more than the title does.
    const detail = reason && reason !== title ? `${reason}. ` : "";
    const show = phase === "error" ? toast.error : toast.warning;
    show(title, {
      id: TOAST_ID,
      description: `${detail}${copy.failure[phase]}`,
      duration: Infinity,
      closeButton: true,
      // Without credits a retry only fails again: the user reactivates later.
      action:
        phase === "quota"
          ? undefined
          : { label: "Reintentar", onClick: () => analysis.retry() },
    });
  }, [phase, reason, analysis]);

  // Leaving the scanner must not leave its failure on another screen.
  useEffect(() => () => void toast.dismiss(TOAST_ID), []);
}
