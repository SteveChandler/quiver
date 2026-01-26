/**
 * In-memory cache for user tracking preferences
 * Separated from route file to allow testing without violating Next.js export rules
 */

// In-memory cache for tracking preference (5-minute TTL)
export const trackingAllowedCache = new Map<
  string,
  { allowed: boolean; expires: number }
>();

/**
 * Clear the tracking allowed cache (for testing purposes)
 * @internal
 */
export function __clearTrackingCache() {
  trackingAllowedCache.clear();
}
