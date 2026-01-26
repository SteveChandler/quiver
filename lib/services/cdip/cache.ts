/**
 * Caching logic for CDIP buoy data
 *
 * Provides in-memory caching with TTL and automatic cleanup.
 */

import { CDIPBuoyData, CDIPCacheEntry } from "./types";
import { CACHE_TIMEOUT_MS, MAX_CACHE_SIZE } from "./constants";

/**
 * Cache manager for CDIP buoy data
 */
export class CDIPCache {
  private readonly dataCache = new Map<string, CDIPCacheEntry>();
  private readonly cacheTimeout: number;

  constructor(cacheTimeoutMs: number = CACHE_TIMEOUT_MS) {
    this.cacheTimeout = cacheTimeoutMs;
  }

  /**
   * Get cached data for a station
   *
   * @param stationId - The station ID
   * @returns Cached data if valid, null otherwise
   */
  get(stationId: string): CDIPBuoyData | null {
    const cached = this.dataCache.get(stationId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.cacheTimeout) {
      this.dataCache.delete(stationId);
      return null;
    }

    return cached.data;
  }

  /**
   * Set cached data for a station
   *
   * @param stationId - The station ID
   * @param data - The buoy data to cache
   */
  set(stationId: string, data: CDIPBuoyData): void {
    this.dataCache.set(stationId, {
      data,
      timestamp: Date.now(),
    });

    // Clean up old cache entries if we exceed max size
    if (this.dataCache.size > MAX_CACHE_SIZE) {
      const oldestKey = this.dataCache.keys().next().value;
      if (oldestKey) {
        this.dataCache.delete(oldestKey);
      }
    }
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.dataCache.clear();
  }

  /**
   * Get the number of cached entries
   */
  size(): number {
    return this.dataCache.size;
  }
}
