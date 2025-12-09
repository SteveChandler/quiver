"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { Camera, MapPin, Loader2 } from "lucide-react";
import { getStaticMapImageUrl } from "@/lib/map-utils";
import { getOptimizedImageUrl } from "@/lib/image-proxy";

interface SpotHeroSectionProps {
  spotName: string;
  latitude: number | null;
  longitude: number | null;
  featuredPhotoUrl: string | null;
  attribution?: string | null;
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
      <div className="relative w-full aspect-[3/2] md:aspect-[21/9] bg-gradient-to-br from-sky-100 to-sky-200">
        <div className="absolute inset-0 flex flex-col items-center justify-center text-sky-700">
          {isLoadingMap ? (
            <>
              <Loader2 className="w-12 h-12 animate-spin opacity-50" />
              <p className="mt-4 text-sm font-medium opacity-60">Loading map...</p>
            </>
          ) : (
            <>
              <Camera className="w-16 h-16 opacity-30" />
              <p className="mt-4 text-lg font-medium opacity-60">{spotName}</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="relative w-full aspect-[3/2] md:aspect-[21/9] bg-slate-200 overflow-hidden">
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
      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />

      {/* Content overlay */}
      <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
        <div className="max-w-5xl mx-auto">
          {/* Photo indicator */}
          {hasPhoto && (
            <div className="flex items-center gap-2 text-white/80 mb-2">
              <Camera className="w-4 h-4" />
              <span className="text-sm">Beach photo</span>
            </div>
          )}
          {!hasPhoto && hasCoordinates && (
            <div className="flex items-center gap-2 text-white/80 mb-2">
              <MapPin className="w-4 h-4" />
              <span className="text-sm">Location map</span>
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
