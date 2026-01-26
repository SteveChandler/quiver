/**
 * Station resolver for NOAA CO-OPS tide stations
 *
 * Provides station lookup by beach name or geographic coordinates.
 */

import { COOPS_STATIONS } from "./constants/station-mappings";
import { GEOGRAPHIC_STATIONS } from "./constants/geographic-regions";
import type { RegionBounds } from "./types";

/** Default station when no match is found (La Jolla) */
const DEFAULT_STATION_ID = "9410230";

/**
 * Options for station resolution logging
 */
export interface StationResolverOptions {
  verbose?: boolean;
  logger?: {
    debug: (message: string, ...args: unknown[]) => void;
    warn: (message: string, ...args: unknown[]) => void;
  };
}

/**
 * Get the appropriate CO-OPS station for a beach location
 *
 * Resolution order:
 * 1. Direct lookup by normalized beach name
 * 2. Partial name matching
 * 3. Geographic bounds lookup (if coordinates provided)
 * 4. Nearest station by distance (if coordinates provided)
 * 5. Default to La Jolla station
 *
 * @param beachName - Name of the beach
 * @param lat - Optional latitude
 * @param lng - Optional longitude
 * @param options - Optional resolver options
 * @returns CO-OPS station ID
 */
export function getStationForLocation(
  beachName: string,
  lat?: number,
  lng?: number,
  options?: StationResolverOptions
): string {
  const normalizedName = beachName.toLowerCase().replace(/\s+/g, "-");

  // First try direct lookup by beach name
  if (COOPS_STATIONS[normalizedName]) {
    return COOPS_STATIONS[normalizedName];
  }

  // Try partial name matching
  for (const [key, stationId] of Object.entries(COOPS_STATIONS)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      return stationId;
    }
  }

  // Fallback based on geographic location
  if (lat !== undefined && lng !== undefined) {
    // Find matching geographic region
    const matchingRegion = findRegionByCoordinates(lat, lng);
    if (matchingRegion) {
      if (options?.verbose && options?.logger) {
        options.logger.debug(
          `Using ${matchingRegion.name} tide station (${matchingRegion.stationId}) for ${beachName} at ${lat}, ${lng}`
        );
      }
      return matchingRegion.stationId;
    }

    // If no exact region match, find nearest region by distance
    const nearest = findNearestStation(lat, lng);
    if (options?.verbose && options?.logger) {
      options.logger.debug(
        `Using nearest tide station (${nearest.stationId}) for ${beachName} at ${lat}, ${lng} (distance: ${nearest.distance.toFixed(2)}°)`
      );
    }
    return nearest.stationId;
  }

  // Final fallback - La Jolla station (most common use case)
  if (options?.logger) {
    options.logger.warn(
      `No tide station found for ${beachName}, defaulting to La Jolla`
    );
  }
  return DEFAULT_STATION_ID;
}

/**
 * Find a geographic region that contains the given coordinates
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Matching region or null
 */
export function findRegionByCoordinates(
  lat: number,
  lng: number
): RegionBounds | null {
  for (const region of GEOGRAPHIC_STATIONS) {
    if (
      lat >= region.latMin &&
      lat <= region.latMax &&
      lng >= region.lonMin &&
      lng <= region.lonMax
    ) {
      return region;
    }
  }
  return null;
}

/**
 * Find the nearest station by calculating distance to region centers
 *
 * Uses simple Euclidean distance on coordinates (sufficient for station selection).
 * For more accuracy, use Haversine formula, but the difference is negligible
 * for selecting the nearest tide station.
 *
 * @param lat - Latitude
 * @param lng - Longitude
 * @returns Object with stationId and distance in degrees
 */
export function findNearestStation(
  lat: number,
  lng: number
): { stationId: string; distance: number } {
  let nearestStation = DEFAULT_STATION_ID;
  let nearestDistance = Infinity;

  for (const region of GEOGRAPHIC_STATIONS) {
    const regionCenterLat = (region.latMin + region.latMax) / 2;
    const regionCenterLon = (region.lonMin + region.lonMax) / 2;
    const distance = Math.sqrt(
      Math.pow(lat - regionCenterLat, 2) + Math.pow(lng - regionCenterLon, 2)
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestStation = region.stationId;
    }
  }

  return { stationId: nearestStation, distance: nearestDistance };
}

/**
 * Check if a beach name has a direct station mapping
 *
 * @param beachName - Name of the beach
 * @returns true if a direct mapping exists
 */
export function hasDirectStationMapping(beachName: string): boolean {
  const normalizedName = beachName.toLowerCase().replace(/\s+/g, "-");
  return normalizedName in COOPS_STATIONS;
}

/**
 * Get the station ID for a normalized beach name (direct lookup only)
 *
 * @param normalizedName - Normalized beach name (lowercase, hyphenated)
 * @returns Station ID or undefined
 */
export function getStationByNormalizedName(
  normalizedName: string
): string | undefined {
  return COOPS_STATIONS[normalizedName];
}
