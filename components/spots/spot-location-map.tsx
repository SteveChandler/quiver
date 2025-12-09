"use client";

import { useState, useEffect } from "react";
import Image from "next/image";
import { MapPin, Loader2 } from "lucide-react";
import { getStaticMapImageUrl } from "@/lib/map-utils";

interface SpotLocationMapProps {
  latitude: number;
  longitude: number;
  spotName: string;
}

/**
 * Displays a static map image showing the beach/spot location in the sidebar.
 * Uses Mapbox, Google Maps, or fallback placeholder based on available API keys.
 *
 * Map URL generation is deferred to client-side useEffect to avoid hydration
 * mismatches caused by the map-utils module's caching and timestamp logic.
 */
export function SpotLocationMap({
  latitude,
  longitude,
  spotName,
}: SpotLocationMapProps) {
  const [imageError, setImageError] = useState(false);
  const [mapUrl, setMapUrl] = useState<string | null>(null);

  // Generate map URL on client side only to avoid hydration mismatch
  useEffect(() => {
    const url = getStaticMapImageUrl(latitude, longitude, {
      width: 400,
      height: 300,
      zoom: 13,
    });
    setMapUrl(url);
  }, [latitude, longitude]);

  // Show loading state while map URL is being generated
  const isLoading = !mapUrl;

  return (
    <div className="rounded-xl border border-slate-200 overflow-hidden shadow-sm">
      <div className="relative aspect-[4/3] bg-slate-100">
        {isLoading ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100">
            <Loader2 className="w-8 h-8 animate-spin text-sky-400" />
          </div>
        ) : !imageError ? (
          <Image
            src={mapUrl}
            alt={`Map showing ${spotName} location`}
            fill
            className="object-cover"
            unoptimized={mapUrl.startsWith("data:")}
            onError={() => setImageError(true)}
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-sky-50 to-sky-100">
            <MapPin className="w-8 h-8 text-sky-400" />
          </div>
        )}
        {/* Map pin overlay for visual emphasis */}
        {!isLoading && !imageError && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="bg-sky-600 text-white p-2 rounded-full shadow-lg">
              <MapPin className="w-5 h-5" />
            </div>
          </div>
        )}
      </div>
      <div className="p-3 bg-slate-50 text-sm text-slate-600">
        <div className="flex items-center gap-2">
          <MapPin className="w-4 h-4 text-sky-600 flex-shrink-0" />
          <div>
            <span className="font-medium text-slate-900">{spotName}</span>
            <p className="text-xs text-slate-500 mt-0.5">
              {latitude.toFixed(4)}°N, {Math.abs(longitude).toFixed(4)}°W
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
