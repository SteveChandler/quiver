/**
 * In-memory cache for user tracking preferences
 * Separated from route file to allow testing without violating Next.js export rules
 *
 * Uses LRU eviction to bound memory usage in serverless environments.
 * Cache is limited to MAX_CACHE_SIZE entries with 5-minute TTL.
 */

// Maximum entries to prevent unbounded memory growth in serverless
const MAX_CACHE_SIZE = 5000;

// Track access order for LRU eviction (most recent at end)
const cacheOrder: string[] = [];

// In-memory cache for tracking preference (5-minute TTL)
export const trackingAllowedCache = new Map<
  string,
  { allowed: boolean; expires: number }
>();

/**
 * Get a value from the cache, updating LRU order on access
 */
export function getTrackingCache(
  userId: string
): { allowed: boolean; expires: number } | undefined {
  const cached = trackingAllowedCache.get(userId);
  if (cached) {
    // Move to end of order (most recently accessed)
    const index = cacheOrder.indexOf(userId);
    if (index !== -1) {
      cacheOrder.splice(index, 1);
      cacheOrder.push(userId);
    }
  }
  return cached;
}

/**
 * Set a value in the cache with LRU eviction when at capacity
 */
export function setTrackingCache(
  userId: string,
  value: { allowed: boolean; expires: number }
): void {
  // Remove from order if it exists (will be re-added at end)
  const existingIndex = cacheOrder.indexOf(userId);
  if (existingIndex !== -1) {
    cacheOrder.splice(existingIndex, 1);
  }

  // Evict oldest entry if at capacity
  if (trackingAllowedCache.size >= MAX_CACHE_SIZE && !trackingAllowedCache.has(userId)) {
    const oldest = cacheOrder.shift();
    if (oldest) {
      trackingAllowedCache.delete(oldest);
    }
  }

  // Add to cache and track order
  cacheOrder.push(userId);
  trackingAllowedCache.set(userId, value);
}

/**
 * Clear the tracking allowed cache (for testing purposes)
 * @internal
 */
export function __clearTrackingCache() {
  trackingAllowedCache.clear();
  cacheOrder.length = 0;
}
