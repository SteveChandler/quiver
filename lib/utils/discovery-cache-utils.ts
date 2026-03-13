/**
 * Discovery Cache Utilities
 *
 * Shared cache utilities for surf discovery data, used by both:
 * - useSurfDiscovery hook (primary data fetching)
 * - useTimeSlotPrefetch hook (background prefetching)
 *
 * Cache Structure:
 * Key: quiver_discovery_{userId}_{optionsHash}
 * Value: CachedDiscoveryData (discovery response + timestamp + hash)
 * TTL: 30 minutes (via CACHE_TTL.API_CALLS)
 *
 * @module lib/utils/discovery-cache-utils
 */

import { CACHE_TTL } from "@/lib/constants/ui";
import type { SurfDiscoveryResponse, TimeSlot } from "@/types/personalization";

/**
 * Cached discovery data structure for localStorage
 */
export interface CachedDiscoveryData {
  discovery: SurfDiscoveryResponse;
  timestamp: number;
  /** Hash of options used to generate this cache entry */
  optionsHash: string;
}

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
    `sk:${options.userSkillLevel || "def"}`,
  ];
  const key = parts.join("|");

  // Use base64 encoding for compactness, but take longer slice to reduce collision risk
  return btoa(key).slice(0, 24);
}

/**
 * Generate full cache key for user + options combination
 */
export function getDiscoveryCacheKey(
  userId: string,
  options: DiscoveryCacheOptions
): string {
  const optionsHash = hashDiscoveryOptions(options);
  return `${CACHE_KEY_PREFIX}${userId}_${optionsHash}`;
}

/**
 * Check if valid non-expired cache exists for the given key
 */
export function hasValidCache(cacheKey: string): boolean {
  if (typeof window === "undefined") return false;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return false;

    const parsedData: CachedDiscoveryData = JSON.parse(cached);
    const isExpired = Date.now() - parsedData.timestamp > CACHE_TTL.API_CALLS;

    return !isExpired;
  } catch {
    return false;
  }
}

/**
 * Read and parse cache data, restoring Date objects
 * Returns null if cache doesn't exist or is expired
 */
export function readFromCache(cacheKey: string): CachedDiscoveryData | null {
  if (typeof window === "undefined") return null;

  try {
    const cached = localStorage.getItem(cacheKey);
    if (!cached) return null;

    const parsedData: CachedDiscoveryData = JSON.parse(cached);
    const isExpired = Date.now() - parsedData.timestamp > CACHE_TTL.API_CALLS;

    if (isExpired) {
      localStorage.removeItem(cacheKey);
      return null;
    }

    // Restore Date objects from JSON strings
    if (parsedData.discovery?.recommendations) {
      parsedData.discovery.recommendations =
        parsedData.discovery.recommendations.map((rec: any) => ({
          ...rec,
          window: {
            ...rec.window,
            start: new Date(rec.window.start),
            end: new Date(rec.window.end),
          },
        }));
    }

    return parsedData;
  } catch (error) {
    console.warn("Failed to read discovery cache:", error);
    try {
      localStorage.removeItem(cacheKey);
    } catch {
      // Ignore removal errors
    }
    return null;
  }
}

/**
 * Write discovery data to localStorage cache
 */
export function writeToCache(
  cacheKey: string,
  discovery: SurfDiscoveryResponse,
  optionsHash: string
): void {
  if (typeof window === "undefined") return;

  try {
    const cacheEntry: CachedDiscoveryData = {
      discovery,
      timestamp: Date.now(),
      optionsHash,
    };
    localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
  } catch (error) {
    console.warn("Failed to write discovery cache:", error);
  }
}
