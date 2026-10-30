"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ChangeDetector,
  type ChangeReading,
} from "@/lib/vision/change-detector";
import { sampleVideo } from "@/lib/vision/sample-frame";

/**
 * How often the video is looked at: 10 times a second (about 9 ms of compute
 * each, measured). `THRESHOLDS.confirm` counts looks, so it is set for this
 * rate: change one and the other must follow.
 */
const SAMPLE_INTERVAL_MS = 100;
/** The wait after a look is at least this many times what the look took. */
const BUSY_FACTOR = 5;

const WAITING: ChangeReading = {
  status: "calibrating",
  motion: 0,
  drift: 0,
  cells: [],
  heat: [],
  adoptions: 0,
};

function sameReading(a: ChangeReading, b: ChangeReading, trackHeat: boolean) {
  if (
    trackHeat &&
    (a.heat.length !== b.heat.length ||
      a.heat.some((diff, i) => diff !== b.heat[i]))
  ) {
    return false;
  }
  return (
    a.status === b.status &&
    a.adoptions === b.adoptions &&
    a.cells.length === b.cells.length &&
    a.cells.every((cell, i) => cell === b.cells[i])
  );
}

/**
 * Runs the local change detector over the live video. The state only updates
 * when the status or the changed regions change; the heat map (every cell's
 * diff) only counts when `trackHeat` says something is drawing it.
 */
export function useChangeDetection(
  getVideo: () => HTMLVideoElement | null,
  enabled: boolean,
  trackHeat = false,
) {
  const detector = useRef(new ChangeDetector());
  const getVideoRef = useRef(getVideo);
  const trackHeatRef = useRef(trackHeat);
  const [reading, setReading] = useState<ChangeReading>(WAITING);

  useEffect(() => {
    getVideoRef.current = getVideo;
    trackHeatRef.current = trackHeat;
  });

  useEffect(() => {
    if (!enabled) return;
    detector.current.reset();
    let timer = 0;
    const look = () => {
      const started = performance.now();
      const video = getVideoRef.current();
      const sig = video && !document.hidden ? sampleVideo(video) : null;
      if (sig) {
        const next = detector.current.push(sig, started);
        setReading((prev) =>
          sameReading(prev, next, trackHeatRef.current) ? prev : next,
        );
      }
      // A look must never take more than a fifth of the main thread: a slow
      // machine looks less often instead of freezing the buttons and dialogs.
      const took = performance.now() - started;
      timer = window.setTimeout(
        look,
        Math.max(SAMPLE_INTERVAL_MS, took * BUSY_FACTOR),
      );
    };
    timer = window.setTimeout(look, SAMPLE_INTERVAL_MS);
    return () => {
      window.clearTimeout(timer);
      setReading(WAITING);
    };
  }, [enabled]);

  const reset = useCallback(() => {
    setReading(detector.current.reset());
  }, []);

  return { reading, reset };
}
