import { CACHE_TTL } from "@/lib/constants/ui";

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number; // Time to live in milliseconds
}

interface CacheOptions {
  ttl?: number; // Default TTL in milliseconds
  maxSize?: number; // Maximum number of entries
}

class RequestCache {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly defaultTTL: number = 5 * 60 * 1000; // 5 minutes
  private readonly maxSize: number = 100;

  constructor(options: CacheOptions = {}) {
    this.defaultTTL = options.ttl || this.defaultTTL;
    this.maxSize = options.maxSize || this.maxSize;
  }

  /**
   * Get cached data if it exists and is not expired
   */
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Check if entry has expired
    const now = Date.now();
    if (now > entry.timestamp + entry.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  /**
   * Set cached data with optional TTL
   */
  set<T>(key: string, data: T, ttl?: number): void {
    // Implement LRU eviction if cache is full
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey) {
        this.cache.delete(firstKey);
      }
    }

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl: ttl || this.defaultTTL,
    });
  }

  /**
   * Check if key exists and is not expired
   */
  has(key: string): boolean {
    return this.get(key) !== null;
  }

  /**
   * Delete specific cache entry
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache entries
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Clear expired entries
   */
  clearExpired(): number {
    const now = Date.now();
    let clearedCount = 0;

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.timestamp + entry.ttl) {
        this.cache.delete(key);
        clearedCount++;
      }
    }

    return clearedCount;
  }

  /**
   * Get cache statistics
   */
  getStats() {
    return {
      size: this.cache.size,
      maxSize: this.maxSize,
      defaultTTL: this.defaultTTL,
    };
  }

  /**
   * Create a cache key from various parameters
   */
  static createKey(
    ...parts: (string | number | boolean | undefined | null)[]
  ): string {
    return parts
      .filter((part) => part !== undefined && part !== null)
      .map((part) => String(part))
      .join(":");
  }
}

// Global cache instances for different types of data
export const apiCache = new RequestCache({
  ttl: CACHE_TTL.API_CALLS,
  maxSize: 50,
});

export const forecastCache = new RequestCache({
  ttl: CACHE_TTL.FORECASTS,
  maxSize: 30,
});

export const beachCache = new RequestCache({
  ttl: CACHE_TTL.BEACH_DATA,
  maxSize: 100,
});

export { RequestCache };

// Simplified auto-cleanup for NOAA data - run less frequently since data is long-lived
if (typeof window !== "undefined" && !(window as any).__PLAYWRIGHT__) {
  setInterval(() => {
    apiCache.clearExpired();
    forecastCache.clearExpired();
    beachCache.clearExpired();
  }, 60 * 60 * 1000); // Clean every hour instead of every 10 minutes
}
