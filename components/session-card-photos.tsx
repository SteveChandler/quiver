"use client";

import React from "react";
import { Camera } from "lucide-react";
import { cn } from "@/lib/utils";
import { getTransformedUrl } from "@/lib/utils/image-utils";

export interface SessionPhoto {
  id: string;
  public_url: string;
  caption?: string;
}

interface SessionCardPhotosProps {
  photos: SessionPhoto[];
  maxDisplay?: number;
  className?: string;
  onClick?: () => void;
}

/**
 * SessionCardPhotos Component
 * Displays photo thumbnails in session cards with flexible grid layout
 * Shows 1-3 photos with overflow indicator
 */
export function SessionCardPhotos({
  photos,
  maxDisplay = 3,
  className,
  onClick,
}: SessionCardPhotosProps) {
  if (!photos || photos.length === 0) {
    return null;
  }

  const displayPhotos = photos.slice(0, maxDisplay);
  const remainingCount = photos.length - displayPhotos.length;

  // Layout variations based on photo count
  const getGridLayout = () => {
    const photoCount = displayPhotos.length;
    if (photoCount === 1) {
      return "grid-cols-1"; // Single large photo
    } else if (photoCount === 2) {
      return "grid-cols-2"; // Two side-by-side
    } else {
      return "grid-cols-3"; // Three in a row
    }
  };

  return (
    <div className={cn("relative w-full", className)}>
      {/* Photo Count Badge */}
      {photos.length > 0 && (
        <div className="absolute -top-2 -right-2 z-10 flex items-center gap-1 bg-black/75 text-white text-xs font-medium px-2 py-1 rounded-full">
          <Camera className="h-3 w-3" />
          <span>{photos.length}</span>
        </div>
      )}

      {/* Photo Grid */}
      <div
        className={cn(
          "grid gap-1 rounded-md overflow-hidden cursor-pointer group",
          getGridLayout()
        )}
        onClick={onClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            onClick?.();
          }
        }}
        aria-label={`View ${photos.length} session ${photos.length === 1 ? "photo" : "photos"}`}
      >
        {displayPhotos.map((photo, index) => (
          <div
            key={photo.id}
            className="relative aspect-square overflow-hidden bg-gray-100"
          >
            {/* Photo Image - using Supabase image transformations for optimized delivery */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={getTransformedUrl(photo.public_url, 'sessionCard')}
              alt={photo.caption || `Session photo ${index + 1}`}
              className="w-full h-full object-cover transition-transform group-hover:scale-105"
              loading="lazy"
            />

            {/* Overlay for last photo if there are more */}
            {index === displayPhotos.length - 1 && remainingCount > 0 && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-lg font-bold">
                  +{remainingCount}
                </span>
              </div>
            )}

            {/* Hover overlay */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors" />
          </div>
        ))}
      </div>
    </div>
  );
}
