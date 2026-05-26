"use client";

import { useState, useCallback } from "react";
import Image from "next/image";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getSpotGalleryPhotos, type SpotFeaturedPhoto } from "@/actions/spot/spot-data-actions";
import { getOptimizedImageUrl } from "@/lib/image-proxy";
import { SpotGeneratedIcon } from "./spot-generated-icon";

interface SpotPhotoGalleryProps {
  beachId: string;
  spotName: string;
  showHeader?: boolean;
}

/**
 * Photo gallery section for spot pages.
 * Fetches and displays beach photos in a responsive grid.
 * Returns null if no photos are available (hides the section).
 */
export function SpotPhotoGallery({
  beachId,
  spotName,
  showHeader = true,
}: SpotPhotoGalleryProps) {
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  const fetchPhotos = useCallback(async () => {
    return await getSpotGalleryPhotos(beachId, 6);
  }, [beachId]);

  const { data: photos, loading } = useDataFetcher(fetchPhotos, {
    immediate: true,
    initialData: [] as SpotFeaturedPhoto[],
  });

  // Handle image load errors
  const handleImageError = (imageUrl: string) => {
    setFailedImages((prev) => new Set([...prev, imageUrl]));
  };

  // Filter out failed images - ensure photos is never null
  const photoList = photos ?? [];
  const validPhotos = photoList.filter((photo) => !failedImages.has(photo.imageUrl));

  // Don't show section if no photos or still loading with no data
  if (loading && validPhotos.length === 0) {
    return (
      <section className="mt-8">
        {showHeader && (
          <div className="mb-4 flex items-center gap-2">
            <SpotGeneratedIcon
              name="gallery"
              size={24}
              className="h-5 w-5 object-contain"
            />
            <h2 className="text-xl font-semibold text-slate-900">
              {spotName} Photos
            </h2>
          </div>
        )}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="aspect-[4/3] bg-slate-100 rounded-lg animate-pulse"
            />
          ))}
        </div>
      </section>
    );
  }

  // Hide section if no photos available
  if (!loading && validPhotos.length === 0) {
    return null;
  }

  return (
    <section className="mt-8">
      {showHeader && (
        <div className="mb-4 flex items-center gap-2">
          <SpotGeneratedIcon
            name="gallery"
            size={24}
            className="h-5 w-5 object-contain"
          />
          <h2 className="text-xl font-semibold text-slate-900">
            {spotName} Photos
          </h2>
          <span className="text-sm text-slate-500">({validPhotos.length})</span>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {validPhotos.map((photo, index) => (
          <div
            key={photo.imageUrl}
            className="relative aspect-[4/3] bg-slate-100 rounded-lg overflow-hidden group"
          >
            <Image
              src={getOptimizedImageUrl(photo.thumbUrl || photo.imageUrl)}
              alt={photo.title || `${spotName} surf photo ${index + 1}`}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              unoptimized
              onError={() => handleImageError(photo.imageUrl)}
            />
            {/* Photo attribution overlay on hover */}
            {photo.attributionHtml && (
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-end justify-start p-2 opacity-0 group-hover:opacity-100">
                <div
                  className="text-xs text-high line-clamp-2"
                  dangerouslySetInnerHTML={{ __html: photo.attributionHtml }}
                />
              </div>
            )}
            {/* Camera icon overlay */}
            <div className="absolute top-2 right-2 bg-black/30 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              <SpotGeneratedIcon
                name="photo"
                size={18}
                className="h-4 w-4 object-contain"
              />
            </div>
          </div>
        ))}
      </div>

      {validPhotos.length > 0 && (
        <p className="mt-3 text-xs text-slate-500">
          Photos from the surf community. Attribution available on hover.
        </p>
      )}
    </section>
  );
}
