/**
 * IP Location Utilities
 *
 * Functions for extracting IP-based location from Vercel headers
 * and matching to metro areas.
 */

import { METRO_AREAS, type MetroAreaConfig } from '@/lib/constants/metro-areas';
import { calculateDistanceInMiles } from '@/lib/utils/distance-utils';
import type { IPLocationData, MetroMatch } from './types';
import { IP_LOCATION_COOKIE } from './types';

/**
 * Default location when no IP data is available (Ocean Beach, San Diego)
 */
export const DEFAULT_LOCATION: MetroMatch = {
  slug: 'san-diego',
  displayName: 'San Diego',
  coordinates: { lat: 32.7503, lon: -117.2534 },
};

/**
 * Extract IP location data from Vercel geolocation headers.
 *
 * Vercel provides these headers automatically on their Edge Network:
 * - x-vercel-ip-city: City name
 * - x-vercel-ip-region: State/region code
 * - x-vercel-ip-country: Country code
 * - x-vercel-ip-latitude: Latitude
 * - x-vercel-ip-longitude: Longitude
 *
 * @param headers - Request headers from Next.js middleware
 * @returns IPLocationData with null values for missing headers
 */
export function extractIPLocation(headers: Headers): IPLocationData {
  const city = headers.get('x-vercel-ip-city');
  const region = headers.get('x-vercel-ip-region');
  const country = headers.get('x-vercel-ip-country');
  const latStr = headers.get('x-vercel-ip-latitude');
  const lonStr = headers.get('x-vercel-ip-longitude');

  return {
    city: city ? decodeURIComponent(city) : null,
    region: region || null,
    country: country || null,
    latitude: latStr ? parseFloat(latStr) : null,
    longitude: lonStr ? parseFloat(lonStr) : null,
  };
}

/**
 * Match IP location to the nearest metro area.
 *
 * Matching priority:
 * 1. Exact city name match in metro cities array
 * 2. City name matches metro display name (case-insensitive)
 * 3. Nearest metro by coordinates (within 100 miles)
 * 4. Default to San Diego
 *
 * @param ipLocation - IP location data from headers
 * @returns MetroMatch with display name and coordinates
 */
export function matchToMetroArea(ipLocation: IPLocationData): MetroMatch {
  const { city, latitude, longitude } = ipLocation;

  // Try exact city match
  if (city) {
    for (const [slug, config] of Object.entries(METRO_AREAS)) {
      // Check if city name is in the metro's cities array
      if (config.cities.some((c) => c.toLowerCase() === city.toLowerCase())) {
        return {
          slug,
          displayName: config.displayName,
          coordinates: config.centerCoordinates,
        };
      }

      // Check if city name matches metro display name
      if (config.displayName.toLowerCase() === city.toLowerCase()) {
        return {
          slug,
          displayName: config.displayName,
          coordinates: config.centerCoordinates,
        };
      }
    }

    // Check if city name matches a metro slug (e.g., "San Diego" -> "san-diego")
    const normalizedCity = city.toLowerCase().replace(/\s+/g, '-');
    const metroConfig = METRO_AREAS[normalizedCity];
    if (metroConfig) {
      return {
        slug: normalizedCity,
        displayName: metroConfig.displayName,
        coordinates: metroConfig.centerCoordinates,
      };
    }
  }

  // Try coordinate-based matching (within 100 miles)
  if (latitude !== null && longitude !== null && !isNaN(latitude) && !isNaN(longitude)) {
    const nearestMetro = findNearestMetro({ lat: latitude, lon: longitude }, 100);
    if (nearestMetro) {
      return nearestMetro;
    }

    // No metro match — return raw IP coordinates with city/region display name
    const displayName = [ipLocation.city, ipLocation.region]
      .filter(Boolean)
      .join(", ") || "Your Area";
    return {
      slug: null,
      displayName,
      coordinates: { lat: latitude, lon: longitude },
    };
  }

  // Default to San Diego only when no coordinates available at all
  return DEFAULT_LOCATION;
}

/**
 * Find the nearest metro area to given coordinates.
 *
 * @param coords - User coordinates
 * @param maxDistanceMiles - Maximum distance to consider (default 100 miles)
 * @returns MetroMatch if within range, null otherwise
 */
function findNearestMetro(
  coords: { lat: number; lon: number },
  maxDistanceMiles: number = 100
): MetroMatch | null {
  let nearestMetro: MetroMatch | null = null;
  let nearestDistance = Infinity;

  for (const [slug, config] of Object.entries(METRO_AREAS)) {
    const distance = calculateDistanceInMiles(
      coords,
      config.centerCoordinates
    );

    if (!isNaN(distance) && distance < nearestDistance && distance <= maxDistanceMiles) {
      nearestDistance = distance;
      nearestMetro = {
        slug,
        displayName: config.displayName,
        coordinates: config.centerCoordinates,
      };
    }
  }

  return nearestMetro;
}

/**
 * Serialize IP location data for cookie storage.
 *
 * @param ipLocation - IP location data
 * @returns JSON string for cookie value
 */
export function serializeIPLocation(ipLocation: IPLocationData): string {
  return JSON.stringify(ipLocation);
}

/**
 * Parse IP location data from cookie value.
 *
 * @param cookieValue - JSON string from cookie
 * @returns IPLocationData or null if invalid
 */
export function parseIPLocationCookie(cookieValue: string | undefined): IPLocationData | null {
  if (!cookieValue) return null;

  try {
    const parsed = JSON.parse(cookieValue);
    return {
      city: parsed.city || null,
      region: parsed.region || null,
      country: parsed.country || null,
      latitude: typeof parsed.latitude === 'number' ? parsed.latitude : null,
      longitude: typeof parsed.longitude === 'number' ? parsed.longitude : null,
    };
  } catch {
    return null;
  }
}

/**
 * Get IP location cookie name.
 */
export function getIPLocationCookieName(): string {
  return IP_LOCATION_COOKIE;
}
