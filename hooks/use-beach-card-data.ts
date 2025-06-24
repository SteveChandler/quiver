"use client";

import { useMemo } from "react";
import { getStaticMapImageUrl, resolveBeachCoordinates } from "@/lib/map-utils";
import {
  getMapImageOptions,
  MAP_PRESET_USAGE,
} from "@/lib/constants/map-presets";
import type {
  MapImagePreset,
  MapImageOptions,
} from "@/lib/constants/map-presets";
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
  /** Limit the number of beaches processed */
  limit?: number;
  /** User location for distance calculations */
  userLocation?: { latitude: number; longitude: number };
  /** Custom distance calculation function */
  calculateDistance?: (beach: Beach) => string;
  /** Default location text when distance can't be calculated */
  defaultLocationText?: string;
  /** Map image options preset */
  mapOptions?: MapImagePreset;
  /** Additional map options */
  customMapOptions?: Partial<MapImageOptions>;
}

export function useBeachCardData(
  beaches: Beach[],
  options: UseBeachCardDataOptions = {}
) {
  const {
    limit,
    userLocation,
    calculateDistance: customCalculateDistance,
    defaultLocationText = "Unknown location",
    mapOptions = MAP_PRESET_USAGE.BEACH_CARD_DEFAULT,
    customMapOptions = {},
  } = options;

  const beachCardData = useMemo(() => {
    if (!beaches || beaches.length === 0) {
      return [];
    }

    // Apply limit if specified
    const processBeaches = limit ? beaches.slice(0, limit) : beaches;

    return processBeaches.map((beach): BeachCardData => {
      // Calculate distance
      let distance = defaultLocationText;
      if (customCalculateDistance) {
        distance = customCalculateDistance(beach);
      } else if (userLocation && beach.latitude && beach.longitude) {
        distance = calculateDistanceFormatted(
          userLocation.latitude,
          userLocation.longitude,
          beach.latitude,
          beach.longitude
        );
      }

      // Get coordinates for map generation
      const coordinates = resolveBeachCoordinates(beach);

      // Generate map image URL
      const mapImageOptions = {
        ...getMapImageOptions(mapOptions),
        ...customMapOptions,
      };

      const mapImageUrl = getStaticMapImageUrl({
        latitude: coordinates.latitude,
        longitude: coordinates.longitude,
        ...mapImageOptions,
      });

      return {
        id: beach.id,
        name: beach.name,
        rating: 0, // Default rating when not available
        reviewCount: 0, // Default review count when not available
        distance,
        mapImageUrl,
        latitude: beach.latitude,
        longitude: beach.longitude,
        coordinates: coordinates,
      };
    });
  }, [
    beaches,
    limit,
    userLocation,
    customCalculateDistance,
    defaultLocationText,
    mapOptions,
    customMapOptions,
  ]);

  return {
    beachCardData,
    loading: false, // Since this is just data transformation
    error: null,
  };
}
