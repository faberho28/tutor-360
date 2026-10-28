import { DEMO_IMAGE } from "@/lib/fixtures/scenarios";
import { cropRect } from "@/lib/overlay/crop";
import type { Detection } from "@/lib/types";

const SIZE = 40;

/**
 * 40x40 thumbnail of the detected part. For now it is cut from the demo photo
 * with CSS; with the real camera (HU-18) it is cut from the frame.
 */
export function CropThumbnail({ detection }: { detection: Detection }) {
  const crop = cropRect(detection.bbox, DEMO_IMAGE);
  const scale = SIZE / crop.side;

  return (
    <span
      aria-hidden="true"
      className="block size-10 shrink-0 rounded-lg border bg-muted bg-no-repeat"
      style={{
        backgroundImage: `url(${DEMO_IMAGE.src})`,
        backgroundSize: `${DEMO_IMAGE.width * scale}px ${DEMO_IMAGE.height * scale}px`,
        backgroundPosition: `${-crop.x * scale}px ${-crop.y * scale}px`,
      }}
    />
  );
}
