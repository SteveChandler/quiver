import { NextRequest } from "next/server";
import {
  CacheDuration,
  createCachedResponse,
  createSuccessResponse,
  methodNotAllowed,
} from "@/lib/api-utils";
import { withRateLimit } from "@/lib/middleware/rate-limiter";
import { getFeaturedBeaches } from "@/lib/data/server/featured-beaches";

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
    const beaches = await getFeaturedBeaches();
    return await createCachedResponse(beaches, CacheDuration.MEDIUM);
  } catch (error) {
    console.error("Error fetching featured beaches:", error);
    // Return empty array rather than error for graceful degradation
    return createSuccessResponse([]);
  }
}

// Apply rate limiting
export const GET = withRateLimit(featuredBeachesHandler, "public-showcase");

const notAllowed = () => methodNotAllowed(["GET"]);
export const POST = notAllowed;
export const PUT = notAllowed;
export const DELETE = notAllowed;
