"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import { buildBeachUrl } from "@/lib/utils/beach-url-utils";
import { getDisplayCamThumbnailUrl } from "@/lib/media/cam-thumbnail";
import type { CamBeachWithRegion } from "@/actions/beach/cam-actions";

interface CamCardProps {
  beach: CamBeachWithRegion;
}

export function CamCard({ beach }: CamCardProps) {
  const thumbnailUrl = getDisplayCamThumbnailUrl({
    cameraUrl: beach.camera_url,
    thumbnailUrl: beach.thumbnail_url,
  });
  const [imgError, setImgError] = useState(false);
  const showThumbnail = thumbnailUrl && !imgError;

  const beachUrl = buildBeachUrl({
    slug: beach.slug,
    city: beach.city,
    state: beach.state,
  });

  return (
    <Link
      href={beachUrl}
      className="group block overflow-hidden rounded-2xl border border-blue-100/60 bg-white/95 shadow-md transition-all duration-200 hover:-translate-y-1 hover:shadow-xl"
    >
      {/* Camera preview area */}
      <div className="relative h-40 overflow-hidden">
        {showThumbnail ? (
          <>
            <Image
              src={thumbnailUrl}
              alt={`${beach.name} live camera`}
              fill
              className="object-cover"
              sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
              onError={() => setImgError(true)}
            />
            {/* Dark gradient overlay at bottom for beach name readability */}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/10 to-transparent" />
          </>
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-[#252D6B]">
            <svg
              className="absolute bottom-0 left-0 h-12 w-full opacity-20"
              viewBox="0 0 1440 120"
              preserveAspectRatio="none"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M0,60L60,65C120,70,240,80,360,75C480,70,600,50,720,45C840,40,960,50,1080,60C1200,70,1320,80,1380,85L1440,90L1440,120L0,120Z"
                fill="white"
                fillOpacity="0.15"
              />
            </svg>
            <span className="relative rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/85">
              Preview unavailable
            </span>
          </div>
        )}

        {showThumbnail ? (
          <span className="absolute right-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-full bg-red-600/90 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-white" />
            LIVE
          </span>
        ) : (
          <span className="absolute right-3 top-3 z-10 inline-flex rounded-full bg-[#FBF6E8]/95 px-2.5 py-1 text-xs font-semibold text-[#252D6B] shadow-sm">
            Cam link
          </span>
        )}

        {/* Beach name overlay */}
        <span className="absolute bottom-3 left-0 right-0 z-10 px-4 text-center font-heading text-lg font-bold text-white drop-shadow-md">
          {beach.name}
        </span>
      </div>

      {/* Card body */}
      <div className="px-4 py-3">
        <div className="flex items-center gap-1.5 text-sm text-gray-500">
          <MapPin className="h-3.5 w-3.5 flex-shrink-0" />
          <span>
            {beach.city}, {beach.state}
          </span>
        </div>
        <p className="mt-1 text-xs text-ocean-blue font-medium opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          {showThumbnail ? "Watch live cam" : "Open cam page"} &rarr;
        </p>
      </div>
    </Link>
  );
}
