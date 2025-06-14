/**
 * Beach Cluster Cache System
 *
 * Implements 4-hour caching for the Pacific Beach cluster:
 * - Pacific Beach (source)
 * - Ocean Beach (fallback)
 * - Mission Beach (fallback)
 * - Sunset Cliffs (fallback)
 * - Crystal Pier (fallback)
 *
 * When any of these beaches are requested, only 1 API call is made to Pacific Beach
 * and the data is shared across all beaches in the cluster for 4 hours.
 */

import type { Forecast, Beach } from "@/types/database";

// Define the Pacific Beach cluster
export const PACIFIC_BEACH_CLUSTER = {
  source: "Pacific Beach",
  fallback_beaches: [
    "Ocean Beach",
    "Mission Beach",
    "Sunset Cliffs",
    "Crystal Pier",
    "Crystal Pier (Pacific Beach)",
  ],
};

// Cache duration: 4 hours
const CACHE_DURATION_MS = 4 * 60 * 60 * 1000; // 4 hours in milliseconds

interface CachedForecastData {
  forecasts: Forecast[];
  sourceBeach: Beach;
  timestamp: number;
  expiresAt: number;
}

// In-memory cache (in production, you might want to use Redis or similar)
let pacificBeachCache: CachedForecastData | null = null;

/**
 * Check if a beach is part of the Pacific Beach cluster
 */
export function isInPacificBeachCluster(beachName: string): boolean {
  const normalizedName = beachName.toLowerCase().trim();

  // Return false for empty strings
  if (!normalizedName) {
    return false;
  }

  // Check if it's the source beach
  if (normalizedName.includes("pacific beach")) {
    return true;
  }

  // Check if it's one of the fallback beaches
  return PACIFIC_BEACH_CLUSTER.fallback_beaches.some(
    (fallbackBeach) =>
      normalizedName.includes(fallbackBeach.toLowerCase()) ||
      fallbackBeach.toLowerCase().includes(normalizedName)
  );
}

/**
 * Get cached forecast data for the Pacific Beach cluster
 */
export function getCachedClusterForecast(): CachedForecastData | null {
  if (!pacificBeachCache) {
    return null;
  }

  const now = Date.now();
  if (now > pacificBeachCache.expiresAt) {
    // Cache expired
    pacificBeachCache = null;
    return null;
  }

  return pacificBeachCache;
}

/**
 * Set cached forecast data for the Pacific Beach cluster
 */
export function setCachedClusterForecast(
  forecasts: Forecast[],
  sourceBeach: Beach
): void {
  const now = Date.now();

  pacificBeachCache = {
    forecasts,
    sourceBeach,
    timestamp: now,
    expiresAt: now + CACHE_DURATION_MS,
  };

  console.log(
    `🗄️ Cached forecast data for Pacific Beach cluster (expires in 4 hours)`
  );
}

/**
 * Invalidate the Pacific Beach cluster cache
 */
export function invalidateClusterCache(): void {
  pacificBeachCache = null;
  console.log("🗑️ Pacific Beach cluster cache invalidated");
}

/**
 * Get cache status for debugging
 */
export function getCacheStatus(): {
  isCached: boolean;
  remainingTimeMs: number;
  remainingTimeHuman: string;
  sourceBeach?: string;
} {
  if (!pacificBeachCache) {
    return {
      isCached: false,
      remainingTimeMs: 0,
      remainingTimeHuman: "No cache",
    };
  }

  const now = Date.now();
  const remainingTimeMs = Math.max(0, pacificBeachCache.expiresAt - now);
  const remainingHours = Math.floor(remainingTimeMs / (60 * 60 * 1000));
  const remainingMinutes = Math.floor(
    (remainingTimeMs % (60 * 60 * 1000)) / (60 * 1000)
  );

  return {
    isCached: remainingTimeMs > 0,
    remainingTimeMs,
    remainingTimeHuman:
      remainingTimeMs > 0
        ? `${remainingHours}h ${remainingMinutes}m remaining`
        : "Expired",
    sourceBeach: pacificBeachCache.sourceBeach.name,
  };
}

/**
 * Find Pacific Beach in a list of beaches
 */
export function findPacificBeach(beaches: Beach[]): Beach | null {
  return (
    beaches.find(
      (beach) =>
        beach.name.toLowerCase().includes("pacific beach") ||
        beach.name.toLowerCase().includes("pacific")
    ) || null
  );
}
