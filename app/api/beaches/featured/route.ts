import { NextRequest } from "next/server";
import {
  CacheDuration,
  createCachedResponse,
  createSuccessResponse,
  methodNotAllowed,
  withRateLimit,
} from "@/lib/middleware/api-wrappers";
import {
  getFeaturedBeaches,
  sortLandingFeaturedBeaches,
} from "@/lib/data/server/featured-beaches";
import { isValidLatitude, isValidLongitude } from "@/lib/coordinate-validation";
import { getBatchFreshForecastsFromCache } from "@/lib/utils/forecast-service-utils";
import { pickBestNativeForecastSlot } from "@/lib/scoring/native-condition-score";
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
 * - Sort for landing-page fit: real photos, beginner/intermediate skill, then score
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

      const best = pickBestNativeForecastSlot(forecasts);
      const score = best?.score ?? 0;

      // Select the forecast closest to now (not the earliest in the window)
      const now = Date.now();
      const currentForecast = forecasts.reduce((closest, f) => {
        const closestDiff = Math.abs(Date.parse(closest.forecast_at) - now);
        const fDiff = Math.abs(Date.parse(f.forecast_at) - now);
        return fDiff < closestDiff ? f : closest;
      }, forecasts[0]);

      // Pass the raw wave_height string (e.g. "2.8") — no parseFloat + variance inflation
      const rawHeight = currentForecast?.wave_height ?? null;

      return {
        ...beach,
        score: score > 0 ? score : null,
        wave_height: rawHeight,
      };
    });

    const sortedBeaches = sortLandingFeaturedBeaches(enrichedBeaches);

    // Short cache for forecast-enriched data (2 minutes for personalized, 5 minutes otherwise)
    if (coordinates) {
      return createSuccessResponse({ beaches: sortedBeaches, isNearby });
    }
    return await createCachedResponse({ beaches: sortedBeaches, isNearby }, CacheDuration.SHORT);
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
