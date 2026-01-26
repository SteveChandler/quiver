/**
 * IOOS Observation Cache
 *
 * In-memory caching for observation data to reduce API calls and improve performance.
 *
 * @module ioos/cache
 */

import { IOOSObservation } from "@/types/ioos";
import { ParsedObservation, CacheEntry } from "./types";

/**
 * Observation cache implementation
 * Stores both IOOSObservation and ParsedObservation formats
 */
export class ObservationCache {
  private cache: Map<string, CacheEntry> = new Map();
  private cacheTtlMs: number;

  /**
   * Create a new observation cache
   *
   * @param cacheTtlMs - Time-to-live for cache entries in milliseconds
   */
  constructor(cacheTtlMs: number) {
    this.cacheTtlMs = cacheTtlMs;
  }

  /**
   * Get cached observation if not expired
   *
   * @param key - Cache key (typically stationId)
   * @returns Cached observation or null if not found/expired
   */
  get(key: string): IOOSObservation | ParsedObservation | null | undefined {
    const entry = this.cache.get(key);
    if (!entry) return undefined;

    const age = Date.now() - entry.at;
    if (age >= this.cacheTtlMs) {
      this.cache.delete(key);
      return undefined;
    }

    return entry.data;
  }

  /**
   * Store observation in cache
   *
   * @param key - Cache key (typically stationId)
   * @param data - Observation data to cache (null if fetch failed)
   */
  set(key: string, data: IOOSObservation | ParsedObservation | null): void {
    this.cache.set(key, {
      at: Date.now(),
      data,
    });
  }

  /**
   * Check if key exists in cache and is not expired
   *
   * @param key - Cache key
   * @returns True if cached value exists and is fresh
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;

    const age = Date.now() - entry.at;
    if (age >= this.cacheTtlMs) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Clear all cached entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get number of cached entries (including expired)
   */
  size(): number {
    return this.cache.size;
  }

  /**
   * Remove expired entries from cache
   * Useful for long-running processes to prevent memory leaks
   *
   * @returns Number of entries removed
   */
  prune(): number {
    const now = Date.now();
    let removed = 0;

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.at;
      if (age >= this.cacheTtlMs) {
        this.cache.delete(key);
        removed++;
      }
    }

    return removed;
  }
}
