import { NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  createSuccessResponse,
  handleApiError,
} from "@/lib/api-utils";
import { withRateLimit } from "@/lib/middleware/rate-limiter";

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

    // Step 1: Get distinct beaches WITH actual photos
    // Use a raw query to get one photo per beach (similar to the view)
    const { data: photosData, error: photosError } = await supabase
      .from("beach_photos")
      .select("beach_id, thumb_url, image_url")
      .eq("approved", true)
      .order("beach_id")
      .order("fetched_at", { ascending: false });

    if (photosError) {
      console.error("Database error fetching beach photos:", photosError);
      return createSuccessResponse([]);
    }

    // Get one photo per beach (DISTINCT ON beach_id logic)
    const photosMap = new Map<string, string>();
    (photosData || []).forEach((photo: any) => {
      if (!photosMap.has(photo.beach_id)) {
        const imageUrl = photo.thumb_url || photo.image_url;
        if (imageUrl) {
          photosMap.set(photo.beach_id, imageUrl);
        }
      }
    });

    const beachIdsWithPhotos = Array.from(photosMap.keys());

    // Fetch beach details for beaches with photos
    const { data: beachesWithPhotos, error: beachesError } = await supabase
      .from("beaches")
      .select("id, name, city, state, slug")
      .eq("is_private", false)
      .in("id", beachIdsWithPhotos);

    if (beachesError) {
      console.error("Database error fetching beaches:", beachesError);
      return createSuccessResponse([]);
    }

    // Enrich beaches with photo URLs
    const enrichedWithPhotos = (beachesWithPhotos || []).map((beach: any) => ({
      id: beach.id,
      name: beach.name,
      city: beach.city,
      state: beach.state,
      slug: beach.slug,
      photo_url: photosMap.get(beach.id),
      has_real_photo: true,
    }));

    // Step 2: Get additional beaches without photos to fill the grid if needed
    const needed = Math.max(0, 50 - enrichedWithPhotos.length);
    let enrichedWithoutPhotos: any[] = [];

    if (needed > 0 && beachIdsWithPhotos.length > 0) {
      const { data: beachesWithoutPhotos } = await supabase
        .from("beaches")
        .select("id, name, city, state, slug")
        .eq("is_private", false)
        .not("id", "in", `(${beachIdsWithPhotos.join(",")})`)
        .limit(needed);

      if (beachesWithoutPhotos) {
        enrichedWithoutPhotos = beachesWithoutPhotos.map((beach) => ({
          id: beach.id,
          name: beach.name,
          city: beach.city,
          state: beach.state,
          slug: beach.slug,
          photo_url: null,
          has_real_photo: false,
        }));
      }
    } else if (needed > 0) {
      // If no beaches with photos, get all beaches
      const { data: beachesWithoutPhotos } = await supabase
        .from("beaches")
        .select("id, name, city, state, slug")
        .eq("is_private", false)
        .limit(needed);

      if (beachesWithoutPhotos) {
        enrichedWithoutPhotos = beachesWithoutPhotos.map((beach) => ({
          id: beach.id,
          name: beach.name,
          city: beach.city,
          state: beach.state,
          slug: beach.slug,
          photo_url: null,
          has_real_photo: false,
        }));
      }
    }

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
