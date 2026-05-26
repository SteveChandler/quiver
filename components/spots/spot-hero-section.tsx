"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { getStaticMapImageUrl } from "@/lib/map-utils";
import { getOptimizedImageUrl } from "@/lib/image-proxy";
import { SpotGeneratedIcon } from "./spot-generated-icon";

interface SpotHeroSectionProps {
  spotName: string;
  latitude: number | null;
  longitude: number | null;
  featuredPhotoUrl: string | null;
  attribution?: string | null;
  eyebrow?: string;
  subtitle?: string | null;
  metadata?: string | null;
  badges?: string[];
}

/**
 * Hero section for spot pages displaying a featured photo or map fallback.
 * Full-width with responsive aspect ratio and gradient overlay.
 *
 * Map URL generation is deferred to client-side useEffect to avoid hydration
 * mismatches caused by the map-utils module's caching and timestamp logic.
 */
export function SpotHeroSection({
  spotName,
  latitude,
  longitude,
  featuredPhotoUrl,
  attribution,
  eyebrow,
  subtitle,
  metadata,
  badges = [],
}: SpotHeroSectionProps) {
  const [imageError, setImageError] = useState(false);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  // Determine what to show: photo > map > placeholder
  const hasPhoto = !!featuredPhotoUrl;
  const hasCoordinates = latitude !== null && longitude !== null;

  // Generate map URL on client side only to avoid hydration mismatch
  useEffect(() => {
    if (!hasPhoto && hasCoordinates) {
      const url = getStaticMapImageUrl(latitude!, longitude!, {
        width: 1200,
        height: 600,
        zoom: 14,
      });
      setMapUrl(url);
    }
  }, [hasPhoto, hasCoordinates, latitude, longitude]);

  // Get optimized URL for external photos, or use client-generated map URL
  const imageUrl = hasPhoto
    ? getOptimizedImageUrl(featuredPhotoUrl!)
    : mapUrl;

  // Show loading state while map URL is being generated
  const isLoadingMap = !hasPhoto && hasCoordinates && !mapUrl;

  // If no photo or map available, or image failed to load, show placeholder
  if (!imageUrl || imageError) {
    return (
      <div className="relative aspect-[5/4] w-full overflow-hidden bg-gradient-to-br from-sky-100 via-cyan-100 to-slate-100 md:aspect-[21/9]">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-sky-700">
          {isLoadingMap ? (
            <>
              <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-sky-500/20 border-t-sky-500/70" />
              <p className="mt-4 text-sm font-medium opacity-60">Loading map...</p>
            </>
          ) : (
            <>
              <SpotGeneratedIcon
                name="photo"
                size={72}
                className="h-16 w-16 object-contain opacity-35"
              />
              <p className="mt-4 text-lg font-medium opacity-60">{spotName}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative aspect-[5/4] w-full overflow-hidden bg-slate-200 md:aspect-[21/9]">
      {/* Background image */}
      <Image
        src={imageUrl}
        alt={`${spotName} ${hasPhoto ? "surf photo" : "location map"}`}
        fill
        priority
        className="object-cover"
        unoptimized={imageUrl.startsWith("data:") || imageUrl.includes("/api/image-proxy")}
        onError={() => setImageError(true)}
      />

      {/* Gradient overlay for text readability */}
      <div className="absolute inset-0 bg-gradient-to-t from-slate-950/80 via-slate-950/25 to-transparent" />
      <div className="absolute inset-0 bg-gradient-to-r from-slate-950/45 via-transparent to-transparent" />

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
        <div className="mx-auto max-w-6xl">
          {/* Photo indicator */}
          {hasPhoto && (
            <div className="flex items-center gap-2 text-high mb-2">
              <SpotGeneratedIcon
                name="photo"
                size={20}
                className="h-4 w-4 object-contain"
              />
              <span className="text-sm">Beach photo</span>
            </div>
          )}
          {!hasPhoto && hasCoordinates && (
            <div className="flex items-center gap-2 text-high mb-2">
              <SpotGeneratedIcon
                name="location"
                size={20}
                className="h-4 w-4 object-contain"
              />
              <span className="text-sm">Location map</span>
            </div>
          )}

          {(eyebrow || subtitle || metadata || badges.length > 0) && (
            <div className="mt-4 max-w-3xl rounded-[24px] border border-white/15 bg-black/25 p-4 text-white backdrop-blur-md sm:rounded-[28px] sm:p-5 md:p-6">
              {eyebrow && (
                <p className="text-xs font-semibold uppercase tracking-[0.26em] text-sky-100/90">
                  {eyebrow}
                </p>
              )}
              <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-4xl md:text-5xl">
                {spotName}
              </h1>
              {subtitle && (
                <p className="mt-3 max-w-2xl text-sm leading-5 text-white/88 line-clamp-3 sm:leading-6 sm:line-clamp-none sm:text-base">
                  {subtitle}
                </p>
              )}
              {metadata && (
                <p className="mt-3 text-xs text-white/72 sm:text-sm">
                  {metadata}
                </p>
              )}
              {badges.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {badges.map((badge) => (
                    <span
                      key={badge}
                      className="rounded-full border border-white/15 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-white/90"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Attribution badge */}
      {hasPhoto && attribution && (
        <div
          className="absolute bottom-3 right-3 bg-black/50 text-white text-xs px-2 py-1 rounded"
          dangerouslySetInnerHTML={{ __html: attribution }}
        />
      )}
    </div>
  );
}
