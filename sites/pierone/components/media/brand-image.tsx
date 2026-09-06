import Image from "next/image";

import type { ImageSlot } from "@/lib/images";

const aspectClass = {
  "3/4": "aspect-[3/4]",
  "4/5": "aspect-[4/5]",
  "3/2": "aspect-[3/2]",
  "16/9": "aspect-video",
  "1/1": "aspect-square",
} as const;

export function BrandImage({
  image,
  className = "",
  overlay = false,
  priority = false,
  sizes = "(min-width: 1024px) 50vw, 100vw",
  radius = true,
  fillParent = false,
}: {
  image: ImageSlot;
  className?: string;
  overlay?: boolean;
  priority?: boolean;
  sizes?: string;
  radius?: boolean;
  fillParent?: boolean;
}) {
  return (
    <div
      className={`relative overflow-hidden ${radius ? "rounded-[6px]" : ""} ${fillParent ? "h-full w-full" : aspectClass[image.aspect]} ${className}`}
    >
      <Image
        src={image.src}
        alt={image.alt}
        fill
        priority={priority}
        sizes={sizes}
        className="object-cover"
        unoptimized
      />
      {overlay ? <div className="absolute inset-0 bg-navy/25" aria-hidden="true" /> : null}
    </div>
  );
}
