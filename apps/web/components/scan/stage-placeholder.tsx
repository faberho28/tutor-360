import Image from "next/image";
import { DEMO_IMAGE } from "@/lib/fixtures/scenarios";

/**
 * Temporary stage with the demo photo. CameraStage (HU-05) replaces it with
 * the video and the mask overlay.
 */
export function StagePlaceholder() {
  return (
    <div className="relative size-full overflow-hidden rounded-3xl bg-black">
      <Image
        src={DEMO_IMAGE.src}
        alt="Foto de ejemplo de una placa madre"
        fill
        priority
        unoptimized
        sizes="100vw"
        className="object-cover"
      />
    </div>
  );
}
