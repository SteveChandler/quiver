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
  beachName?: string; // Optional beach name to display in fallback
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
  beachName,
}: MapImageProps) {
  const [imageError, setImageError] = useState(false);

  const handleImageError = () => {
    console.warn("Map image failed to load:", src);
    setImageError(true);
  };

  // Show placeholder only if image failed to load or it's a data URL placeholder
  if (imageError || src.startsWith("data:image/svg+xml")) {
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
          <p className="text-sm font-medium">{beachName || "Beach Location"}</p>
          {latitude && longitude && (
            <p className="text-xs text-gray-500 mt-1">
              {latitude.toFixed(4)}, {longitude.toFixed(4)}
            </p>
          )}
        </div>
      </div>
    );
  }

  // For external map images, use a regular img tag to avoid Next.js restrictions
  if (
    src.includes("api.mapbox.com") ||
    src.includes("maps.googleapis.com") ||
    src.includes("staticmap.openstreetmap.de")
  ) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt={alt}
        className={className}
        style={
          fill
            ? { width: "100%", height: "100%", objectFit: "cover" }
            : { width, height }
        }
        onError={handleImageError}
      />
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
