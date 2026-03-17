import { NextRequest } from "next/server";
import {
  CacheDuration,
  createCachedResponse,
  createSuccessResponse,
  methodNotAllowed,
} from "@/lib/api-utils";
import { withRateLimit } from "@/lib/middleware/api-wrappers";
import { getFeaturedBeaches } from "@/lib/data/server/featured-beaches";
import { isValidLatitude, isValidLongitude } from "@/lib/coordinate-validation";
import { getBatchFreshForecastsFromCache } from "@/lib/utils/forecast-service-utils";
import { calculateDayScore } from "@/lib/utils/regional-forecast-utils";
import type { EnrichedBeach } from "@/lib/data/server/featured-beaches";

/**
 * GET /api/beaches/featured
 *
 * Returns a curated list of featured beaches for the landing page.
 * Prioritizes beaches with actual photos to avoid showing duplicate fallback images.
 * Enriches beaches with live forecast data (score and wave height).
 *
 * Strategy:
 * - First, get beaches with actual photos (from beach_photos table)
 * - Then, fill remaining slots with beaches that have fallback images in FALLBACK_IMAGE_BY_NAME
 * - Enrich with forecast data from cache (current conditions)
 * - Sort by score descending (best conditions first)
 * - This ensures visual variety and no duplicate photos on the landing page
 *
 * Security:
 * - Rate limited to prevent abuse
 *
 * @returns Array of beach objects with id, name, location data, photo_url, score, and wave_height
 */
async function featuredBeachesHandler(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const latParam = searchParams.get("lat");
    const lonParam = searchParams.get("lon");

    let coordinates: { lat: number; lon: number } | null = null;
    if (latParam && lonParam) {
      const lat = parseFloat(latParam);
      const lon = parseFloat(lonParam);
      if (isValidLatitude(lat) && isValidLongitude(lon)) {
        coordinates = { lat, lon };
      }
    }

    const { beaches, isNearby } = await getFeaturedBeaches(
      coordinates ? { coordinates } : undefined
    );

    // Enrich beaches with forecast data
    const beachIds = beaches.map((b) => b.id);
    const forecastMap = await getBatchFreshForecastsFromCache(beachIds, 24);

    const enrichedBeaches: EnrichedBeach[] = beaches.map((beach) => {
      const forecastResult = forecastMap.get(beach.id);

      if (!forecastResult || !forecastResult.forecasts || forecastResult.forecasts.length === 0) {
        return beach; // No forecast data available
      }

      const forecasts = forecastResult.forecasts;

      // Calculate score using the most recent forecasts
      const minimalBeach = { id: beach.id, name: beach.name } as any;
      const score = calculateDayScore(forecasts, minimalBeach);

      // Extract wave height from the most recent forecast
      const waveHeight = parseFloat(forecasts[0]?.wave_height || "0");

      return {
        ...beach,
        score: score > 0 ? score : null,
        wave_height: waveHeight > 0 ? waveHeight : null,
      };
    });

    // Sort by score descending (nulls last)
    enrichedBeaches.sort((a, b) => {
      if (a.score == null && b.score == null) return 0;
      if (a.score == null) return 1;
      if (b.score == null) return -1;
      return b.score - a.score;
    });

    // Short cache for forecast-enriched data (2 minutes for personalized, 5 minutes otherwise)
    if (coordinates) {
      return createSuccessResponse({ beaches: enrichedBeaches, isNearby });
    }
    return await createCachedResponse({ beaches: enrichedBeaches, isNearby }, CacheDuration.SHORT);
  } catch (error) {
    console.error("Error fetching featured beaches:", error);
    // Return empty array rather than error for graceful degradation
    return createSuccessResponse({ beaches: [], isNearby: false });
  }
}

// Apply rate limiting
export const GET = withRateLimit(featuredBeachesHandler, "public-showcase");

const notAllowed = () => methodNotAllowed(["GET"]);
export const POST = notAllowed;
export const PUT = notAllowed;
export const DELETE = notAllowed;
