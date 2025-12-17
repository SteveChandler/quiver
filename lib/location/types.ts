/**
 * Location Types
 *
 * Types for IP-based and browser-based geolocation detection.
 * Used by the location context and landing page components.
 */

/**
 * IP-based location data from Vercel geolocation headers.
 * All fields may be null if headers are not available (e.g., local development).
 */
export interface IPLocationData {
  /** City name (e.g., "San Diego", "Los Angeles") */
  city: string | null;
  /** State/region code (e.g., "CA", "OR") */
  region: string | null;
  /** Country code (e.g., "US", "MX") */
  country: string | null;
  /** Latitude coordinate */
  latitude: number | null;
  /** Longitude coordinate */
  longitude: number | null;
}

/**
 * Source of the current location data.
 */
export type LocationSource = 'ip' | 'browser' | 'default';

/**
 * Resolved location for display in UI components.
 */
export interface ResolvedLocation {
  /** Display name for the location (e.g., "San Diego", "Orange County") */
  displayName: string;
  /** Coordinates if available */
  coordinates: { lat: number; lon: number } | null;
  /** Source of this location data */
  source: LocationSource;
  /** Whether location is still being determined */
  isLoading: boolean;
}

/**
 * Result of matching IP location to a metro area.
 */
export interface MetroMatch {
  /** Metro area slug (e.g., "san-diego") */
  slug: string;
  /** Display name (e.g., "San Diego") */
  displayName: string;
  /** Center coordinates of the metro area */
  coordinates: { lat: number; lon: number };
}

/**
 * Cookie name for storing IP-based location data client-side.
 */
export const IP_LOCATION_COOKIE = 'quiver_ip_region';
