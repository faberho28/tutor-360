import Image from "next/image";
import { DEMO_IMAGE } from "@/lib/fixtures/scenarios";

/** What the overlay is normalized against: the demo photo for now. */
export const DEMO_SOURCE = {
  width: DEMO_IMAGE.width,
  height: DEMO_IMAGE.height,
} as const;

/** Demo photo shown where the camera video will go (HU-14). */
export function DemoImageSource() {
  return (
    <Image
      src={DEMO_IMAGE.src}
      alt="Foto de ejemplo de una placa madre"
      fill
      priority
      unoptimized
      sizes="100vw"
      className="pointer-events-none object-cover select-none"
    />
  );
}
