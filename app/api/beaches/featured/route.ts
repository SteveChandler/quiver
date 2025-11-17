import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  handleApiError,
} from "@/lib/api-utils";
import { withRateLimit } from "@/lib/middleware/rate-limiter";
import { withApprovedPhotos } from "@/lib/supabase/query-builders";
import type { BeachPhotoSelect, Beach } from "@/types/database";
import {
  EXCLUDED_BEACH_IDS,
  PRIORITY_BEACH_IDS,
  FEATURED_BEACHES_LIMIT,
  getPriorityIndex,
} from "@/lib/constants/featured-beaches-config";

// Type for beach data selected from database
type BeachSelect = Pick<Beach, 'id' | 'name' | 'city' | 'state' | 'slug'>;

// Type for enriched beach with photo URL
interface EnrichedBeach extends BeachSelect {
  photo_url: string | null | undefined;
  has_real_photo: boolean;
}

/**
 * Fetches beach photos and creates a map of beach ID to photo URL.
 *
 * @param supabase - Supabase client instance
 * @returns Map of beach ID to photo URL
 */
async function fetchBeachPhotosMap(supabase: any): Promise<Map<string, string>> {
  const { data: photosData, error: photosError } = await withApprovedPhotos(
    supabase
      .from("beach_photos")
      .select("beach_id, thumb_url, image_url")
  )
    .not("beach_id", "in", `(${EXCLUDED_BEACH_IDS.join(",")})`)
    .order("beach_id")
    .order("fetched_at", { ascending: false });

  if (photosError) {
    console.error("Database error fetching beach photos:", photosError);
    return new Map();
  }

  // Get one photo per beach (DISTINCT ON beach_id logic)
  const photosMap = new Map<string, string>();
  (photosData || []).forEach((photo: BeachPhotoSelect) => {
    if (!photosMap.has(photo.beach_id)) {
      const imageUrl = photo.thumb_url || photo.image_url;
      if (imageUrl) {
        photosMap.set(photo.beach_id, imageUrl);
      }
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
    .select("id, name, city, state, slug")
    .eq("is_private", false)
    .in("id", beachIdsWithPhotos);

  if (beachesError) {
    console.error("Database error fetching beaches:", beachesError);
    return [];
  }

  // Enrich beaches with photo URLs
  return (beachesWithPhotos || []).map((beach: BeachSelect) => ({
    id: beach.id,
    name: beach.name,
    city: beach.city,
    state: beach.state,
    slug: beach.slug,
    photo_url: photosMap.get(beach.id),
    has_real_photo: true,
  }));
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

  let query = supabase
    .from("beaches")
    .select("id, name, city, state, slug")
    .eq("is_private", false);

  // Only exclude if there are IDs to exclude
  if (excludeIds.length > 0) {
    query = query.not("id", "in", `(${excludeIds.join(",")})`);
  }

  const { data: beachesWithoutPhotos } = await query.limit(needed);

  if (!beachesWithoutPhotos) {
    return [];
  }

  return beachesWithoutPhotos.map((beach) => ({
    id: beach.id,
    name: beach.name,
    city: beach.city,
    state: beach.state,
    slug: beach.slug,
    photo_url: null,
    has_real_photo: false,
  }));
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
 * GET /api/beaches/featured
 *
 * Returns a curated list of featured beaches for the landing page.
 * Prioritizes beaches with actual photos to avoid showing duplicate fallback images.
 *
 * Strategy:
 * - First, get beaches with actual photos (from beach_photos table)
 * - Then, fill remaining slots with beaches that have fallback images in FALLBACK_IMAGE_BY_NAME
 * - This ensures visual variety and no duplicate photos on the landing page
 *
 * Security:
 * - Rate limited to prevent abuse
 *
 * @returns Array of beach objects with id, name, location data, and photo_url (prioritized by actual photos)
 */
async function featuredBeachesHandler(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

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

    // Combine: beaches with photos first, then beaches without photos
    const allBeaches = [...enrichedWithPhotos, ...enrichedWithoutPhotos];

    return createSuccessResponse(allBeaches);
  } catch (error) {
    console.error("Error fetching featured beaches:", error);
    // Return empty array rather than error for graceful degradation
    return createSuccessResponse([]);
  }
}

// Apply rate limiting
export const GET = withRateLimit(featuredBeachesHandler, "public-default");
