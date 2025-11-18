/**
 * Cache management utilities for Best Beaches feature
 *
 * This module provides utilities for managing the Next.js cache for beach recommendations.
 * It allows for manual cache invalidation when needed (e.g., after data updates).
 *
 * @module lib/cache/best-beaches-cache
 */

import { revalidateTag } from "next/cache";

/**
 * Cache tags used for beach recommendations
 */
export const BEST_BEACHES_CACHE_TAGS = {
  ALL: 'best-beaches',
  USER_PREFIX: 'user:',
} as const;

/**
 * Invalidate all cached beach recommendations
 *
 * Use this when:
 * - New beach data is added to the database
 * - Forecast data is updated
 * - Intel data is regenerated
 * - Global beach preferences change
 *
 * @example
 * ```ts
 * import { invalidateAllBeachRecommendations } from '@/lib/cache/best-beaches-cache';
 *
 * // After updating forecasts
 * await updateForecasts();
 * invalidateAllBeachRecommendations();
 * ```
 */
export function invalidateAllBeachRecommendations(): void {
  revalidateTag(BEST_BEACHES_CACHE_TAGS.ALL);
  console.log('[CACHE] Invalidated all beach recommendations');
}

/**
 * Invalidate cached recommendations for a specific user
 *
 * Use this when:
 * - User updates their home beach
 * - User changes their experience level
 * - User's beach affinity data changes
 *
 * @param userId - The user ID whose cache should be invalidated
 *
 * @example
 * ```ts
 * import { invalidateUserRecommendations } from '@/lib/cache/best-beaches-cache';
 *
 * // After user updates their profile
 * await updateUserProfile(userId, newData);
 * invalidateUserRecommendations(userId);
 * ```
 */
export function invalidateUserRecommendations(userId: string): void {
  const userTag = `${BEST_BEACHES_CACHE_TAGS.USER_PREFIX}${userId}`;
  revalidateTag(userTag);
  console.log(`[CACHE] Invalidated recommendations for user: ${userId}`);
}

/**
 * Get cache statistics from logs
 *
 * This is a helper function to parse Vercel logs for cache performance metrics.
 * In production, you would use this with a log aggregation service.
 *
 * @returns Instructions for monitoring cache performance
 */
export function getCacheMonitoringInstructions(): string {
  return `
Monitor cache performance with these Vercel log filters:

1. Cache Hits/Misses:
   - Filter: "[CACHE] best-beaches"
   - Look for "MISS (computed in Xms)" to track uncached requests

2. Performance Tracking:
   - Cached requests: < 100ms response time
   - Uncached requests: 1.5-2.0s response time
   - Target cache hit rate: > 80%

3. Cache Invalidation Events:
   - Filter: "[CACHE] Invalidated"
   - Track when and why cache is being cleared

4. Key Metrics to Monitor:
   - Average response time
   - Cache hit rate (% of requests under 100ms)
   - P95 response time
   - Cache invalidation frequency
  `.trim();
}

/**
 * Cache configuration constants
 */
export const CACHE_CONFIG = {
  /** Cache TTL in seconds (5 minutes) */
  TTL_SECONDS: 300,

  /** Coordinate rounding precision (2 decimal places = ~1km) */
  COORDINATE_PRECISION: 2,

  /** Expected cache hit rate threshold */
  TARGET_HIT_RATE: 0.8,

  /** Expected response time for cached requests (ms) */
  CACHED_RESPONSE_TARGET: 100,

  /** Expected response time for uncached requests (ms) */
  UNCACHED_RESPONSE_TARGET: 2000,
} as const;
