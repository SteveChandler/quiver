/**
 * Featured Beaches Configuration
 *
 * Centralized configuration for featured beaches endpoint and related features.
 * Manages beach prioritization, exclusions, and display limits.
 *
 * @module lib/constants/featured-beaches-config
 */

/**
 * Beaches excluded from featured listings due to broken photos or other issues.
 *
 * Add beach IDs here to remove them from featured beaches rotation.
 * Each entry should include a comment explaining why the beach is excluded.
 */
export const EXCLUDED_BEACH_IDS: readonly string[] = [
  "9e94759c-d531-4e5c-9bc2-d022acea9dcd", // Imperial Beach - has broken Openverse photo
] as const;

/**
 * Priority beaches that should appear first in featured listings.
 *
 * These beaches are shown at the top of featured beaches lists because they have:
 * - High-quality, reliable photos
 * - Popular destinations
 * - Excellent conditions and amenities
 *
 * Order matters: beaches appear in the order listed here.
 */
export const PRIORITY_BEACH_IDS: readonly string[] = [
  "01330afc-00d3-461b-88f3-b173774766f4", // Blacks Beach - reliable photo, iconic SD surf spot
] as const;

/**
 * Maximum number of featured beaches to return in API responses.
 *
 * This limit balances:
 * - Visual variety on landing page
 * - Performance (payload size)
 * - Database query efficiency
 */
export const FEATURED_BEACHES_LIMIT = 50;

/**
 * Mapping of beach names to curated fallback imagery.
 *
 * Landing page components and the featured beaches API both rely on these
 * curated assets to ensure we never duplicate generic placeholder photos.
 */
export const FALLBACK_IMAGE_BY_NAME = {
  "Black's Beach": "/images/blacks.webp",
  "Blacks Beach": "/images/blacks.webp",
  "Swami's": "/images/Winter-Swamis.webp",
  Swamis: "/images/Winter-Swamis.webp",
  Tourmaline: "/images/tourmaline.png",
  Windansea: "/images/windandsea-surf-shack-sunset.jpg",
  "WindanSea Beach": "/images/windandsea-surf-shack-sunset.jpg",
  "Agate Beach": "/images/Agate_Beach_Marin_County_California.webp",
  "Beacons Beach": "/images/Beacons_Beach.webp",
  Beacons: "/images/Beacons_Beach.webp",
  "Ocean Beach": "/images/OceanBeachSurfers.jpg",
  "Bandon Beach": "/images/On_the_Beach_at_Bandon.webp",
} as const;

export type FallbackBeachName = keyof typeof FALLBACK_IMAGE_BY_NAME;

export const getFallbackImageForBeach = (name: string): string | undefined => {
  return FALLBACK_IMAGE_BY_NAME[name as FallbackBeachName];
};

/**
 * Default limit for beach photo fetching in getBestBeachPhotosAction.
 *
 * Controls how many photos are fetched when displaying beach media galleries.
 * Higher values provide more variety but increase payload size and query time.
 */
export const DEFAULT_BEACH_PHOTOS_LIMIT = 12;

/**
 * Type guards for beach ID validation
 */
export const isExcludedBeach = (beachId: string): boolean => {
  return EXCLUDED_BEACH_IDS.includes(beachId);
};

export const isPriorityBeach = (beachId: string): boolean => {
  return PRIORITY_BEACH_IDS.includes(beachId);
};

/**
 * Get priority index for sorting (lower index = higher priority)
 * Returns -1 if beach is not in priority list
 */
export const getPriorityIndex = (beachId: string): number => {
  return PRIORITY_BEACH_IDS.indexOf(beachId);
};
