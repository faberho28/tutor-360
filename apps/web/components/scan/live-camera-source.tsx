"use client";

import { Loader } from "lucide-react";
import { useEffect, type RefObject } from "react";

/** The camera video, filling the stage. */
export function LiveCameraSource({
  stream,
  videoRef,
  onDimensions,
}: {
  stream: MediaStream | null;
  videoRef: RefObject<HTMLVideoElement | null>;
  onDimensions: (size: { width: number; height: number }) => void;
}) {
  useEffect(() => {
    const video = videoRef.current;
    if (video) video.srcObject = stream;
  }, [stream, videoRef]);

  return (
    <>
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        aria-label="Video de la cámara"
        onLoadedMetadata={(event) =>
          onDimensions({
            width: event.currentTarget.videoWidth,
            height: event.currentTarget.videoHeight,
          })
        }
        className="pointer-events-none absolute inset-0 size-full object-cover"
      />
      {stream ? null : (
        <div className="absolute inset-0 flex items-center justify-center gap-3 text-white">
          <Loader
            aria-hidden="true"
            className="size-6 motion-safe:animate-spin"
          />
          <p role="status" className="text-xs font-medium">
            Conectando con la cámara…
          </p>
        </div>
      )}
    </>
  );
}
