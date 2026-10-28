"use client";

import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { LABELS_ES } from "@/lib/overlay-theme";
import { useSession } from "@/lib/session/session-provider";

export function useNewAnomalyToast() {
  const detections = useSession((s) => s.detections);
  const announced = useRef<Set<string> | null>(null);

  useEffect(() => {
    const anomalies = detections.filter(
      (detection) => detection.status === "anomaly",
    );
    if (announced.current === null) {
      announced.current = new Set(anomalies.map((detection) => detection.id));
      return;
    }

    for (const detection of anomalies) {
      if (announced.current.has(detection.id)) continue;
      announced.current.add(detection.id);
      toast.warning(`${LABELS_ES[detection.cls]} detectado`, {
        id: `anomaly-${detection.id}`,
      });
    }
  }, [detections]);
}
