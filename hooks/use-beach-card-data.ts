"use client";

import { useMemo } from "react";
import { getStaticMapImageUrl, resolveBeachCoordinates } from "@/lib/map-utils";
import { useMultipleBeachReviews } from "@/hooks/use-beach-reviews";
import { calculateDistanceFormatted } from "@/lib/utils/distance-utils";
import type { Beach } from "@/types/database";

interface BeachCardData {
  id: string;
  name: string;
  rating: number;
  reviewCount: number;
  distance: string;
  mapImageUrl: string;
  latitude?: number;
  longitude?: number;
  coordinates?: { latitude: number; longitude: number };
}

interface UseBeachCardDataOptions {
  /** Limit the number of beaches to process */
  limit?: number;
  /** User location for distance calculations */
  userLocation?: { lat: number; lon: number };
  /** Function to calculate distance from user location */
  calculateDistance?: (
    userLat: number,
    userLon: number,
    beachLat: number,
    beachLon: number
  ) => string;
  /** Default location text when no user location is available */
  defaultLocationText?: string;
  /** Map image options */
  mapOptions?: {
    width?: number;
    height?: number;
    zoom?: number;
  };
}

const DEFAULT_MAP_OPTIONS = {
  width: 300,
  height: 200,
  zoom: 15,
};

// Default distance calculation using centralized utility
// Returns "—" if coordinates are invalid (NaN, null, etc.)
function defaultCalculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): string {
  const formatted = calculateDistanceFormatted(
    { lat: lat1, lon: lng1 },
    { lat: lat2, lon: lng2 },
    "miles"
  );
  // If validation failed, return the fallback character
  if (formatted === "—") {
    return "—";
  }
  return `${formatted} away`;
}

/**
 * Hook for preparing beach card data with reviews, distances, and map images
 */
export function useBeachCardData(
  beaches: Beach[],
  options: UseBeachCardDataOptions = {}
): {
  beachCardData: BeachCardData[];
  loading: boolean;
  error: string | null;
} {
  const {
    limit,
    userLocation,
    calculateDistance = defaultCalculateDistance,
    defaultLocationText = "San Diego",
    mapOptions = DEFAULT_MAP_OPTIONS,
  } = options;

  // Apply limit if specified
  const displayBeaches = useMemo(() => {
    return limit ? beaches.slice(0, limit) : beaches;
  }, [beaches, limit]);

  // Get beach IDs for review data
  const beachIds = useMemo(() => {
    return displayBeaches.map((beach) => beach.id);
  }, [displayBeaches]);

  // Fetch review stats
  const {
    reviewStats,
    loading: reviewsLoading,
    error,
  } = useMultipleBeachReviews(beachIds);

  // Extract map options to stable values to prevent unnecessary re-renders
  const mapWidth = mapOptions.width || DEFAULT_MAP_OPTIONS.width;
  const mapHeight = mapOptions.height || DEFAULT_MAP_OPTIONS.height;
  const mapZoom = mapOptions.zoom || DEFAULT_MAP_OPTIONS.zoom;

  // Process beach data
  const beachCardData = useMemo(() => {
    return displayBeaches.map((beach): BeachCardData => {
      // Resolve coordinates
      const coords = resolveBeachCoordinates(beach);

      // Get review stats
      const beachStats = reviewStats[beach.id];
      const rating = beachStats?.average_overall || 0;
      const reviewCount = beachStats?.total_reviews || 0;

      // Calculate distance
      let distance = (beach as any).location_text || defaultLocationText;
      if (userLocation && coords) {
        distance = calculateDistance(
          userLocation.lat,
          userLocation.lon,
          coords.latitude,
          coords.longitude
        );
      }

      // Generate map image URL (now with caching to prevent duplicates)
      const mapImageUrl = getStaticMapImageUrl(
        coords?.latitude,
        coords?.longitude,
        { width: mapWidth, height: mapHeight, zoom: mapZoom }
      );

      return {
        id: beach.id,
        name: beach.name,
        rating,
        reviewCount,
        distance,
        mapImageUrl,
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        coordinates: coords || undefined,
      };
    });
  }, [
    displayBeaches,
    reviewStats,
    userLocation,
    calculateDistance,
    defaultLocationText,
    mapWidth,
    mapHeight,
    mapZoom,
  ]);

  return {
    beachCardData,
    loading: reviewsLoading,
    error,
  };
}
