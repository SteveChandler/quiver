"use server";

import { unstable_cache } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { BeachRecommendationService } from "@/lib/services/beach-recommendation-service";
import type { BeachRecommendation } from "@/types/beach-recommendations";

/**
 * Internal implementation of getBestBeachesNearHome
 * Separated for caching purposes
 */
async function getBestBeachesNearHomeImpl(
  userId: string,
  coords?: { lat: number; lon: number } | null
) {
  const service = new BeachRecommendationService();
  return await service.getBestBeaches(userId, coords);
}

/**
 * Server action to get best beach recommendations near user's location
 *
 * This is now a thin wrapper around the BeachRecommendationService,
 * handling only authentication and delegating all business logic to the service layer.
 *
 * PERFORMANCE OPTIMIZATION:
 * - Uses Next.js unstable_cache for distributed caching across serverless instances
 * - 5-minute cache TTL with stale-while-revalidate for better UX
 * - Cache key includes user ID and rounded coordinates for cache hit optimization
 *
 * @param coords - Optional GPS coordinates { lat, lon }
 * @returns Service result with beach recommendations and metadata
 */
export async function getBestBeachesNearHome(
  coords?: { lat: number; lon: number } | null
) {
  try {
    const supabase = await createSupabaseServerClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser();

    if (userError || !user) {
      return { success: true, data: [] as BeachRecommendation[], metadata: undefined };
    }

    // Generate cache key based on user ID and coordinates
    // Round coords to 2 decimal places (~1km precision) to increase cache hits
    const cacheKeyParts = [user.id];
    if (coords?.lat && coords?.lon) {
      const roundedLat = Math.round(coords.lat * 100) / 100;
      const roundedLon = Math.round(coords.lon * 100) / 100;
      cacheKeyParts.push(`${roundedLat},${roundedLon}`);
    } else {
      cacheKeyParts.push('home');
    }
    const cacheKey = cacheKeyParts.join(':');

    // Log cache key for monitoring
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] [CACHE] best-beaches:${cacheKey} - Request initiated`);

    // Wrap service call with Next.js cache
    // This provides distributed caching that works across Vercel serverless instances
    const cachedGetBestBeaches = unstable_cache(
      async (userId: string, coords?: { lat: number; lon: number } | null) => {
        const startTime = Date.now();
        const result = await getBestBeachesNearHomeImpl(userId, coords);
        const duration = Date.now() - startTime;
        console.log(`[${new Date().toISOString()}] [CACHE] best-beaches:${cacheKey} - MISS (computed in ${duration}ms)`);
        return result;
      },
      ['best-beaches', cacheKey], // Cache key with prefix
      {
        revalidate: 300, // 5 minutes in seconds
        tags: ['best-beaches', `user:${user.id}`], // Tags for cache invalidation
      }
    );

    const result = await cachedGetBestBeaches(user.id, coords);

    // Log successful cache hit (if we get here quickly)
    return result;
  } catch (error) {
    console.error("[getBestBeachesNearHome] ❌ Unexpected error:", error);
    return { success: false, error: String(error), data: [] as BeachRecommendation[], metadata: undefined };
  }
}
