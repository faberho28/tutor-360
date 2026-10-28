"use client";

import "@google/model-viewer";
import { useReducedMotion } from "@/hooks/use-reduced-motion";

declare module "react" {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace JSX {
    interface IntrinsicElements {
      "model-viewer": React.DetailedHTMLProps<
        React.HTMLAttributes<HTMLElement>,
        HTMLElement
      > & {
        src?: string;
        alt?: string;
        "camera-controls"?: boolean;
        "auto-rotate"?: boolean;
        "touch-action"?: string;
        "shadow-intensity"?: string;
      };
    }
  }
}

/**
 * The 3D viewer. It lives in its own module so the library is only downloaded
 * when the dialog needs it (loaded with next/dynamic, ssr: false).
 */
export default function ModelViewer({
  glbUrl,
  alt,
}: {
  glbUrl: string;
  alt: string;
}) {
  const reducedMotion = useReducedMotion();

  return (
    <model-viewer
      src={glbUrl}
      alt={alt}
      camera-controls
      auto-rotate={reducedMotion ? undefined : true}
      touch-action="pan-y"
      shadow-intensity="1"
      style={{ width: "100%", height: "100%" }}
    />
  );
}
