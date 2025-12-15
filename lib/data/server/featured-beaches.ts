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

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { withApprovedPhotos } from "@/lib/supabase/query-builders";
import {
  EXCLUDED_BEACH_IDS,
  PRIORITY_BEACH_IDS,
  FEATURED_BEACHES_LIMIT,
  getPriorityIndex,
  FALLBACK_IMAGE_BY_NAME,
} from "@/lib/constants/featured-beaches-config";
import type { BeachPhotoSelect, Beach } from "@/types/database";

// Type for beach data selected from database
type BeachSelect = Pick<
  Beach,
  "id" | "name" | "city" | "state" | "slug" | "average_rating" | "review_count" | "skill_level"
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
 * Fetches beach photos and creates a map of beach ID to photo URL.
 *
 * @param supabase - Supabase client instance
 * @returns Map of beach ID to photo URL
 */
async function fetchBeachPhotosMap(supabase: any): Promise<Map<string, string>> {
  let query = withApprovedPhotos(
    supabase
      .from("beach_photos")
      .select("beach_id, thumb_url, image_url")
  ).order("beach_id").order("fetched_at", { ascending: false });

  if (EXCLUDED_BEACH_IDS.length > 0) {
    query = query.not("beach_id", "in", `(${EXCLUDED_BEACH_IDS.join(",")})`);
  }

  const { data: photosData, error: photosError } = await query;

  if (photosError) {
    console.error("Database error fetching beach photos:", photosError);
    return new Map();
  }

  // Get one photo per beach (DISTINCT ON beach_id logic)
  const photosMap = new Map<string, string>();
  (photosData || []).forEach((photo: BeachPhotoSelect) => {
    if (EXCLUDED_BEACH_SET.has(photo.beach_id) || photosMap.has(photo.beach_id)) {
      return;
    }
    const imageUrl = sanitizePhotoUrl(photo.thumb_url) || sanitizePhotoUrl(photo.image_url);
    if (imageUrl) {
      photosMap.set(photo.beach_id, imageUrl);
    }
  });

  return photosMap;
}

/**
 * Fetches beach details and enriches them with photo URLs.
 *
 * @param supabase - Supabase client instance
 * @param photosMap - Map of beach ID to photo URL
 * @returns Array of enriched beaches with photos
 */
async function fetchBeachesWithPhotos(
  supabase: any,
  photosMap: Map<string, string>
): Promise<EnrichedBeach[]> {
  const beachIdsWithPhotos = Array.from(photosMap.keys());

  if (beachIdsWithPhotos.length === 0) {
    return [];
  }

  const { data: beachesWithPhotos, error: beachesError } = await supabase
    .from("beaches")
    .select("id, name, city, state, slug, average_rating, review_count, skill_level")
    .eq("is_private", false)
    .in("id", beachIdsWithPhotos);

  if (beachesError) {
    console.error("Database error fetching beaches:", beachesError);
    return [];
  }

  const beachRows: BeachSelect[] = (beachesWithPhotos || []) as BeachSelect[];

  const enriched: EnrichedBeach[] = [];
  for (const beachRow of beachRows) {
    const photoUrl = photosMap.get(beachRow.id) ?? null;
    const record = mapBeachRecord(beachRow, photoUrl, true);
    if (record) {
      enriched.push(record);
    }
  }

  return enriched;
}

/**
 * Fetches additional beaches without photos to fill remaining slots.
 *
 * @param supabase - Supabase client instance
 * @param needed - Number of additional beaches needed
 * @param excludeIds - Beach IDs to exclude from results
 * @returns Array of enriched beaches without photos
 */
async function fetchBeachesWithoutPhotos(
  supabase: any,
  needed: number,
  excludeIds: string[]
): Promise<EnrichedBeach[]> {
  if (needed <= 0) {
    return [];
  }

  const exclusionSet = new Set(excludeIds);
  EXCLUDED_BEACH_IDS.forEach((id) => exclusionSet.add(id));

  let query = supabase
    .from("beaches")
    .select("id, name, city, state, slug, average_rating, review_count, skill_level")
    .eq("is_private", false);

  if (exclusionSet.size > 0) {
    query = query.not("id", "in", `(${Array.from(exclusionSet).join(",")})`);
  }

  const fetchLimit = Math.min(
    Math.max(needed * 2, needed),
    FEATURED_BEACHES_LIMIT
  );

  const { data: beachesWithoutPhotos } = await query
    .order("name")
    .limit(fetchLimit);

  if (!beachesWithoutPhotos) {
    return [];
  }

  const beachRows: BeachSelect[] = (beachesWithoutPhotos || []) as BeachSelect[];

  const mapped: EnrichedBeach[] = [];
  for (const beachRow of beachRows) {
    const record = mapBeachRecord(beachRow, null, false);
    if (record) {
      mapped.push(record);
    }
  }

  const prioritized: EnrichedBeach[] = [];
  const others: EnrichedBeach[] = [];

  for (const beach of mapped) {
    const normalizedName = beach.name.toLowerCase();
    if (FALLBACK_NAME_SET.has(normalizedName)) {
      prioritized.push(beach);
    } else {
      others.push(beach);
    }
  }

  return [...prioritized, ...others];
}

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
 * Fetches a curated list of featured beaches for the landing page.
 *
 * This function prioritizes beaches with actual photos to avoid showing duplicate
 * fallback images, ensuring visual variety on the landing page.
 *
 * Process:
 * 1. Fetch beaches with actual photos from beach_photos table
 * 2. Apply priority sorting to beaches with photos
 * 3. Fill remaining slots with beaches that have fallback images
 * 4. Deduplicate by ID and name
 * 5. Final sort: photos first, then by priority
 *
 * @returns Promise resolving to array of enriched beach objects (up to FEATURED_BEACHES_LIMIT)
 */
export async function getFeaturedBeaches(): Promise<EnrichedBeach[]> {
  try {
    const supabase = createSupabaseServerClient();

    if (!supabase) {
      console.error("Failed to initialize Supabase client");
      return [];
    }

    // Step 1: Fetch beach photos and create ID-to-URL map
    const photosMap = await fetchBeachPhotosMap(supabase);

    // Step 2: Fetch beaches with photos and enrich with photo URLs
    const enrichedWithPhotos = await fetchBeachesWithPhotos(supabase, photosMap);

    // Step 3: Apply priority sorting to beaches with photos
    applyPrioritySorting(enrichedWithPhotos);

    // Step 4: Fill remaining slots with beaches without photos
    const needed = Math.max(0, FEATURED_BEACHES_LIMIT - enrichedWithPhotos.length);
    const beachIdsWithPhotos = Array.from(photosMap.keys());
    const enrichedWithoutPhotos = await fetchBeachesWithoutPhotos(
      supabase,
      needed,
      beachIdsWithPhotos
    );

    // Step 5: Combine, deduplicate, and sort
    const combined = [...enrichedWithPhotos, ...enrichedWithoutPhotos];
    const deduped = dedupeBeaches(combined).slice(0, FEATURED_BEACHES_LIMIT);
    const sorted = sortFeaturedBeaches(deduped);

    return sorted;
  } catch (error) {
    console.error("Error fetching featured beaches:", error);
    // Return empty array for graceful degradation
    return [];
  }
}
