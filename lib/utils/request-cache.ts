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

/**
 * Factory that returns a cached fetch function for map API calls.
 * Rounds coordinates to reduce cache fragmentation.
 * Moved here from `hooks/use-cached-api.ts` so map utilities can import it
 * without pulling in React hook code.
 */
export function createCachedMapFetch<T>(apiPath: string, ttl: number) {
  return (
    latitude: number,
    longitude: number,
    signal?: AbortSignal,
  ): Promise<T> => {
    // Use aggressive rounding for buoy conditions since it's fallback data
    const precision = apiPath.includes("buoys/conditions") ? 1 : 3; // 1 decimal = ~10km zones
    const latKey = latitude.toFixed(precision);
    const lonKey = longitude.toFixed(precision);
    const cacheKey = RequestCache.createKey(apiPath, latKey, lonKey);

    // Check cache first
    const cached = apiCache.get<T>(cacheKey);
    if (cached) {
      return Promise.resolve(cached);
    }

    // Fetch and cache
    return fetch(`${apiPath}?latitude=${latitude}&longitude=${longitude}`, {
      headers: { Accept: "application/json" },
      signal,
    })
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        apiCache.set(cacheKey, data, ttl);
        return data;
      });
  };
}

// Simplified auto-cleanup for NOAA data - run less frequently since data is long-lived
if (typeof window !== "undefined" && !(window as any).__PLAYWRIGHT__) {
  setInterval(() => {
    apiCache.clearExpired();
    forecastCache.clearExpired();
    beachCache.clearExpired();
  }, 60 * 60 * 1000); // Clean every hour instead of every 10 minutes
}
