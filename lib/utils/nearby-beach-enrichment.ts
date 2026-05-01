import { cache } from "react";
import { getBatchFreshForecastsFromCache } from "@/lib/utils/forecast-service-utils";
import { calculateDayScore } from "@/lib/utils/regional-forecast-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withApprovedPhotos } from "@/lib/supabase/query-builders";
import type { Beach } from "@/types/database";

export interface EnrichedNearbyBeach extends Beach {
  distance?: number;
  score: number | null;
  waveHeight: number | null;
  photoUrl: string | null;
}

/**
 * Cached photo fetcher to deduplicate queries within a single SSR render.
 */
const getCachedBeachPhotos = cache(
  async (beachIds: string[]): Promise<Map<string, string>> => {
    const supabase = createSupabaseServiceRoleClient();
    const baseQuery = supabase
      .from("beach_photos")
      .select("beach_id, image_url, thumb_url, source")
      .in("beach_id", beachIds)
      .order("fetched_at", { ascending: false });
    const { data: photos } = await withApprovedPhotos(baseQuery);

    // Prefer scenic/licensed sources over user uploads for nearby cards so we
    // don't surface random portraits when a representative beach image exists.
    const photoMap = new Map<string, string>();
    const userFallbackMap = new Map<string, string>();
    if (photos) {
      for (const photo of photos) {
        const bestUrl = photo.thumb_url || photo.image_url;
        if (!bestUrl) continue;

        if (photo.source !== "user") {
          if (!photoMap.has(photo.beach_id)) {
            photoMap.set(photo.beach_id, bestUrl);
          }
          continue;
        }

        if (!userFallbackMap.has(photo.beach_id)) {
          userFallbackMap.set(photo.beach_id, bestUrl);
        }
      }
    }

    for (const [beachId, url] of userFallbackMap.entries()) {
      if (!photoMap.has(beachId)) {
        photoMap.set(beachId, url);
      }
    }
    return photoMap;
  }
);

/**
 * Enrich nearby beaches with live forecast conditions and photos.
 *
 * Uses the same batch forecast pattern as /api/beaches/featured/route.ts
 * and fetches the most recent approved photo per beach from beach_photos.
 */
export async function enrichBeachesWithConditions(
  beaches: Beach[]
): Promise<EnrichedNearbyBeach[]> {
  if (beaches.length === 0) return [];

  const beachIds = beaches.map((b) => b.id);

  // Batch fetch forecasts from cache (same pattern as /api/beaches/featured)
  const forecastMap = await getBatchFreshForecastsFromCache(beachIds, 24);

  // Batch fetch photos using cached fetcher to deduplicate within the same SSR render
  const photoMap = await getCachedBeachPhotos(beachIds);

  // Enrich each beach
  return beaches.map((beach) => {
    const forecastResult = forecastMap.get(beach.id);
    let score: number | null = null;
    let waveHeight: number | null = null;

    if (forecastResult?.forecasts?.length) {
      const forecasts = forecastResult.forecasts;
      const calculatedScore = calculateDayScore(forecasts, beach);
      score = calculatedScore > 0 ? calculatedScore : null;
      waveHeight = parseFloat(forecasts[0]?.wave_height || "0") || null;
    }

    return {
      ...beach,
      score,
      waveHeight,
      photoUrl: photoMap.get(beach.id) || null,
    };
  });
}
