"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { Camera, Maximize2 } from "lucide-react";
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

export function BeachPhotoGallery({ beach, className }: BeachPhotoGalleryProps) {
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

  // Filter out failed images
  const validPhotos = photos?.filter((p) => !failedImages.has(p.id)) || [];

  // Generate a static map URL using the utility function
  const mapUrl = getStaticMapImageUrl(beach.latitude, beach.longitude, {
    width: 600,
    height: 400,
    zoom: 13,
  });

  const heroPhoto = validPhotos[0];
  const sidePhotos = validPhotos.slice(1, 3);
  const hasPhotos = validPhotos.length > 0;

  return (
    <div className={`relative ${className || ""}`}>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 rounded-xl overflow-hidden">
        {/* Main/Hero Photo (left side on desktop, top on mobile) */}
        <div className="relative aspect-[4/3] md:aspect-auto md:row-span-2 bg-muted">
          {heroPhoto ? (
            <Image
              src={heroPhoto.public_url}
              alt={`${beach.name} - main view`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
              onError={() => handleImageError(heroPhoto.id)}
              unoptimized={heroPhoto.public_url.includes("openverse") || heroPhoto.public_url.includes("flickr")}
            />
          ) : beach.latitude && beach.longitude ? (
            <Image
              src={mapUrl}
              alt={`Map of ${beach.name}`}
              fill
              sizes="(max-width: 768px) 100vw, 50vw"
              className="object-cover"
              priority
              unoptimized
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
          <div className="relative aspect-[4/3] bg-muted">
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
              <Image
                src={mapUrl}
                alt={`Map of ${beach.name}`}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-ocean-blue/5 to-blue-100/10">
                <Camera className="h-8 w-8 text-muted-foreground/30" />
              </div>
            )}
          </div>

          {/* Small Photo 2 or Map */}
          <div className="relative aspect-[4/3] bg-muted">
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
            ) : beach.latitude && beach.longitude ? (
              <Image
                src={mapUrl}
                alt={`Map of ${beach.name}`}
                fill
                sizes="(max-width: 768px) 50vw, 25vw"
                className="object-cover"
                unoptimized
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
      {validPhotos.length > 1 && (
        <Button
          variant="secondary"
          size="sm"
          className="absolute bottom-4 right-4 backdrop-blur-sm bg-white/90 hover:bg-white shadow-md"
        >
          <Camera className="h-4 w-4 mr-2" />
          {validPhotos.length} photos
        </Button>
      )}
    </div>
  );
}
