/**
 * Beach Core Types - Type hierarchy for beach-related data
 *
 * This module establishes a clear type hierarchy to eliminate duplication
 * across the codebase. All beach-related types should extend from these base types.
 *
 * Type Hierarchy:
 * - BeachLocation: Minimal location data (slug, city, state)
 * - BeachIdentity: Location + identification (id, name)
 * - Beach: Full beach entity (extends BeachIdentity with all properties)
 *
 * @module types/beach-core
 */

import type { Coordinates } from '@/lib/types/coordinates';

/**
 * Minimal beach location data required for hierarchical URL generation
 *
 * Used for: URL building, navigation, SEO
 *
 * @example
 * const location: BeachLocation = {
 *   slug: "ocean-beach",
 *   city: "San Diego",
 *   state: "CA"
 * };
 */
export interface BeachLocation {
  slug: string | null;
  city: string | null;
  state: string | null;
  /**
   * Optional country name (e.g., "USA", "Mexico").
   * When present, enables canonical international URLs like:
   * /{country}/{state}/{city}/{beachSlug}
   */
  country?: string | null;
}

/**
 * Beach identity including basic identification fields
 *
 * Extends BeachLocation with id and name for complete identification
 * Used for: Components, cards, lists where minimal beach data is needed
 *
 * @example
 * const beach: BeachIdentity = {
 *   id: "123",
 *   name: "Ocean Beach",
 *   slug: "ocean-beach",
 *   city: "San Diego",
 *   state: "CA"
 * };
 */
export interface BeachIdentity extends BeachLocation {
  id: string;
  name: string;
}

/**
 * Coordinates for geospatial operations
 *
 * Re-exported from centralized coordinate types for backward compatibility
 * @see /lib/types/coordinates.ts for the canonical definition
 *
 * Used for: Location services, distance calculations, map positioning
 */
export type BeachCoordinates = Coordinates;

/**
 * Beach identity with optional coordinates
 *
 * Combines identification with optional geospatial data
 * Used for: Components that may need location but not always
 */
export interface BeachIdentityWithCoords extends BeachIdentity {
  lat?: number | null;
  lon?: number | null;
}

/**
 * Minimal beach data for URL generation with fallback
 *
 * Supports both hierarchical URLs (with slug/city/state) and ID-based fallback
 * Used by: getBeachUrlSafe utility, navigation components
 *
 * @example
 * // Hierarchical URL
 * const beach1: BeachUrlData = {
 *   id: "123",
 *   slug: "ocean-beach",
 *   city: "San Diego",
 *   state: "CA"
 * };
 *
 * // ID-based fallback
 * const beach2: BeachUrlData = {
 *   id: "456",
 *   slug: null,
 *   city: null,
 *   state: null
 * };
 */
export type BeachUrlData = Partial<BeachLocation> & {
  id?: string;
};

/**
 * Type guard to check if beach has complete location data
 *
 * @param beach - Beach object to check
 * @returns True if beach has slug, city, and state
 *
 * @example
 * if (hasCompleteLocation(beach)) {
 *   const url = buildBeachUrl(beach); // TypeScript knows location is complete
 * }
 */
export function hasCompleteLocation(
  beach: Partial<BeachLocation>
): beach is BeachLocation {
  return !!(beach.slug && beach.city && beach.state);
}

/**
 * Type guard to check if beach has coordinates
 *
 * @param beach - Beach object to check
 * @returns True if beach has valid lat and lon
 *
 * @example
 * if (hasCoordinates(beach)) {
 *   const distance = calculateDistance(userLocation, beach);
 * }
 */
export function hasCoordinates(
  beach: Partial<BeachCoordinates>
): beach is BeachCoordinates {
  return typeof beach.lat === 'number' && typeof beach.lon === 'number';
}
