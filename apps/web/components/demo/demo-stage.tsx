import Image from "next/image";
import { OverlayCanvas } from "@/components/scan/overlay-canvas";
import { DEMO_IMAGE } from "@/lib/fixtures/scenarios";

/** What the overlay is normalized against: the demo photo. */
const DEMO_SOURCE = {
  width: DEMO_IMAGE.width,
  height: DEMO_IMAGE.height,
} as const;

/** The demo photo with its mask overlay, in place of the camera. */
export function DemoStage() {
  return (
    <>
      <Image
        src={DEMO_IMAGE.src}
        alt="Foto de ejemplo de una placa madre"
        fill
        priority
        unoptimized
        sizes="100vw"
        className="pointer-events-none object-cover select-none"
      />
      <OverlayCanvas source={DEMO_SOURCE} />
    </>
  );
}
