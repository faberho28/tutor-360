"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { useReducedMotion } from "@/hooks/use-reduced-motion";
import { drawOverlay, hitTest, type OverlayLayout } from "@/lib/overlay/draw";
import { OVERLAY } from "@/lib/overlay-theme";
import { useSession } from "@/lib/session/session-provider";

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
  const reducedMotion = useReducedMotion();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const layoutRef = useRef<OverlayLayout | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || size.w === 0 || size.h === 0) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(size.w * dpr);
    canvas.height = Math.round(size.h * dpr);

    const font = `500 12px ${getComputedStyle(document.body).fontFamily}`;
    const animate =
      !reducedMotion && detections.some((d) => OVERLAY[d.cls].pulse);
    let frame = 0;

    const render = (now: number) => {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      layoutRef.current = drawOverlay(ctx, {
        width: size.w,
        height: size.h,
        source,
        detections,
        selectedId,
        now,
        reducedMotion,
        font,
      });
      if (animate) frame = requestAnimationFrame(render);
    };
    render(performance.now());

    return () => cancelAnimationFrame(frame);
  }, [detections, selectedId, size, source, reducedMotion]);

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
        const { x, y } = pointFrom(event);
        event.currentTarget.style.cursor = hitTest(layoutRef.current, x, y)
          ? "pointer"
          : "default";
      }}
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
