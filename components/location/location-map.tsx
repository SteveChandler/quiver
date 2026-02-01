"use client";

import { useMemo, Suspense } from "react";
import { useRouter } from "next/navigation";
import { InteractiveMap } from "@/components/map/interactive-map";
import type { Beach } from "@/types/database";
import { getBeachHrefSafe } from "@/lib/utils/beach-url-utils";

interface LocationMapProps {
  /** Beaches to display - accepts Beach or BeachWithMetrics (metrics are optional) */
  beaches: Beach[];
  city: string;
  state: string;
  className?: string;
}

/**
 * LocationMap Component
 *
 * Wrapper around InteractiveMap for location pages.
 * Displays all beaches in a location with appropriate zoom and bounds.
 */
export function LocationMap({
  beaches,
  city,
  state,
  className = "h-[500px] w-full rounded-lg overflow-hidden border border-gray-200",
}: LocationMapProps) {
  const router = useRouter();

  // Calculate center point and initial zoom from beach coordinates
  // Note: Location ranking RPCs may return latitude/longitude; server actions map to lat/lon
  // so the map can treat beaches uniformly.
  const { center, zoom } = useMemo(() => {
    if (beaches.length === 0) {
      return { center: [32.7157, -117.1611] as [number, number], zoom: 10 };
    }

    // Calculate bounds from all beach coordinates
    let minLat = Infinity;
    let maxLat = -Infinity;
    let minLng = Infinity;
    let maxLng = -Infinity;

    beaches.forEach((beach) => {
      if (beach.lat && beach.lon) {
        minLat = Math.min(minLat, beach.lat);
        maxLat = Math.max(maxLat, beach.lat);
        minLng = Math.min(minLng, beach.lon);
        maxLng = Math.max(maxLng, beach.lon);
      }
    });

    // Calculate center point
    const centerLat = (minLat + maxLat) / 2;
    const centerLng = (minLng + maxLng) / 2;

    // Calculate appropriate zoom level based on bounds
    // More spread = lower zoom (more zoomed out)
    const latDiff = maxLat - minLat;
    const lngDiff = maxLng - minLng;
    const maxDiff = Math.max(latDiff, lngDiff);

    let calculatedZoom = 13; // Default zoom
    if (maxDiff > 1) calculatedZoom = 9;
    else if (maxDiff > 0.5) calculatedZoom = 10;
    else if (maxDiff > 0.2) calculatedZoom = 11;
    else if (maxDiff > 0.1) calculatedZoom = 12;

    return {
      center: [centerLat, centerLng] as [number, number],
      zoom: calculatedZoom,
    };
  }, [beaches]);

  // Handle beach click - navigate to beach detail page
  const handleBeachClick = (beach: Beach) => {
    const href = getBeachHrefSafe({
      id: beach.id ?? null,
      slug: beach.slug ?? null,
      city: beach.city ?? city,
      state: beach.state ?? state,
      country: beach.country ?? null,
    });

    // Avoid pushing a dead route; if no href is possible, do nothing.
    if (!href) return;
    router.push(href);
  };

  // Empty state
  if (beaches.length === 0) {
    return (
      <div
        className={className}
        data-testid="location-map-empty"
        role="region"
        aria-label={`Map of beaches in ${city}, ${state}`}
      >
        <div className="flex h-full items-center justify-center bg-gray-50 text-gray-500">
          No beaches to display on map
        </div>
      </div>
    );
  }

  return (
    <div
      className={className}
      data-testid="location-map"
      role="region"
      aria-label={`Map of beaches in ${city}, ${state}`}
    >
      <Suspense
        fallback={
          <div className="flex h-full items-center justify-center bg-gray-50">
            <div className="text-center">
              <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
              <p className="text-sm text-gray-500">Loading map...</p>
            </div>
          </div>
        }
      >
        <InteractiveMap
          initialCenter={center}
          initialZoom={zoom}
          beaches={beaches}
          onLocationClick={handleBeachClick}
          className="h-full w-full"
        />
      </Suspense>
    </div>
  );
}

/**
 * LocationMapSkeleton Component
 *
 * Loading skeleton for the location map
 */
export function LocationMapSkeleton({
  className = "h-[500px] w-full rounded-lg overflow-hidden border border-gray-200",
}: {
  className?: string;
}) {
  return (
    <div className={className} data-testid="location-map-skeleton">
      <div className="flex h-full animate-pulse items-center justify-center bg-gray-100">
        <div className="text-center">
          <div className="mb-2 h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-blue-600" />
          <p className="text-sm text-gray-500">Loading map...</p>
        </div>
      </div>
    </div>
  );
}

/**
 * LocationMapError Component
 *
 * Error state for the location map
 */
export function LocationMapError({
  error,
  className = "h-[500px] w-full rounded-lg overflow-hidden border border-gray-200",
}: {
  error?: Error;
  className?: string;
}) {
  return (
    <div className={className} data-testid="location-map-error">
      <div className="flex h-full items-center justify-center bg-red-50 text-red-600">
        <div className="text-center">
          <svg
            className="mx-auto h-12 w-12 text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
            />
          </svg>
          <p className="mt-2 text-sm font-medium">Failed to load map</p>
          {error && (
            <p className="mt-1 text-xs text-red-500">{error.message}</p>
          )}
        </div>
      </div>
    </div>
  );
}
