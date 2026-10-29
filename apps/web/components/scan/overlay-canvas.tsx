"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { drawOverlay, hitTest, type OverlayLayout } from "@/lib/overlay/draw";
import { drawTrackingDebug } from "@/lib/overlay/draw-debug";
import { getTrackingDebug, subscribeTrackingDebug } from "@/lib/tracking/debug";
import { OVERLAY } from "@/lib/overlay-theme";
import { useSession, useSessionStore } from "@/lib/session/session-provider";

/**
 * Canvas on top of the video: masks, labels and tap-to-select. It matches the
 * size of the stage and redraws on resize, selection or data changes. The
 * animation loop only runs while some mask pulses.
 */
export function OverlayCanvas({
  source,
}: {
  source: { width: number; height: number };
}) {
  const detections = useSession((s) => s.detections);
  const selectedId = useSession((s) => s.selectedId);
  const select = useSession((s) => s.select);
  const clearSelection = useSession((s) => s.clearSelection);
  const stale = useSession((s) => s.analysis.stale);
  const store = useSessionStore();
  const reducedMotion = useReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<OverlayLayout | null>(null);
  // The tracking moves the masks up to 30 times a second: it goes around React
  // (no re-render, no new effect) and only asks the canvas to redraw.
  const viewRef = useRef(store.getState().view);
  const redrawRef = useRef<() => void>(() => {});
  const fontRef = useRef<string | null>(null);
  // Development only (D): the debug view of the tracking.
  const debugRef = useRef(false);
  const [size, setSize] = useState({ w: 0, h: 0 });
  // Mouse hover only: touch has no hover, a tap selects instead.
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return;
      setSize({
        w: Math.round(entry.contentRect.width),
        h: Math.round(entry.contentRect.height),
      });
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);

  // The canvas buffer is only reallocated when its size really changes:
  // assigning width or height clears and reallocates it even with the same value.
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const dpr = window.devicePixelRatio || 1;
    const width = Math.round(size.w * dpr);
    const height = Math.round(size.h * dpr);
    if (canvas.width !== width) canvas.width = width;
    if (canvas.height !== height) canvas.height = height;
  }, [size]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    // Reading the computed style forces a layout: once is enough.
    fontRef.current ??= `500 12px ${getComputedStyle(document.body).fontFamily}`;
    const font = fontRef.current;
    const animate =
      !reducedMotion &&
      !stale &&
      detections.some((d) => OVERLAY[d.status].pulse);
    let frame = 0;

    const draw = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutRef.current = drawOverlay(ctx, {
        width: size.w,
        height: size.h,
        source,
        detections,
        selectedId,
        hoveredId,
        now,
        reducedMotion,
        font,
        stale,
        view: viewRef.current,
      });
      if (process.env.NODE_ENV !== "production" && debugRef.current) {
        drawTrackingDebug(ctx, getTrackingDebug(), {
          width: size.w,
          height: size.h,
          source,
        });
      }
    };
    const loop = (now: number) => {
      draw(now);
      if (animate) frame = requestAnimationFrame(loop);
    };
    loop(performance.now());
    // While something pulses the loop already redraws every frame.
    redrawRef.current = () => {
      if (!animate) draw(performance.now());
    };

    return () => {
      cancelAnimationFrame(frame);
      redrawRef.current = () => {};
    };
  }, [detections, selectedId, hoveredId, size, source, reducedMotion, stale]);

  // The tracking's motions: redraw on the next animation frame, once however
  // many times they changed before it.
  useEffect(() => {
    let pending = 0;
    const schedule = () => {
      if (pending) return;
      pending = requestAnimationFrame(() => {
        pending = 0;
        redrawRef.current();
      });
    };
    const unsubscribe = store.subscribe((state, previous) => {
      if (state.view === previous.view) return;
      viewRef.current = state.view;
      schedule();
    });

    // Development only: D shows the corners the tracking follows.
    let stopDebug = () => {};
    if (process.env.NODE_ENV !== "production") {
      const unsubscribeDebug = subscribeTrackingDebug(() => {
        if (debugRef.current) schedule();
      });
      const onKey = (event: KeyboardEvent) => {
        if (event.key.toLowerCase() !== "d") return;
        if (event.ctrlKey || event.metaKey || event.altKey) return;
        const target = event.target;
        if (
          target instanceof Element &&
          target.closest("input, textarea, select, [contenteditable='true']")
        ) {
          return;
        }
        debugRef.current = !debugRef.current;
        schedule();
      };
      window.addEventListener("keydown", onKey);
      stopDebug = () => {
        unsubscribeDebug();
        window.removeEventListener("keydown", onKey);
      };
    }

    return () => {
      unsubscribe();
      stopDebug();
      cancelAnimationFrame(pending);
    };
  }, [store]);

  function pointFrom(event: PointerEvent<HTMLCanvasElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  return (
    <canvas
      ref={canvasRef}
      role="img"
      aria-label="Máscaras de los componentes detectados"
      className="absolute inset-0 size-full touch-manipulation"
      onPointerMove={(event) => {
        if (event.pointerType === "touch") return;
        const { x, y } = pointFrom(event);
        const id = hitTest(layoutRef.current, x, y);
        event.currentTarget.style.cursor = id ? "pointer" : "default";
        setHoveredId((current) => (current === id ? current : id));
      }}
      onPointerLeave={() => setHoveredId(null)}
      onPointerCancel={() => setHoveredId(null)}
      onClick={(event) => {
        const rect = event.currentTarget.getBoundingClientRect();
        const id = hitTest(
          layoutRef.current,
          event.clientX - rect.left,
          event.clientY - rect.top,
        );
        if (id) select(id);
        else clearSelection();
      }}
    />
  );
}
