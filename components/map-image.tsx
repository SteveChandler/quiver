"use client";

import { useState } from "react";
import Image from "next/image";

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
  height = 200,
  className,
  fill = false,
}: MapImageProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    console.warn("Map image failed to load:", src);
    setImageError(true);
  };

  // If image failed or it's an external map URL, show a static placeholder
  if (
    imageError ||
    src.includes("staticmap.openstreetmap.de") ||
    src.includes("api.mapbox.com") ||
    src.includes("maps.googleapis.com")
  ) {
    return (
      <div
        className={`bg-gradient-to-br from-blue-100 to-green-100 flex items-center justify-center ${className}`}
        style={fill ? undefined : { width, height }}
      >
        <div className="text-center text-gray-600 p-4">
          <svg
            className="mx-auto h-8 w-8 text-blue-500 mb-2"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
            />
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
            />
          </svg>
          <p className="text-sm font-medium">Beach Location</p>
          {latitude && longitude && (
            <p className="text-xs text-gray-500 mt-1">
              {latitude.toFixed(4)}, {longitude.toFixed(4)}
            </p>
          )}
        </div>
      </div>
    );
  }

  // For local/placeholder images, use Next.js Image normally
  return (
    <Image
      src={src}
      alt={alt}
      width={fill ? undefined : width}
      height={fill ? undefined : height}
      fill={fill}
      className={className}
      onError={handleImageError}
    />
  );
}
