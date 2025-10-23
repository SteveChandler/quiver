"use client";

import { useState, useCallback, useMemo } from "react";
import Image from "next/image";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Beach } from "@/types/database";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getStaticMapImageUrl } from "@/lib/map-utils";

interface BestPhoto {
  id: string;
  public_url: string;
  created_at: string;
}

async function getBestBeachPhotos(
  beachId: string,
  limit = 5
): Promise<BestPhoto[]> {
  const { getBestBeachPhotosAction } = await import(
    "@/actions/beach-media-actions"
  );
  const result = await getBestBeachPhotosAction(beachId, limit);
  if (!result.success) throw new Error(result.error || "Failed to load photos");
  return result.data as BestPhoto[];
}

interface BeachPhotoGalleryProps {
  beach: Beach;
  className?: string;
}

interface MapFallbackProps {
  mapUrl: string;
  beachName: string;
  sizes: string;
  priority?: boolean;
}

function MapFallback({ mapUrl, beachName, sizes, priority = false }: MapFallbackProps) {
  return (
    <Image
      src={mapUrl}
      alt={`Map of ${beachName}`}
      fill
      sizes={sizes}
      className="object-cover"
      priority={priority}
      unoptimized
    />
  );
}

export function BeachPhotoGallery({ beach, className }: BeachPhotoGalleryProps) {
  // Fixed: Only show one map when photos < 2
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const fetchPhotos = useCallback(async () => {
    return await getBestBeachPhotos(beach.id, 5);
  }, [beach.id]);

  const { data: photos } = useDataFetcher(fetchPhotos, {
    immediate: true,
    initialData: [] as BestPhoto[],
  });

  const handleImageError = (photoId: string) => {
    console.warn("Beach photo failed to load:", photoId);
    setFailedImages((prev) => new Set(prev).add(photoId));
  };

  // Filter out failed images (memoized)
  const validPhotos = useMemo(
    () => photos?.filter((p) => !failedImages.has(p.id)) || [],
    [photos, failedImages]
  );

  // Generate a static map URL using the utility function (memoized)
  const mapUrl = useMemo(
    () =>
      getStaticMapImageUrl(
        beach.latitude ?? undefined,
        beach.longitude ?? undefined,
        {
          width: 600,
          height: 400,
          zoom: 13,
        }
      ),
    [beach.latitude, beach.longitude]
  );

  const heroPhoto = validPhotos[0];
  const sidePhotos = validPhotos.slice(1, 3);
  const hasPhotos = validPhotos.length > 0;

  return (
    <div className={`relative ${className || ""}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-xl overflow-hidden">
        {/* Phase 1 Spec: gap-2 = 8px ✅, rounded-xl = 12px ✅ */}
        {/* Main/Hero Photo (left side on desktop, top on mobile) */}
        {/* Phase 1 Spec: min-h-[400px] on desktop, aspect-[3/2] on mobile */}
        <div className="relative aspect-[3/2] md:aspect-auto md:min-h-[400px] md:row-span-2 bg-muted">
          {heroPhoto ? (
            <Image
              src={heroPhoto.public_url}
              alt={`${beach.name} - main view`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
              fetchPriority="high"
              onError={() => handleImageError(heroPhoto.id)}
              unoptimized={heroPhoto.public_url.includes("openverse") || heroPhoto.public_url.includes("flickr")}
            />
          ) : beach.latitude && beach.longitude ? (
            <MapFallback
              mapUrl={mapUrl}
              beachName={beach.name}
              sizes="(max-width: 768px) 100vw, 50vw"
              priority
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ocean-blue/10 to-blue-200/20">
              <Camera className="h-16 w-16 text-muted-foreground/40" />
            </div>
          )}
        </div>

        {/* Right Column: Small photos and map */}
        <div className="grid grid-cols-2 md:grid-cols-1 gap-2">
          {/* Small Photo 1 or Map (when only 1 photo total) */}
          {/* Phase 1 Spec: 196px height on desktop, aspect-[3/2] on mobile */}
          <div className="relative aspect-[3/2] md:aspect-auto md:h-[196px] bg-muted">
            {sidePhotos[0] ? (
              <Image
                src={sidePhotos[0].public_url}
                alt={`${beach.name} - view 2`}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
                onError={() => handleImageError(sidePhotos[0].id)}
                unoptimized={sidePhotos[0].public_url.includes("openverse") || sidePhotos[0].public_url.includes("flickr")}
              />
            ) : validPhotos.length === 1 && beach.latitude && beach.longitude ? (
              <MapFallback
                mapUrl={mapUrl}
                beachName={beach.name}
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ocean-blue/5 to-blue-100/10">
                <Camera className="h-8 w-8 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* Small Photo 2 or Map (only show map if 2+ photos) */}
          {/* Phase 1 Spec: 196px height on desktop, aspect-[3/2] on mobile */}
          <div className="relative aspect-[3/2] md:aspect-auto md:h-[196px] bg-muted">
            {sidePhotos[1] ? (
              <Image
                src={sidePhotos[1].public_url}
                alt={`${beach.name} - view 3`}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
                onError={() => handleImageError(sidePhotos[1].id)}
                unoptimized={sidePhotos[1].public_url.includes("openverse") || sidePhotos[1].public_url.includes("flickr")}
              />
            ) : validPhotos.length >= 2 && beach.latitude && beach.longitude ? (
              <MapFallback
                mapUrl={mapUrl}
                beachName={beach.name}
                sizes="(max-width: 768px) 50vw, 25vw"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ocean-blue/5 to-blue-100/10">
                <Camera className="h-8 w-8 text-muted-foreground/30" />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Photo count badge (bottom right) */}
      {/* Phase 1 Spec: bottom-16px, right-16px, padding 8px 16px, icon 16px, gap 8px */}
      {validPhotos.length > 1 && (
        <Button
          variant="secondary"
          className="absolute bottom-4 right-4 px-4 py-2 backdrop-blur-sm bg-white/90 hover:bg-white shadow-md rounded-lg"
        >
          <Camera className="h-4 w-4 mr-2" />
          {validPhotos.length} photos
        </Button>
      )}
    </div>
  );
}
