"use client";

import { useState } from "react";
import Image from "next/image";
import { getOpenStreetMapStaticImageUrl } from "@/lib/map-utils";

interface MapImageProps {
  src: string;
  alt: string;
  latitude?: number;
  longitude?: number;
  width?: number;
  height?: number;
  className?: string;
  fill?: boolean;
}

export function MapImage({
  src,
  alt,
  latitude,
  longitude,
  width = 300,
  height = 120,
  className,
  fill = false,
}: MapImageProps) {
  const [imageError, setImageError] = useState(false);
  const [fallbackError, setFallbackError] = useState(false);

  // Get fallback OpenStreetMap URL if we have coordinates
  const fallbackSrc =
    latitude && longitude && !fallbackError
      ? getOpenStreetMapStaticImageUrl(latitude, longitude, { width, height })
      : `/placeholder.svg?height=${height}&width=${width}`;

  const handleImageError = () => {
    console.warn("Primary map image failed to load:", src);
    setImageError(true);
  };

  const handleFallbackError = () => {
    console.warn("Fallback map image failed to load:", fallbackSrc);
    setFallbackError(true);
  };

  // If primary image failed, use fallback
  const imageSrc = imageError ? fallbackSrc : src;
  const onError = imageError ? handleFallbackError : handleImageError;

  // Show a static placeholder if both images failed
  if (imageError && fallbackError) {
    return (
      <div
        className={`bg-gray-200 flex items-center justify-center ${className}`}
        style={fill ? undefined : { width, height }}
      >
        <div className="text-center text-gray-500 p-4">
          <svg
            className="mx-auto h-8 w-8 text-gray-400 mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-1.447-.894L15 4m0 13V4m-6 3l6-3"
            />
          </svg>
          <p className="text-sm">Map unavailable</p>
        </div>
      </div>
    );
  }

  return (
    <Image
      src={imageSrc}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      fill={fill}
      className={className}
      onError={onError}
      unoptimized={imageError} // Don't optimize fallback images
    />
  );
}
