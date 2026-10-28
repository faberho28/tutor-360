"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChangeDetector,
  type ChangeReading,
} from "@/lib/vision/change-detector";
import { sampleVideo } from "@/lib/vision/sample-frame";

const SAMPLE_INTERVAL_MS = 250;

const WAITING: ChangeReading = {
  status: "calibrating",
  motion: 0,
  drift: 0,
  cells: [],
  heat: [],
  adoptions: 0,
};

function sameReading(a: ChangeReading, b: ChangeReading) {
  return (
    a.status === b.status &&
    a.adoptions === b.adoptions &&
    a.cells.length === b.cells.length &&
    a.cells.every((cell, i) => cell === b.cells[i])
  );
}

/**
 * Runs the local change detector over the live video. The state only updates
 * when the status, the changed regions or the heat map visibly change.
 */
export function useChangeDetection(
  getVideo: () => HTMLVideoElement | null,
  enabled: boolean,
) {
  const detector = useRef(new ChangeDetector());
  const getVideoRef = useRef(getVideo);
  const [reading, setReading] = useState<ChangeReading>(WAITING);

  useEffect(() => {
    getVideoRef.current = getVideo;
  });

  useEffect(() => {
    if (!enabled) return;
    detector.current.reset();
    const id = window.setInterval(() => {
      const video = getVideoRef.current();
      if (!video || document.hidden) return;
      const sig = sampleVideo(video);
      if (!sig) return;
      const next = detector.current.push(sig, performance.now());
      setReading((prev) => (sameReading(prev, next) ? prev : next));
    }, SAMPLE_INTERVAL_MS);
    return () => {
      window.clearInterval(id);
      setReading(WAITING);
    };
  }, [enabled]);

  const reset = useCallback(() => {
    setReading(detector.current.reset());
  }, []);

  return { reading, reset };
}
