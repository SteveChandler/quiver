/**
 * Server-Side Featured Beaches Data Fetcher
 *
 * Provides server-only data fetching for featured beaches.
 * Used by server components and API routes to retrieve curated beach listings.
 *
 * This module extracts the core business logic from the featured beaches API route
 * into a reusable server function that can be imported by server components for SSR.
 *
 * Strategy:
 * - First, get beaches with actual photos (from beach_photos table)
 * - Then, fill remaining slots with beaches that have fallback images in FALLBACK_IMAGE_BY_NAME
 * - This ensures visual variety and no duplicate photos on the landing page
 *
 * @module lib/data/server/featured-beaches
 */

import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withApprovedPhotos } from "@/lib/supabase/query-builders";
import {
  EXCLUDED_BEACH_IDS,
  FEATURED_BEACHES_LIMIT,
  FEATURED_BEACHES_RADIUS_MILES,
  MIN_NEARBY_RESULTS,
  getPriorityIndex,
  FALLBACK_IMAGE_BY_NAME,
} from "@/lib/constants/featured-beaches-config";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import type { BeachPhotoSelect, Beach } from "@/types/database";
import type { Coordinates } from "@/lib/types/coordinates";

export interface FeaturedBeachesOptions {
  coordinates?: Coordinates | null;
  radiusMiles?: number;
}

// Type for beach data selected from database
type BeachSelect = Pick<
  Beach,
  "id" | "name" | "city" | "state" | "slug" | "average_rating" | "review_count" | "skill_level" | "lat" | "lon"
>;

// Type for enriched beach with photo URL
export interface EnrichedBeach {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  slug: string | null;
  average_rating: number | null;
  review_count: number | null;
  skill_level: string | null;
  photo_url: string | null | undefined;
  has_real_photo: boolean;
}

const HTTP_URL_REGEX = /^https?:\/\//i;
const FALLBACK_NAME_SET = new Set(
  Object.keys(FALLBACK_IMAGE_BY_NAME).map((name) => name.toLowerCase())
);
const EXCLUDED_BEACH_SET = new Set(EXCLUDED_BEACH_IDS);

/**
 * Sanitizes optional string values by trimming whitespace and converting empty strings to null.
 *
 * @param value - The optional string value to sanitize
 * @returns Sanitized string or null
 */
const sanitizeOptional = (value?: string | null): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

/**
 * Sanitizes photo URLs by trimming whitespace and validating HTTP/HTTPS protocol.
 *
 * @param url - The optional URL to sanitize
 * @returns Sanitized URL or null
 */
const sanitizePhotoUrl = (url?: string | null): string | null => {
  if (!url) return null;
  const trimmed = url.trim();
  return HTTP_URL_REGEX.test(trimmed) ? trimmed : null;
};

/**
 * Maps a raw beach record to an enriched beach object with sanitized fields.
 *
 * @param beach - The raw beach record from database
 * @param photoUrl - The photo URL to associate with the beach
 * @param hasRealPhoto - Whether the beach has a real photo (vs fallback)
 * @returns Enriched beach object or null if invalid
 */
const mapBeachRecord = (
  beach: BeachSelect,
  photoUrl: string | null,
  hasRealPhoto: boolean
): EnrichedBeach | null => {
  const normalizedName = sanitizeOptional(beach.name);
  if (!normalizedName) {
    return null;
  }

  return {
    id: beach.id,
    name: normalizedName,
    city: sanitizeOptional(beach.city),
    state: sanitizeOptional(beach.state),
    slug: sanitizeOptional(beach.slug),
    average_rating: beach.average_rating ?? null,
    review_count: beach.review_count ?? null,
    skill_level: sanitizeOptional(beach.skill_level),
    photo_url: photoUrl,
    has_real_photo: hasRealPhoto && Boolean(photoUrl),
  };
};

/**
 * Applies priority sorting to beaches based on PRIORITY_BEACH_IDS configuration.
 *
 * Priority beaches appear first in the order specified in the configuration.
 * Non-priority beaches maintain their original order.
 *
 * @param beaches - Array of beaches to sort
 */
function applyPrioritySorting(beaches: EnrichedBeach[]): void {
  beaches.sort((a, b) => {
    const aIndex = getPriorityIndex(a.id);
    const bIndex = getPriorityIndex(b.id);

    const aIsPriority = aIndex !== -1;
    const bIsPriority = bIndex !== -1;

    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;

    // If both are priority, sort by priority index
    if (aIsPriority && bIsPriority) {
      return aIndex - bIndex;
    }

    return 0; // Keep original order for non-priority beaches
  });
}

/**
 * Removes duplicate beaches by ID and name (case-insensitive).
 *
 * @param beaches - Array of beaches to deduplicate
 * @returns Array with duplicates removed
 */
function dedupeBeaches(beaches: EnrichedBeach[]): EnrichedBeach[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const deduped: EnrichedBeach[] = [];

  for (const beach of beaches) {
    if (!beach.id || seenIds.has(beach.id)) {
      continue;
    }

    const normalizedName = beach.name.trim().toLowerCase();
    if (!normalizedName || seenNames.has(normalizedName)) {
      continue;
    }

    seenIds.add(beach.id);
    seenNames.add(normalizedName);
    deduped.push(beach);
  }

  return deduped;
}

/**
 * Sorts featured beaches by photo availability and priority.
 *
 * Sort order:
 * 1. Beaches with real photos before beaches without
 * 2. Within each group, priority beaches first (in priority order)
 * 3. Within each group, non-priority beaches alphabetically
 *
 * @param beaches - Array of beaches to sort
 * @returns New sorted array
 */
function sortFeaturedBeaches(beaches: EnrichedBeach[]): EnrichedBeach[] {
  return [...beaches].sort((a, b) => {
    if (a.has_real_photo !== b.has_real_photo) {
      return a.has_real_photo ? -1 : 1;
    }

    const aPriority = getPriorityIndex(a.id);
    const bPriority = getPriorityIndex(b.id);
    const aIsPriority = aPriority !== -1;
    const bIsPriority = bPriority !== -1;

    if (aIsPriority && !bIsPriority) return -1;
    if (!aIsPriority && bIsPriority) return 1;
    if (aIsPriority && bIsPriority) {
      return aPriority - bPriority;
    }

    return a.name.localeCompare(b.name);
  });
}

/**
 * Builds the global featured beaches list (no proximity filtering).
 * Photos-first beaches, then fallback-image beaches, deduped and sorted.
 */
function buildGlobalFeaturedList(
  enrichedWithPhotos: EnrichedBeach[],
  enrichedWithoutPhotos: EnrichedBeach[],
  limit: number
): EnrichedBeach[] {
  const needed = Math.max(0, limit - enrichedWithPhotos.length);
  const combined = [...enrichedWithPhotos, ...enrichedWithoutPhotos.slice(0, needed)];
  const deduped = dedupeBeaches(combined).slice(0, limit);
  return sortFeaturedBeaches(deduped);
}

/**
 * Filters enriched beaches by proximity to user coordinates.
 * Returns beaches within radius, sorted: photos first, then by distance.
 */
function filterByProximity(
  beaches: EnrichedBeach[],
  coordinatesById: Map<string, { lat: number; lon: number }>,
  userCoords: Coordinates,
  radiusMiles: number,
  limit: number
): EnrichedBeach[] {
  return beaches
    .map((beach) => {
      const coords = coordinatesById.get(beach.id);
      if (!coords) return null;

      const distance = calculateDistanceInMiles(userCoords, coords);
      if (!Number.isFinite(distance) || distance > radiusMiles) return null;

      return { beach, distance };
    })
    .filter((item): item is { beach: EnrichedBeach; distance: number } => item !== null)
    .sort((a, b) => {
      if (a.beach.has_real_photo !== b.beach.has_real_photo) {
        return a.beach.has_real_photo ? -1 : 1;
      }
      return a.distance - b.distance;
    })
    .map((item) => item.beach)
    .slice(0, limit);
}

/**
 * Fetches a curated list of featured beaches for the landing page.
 *
 * This function prioritizes beaches with actual photos to avoid showing duplicate
 * fallback images, ensuring visual variety on the landing page.
 *
 * Process:
 * 1. Fetch beach photos and all candidate beaches in parallel (2 queries instead of 3 sequential)
 * 2. Enrich beaches with photo URLs in memory
 * 3. Apply priority sorting to beaches with photos
 * 4. Fill remaining slots with beaches that have fallback images
 * 5. Deduplicate by ID and name
 * 6. Final sort: photos first, then by priority
 *
 * Performance: Parallelized queries reduce latency from ~2000ms to ~700ms
 *
 * @returns Promise resolving to array of enriched beach objects (up to FEATURED_BEACHES_LIMIT)
 */
async function _getFeaturedBeaches(options?: FeaturedBeachesOptions): Promise<EnrichedBeach[]> {
  try {
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      console.error("Failed to initialize Supabase client");
      return [];
    }

    // Step 1: Parallel fetch - photos and all candidate beaches at once
    // This eliminates 2 sequential round trips
    let photosQuery = withApprovedPhotos(
      supabase
        .from("beach_photos")
        .select("beach_id, thumb_url, image_url")
    ).order("beach_id").order("fetched_at", { ascending: false });

    if (EXCLUDED_BEACH_IDS.length > 0) {
      photosQuery = photosQuery.not("beach_id", "in", `(${EXCLUDED_BEACH_IDS.join(",")})`);
    }

    const beachesQuery = supabase
      .from("beaches")
      .select("id, name, city, state, slug, average_rating, review_count, skill_level, lat, lon")
      .eq("is_private", false)
      .limit(FEATURED_BEACHES_LIMIT * 3); // Fetch extra for filtering

    // Execute both queries in parallel
    const [photosResult, beachesResult] = await Promise.all([
      photosQuery,
      beachesQuery,
    ]);

    if (photosResult.error) {
      console.error("Database error fetching beach photos:", photosResult.error);
    }
    if (beachesResult.error) {
      console.error("Database error fetching beaches:", beachesResult.error);
      return [];
    }

    // Step 2: Build photos map (one photo per beach)
    const photosMap = new Map<string, string>();
    (photosResult.data || []).forEach((photo: BeachPhotoSelect) => {
      if (EXCLUDED_BEACH_SET.has(photo.beach_id) || photosMap.has(photo.beach_id)) {
        return;
      }
      const imageUrl = sanitizePhotoUrl(photo.thumb_url) || sanitizePhotoUrl(photo.image_url);
      if (imageUrl) {
        photosMap.set(photo.beach_id, imageUrl);
      }
    });

    // Step 3: Enrich beaches in memory (no additional DB queries)
    const allBeaches: BeachSelect[] = (beachesResult.data || []) as BeachSelect[];
    const coordinatesById = new Map<string, { lat: number; lon: number }>();
    const enrichedWithPhotos: EnrichedBeach[] = [];
    const enrichedWithoutPhotos: EnrichedBeach[] = [];

    for (const beach of allBeaches) {
      if (EXCLUDED_BEACH_SET.has(beach.id)) continue;

      // Store coordinates for proximity filtering (O(1) lookups later)
      if (beach.lat != null && beach.lon != null) {
        coordinatesById.set(beach.id, { lat: beach.lat, lon: beach.lon });
      }

      const photoUrl = photosMap.get(beach.id);
      const hasRealPhoto = Boolean(photoUrl);
      const record = mapBeachRecord(beach, photoUrl ?? null, hasRealPhoto);

      if (record) {
        if (hasRealPhoto) {
          enrichedWithPhotos.push(record);
        } else {
          // Check if beach has fallback image
          const normalizedName = beach.name?.toLowerCase() || "";
          if (FALLBACK_NAME_SET.has(normalizedName)) {
            enrichedWithoutPhotos.push(record);
          }
        }
      }
    }

    // Step 4: Apply priority sorting to beaches with photos
    applyPrioritySorting(enrichedWithPhotos);

    // Step 5: Build global list (used for no-coords path and as proximity fallback)
    const globalList = buildGlobalFeaturedList(
      enrichedWithPhotos,
      enrichedWithoutPhotos,
      FEATURED_BEACHES_LIMIT
    );

    // Step 6: When user coordinates are available, filter to nearby beaches
    const userCoords = options?.coordinates;
    if (!userCoords) {
      return globalList;
    }

    const radiusMiles = options?.radiusMiles ?? FEATURED_BEACHES_RADIUS_MILES;
    const allDeduped = dedupeBeaches([...enrichedWithPhotos, ...enrichedWithoutPhotos]);
    const nearby = filterByProximity(
      allDeduped,
      coordinatesById,
      userCoords,
      radiusMiles,
      FEATURED_BEACHES_LIMIT
    );

    // Fall back to global list if too few nearby results
    return nearby.length < MIN_NEARBY_RESULTS ? globalList : nearby;
  } catch (error) {
    console.error("Error fetching featured beaches:", error);
    // Return empty array for graceful degradation
    return [];
  }
}

/**
 * Cached featured beaches fetcher (server-side Next.js cache).
 *
 * - Keeps landing SSR fast by avoiding repeated Supabase queries on every `/` request.
 * - Tagged so we can invalidate later if/when we add admin tooling to update featured content.
 *
 * Note: Wrapped in try/catch to be resilient in test environments where Next cache may not be available.
 */
export async function getFeaturedBeaches(options?: FeaturedBeachesOptions): Promise<EnrichedBeach[]> {
  // When coordinates are provided, bypass cache to avoid cache key explosion per unique lat/lon
  if (options?.coordinates) {
    return await _getFeaturedBeaches(options);
  }

  try {
    const cachedFetch = unstable_cache(_getFeaturedBeaches, ["featured-beaches"], {
      tags: ["featured-beaches"],
      revalidate: 600, // 10 minutes
    });
    return await cachedFetch();
  } catch {
    return await _getFeaturedBeaches();
  }
}
