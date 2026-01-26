/**
 * In-memory TTL cache for gamification data
 *
 * Provides caching with automatic expiration and inflight deduplication.
 * This module is a singleton shared across all gamification services.
 */

/**
 * Cache entry with expiration timestamp
 */
interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

/**
 * TTL values for different cache types (in milliseconds)
 */
export const CACHE_TTL = {
  XP_STATUS: 30_000,
  USER_BADGES: 30_000,
  BADGE_DEFINITIONS: 10 * 60_000,
} as const;

/**
 * Get current timestamp
 */
function now(): number {
  return Date.now();
}

/**
 * The singleton cache instance
 */
const cache = {
  xpStatusByUserId: new Map<string, CacheEntry<any>>(),
  userBadgesByUserId: new Map<string, CacheEntry<any[]>>(),
  badgeDefinitions: new Map<string, CacheEntry<any[]>>(),
  inflight: new Map<string, Promise<any>>(),
};

/**
 * Get a cached value if it exists and hasn't expired
 *
 * @param map - The cache map to retrieve from
 * @param key - The cache key
 * @returns The cached value or null if not found/expired
 */
export function getCached<T>(
  map: Map<string, CacheEntry<T>>,
  key: string
): T | null {
  const entry = map.get(key);
  if (!entry) return null;
  if (entry.expiresAt <= now()) {
    map.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Set a value in the cache with a TTL
 *
 * @param map - The cache map to store in
 * @param key - The cache key
 * @param value - The value to cache
 * @param ttlMs - Time-to-live in milliseconds
 */
export function setCached<T>(
  map: Map<string, CacheEntry<T>>,
  key: string,
  value: T,
  ttlMs: number
): void {
  map.set(key, { value, expiresAt: now() + ttlMs });
}

/**
 * Invalidate all cached data for a specific user
 *
 * @param userId - The user ID to invalidate caches for
 */
export function invalidateUserCaches(userId: string): void {
  cache.xpStatusByUserId.delete(userId);
  cache.userBadgesByUserId.delete(userId);
}

/**
 * Get the XP status cache map
 */
export function getXPStatusCache(): Map<string, CacheEntry<any>> {
  return cache.xpStatusByUserId;
}

/**
 * Get the user badges cache map
 */
export function getUserBadgesCache(): Map<string, CacheEntry<any[]>> {
  return cache.userBadgesByUserId;
}

/**
 * Get the badge definitions cache map
 */
export function getBadgeDefinitionsCache(): Map<string, CacheEntry<any[]>> {
  return cache.badgeDefinitions;
}

/**
 * Get the inflight requests map
 */
export function getInflightCache(): Map<string, Promise<any>> {
  return cache.inflight;
}

/**
 * Reset all caches - ONLY for use in tests
 *
 * This module caches results in-memory for performance, which is great in prod
 * but can make unit tests flaky if state carries across test cases.
 */
export function resetCacheForTests(): void {
  if (process.env.NODE_ENV !== "test") return;
  cache.xpStatusByUserId.clear();
  cache.userBadgesByUserId.clear();
  cache.badgeDefinitions.clear();
  cache.inflight.clear();
}
