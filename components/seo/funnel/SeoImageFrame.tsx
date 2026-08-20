import Image from "next/image";
import { ImageIcon } from "lucide-react";

import type { SeoImage } from "@/lib/seo/funnel-pages";
import { publicImageExists } from "@/lib/utils/public-image-exists";

interface SeoImageFrameProps {
  image: SeoImage;
  priority?: boolean;
  className?: string;
  showCaption?: boolean;
  sizes?: string;
}

export function SeoImageFrame({
  image,
  priority = false,
  className = "",
  showCaption = true,
  sizes = "(max-width: 768px) 100vw, 50vw",
}: SeoImageFrameProps) {
  const hasImage = publicImageExists(image.src);

  return (
    <figure className={className}>
      <div className="relative overflow-hidden rounded-lg border border-[#11100D]/10 bg-[#F4EBD8] shadow-[3px_4px_0_rgba(17,16,13,0.14)]">
        <div className="relative aspect-[4/3]">
          {hasImage ? (
            <Image
              src={image.src}
              alt={image.alt}
              fill
              priority={priority}
              sizes={sizes}
              className="object-cover"
            />
          ) : (
            <div
              role="img"
              aria-label={image.alt}
              className="relative flex h-full w-full items-center justify-center overflow-hidden bg-[#252D6B]"
            >
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_22%,rgba(247,142,66,0.28),transparent_34%),linear-gradient(135deg,rgba(37,45,107,0.96),rgba(27,87,116,0.88))]" />
              <div className="absolute bottom-0 left-0 right-0 h-1/3 bg-[#F4EBD8]/18" />
              <div className="relative flex h-16 w-16 items-center justify-center rounded-full border border-white/20 bg-white/10">
                <ImageIcon className="h-8 w-8 text-white/80" aria-hidden />
              </div>
            </div>
          )}
        </div>
      </div>
      {showCaption ? (
        <figcaption className="mt-2 text-sm text-gray-600">
          {image.caption}
        </figcaption>
      ) : null}
    </figure>
  );
}
