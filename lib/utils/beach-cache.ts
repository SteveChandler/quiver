/**
 * Beach Data Caching Utility
 * 
 * Provides in-memory caching for beach data to reduce database load.
 * Particularly useful for frequently accessed beach information.
 */

import type { Beach } from "@/types/database";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class BeachCache {
  private cache = new Map<string, CacheEntry<any>>();
  private readonly defaultTTL = 5 * 60 * 1000; // 5 minutes in milliseconds

  /**
   * Get a value from cache if it exists and hasn't expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      return null;
    }
    
    // Check if entry has expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }

  /**
   * Set a value in cache with optional TTL
   */
  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs || this.defaultTTL;
    const now = Date.now();
    
    this.cache.set(key, {
      data,
      timestamp: now,
      expiresAt: now + ttl,
    });
  }

  /**
   * Invalidate a specific cache entry
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Get cache statistics
   */
  getStats(): {
    size: number;
    entries: Array<{ key: string; age: number }>;
  } {
    const now = Date.now();
    const entries: Array<{ key: string; age: number }> = [];
    
    this.cache.forEach((entry, key) => {
      entries.push({
        key,
        age: now - entry.timestamp,
      });
    });
    
    return {
      size: this.cache.size,
      entries,
    };
  }

  /**
   * Remove expired entries (garbage collection)
   */
  cleanup(): void {
    const now = Date.now();
    const keysToDelete: string[] = [];
    
    this.cache.forEach((entry, key) => {
      if (now > entry.expiresAt) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach((key) => this.cache.delete(key));
    
    if (keysToDelete.length > 0) {
      console.log(`🧹 Cleaned up ${keysToDelete.length} expired beach cache entries`);
    }
  }
}

// Singleton instance
const beachCache = new BeachCache();

// Helper functions for common beach caching patterns

/**
 * Get a beach by ID with caching
 */
export async function getCachedBeach(
  beachId: string,
  fetchFn: () => Promise<Beach | null>
): Promise<Beach | null> {
  const cacheKey = `beach:${beachId}`;
  
  // Try cache first
  const cached = beachCache.get<Beach>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch from database
  const beach = await fetchFn();
  
  // Cache the result
  if (beach) {
    beachCache.set(cacheKey, beach);
  }
  
  return beach;
}

/**
 * Get all beaches with caching
 */
export async function getCachedBeaches(
  fetchFn: () => Promise<Beach[]>
): Promise<Beach[]> {
  const cacheKey = "beaches:all";
  
  // Try cache first
  const cached = beachCache.get<Beach[]>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Fetch from database
  const beaches = await fetchFn();
  
  // Cache the result (shorter TTL for lists)
  beachCache.set(cacheKey, beaches, 2 * 60 * 1000); // 2 minutes
  
  return beaches;
}

/**
 * Invalidate cache for a specific beach
 */
export function invalidateBeachCache(beachId: string): void {
  beachCache.invalidate(`beach:${beachId}`);
  beachCache.invalidate("beaches:all");
}

/**
 * Clear all beach cache
 */
export function clearBeachCache(): void {
  beachCache.clear();
}

/**
 * Get beach cache statistics
 */
export function getBeachCacheStats() {
  return beachCache.getStats();
}

// Set up periodic cleanup (every 10 minutes)
if (typeof window !== "undefined") {
  setInterval(() => {
    beachCache.cleanup();
  }, 10 * 60 * 1000);
}

export { beachCache };

