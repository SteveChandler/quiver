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
 * Returns ALL beaches with optional photos for visual display.
 *
 * After database cleanup (removing orphaned beach_photos), this endpoint
 * now returns all beaches instead of filtering by photo availability.
 * Beaches without photos receive a null photo_url, and the frontend
 * handles fallback images appropriately.
 *
 * Security:
 * - Rate limited to prevent abuse
 *
 * @returns Array of beach objects with id, name, location data, and optional photo_url
 */
async function featuredBeachesHandler(request: NextRequest) {
  try {
    const supabase = await createSupabaseServerClient();

    // Fetch all beaches (not just those with photos)
    const { data: beachesData, error: beachesError } = await supabase
      .from("beaches")
      .select("id, name, city, state, slug")
      .eq("is_private", false)
      .order("name")
      .limit(50); // Reasonable limit for featured section

    if (beachesError) {
      console.error("Database error fetching beaches:", beachesError);
      return createSuccessResponse([]);
    }

    if (!beachesData || beachesData.length === 0) {
      return createSuccessResponse([]);
    }

    // Extract beach IDs for photo lookup
    const beachIds = beachesData.map(b => b.id);

    // Fetch available photos for these beaches
    const { data: photosData } = await supabase
      .from("beach_photos_featured")
      .select("beach_id, thumb_url, image_url")
      .in("beach_id", beachIds);

    // Build photo map
    const photosMap = new Map<string, string>();
    if (photosData) {
      photosData.forEach((photo: any) => {
        const imageUrl = photo.thumb_url || photo.image_url;
        if (imageUrl && photo.beach_id && !photosMap.has(photo.beach_id)) {
          photosMap.set(photo.beach_id, imageUrl);
        }
      });
    }

    // Enrich beaches with photo URLs (null if no photo available)
    const enriched = beachesData.map((beach) => ({
      id: beach.id,
      name: beach.name,
      city: beach.city,
      state: beach.state,
      slug: beach.slug,
      photo_url: photosMap.get(beach.id) ?? null,
    }));

    // Return all beaches (component will slice to needed amount and has fallback data)
    return createSuccessResponse(enriched);
  } catch (error) {
    console.error("Error fetching featured beaches:", error);
    // Return empty array rather than error for graceful degradation
    return createSuccessResponse([]);
  }
}

// Apply rate limiting
export const GET = withRateLimit(featuredBeachesHandler, "public-default");
