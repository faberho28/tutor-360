"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { coverTransform } from "@/lib/overlay/geometry";

/** Diameter of the lens, in CSS pixels. */
const LENS_SIZE = 200;
const MIN_ZOOM = 2;
const MAX_ZOOM = 8;
const DEFAULT_ZOOM = 3;
const WHEEL_STEP = 0.25;
/** Image enhancement of the lens (it never touches what the models receive). */
const CONTRAST = 1.15;
const SATURATION = 1.1;
/** How much of the detail (picture minus its blurred copy) is added back. */
const SHARPEN_AMOUNT = 1.2;
/** Blur radius of the unsharp mask, per unit of zoom and device pixel. */
const SHARPEN_RADIUS = 0.4;

/**
 * Unsharp mask: adds back the difference between the picture and a blurred
 * copy of it. It brings out the edges that the enlargement softened without
 * inventing detail the camera did not capture.
 */
function sharpen(
  ctx: CanvasRenderingContext2D,
  scratch: HTMLCanvasElement,
  side: number,
  radius: number,
  amount: number,
) {
  const soft = scratch.getContext("2d", { willReadFrequently: true });
  if (!soft) return;
  if (scratch.width !== side) scratch.width = side;
  if (scratch.height !== side) scratch.height = side;
  soft.clearRect(0, 0, side, side);
  soft.filter = `blur(${radius}px)`;
  soft.drawImage(ctx.canvas, 0, 0);
  soft.filter = "none";

  const sharp = ctx.getImageData(0, 0, side, side);
  const blurred = soft.getImageData(0, 0, side, side).data;
  const px = sharp.data;
  // The array is clamped to 0..255 on assignment.
  for (let i = 0; i < px.length; i += 4) {
    px[i] = px[i]! + amount * (px[i]! - blurred[i]!);
    px[i + 1] = px[i + 1]! + amount * (px[i + 1]! - blurred[i + 1]!);
    px[i + 2] = px[i + 2]! + amount * (px[i + 2]! - blurred[i + 2]!);
  }
  ctx.putImageData(sharp, 0, 0);
}

/**
 * A round lens that follows the pointer over the stage and shows the camera
 * and the masks enlarged under it, and goes away over the buttons and floating cards. It only draws: the geometry, the tracking
 * and what the models receive are not touched. The wheel changes the zoom.
 */
export function Magnifier({
  container,
  videoRef,
  overlayRef,
  source,
}: {
  /** The stage: the lens is drawn in it and follows the pointer over it. */
  container: HTMLElement | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  /** The canvas with the masks, copied into the lens. */
  overlayRef: RefObject<HTMLCanvasElement | null>;
  source: { width: number; height: number };
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Scratch canvas for the blurred copy of the sharpening.
  const scratchRef = useRef<HTMLCanvasElement | null>(null);
  // Pointer and zoom change many times a second: they stay out of React state,
  // only whether the lens is visible does.
  const pointer = useRef<{ x: number; y: number } | null>(null);
  const zoom = useRef(DEFAULT_ZOOM);
  const [visible, setVisible] = useState(false);
  const [zoomLabel, setZoomLabel] = useState(DEFAULT_ZOOM);

  useEffect(() => {
    if (!container) return;

    const place = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      // Only over the picture: on the buttons and the floating cards (the
      // control bar, the guide, the corner controls) the lens goes away.
      if (event.target !== overlayRef.current) {
        pointer.current = null;
        setVisible(false);
        return;
      }
      const rect = container.getBoundingClientRect();
      pointer.current = {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
      };
      setVisible(true);
    };
    const hide = () => {
      pointer.current = null;
      setVisible(false);
    };
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const next = zoom.current + (event.deltaY < 0 ? WHEEL_STEP : -WHEEL_STEP);
      zoom.current = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, next));
      setZoomLabel(zoom.current);
    };

    container.addEventListener("pointermove", place);
    container.addEventListener("pointerleave", hide);
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      container.removeEventListener("pointermove", place);
      container.removeEventListener("pointerleave", hide);
      container.removeEventListener("wheel", onWheel);
    };
  }, [container, overlayRef]);

  useEffect(() => {
    if (!container || !visible) return;
    let frame = 0;

    const draw = () => {
      frame = requestAnimationFrame(draw);
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const at = pointer.current;
      if (!canvas || !video || !at || source.width === 0) return;
      const ctx = canvas.getContext("2d", { willReadFrequently: true });
      if (!ctx) return;

      const dpr = window.devicePixelRatio || 1;
      const side = Math.round(LENS_SIZE * dpr);
      if (canvas.width !== side) canvas.width = side;
      if (canvas.height !== side) canvas.height = side;

      // The part of the stage under the lens, in stage pixels.
      const half = LENS_SIZE / 2 / zoom.current;
      const x0 = at.x - half;
      const y0 = at.y - half;
      const span = half * 2;

      const cover = coverTransform(
        source.width,
        source.height,
        container.clientWidth,
        container.clientHeight,
      );

      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, side, side);
      try {
        ctx.filter = `contrast(${CONTRAST}) saturate(${SATURATION})`;
        ctx.drawImage(
          video,
          (x0 - cover.offsetX) / cover.scale,
          (y0 - cover.offsetY) / cover.scale,
          span / cover.scale,
          span / cover.scale,
          0,
          0,
          side,
          side,
        );
        ctx.filter = "none";
        scratchRef.current ??= document.createElement("canvas");
        sharpen(
          ctx,
          scratchRef.current,
          side,
          Math.max(1, zoom.current * dpr * SHARPEN_RADIUS),
          SHARPEN_AMOUNT,
        );
        const overlay = overlayRef.current;
        if (overlay && overlay.width > 0) {
          const k = overlay.width / container.clientWidth;
          ctx.drawImage(
            overlay,
            x0 * k,
            y0 * k,
            span * k,
            span * k,
            0,
            0,
            side,
            side,
          );
        }
      } catch {
        ctx.filter = "none";
        // The video has no frame yet: the black background stays.
      }

      // A cross in the center marks the point being looked at.
      const c = side / 2;
      const arm = 6 * dpr;
      ctx.strokeStyle = "rgba(255,255,255,0.9)";
      ctx.lineWidth = Math.max(1, dpr);
      ctx.beginPath();
      ctx.moveTo(c - arm, c);
      ctx.lineTo(c + arm, c);
      ctx.moveTo(c, c - arm);
      ctx.lineTo(c, c + arm);
      ctx.stroke();

      canvas.style.transform = `translate(${at.x - LENS_SIZE / 2}px, ${at.y - LENS_SIZE / 2}px)`;
    };

    frame = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(frame);
  }, [container, visible, videoRef, overlayRef, source]);

  if (!visible) return null;

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
    >
      <canvas
        ref={canvasRef}
        style={{ width: LENS_SIZE, height: LENS_SIZE }}
        className="absolute top-0 left-0 rounded-full bg-black shadow-lg ring-2 ring-white/80"
      />
      <span className="absolute right-3 bottom-20 rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white tabular-nums backdrop-blur">
        {zoomLabel.toFixed(2).replace(/\.?0+$/, "")}×
      </span>
    </div>
  );
}
