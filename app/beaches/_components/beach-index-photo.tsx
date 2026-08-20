import Image from "next/image";

import { PhotoAttribution } from "@/components/photos/photo-attribution";
import { getProxiedImageUrl } from "@/lib/utils/image-utils";
import { publicImageExists } from "@/lib/utils/public-image-exists";
import { cn } from "@/lib/utils";

export interface BeachIndexPhotoData {
  src: string;
  alt: string;
  attributionHtml?: string | null;
}

interface BeachIndexPhotoProps {
  photo: BeachIndexPhotoData | null;
  fallbackLabel: string;
  className?: string;
  imageClassName?: string;
  priority?: boolean;
  sizes: string;
}

export function BeachIndexPhoto({
  photo,
  fallbackLabel,
  className,
  imageClassName,
  priority = false,
  sizes,
}: BeachIndexPhotoProps) {
  const hasPhoto = Boolean(photo && publicImageExists(photo.src));

  return (
    <figure className={cn("min-w-0", className)}>
      <div className="halftone-photo relative aspect-[4/3] overflow-hidden border-2 border-[#11100D] bg-[#D9C49C]">
        {hasPhoto && photo ? (
          <Image
            src={getProxiedImageUrl(photo.src)}
            alt={photo.alt}
            fill
            priority={priority || undefined}
            sizes={sizes}
            className={cn("object-cover", imageClassName)}
          />
        ) : (
          <div
            role="img"
            aria-label={`${fallbackLabel} photo coming soon`}
            className="flex h-full w-full items-center justify-center bg-[#F0E5CC] p-4 text-center"
          >
            <div className="stamp-circle rot-1 !h-24 !w-24 !text-xs sm:!h-28 sm:!w-28">
              <span>Field photo</span>
              <span className="lg">Soon</span>
            </div>
          </div>
        )}
      </div>
      {hasPhoto && photo?.attributionHtml ? (
        <figcaption className="mt-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[#11100D]/65">
          Credit: {" "}
          <PhotoAttribution
            attribution={null}
            attributionHtml={photo.attributionHtml}
          />
        </figcaption>
      ) : null}
    </figure>
  );
}
