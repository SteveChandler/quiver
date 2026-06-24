import type { ReactElement } from "react";
import Image from "next/image";

import type { CamBeachWithRegion } from "@/actions/beach/cam-actions";
import {
  CAM_CARD_FALLBACK_IMAGE_URL,
  getDisplayCamThumbnailUrls,
} from "@/lib/media/cam-thumbnail";

interface CamsHeroContactSheetProps {
  beaches: CamBeachWithRegion[];
  label: string;
}

export function CamsHeroContactSheet({
  beaches,
  label,
}: CamsHeroContactSheetProps): ReactElement | null {
  const featuredBeaches = beaches.slice(0, 3).map((beach) => {
    const [imageUrl = CAM_CARD_FALLBACK_IMAGE_URL] = getDisplayCamThumbnailUrls(
      {
        cameraUrl: beach.camera_url,
        thumbnailUrl: beach.thumbnail_url,
        fallbackImageUrl: beach.photo_url,
      },
    );

    return {
      ...beach,
      imageUrl,
    };
  });

  if (featuredBeaches.length === 0) return null;

  return (
    <aside className="relative lg:pt-8" aria-label={label}>
      <div
        className="absolute -top-2 left-10 z-20 h-5 w-28 rotate-[-7deg] bg-[#F78E42] shadow-[3px_3px_0_rgba(17,16,13,0.22)]"
        aria-hidden="true"
      />
      <div className="torn torn-tb relative border-2 border-[#11100D] bg-[#F0E5CC] p-3 shadow-[8px_9px_0_rgba(17,16,13,0.22)]">
        <div className="grid gap-3">
          {featuredBeaches.map((beach, index) => (
            <figure
              key={beach.id}
              className={
                index === 0
                  ? "halftone-photo relative aspect-[16/9] overflow-hidden border-2 border-[#11100D] bg-[#0D1020]"
                  : "halftone-photo relative aspect-[16/7] overflow-hidden border-2 border-[#11100D] bg-[#0D1020]"
              }
            >
              <Image
                src={beach.imageUrl}
                alt={`${beach.name} surf cam preview`}
                fill
                className="object-cover"
                sizes="(min-width: 1024px) 38vw, 100vw"
              />
              <figcaption className="absolute bottom-2 left-2 bg-[#FBF6E8] px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.12em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.24)]">
                {beach.name}
              </figcaption>
            </figure>
          ))}
        </div>
        <p className="mt-3 inline-flex border-2 border-[#11100D] bg-[#F78E42] px-2 py-1 font-mono text-[10px] font-black uppercase tracking-[0.16em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.22)]">
          Live cam roll
        </p>
      </div>
    </aside>
  );
}
