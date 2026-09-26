import Image from "next/image";

import type { SeasonPhoto } from "@/lib/climatology/season-photos";
import { requiresLicenseNotice } from "@/lib/photos/license-notice";

interface SeasonPhotoFigureProps {
  photo: SeasonPhoto;
  priority?: boolean;
  className?: string;
}

export function SeasonPhotoFigure({ photo, priority = false, className }: SeasonPhotoFigureProps) {
  return (
    <figure className={className}>
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-[#11100D]/15 bg-[#EEE3C9]">
        <Image
          src={photo.src}
          alt={photo.alt}
          fill
          priority={priority}
          sizes="(min-width: 1024px) 460px, 100vw"
          className="object-cover"
        />
      </div>
      <figcaption className="mt-2 text-xs leading-5 text-[#655C4C]">
        {photo.caption}{" "}
        <a href={photo.sourceUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
          {`Photo: ${photo.creator}`}
        </a>
        {/* Public-domain photos need no licence label; CC photos were cropped by the downloader. */}
        {requiresLicenseNotice(photo.licenseCode) && (
          <>
            {", "}
            <a
              href={photo.licenseUrl}
              target="_blank"
              rel="license noopener noreferrer"
              className="underline underline-offset-2"
            >
              {photo.licenseCode}
            </a>
            {", cropped"}
          </>
        )}
      </figcaption>
    </figure>
  );
}
