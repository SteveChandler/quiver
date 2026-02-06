/**
 * In-memory TTL cache for gamification data
 *
 * Provides caching with automatic expiration and inflight deduplication.
 * This module is a singleton shared across all gamification services.
 */

import type { UserXPStatus } from "./types";

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
 * Badge definition fields returned in joins
 */
interface BadgeDefinitionFields {
  name: string;
  description: string;
  icon: string;
  category: string;
  xp_reward: number;
}

/**
 * User badge with joined badge definition (from Supabase join query)
 * Note: Supabase join can return array or object depending on query/relation
 */
export interface CachedUserBadge {
  badge_slug: string;
  unlocked_at: string;
  context: Record<string, unknown>;
  badge_definitions: BadgeDefinitionFields | BadgeDefinitionFields[] | null;
}

/**
 * Badge definition as stored in the database
 */
export interface CachedBadgeDefinition {
  badge_slug: string;
  name: string;
  description: string;
  icon: string;
  category: string;
  xp_reward: number;
}

/**
 * Get current timestamp
 */
function now(): number {
  return Date.now();
}

/**
 * The singleton cache instance
 *
 * Note: inflight cache uses `any` because it holds heterogeneous promise types
 * that are returned directly to callers expecting specific types.
 */
const cache = {
  xpStatusByUserId: new Map<string, CacheEntry<UserXPStatus>>(),
  userBadgesByUserId: new Map<string, CacheEntry<CachedUserBadge[]>>(),
  badgeDefinitions: new Map<string, CacheEntry<CachedBadgeDefinition[]>>(),
   
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
export function getXPStatusCache(): Map<string, CacheEntry<UserXPStatus>> {
  return cache.xpStatusByUserId;
}

/**
 * Get the user badges cache map
 */
export function getUserBadgesCache(): Map<string, CacheEntry<CachedUserBadge[]>> {
  return cache.userBadgesByUserId;
}

/**
 * Get the badge definitions cache map
 */
export function getBadgeDefinitionsCache(): Map<string, CacheEntry<CachedBadgeDefinition[]>> {
  return cache.badgeDefinitions;
}

/**
 * Get the inflight requests map
 *
 * Uses `any` because it holds heterogeneous promise types that callers
 * use polymorphically based on the cache key pattern.
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
