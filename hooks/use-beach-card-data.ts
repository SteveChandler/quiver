"use client";

import { useMemo } from "react";
import { getStaticMapImageUrl, resolveBeachCoordinates } from "@/lib/map-utils";
import { useMultipleBeachReviews } from "@/hooks/use-beach-reviews";
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
  userLocation?: { lat: number; lng: number };
  /** Function to calculate distance from user location */
  calculateDistance?: (
    userLat: number,
    userLng: number,
    beachLat: number,
    beachLng: number
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

// Default distance calculation using Haversine formula
function defaultCalculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): string {
  const R = 3958.8; // Earth's radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;
  return `${distance.toFixed(1)} miles`;
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
      let distance = beach.location_text || defaultLocationText;
      if (userLocation && coords) {
        distance = calculateDistance(
          userLocation.lat,
          userLocation.lng,
          coords.latitude,
          coords.longitude
        );
      }

      // Generate map image URL
      const mapImageUrl = getStaticMapImageUrl(
        coords?.latitude,
        coords?.longitude,
        mapOptions
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
    mapOptions,
  ]);

  return {
    beachCardData,
    loading: reviewsLoading,
    error,
  };
}
