import type { Beach } from "@/types/database";
import { resolveBeachCoordinates, getStaticMapImageUrl } from "@/lib/map-utils";
import { calculateDistanceFormatted } from "@/lib/utils/distance-utils";
import { MAP_PRESET_USAGE } from "@/lib/constants/map-presets";
import type { ReviewStats } from "@/lib/review-stats-utils";

interface BeachCardData {
  id: string;
  name: string;
  coords: { latitude: number; longitude: number } | null;
  mapImageUrl: string;
  rating: number;
  reviewCount: number;
  distance: string;
  latitude?: number;
  longitude?: number;
  slug?: string | null;
  city?: string | null;
  state?: string | null;
}

/**
 * Prepare beach card data with coordinates, map image, and stats
 */
function prepareBeachCardData(
  beach: Beach,
  userLocation?: { lat: number; lng: number } | null,
  reviewStats?: Record<string, ReviewStats>,
  mapPreset: keyof typeof MAP_PRESET_USAGE = "BEACH_CARD_LIST"
): BeachCardData {
  // Get beach coordinates using the unified resolution function
  const coords = resolveBeachCoordinates(beach);

  // Get review stats for this beach
  const stats = reviewStats?.[beach.id];

  // Calculate distance if user location and beach coordinates are available
  let distance = "Unknown distance";
  if (userLocation && coords) {
    distance = calculateDistanceFormatted(
      userLocation.lat,
      userLocation.lng,
      coords.latitude,
      coords.longitude,
      "miles"
    );
  } else if (beach.location_text) {
    distance = beach.location_text;
  } else {
    // Fallback distance calculation for display
    distance = `${Math.floor(Math.random() * 20) + 1} miles`;
  }

  // Generate the map image URL using the specified preset
  const mapImageUrl = getStaticMapImageUrl(
    coords?.latitude,
    coords?.longitude,
    MAP_PRESET_USAGE[mapPreset]
  );

  return {
    id: beach.id,
    name: beach.name,
    coords,
    mapImageUrl,
    rating: stats?.average_overall || 0,
    reviewCount: stats?.total_reviews || 0,
    distance,
    latitude: coords?.latitude,
    longitude: coords?.longitude,
    slug: beach.slug ?? null,
    city: beach.city ?? null,
    state: beach.state ?? null,
  };
}

/**
 * Get beach location display string from city, state, and region
 * Prioritizes city/state, falls back to region or "California"
 */
export function getBeachLocation(beach: Beach): string {
  if (beach.city && beach.state) {
    return `${beach.city}, ${beach.state}`;
  }
  if (beach.city) {
    return beach.city;
  }
  if (beach.state) {
    return beach.state;
  }
  if (beach.region_id) {
    return beach.region_id;
  }
  return "California";
}

/**
 * Prepare multiple beach cards data efficiently
 */
export function prepareMultipleBeachCardData(
  beaches: Beach[],
  userLocation?: { lat: number; lng: number } | null,
  reviewStats?: Record<string, ReviewStats>,
  mapPreset: keyof typeof MAP_PRESET_USAGE = "BEACH_CARD_LIST"
): BeachCardData[] {
  return beaches.map((beach) =>
    prepareBeachCardData(beach, userLocation, reviewStats, mapPreset)
  );
}
