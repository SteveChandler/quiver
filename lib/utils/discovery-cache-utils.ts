/**
 * Discovery Cache Utilities
 *
 * Discovery option hashing plus removal of legacy recommendation cache data.
 *
 * @module lib/utils/discovery-cache-utils
 */

import type { TimeSlot } from "@/types/personalization";

/**
 * Options shape used for cache key generation
 */
export interface DiscoveryCacheOptions {
  userLocation?: { lat: number; lon: number };
  radiusMiles?: number;
  horizonHours?: number;
  maxResults?: number;
  timeSlot?: TimeSlot;
  /** User's skill level — included so changing it invalidates the cache */
  userSkillLevel?: string | null;
}

export const CACHE_KEY_PREFIX = "quiver_discovery_";

/**
 * Remove only persisted recommendation responses. Objective forecast caches
 * use different prefixes and must survive this migration.
 */
export function clearDiscoveryRecommendationCache(): void {
  if (typeof window === "undefined") return;

  try {
    for (let index = localStorage.length - 1; index >= 0; index -= 1) {
      const key = localStorage.key(index);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        localStorage.removeItem(key);
      }
    }
  } catch (error) {
    console.warn("Failed to clear discovery recommendation cache:", error);
  }
}

/**
 * Generate a hash string from options to use as part of cache key.
 * Uses explicit string concatenation to ensure critical fields (especially timeSlot)
 * are always captured regardless of JSON property ordering or truncation.
 */
export function hashDiscoveryOptions(options: DiscoveryCacheOptions): string {
  // Explicit concatenation ensures timeSlot is always included and order is deterministic
  const parts = [
    `ts:${options.timeSlot || "any"}`, // Critical for cache differentiation
    `lat:${options.userLocation?.lat?.toFixed(2) || "none"}`,
    `lon:${options.userLocation?.lon?.toFixed(2) || "none"}`,
    `r:${options.radiusMiles || "def"}`,
    `h:${options.horizonHours || "def"}`,
    `m:${options.maxResults || "def"}`,
    `sk:${options.userSkillLevel || "def"}`, // Skill level change invalidates cache
  ];
  const key = parts.join("|");

  // Retain the complete encoding. Prefix truncation made trailing fields such
  // as skill level collide and prevented the fresh request they should trigger.
  return btoa(key);
}
