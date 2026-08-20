"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import {
  CAM_CARD_FALLBACK_IMAGE_URL,
  getDisplayCamThumbnailUrls,
} from "@/lib/media/cam-thumbnail";
import type { CamBeachWithRegion } from "@/actions/beach/cam-actions";

interface CamCardProps {
  beach: CamBeachWithRegion;
}

export function CamCard({ beach }: CamCardProps) {
  const fallbackImageUrl = beach.photo_url ?? CAM_CARD_FALLBACK_IMAGE_URL;
  const thumbnailUrls = useMemo(
    () =>
      getDisplayCamThumbnailUrls({
        cameraUrl: beach.camera_url,
        thumbnailUrl: beach.thumbnail_url,
        fallbackImageUrl,
      }),
    [beach.camera_url, beach.thumbnail_url, fallbackImageUrl],
  );
  const [thumbnailIndex, setThumbnailIndex] = useState(0);
  const [imgError, setImgError] = useState(false);
  const imageRef = useRef<HTMLImageElement | null>(null);
  const thumbnailUrl = thumbnailUrls[thumbnailIndex] ?? null;
  const showThumbnail = Boolean(thumbnailUrl) && !imgError;

  const handleImageError = useCallback((): void => {
    const nextIndex = thumbnailIndex + 1;
    if (nextIndex < thumbnailUrls.length) {
      setThumbnailIndex(nextIndex);
      return;
    }

    setImgError(true);
  }, [thumbnailIndex, thumbnailUrls.length]);

  useEffect(() => {
    if (!showThumbnail) return;

    const image = imageRef.current;
    if (!image?.complete || image.naturalWidth > 0) return;

    handleImageError();
  }, [handleImageError, showThumbnail, thumbnailUrl]);

  const beachUrl = buildBeachUrl({
    slug: beach.slug,
    city: beach.city,
    state: beach.state,
  });

  return (
    <Link
      href={beachUrl}
      className="torn torn-tb group block overflow-hidden border-2 border-[#11100D] bg-[#FBF6E8] p-0 text-[#11100D] shadow-[4px_5px_0_rgba(17,16,13,0.18)] transition-transform duration-200 hover:-translate-y-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F78E42] focus-visible:ring-offset-2 focus-visible:ring-offset-[#F4EBD8]"
    >
      {/* Camera preview area */}
      <div
        className="halftone-photo relative h-44 overflow-hidden border-b-2 border-[#11100D] bg-cover bg-center"
        style={{ backgroundImage: `url("${fallbackImageUrl}")` }}
      >
        {showThumbnail ? (
          <>
            <Image
              key={thumbnailUrl}
              ref={imageRef}
              src={thumbnailUrl}
              alt={`${beach.name} live camera`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              onError={handleImageError}
            />
            {/* Dark gradient overlay at bottom for beach name readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#F0E5CC]">
            <svg
              className="absolute bottom-0 left-0 h-12 w-full opacity-20"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M0,60L60,65C120,70,240,80,360,75C480,70,600,50,720,45C840,40,960,50,1080,60C1200,70,1320,80,1380,85L1440,90L1440,120L0,120Z"
                fill="#11100D"
                fillOpacity="0.18"
              />
            </svg>
            <span className="relative border-2 border-[#11100D] bg-[#FBF6E8] px-3 py-1 font-mono text-xs font-bold uppercase tracking-[0.12em] text-[#11100D]">
              Preview unavailable
            </span>
          </div>
        )}

        {showThumbnail ? (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 border-2 border-[#11100D] bg-[#F78E42] px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.25)]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#11100D]" />
            LIVE
          </span>
        ) : (
          <span className="absolute right-3 top-3 z-10 inline-flex border-2 border-[#11100D] bg-[#FDB84B] px-2.5 py-1 font-mono text-[10px] font-black uppercase tracking-[0.12em] text-[#11100D] shadow-[2px_2px_0_rgba(17,16,13,0.25)]">
            Cam link
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="px-4 py-3">
        <h3 className="font-heading text-lg font-black uppercase leading-tight tracking-normal text-[#11100D]">
          {beach.name}
        </h3>
        <div className="mt-2 flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-[0.08em] text-[#11100D]/65">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0 text-[#F78E42]" />
          <span>
            {beach.city}, {beach.state}
          </span>
        </div>
        <p className="mt-3 font-mono text-[11px] font-black uppercase tracking-[0.14em] text-[#0B3A75] opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {/* One string expression: SWC eats the leading space of a
              multi-line JSX text child that contains an HTML entity. */}
          {`${showThumbnail ? "Watch live cam" : "Open cam page"} →`}
        </p>
      </div>
    </Link>
  );
}
