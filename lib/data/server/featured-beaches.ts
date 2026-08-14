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
  EXPANDED_SEARCH_RADII,
  FEATURED_BEACHES_LIMIT,
  FEATURED_BEACHES_RADIUS_MILES,
  MIN_NEARBY_RESULTS,
  getPriorityIndex,
  FALLBACK_IMAGE_BY_NAME,
} from "@/lib/constants/featured-beaches-config";
import { calculateDistanceInMiles } from "@/lib/utils/distance-utils";
import { rankBeaches } from "@/lib/recommendations/selection";
import { WATER_QUALITY_HOLD_PREFETCH_BUFFER } from "@/lib/recommendations/major-event-hold/water-quality";
import type { BeachPhotoSelect, Beach } from "@/types/database";
import type { Coordinates } from "@/lib/types/coordinates";

export interface FeaturedBeachesOptions {
  coordinates?: Coordinates | null;
  radiusMiles?: number;
}

// Type for beach data selected from database
type BeachSelect = Pick<
  Beach,
  "id" | "name" | "city" | "state" | "country" | "slug" | "average_rating" | "review_count" | "skill_level" | "lat" | "lon"
>;

// Type for enriched beach with photo URL
export interface EnrichedBeach {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  country?: string | null;
  slug: string | null;
  average_rating: number | null;
  review_count: number | null;
  skill_level: string | null;
  photo_url: string | null | undefined;
  has_real_photo: boolean;
  score?: number | null;                // Current forecast score (0-100)
  wave_height?: string | number | null;  // Current wave height (raw string from forecast, e.g. "2.8")
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
    country: sanitizeOptional(beach.country),
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

function getLandingSkillPriority(skillLevel?: string | null): number {
  const normalized = (skillLevel ?? "").trim().toLowerCase();

  if (normalized.includes("expert")) return 5;
  if (
    normalized.includes("beginner") ||
    normalized.includes("longboard") ||
    normalized.includes("easy") ||
    normalized.includes("mellow") ||
    normalized.includes("lower-intermediate")
  ) {
    return 0;
  }
  if (normalized.includes("intermediate") && normalized.includes("advanced")) {
    return 2;
  }
  if (normalized.includes("intermediate")) return 1;
  if (normalized.includes("advanced")) return 4;
  return 3;
}

function compareNullableNumberDesc(
  a: number | null | undefined,
  b: number | null | undefined
): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  return b - a;
}

export function sortLandingFeaturedBeaches(
  beaches: EnrichedBeach[]
): EnrichedBeach[] {
  return [...beaches].sort((a, b) => {
    if (a.has_real_photo !== b.has_real_photo) {
      return a.has_real_photo ? -1 : 1;
    }

    const skillDelta =
      getLandingSkillPriority(a.skill_level) -
      getLandingSkillPriority(b.skill_level);
    if (skillDelta !== 0) return skillDelta;

    const scoreDelta = compareNullableNumberDesc(a.score, b.score);
    if (scoreDelta !== 0) return scoreDelta;

    const ratingDelta = compareNullableNumberDesc(
      a.average_rating,
      b.average_rating
    );
    if (ratingDelta !== 0) return ratingDelta;

    const reviewDelta = compareNullableNumberDesc(
      a.review_count,
      b.review_count
    );
    if (reviewDelta !== 0) return reviewDelta;

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
export interface FeaturedBeachesResult {
  beaches: EnrichedBeach[];
  isNearby: boolean;
}

async function _getFeaturedBeaches(options?: FeaturedBeachesOptions): Promise<FeaturedBeachesResult> {
  try {
    const supabase = await createSupabaseServerClient();

    if (!supabase) {
      console.error("Failed to initialize Supabase client");
      return { beaches: [], isNearby: false };
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

    let beachesQuery = supabase
      .from("beaches")
      .select("id, name, city, state, country, slug, average_rating, review_count, skill_level, lat, lon")
      .eq("is_private", false);

    // When no coordinates, limit for performance; with coordinates, fetch all for proximity filtering
    if (!options?.coordinates) {
      beachesQuery = beachesQuery.limit(
        FEATURED_BEACHES_LIMIT * 3 + WATER_QUALITY_HOLD_PREFETCH_BUFFER,
      );
    }

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
      return { beaches: [], isNearby: false };
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

    const allDeduped = dedupeBeaches([
      ...enrichedWithPhotos,
      ...enrichedWithoutPhotos,
    ]);
    // Filter the source list before any derived list is cached. The comparator
    // preserves the existing curated order; ranking is still enforced at the
    // downstream proximity/landing selection sites.
    const safeBeaches = await rankBeaches(allDeduped, { compare: () => 0 });
    const safeWithPhotos = safeBeaches.filter((beach) => beach.has_real_photo);
    const safeWithoutPhotos = safeBeaches.filter(
      (beach) => !beach.has_real_photo,
    );

    // Step 5: Build global list (used for no-coords path and as proximity fallback)
    const globalList = buildGlobalFeaturedList(
      safeWithPhotos,
      safeWithoutPhotos,
      FEATURED_BEACHES_LIMIT
    );

    // Step 6: When user coordinates are available, filter to nearby beaches
    const userCoords = options?.coordinates;
    if (!userCoords) {
      return { beaches: globalList, isNearby: false };
    }

    const radiusMiles = options?.radiusMiles ?? FEATURED_BEACHES_RADIUS_MILES;
    const nearby = filterByProximity(
      safeBeaches,
      coordinatesById,
      userCoords,
      radiusMiles,
      FEATURED_BEACHES_LIMIT
    );

    // If initial radius finds enough beaches with photos, use them
    const nearbyWithPhotos = nearby.filter((b) => b.has_real_photo);
    if (nearbyWithPhotos.length >= MIN_NEARBY_RESULTS) {
      return { beaches: nearby, isNearby: true };
    }

    // Expand radius progressively to find closest beaches
    // (e.g., DC → OBX at ~300mi, Atlanta → FL at ~500mi)
    for (const expandedRadius of EXPANDED_SEARCH_RADII) {
      if (expandedRadius <= radiusMiles) continue; // skip radii we've already covered
      const expanded = filterByProximity(
        safeBeaches, coordinatesById, userCoords, expandedRadius, FEATURED_BEACHES_LIMIT
      );
      const expandedWithPhotos = expanded.filter((b) => b.has_real_photo);
      if (expandedWithPhotos.length >= MIN_NEARBY_RESULTS) {
        return { beaches: expanded, isNearby: true };
      }
    }

    // Only fall back to global list if even max radius finds nothing (e.g., landlocked midwest)
    return { beaches: globalList, isNearby: false };
  } catch (error) {
    console.error("Error fetching featured beaches:", error);
    return { beaches: [], isNearby: false };
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
export async function getFeaturedBeaches(options?: FeaturedBeachesOptions): Promise<FeaturedBeachesResult> {
  // When coordinates are provided, bypass cache to avoid cache key explosion per unique lat/lon
  if (options?.coordinates) {
    return _getFeaturedBeaches(options);
  }

  try {
    const cachedFetch = unstable_cache(_getFeaturedBeaches, ["featured-beaches"], {
      tags: ["featured-beaches"],
      revalidate: 600, // 10 minutes
    });
    return cachedFetch();
  } catch {
    return _getFeaturedBeaches();
  }
}
