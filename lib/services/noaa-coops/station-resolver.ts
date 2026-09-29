/**
 * Station resolver for NOAA CO-OPS tide stations
 *
 * Provides station lookup by beach name or geographic coordinates.
 */

import { calculateDistance } from "@/lib/utils/distance-utils";
import { COOPS_STATIONS } from "./constants/station-mappings";
import { GEOGRAPHIC_STATIONS } from "./constants/geographic-regions";
import { COOPS_STATION_COORDINATES } from "./constants/station-coordinates";
import type { RegionBounds } from "./types";

/** Default station when no match is found (La Jolla) */
const DEFAULT_STATION_ID = "9410230";

/**
 * Farthest a name-matched station may be from the beach's coordinates. Names
 * collide across coasts ("newport", "long-beach", "ocean-beach"); within 200 km
 * CO-OPS water temperature still reads within ~1.3°F of the nearest buoy.
 */
const MAX_NAME_MATCH_KM = 200;

/**
 * Options for station resolution logging
 */
interface StationResolverOptions {
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
 * With coordinates, a name match (1-2) counts only when its station is within
 * MAX_NAME_MATCH_KM of them. A blank name skips name matching.
 *
 * @param beachName - Name of the beach
 * @param lat - Optional latitude
 * @param lon - Optional longitude
 * @param options - Optional resolver options
 * @returns CO-OPS station ID
 */
export function getStationForLocation(
  beachName: string,
  lat?: number,
  lon?: number,
  options?: StationResolverOptions
): string {
  const normalizedName = beachName.trim().toLowerCase().replace(/\s+/g, "-");

  // An empty name is a substring of every key, so it would always match the
  // first entry (La Jolla) regardless of coordinates.
  if (normalizedName) {
    for (const stationId of findNameMatches(normalizedName)) {
      if (lat === undefined || lon === undefined) return stationId;
      const distanceKm = getStationDistanceKm(stationId, lat, lon);
      if (distanceKm !== null && distanceKm <= MAX_NAME_MATCH_KM) return stationId;
      if (options?.verbose && options?.logger) {
        options.logger.debug(
          `Skipping name-matched tide station ${stationId} for ${beachName}: ${distanceKm === null ? "no coordinates" : `${Math.round(distanceKm)} km away`}`
        );
      }
    }
  }

  // Fallback based on geographic location
  if (lat !== undefined && lon !== undefined) {
    // Find matching geographic region
    const matchingRegion = findRegionByCoordinates(lat, lon);
    if (matchingRegion) {
      if (options?.verbose && options?.logger) {
        options.logger.debug(
          `Using ${matchingRegion.name} tide station (${matchingRegion.stationId}) for ${beachName} at ${lat}, ${lon}`
        );
      }
      return matchingRegion.stationId;
    }

    // If no exact region match, find nearest region by distance
    const nearest = findNearestStation(lat, lon);
    if (options?.verbose && options?.logger) {
      options.logger.debug(
        `Using nearest tide station (${nearest.stationId}) for ${beachName} at ${lat}, ${lon} (distance: ${nearest.distance.toFixed(2)}°)`
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
 * Stations whose names match the beach name: the exact key first, then every
 * partial match in table order.
 */
function findNameMatches(normalizedName: string): string[] {
  const matches: string[] = [];
  const exact = COOPS_STATIONS[normalizedName];
  if (exact) matches.push(exact);
  for (const [key, stationId] of Object.entries(COOPS_STATIONS)) {
    if (normalizedName.includes(key) || key.includes(normalizedName)) {
      matches.push(stationId);
    }
  }
  return matches;
}

/**
 * Great-circle distance from a point to a resolver station, or null when the
 * station has no entry in COOPS_STATION_COORDINATES.
 */
export function getStationDistanceKm(
  stationId: string,
  lat: number,
  lon: number
): number | null {
  const station = COOPS_STATION_COORDINATES[stationId];
  if (!station) return null;
  return calculateDistance({ lat, lon }, station, "km");
}

/**
 * Find a geographic region that contains the given coordinates
 *
 * @param lat - Latitude
 * @param lon - Longitude
 * @returns Matching region or null
 */
function findRegionByCoordinates(
  lat: number,
  lon: number
): RegionBounds | null {
  for (const region of GEOGRAPHIC_STATIONS) {
    if (
      lat >= region.latMin &&
      lat <= region.latMax &&
      lon >= region.lonMin &&
      lon <= region.lonMax
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
 * @param lon - Longitude
 * @returns Object with stationId and distance in degrees
 */
function findNearestStation(
  lat: number,
  lon: number
): { stationId: string; distance: number } {
  let nearestStation = DEFAULT_STATION_ID;
  let nearestDistance = Infinity;

  for (const region of GEOGRAPHIC_STATIONS) {
    const regionCenterLat = (region.latMin + region.latMax) / 2;
    const regionCenterLon = (region.lonMin + region.lonMax) / 2;
    const distance = Math.sqrt(
      Math.pow(lat - regionCenterLat, 2) + Math.pow(lon - regionCenterLon, 2)
    );
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearestStation = region.stationId;
    }
  }

  return { stationId: nearestStation, distance: nearestDistance };
}

