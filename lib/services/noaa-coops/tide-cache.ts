/**
 * Tide data cache
 *
 * In-memory LRU cache with TTL for tide data by station ID
 * to avoid duplicate API calls.
 */

import type { COOPSForecast, TideCacheEntry } from "./types";

/** Default cache timeout: 30 minutes */
const DEFAULT_CACHE_TIMEOUT_MS = 30 * 60 * 1000;

/** Default maximum cache size */
const DEFAULT_MAX_CACHE_SIZE = 50;

/**
 * Configuration options for TideCache
 */
export interface TideCacheOptions {
  /** Cache timeout in milliseconds (default: 30 minutes) */
  timeoutMs?: number;
  /** Maximum number of entries (default: 50) */
  maxSize?: number;
  /** Verbose logging callback */
  onCacheHit?: (stationId: string) => void;
}

/**
 * In-memory cache for tide data with TTL and LRU eviction
 */
export class TideCache {
  private readonly cache = new Map<string, TideCacheEntry>();
  private readonly timeoutMs: number;
  private readonly maxSize: number;
  private readonly onCacheHit?: (stationId: string) => void;

  constructor(options?: TideCacheOptions) {
    this.timeoutMs = options?.timeoutMs ?? DEFAULT_CACHE_TIMEOUT_MS;
    this.maxSize = options?.maxSize ?? DEFAULT_MAX_CACHE_SIZE;
    this.onCacheHit = options?.onCacheHit;
  }

  /**
   * Get cached tide data for a station if available and not expired
   *
   * @param stationId - CO-OPS station ID
   * @returns Cached forecast or null if not found/expired
   */
  get(stationId: string): COOPSForecast | null {
    const cached = this.cache.get(stationId);
    if (!cached) return null;

    const now = Date.now();
    if (now - cached.timestamp > this.timeoutMs) {
      this.cache.delete(stationId);
      return null;
    }

    this.onCacheHit?.(stationId);
    return cached.data;
  }

  /**
   * Cache tide data for a station
   *
   * @param stationId - CO-OPS station ID
   * @param data - Forecast data to cache
   */
  set(stationId: string, data: COOPSForecast): void {
    this.cache.set(stationId, {
      data,
      timestamp: Date.now(),
    });

    // LRU eviction: remove oldest entry if too many
    if (this.cache.size > this.maxSize) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Check if a station has cached data (may be expired)
   *
   * @param stationId - CO-OPS station ID
   * @returns true if entry exists
   */
  has(stationId: string): boolean {
    return this.cache.has(stationId);
  }

  /**
   * Get raw cache entry (for diagnostics)
   *
   * @param stationId - CO-OPS station ID
   * @returns Cache entry or undefined
   */
  getEntry(stationId: string): TideCacheEntry | undefined {
    return this.cache.get(stationId);
  }

  /**
   * Clear all cached data
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get current cache size
   */
  get size(): number {
    return this.cache.size;
  }

  /**
   * Get cache timeout in milliseconds
   */
  get timeout(): number {
    return this.timeoutMs;
  }

  /**
   * Calculate remaining TTL for a cached entry
   *
   * @param stationId - CO-OPS station ID
   * @returns Remaining TTL in seconds, or null if not cached
   */
  getTtlRemaining(stationId: string): number | null {
    const entry = this.cache.get(stationId);
    if (!entry) return null;

    const cacheAge = Date.now() - entry.timestamp;
    const remaining = Math.max(0, Math.floor((this.timeoutMs - cacheAge) / 1000));
    return remaining;
  }

  /**
   * Determine data freshness category
   *
   * @param stationId - CO-OPS station ID
   * @returns "fresh" | "cached" | "stale" | null
   */
  getDataFreshness(stationId: string): "fresh" | "cached" | "stale" | null {
    const entry = this.cache.get(stationId);
    if (!entry) return null;

    const cacheAge = Date.now() - entry.timestamp;
    if (cacheAge > this.timeoutMs * 0.8) {
      return "stale";
    }
    return "cached";
  }
}

/**
 * Create a new TideCache instance with default options
 */
export function createTideCache(options?: TideCacheOptions): TideCache {
  return new TideCache(options);
}
