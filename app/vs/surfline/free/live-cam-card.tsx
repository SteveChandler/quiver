"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
} from "react";
import Image from "next/image";
import Link from "next/link";
import { Camera, MapPin } from "lucide-react";

import type { CamBeachWithRegion } from "@/actions/beach/cam-actions";
import {
  CAM_CARD_FALLBACK_IMAGE_URL,
  getDisplayCamThumbnailUrls,
} from "@/lib/media/cam-thumbnail";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getProxiedImageUrl } from "@/lib/utils/image-utils";

interface LiveCamCardProps {
  beach: CamBeachWithRegion;
}

export function LiveCamCard({ beach }: LiveCamCardProps): ReactElement {
  const imageUrls = useMemo(
    () =>
      getDisplayCamThumbnailUrls({
        cameraUrl: beach.camera_url,
        thumbnailUrl: beach.thumbnail_url,
        fallbackImageUrl: beach.photo_url,
      })
        .filter((url) => url !== CAM_CARD_FALLBACK_IMAGE_URL)
        .map(getProxiedImageUrl)
        .filter(Boolean),
    [beach.camera_url, beach.photo_url, beach.thumbnail_url],
  );
  const [imageIndex, setImageIndex] = useState(0);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const imageUrl = imageUrls[imageIndex] ?? null;
  const location = `${beach.city}, ${beach.state}`;
  const href = buildBeachUrl({
    slug: beach.slug,
    city: beach.city,
    state: beach.state,
  });

  const handleImageError = useCallback((): void => {
    setImageIndex((currentIndex) => currentIndex + 1);
  }, []);

  useEffect(() => {
    if (!imageUrl) return;

    const image = imageRef.current;
    if (!image?.complete || image.naturalWidth > 0) return;

    handleImageError();
  }, [handleImageError, imageUrl]);

  return (
    <Link
      href={href}
      aria-label={`Watch the ${beach.name} live cam in ${location}`}
      className="group block overflow-hidden rounded-md border-2 border-[#11100D] bg-[#FFFDF7] shadow-[3px_3px_0_rgba(17,16,13,0.18)] transition-transform hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EBD8]"
    >
      <div className="relative aspect-[16/9] overflow-hidden border-b-2 border-[#11100D] bg-[#F0E5CC]">
        {imageUrl ? (
          <Image
            key={imageUrl}
            ref={imageRef}
            src={imageUrl}
            alt={`${beach.name} live surf cam preview`}
            fill
            sizes="(max-width: 639px) 50vw, (max-width: 767px) 33vw, (max-width: 1280px) 25vw, 304px"
            className="object-cover transition-transform duration-300 group-hover:scale-[1.02]"
            onError={handleImageError}
          />
        ) : (
          <div
            aria-hidden="true"
            data-testid="live-cam-image-fallback"
            className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#F0E5CC] text-[#11100D]"
          >
            <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_1px_1px,#11100D_1px,transparent_0)] [background-size:9px_9px]" />
            <div className="absolute -bottom-8 left-[-8%] h-16 w-[116%] rotate-[-3deg] border-t-2 border-[#11100D] bg-[#D9C49C]" />
            <div className="relative flex rotate-[-2deg] items-center gap-2 border-2 border-[#11100D] bg-[#FBF6E8] px-3 py-2 shadow-[3px_3px_0_rgba(17,16,13,0.22)]">
              <Camera className="h-5 w-5" strokeWidth={2.5} />
              <span className="font-mono text-[9px] font-black uppercase tracking-[0.12em]">
                Cam at the coast
              </span>
            </div>
          </div>
        )}

        <span className="absolute left-2 top-2 z-10 inline-flex items-center gap-1.5 border-2 border-[#11100D] bg-[#FBF6E8] px-2 py-1 font-mono text-[8px] font-black uppercase tracking-[0.14em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.24)]">
          <span className="h-1.5 w-1.5 rounded-full bg-[#00A884]" aria-hidden="true" />
          Live
        </span>
      </div>

      <div className="min-w-0 px-2.5 py-2">
        <div className="truncate font-heading text-xs font-black uppercase leading-tight text-[#11100D] sm:text-sm">
          {beach.name}
        </div>
        <div className="mt-1 flex min-w-0 items-center gap-1 font-mono text-[8px] font-bold uppercase tracking-[0.08em] text-[#6B6557] sm:text-[9px]">
          <MapPin className="h-3 w-3 shrink-0 text-[#9E5010]" aria-hidden="true" />
          <span className="truncate">{location}</span>
        </div>
      </div>
    </Link>
  );
}
