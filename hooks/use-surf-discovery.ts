"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { CACHE_TTL } from "@/lib/constants/ui";
import type { SurfDiscoveryResponse } from "@/types/personalization";

/**
 * Cached discovery data structure for localStorage
 */
interface CachedDiscoveryData {
  discovery: SurfDiscoveryResponse;
  timestamp: number;
  /** Hash of options used to generate this cache entry */
  optionsHash: string;
}

const CACHE_KEY_PREFIX = "quiver_discovery_";

/**
 * Generate a hash string from options to use as part of cache key
 */
function hashOptions(options: UseSurfDiscoveryOptions): string {
  const normalized = {
    lat: options.userLocation?.lat?.toFixed(2),
    lon: options.userLocation?.lon?.toFixed(2),
    radius: options.radiusMiles,
    horizon: options.horizonHours,
    max: options.maxResults,
    home: options.includeHome,
  };
  return btoa(JSON.stringify(normalized)).slice(0, 16);
}

/**
 * Options for useSurfDiscovery hook
 */
interface UseSurfDiscoveryOptions {
  /** User's GPS location (Phase 2) */
  userLocation?: { lat: number; lon: number };
  /** Search radius in miles (Phase 2, default: 25) */
  radiusMiles?: number;
  /** Hard cap for window start time in hours (e.g. 24 for next-day UX) */
  horizonHours?: number;
  /** Maximum recommendations to return (default: 5, max: 10) */
  maxResults?: number;
  /** Include home beach in results (default: true) */
  includeHome?: boolean;
  /** Whether the hook is enabled (default: true) */
  enabled?: boolean;
  /** Whether to fetch immediately on mount (default: true) */
  immediate?: boolean;
  /** Optional callback when discovery results are fetched successfully */
  onSuccess?: (data: SurfDiscoveryResponse) => void;
  /** Optional callback when an error occurs */
  onError?: (error: string) => void;
}

/**
 * Return type for useSurfDiscovery hook
 */
interface UseSurfDiscoveryReturn {
  /** Surf discovery response with ranked recommendations */
  discovery: SurfDiscoveryResponse | null;
  /** Whether the request is currently loading */
  loading: boolean;
  /** Error message if request failed */
  error: string | null;
  /** Function to manually refetch the recommendations */
  refetch: () => Promise<void>;
  /** Convenience helper: true if recommendations exist, false otherwise */
  hasRecommendations: boolean;
  /** Whether the current data is from cache */
  isCached: boolean;
  /** Clear the cache and refetch fresh data */
  clearCacheAndRefetch: () => Promise<void>;
}

/**
 * Hook for discovering ranked surf spot recommendations with localStorage caching
 *
 * Fetches multiple surf spot recommendations ranked by current conditions,
 * user preferences, beach metadata, and familiarity. Results are cached in
 * localStorage for 30 minutes to improve page load performance.
 *
 * @param options - Configuration options for the hook
 * @returns Discovery data with loading and error states
 *
 * @example
 * ```tsx
 * function DiscoverPage() {
 *   const { discovery, loading, error, refetch, isCached, clearCacheAndRefetch } = useSurfDiscovery({
 *     maxResults: 5,
 *     immediate: true,
 *     enabled: true,
 *   });
 *
 *   // Pull-to-refresh should call clearCacheAndRefetch()
 *   const handleRefresh = () => clearCacheAndRefetch();
 *
 *   if (loading && !isCached) return <div>Finding the best spots...</div>;
 *   if (error) return <div>Error: {error}</div>;
 *   if (!discovery || discovery.recommendations.length === 0) {
 *     return <div>No surf spots found</div>;
 *   }
 *
 *   return (
 *     <div>
 *       {isCached && <span>Updated {timeSince(discovery.metadata.generated_at)}</span>}
 *       {discovery.recommendations.map((rec) => (
 *         <div key={rec.beach.id}>
 *           <h3>{rec.beach.name}</h3>
 *           <p>Match: {rec.matchQuality} ({rec.score}/100)</p>
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function useSurfDiscovery(
  options: UseSurfDiscoveryOptions = {}
): UseSurfDiscoveryReturn {
  const {
    userLocation,
    radiusMiles,
    horizonHours,
    maxResults,
    includeHome,
    enabled = true,
    immediate = true,
    onSuccess,
    onError,
  } = options;
  const { user } = useAuth();

  const [cachedData, setCachedData] = useState<CachedDiscoveryData | null>(null);
  const [isCached, setIsCached] = useState(false);
  const prevCacheKeyRef = useRef<string | null>(null);

  const userLat = userLocation?.lat;
  const userLon = userLocation?.lon;

  // Compute a stable options hash from primitive values (avoid using `options` object identity).
  const optionsHash = useMemo(() => {
    return hashOptions({
      userLocation:
        userLat !== undefined && userLon !== undefined
          ? { lat: userLat, lon: userLon }
          : undefined,
      radiusMiles,
      horizonHours,
      maxResults,
      includeHome,
    });
  }, [
    userLat,
    userLon,
    radiusMiles,
    horizonHours,
    maxResults,
    includeHome,
  ]);

  // Generate cache key for this user + options combination
  const cacheKey = useMemo(() => {
    if (!user?.id) return null;
    return `${CACHE_KEY_PREFIX}${user.id}_${optionsHash}`;
  }, [user?.id, optionsHash]);

  // If the cache key changes (e.g. location/options change), ensure we don't keep using
  // cached data from a previous key. This also allows `useDataFetcher` to re-run when
  // `immediate` toggles back to true (because `cachedData` becomes null).
  useEffect(() => {
    if (prevCacheKeyRef.current !== cacheKey) {
      setCachedData(null);
      setIsCached(false);
      prevCacheKeyRef.current = cacheKey;
    }
  }, [cacheKey]);

  // Load cached data on mount
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id || !enabled) return;

    if (!cacheKey) return;

    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsedData: CachedDiscoveryData = JSON.parse(cached);
        // NOTE: Use API_CALLS TTL (30m) for discovery cache to avoid relying on
        // an optional constant in older builds.
        const isExpired =
          Date.now() - parsedData.timestamp > CACHE_TTL.API_CALLS;

        if (!isExpired) {
          // Restore Date objects from JSON
          if (parsedData.discovery?.recommendations) {
            parsedData.discovery.recommendations = parsedData.discovery.recommendations.map(
              (rec: any) => ({
                ...rec,
                window: {
                  ...rec.window,
                  start: new Date(rec.window.start),
                  end: new Date(rec.window.end),
                },
              })
            );
          }
          setCachedData(parsedData);
          setIsCached(true);
        } else {
          // Cache expired, remove it
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.warn("Failed to load cached discovery data:", error);
      if (cacheKey) localStorage.removeItem(cacheKey);
    }
  }, [user?.id, enabled, cacheKey]);

  // Memoized fetch function to discover surf spots
  const fetchSurfDiscovery = useCallback(async () => {
    if (!user) {
      throw new Error("User must be authenticated to discover surf spots");
    }

    // Build query parameters
    const params = new URLSearchParams();

    // GPS parameters (Phase 2)
    if (userLocation) {
      params.set("lat", userLocation.lat.toString());
      params.set("lon", userLocation.lon.toString());
      if (radiusMiles) {
        params.set("radius", radiusMiles.toString());
      }
    }

    if (maxResults) {
      params.set("maxResults", maxResults.toString());
    }

    if (horizonHours) {
      params.set("horizonHours", horizonHours.toString());
    }

    if (includeHome !== undefined) {
      params.set("includeHome", includeHome.toString());
    }

    const queryString = params.toString();
    const url = `/api/surf/discover${queryString ? `?${queryString}` : ""}`;

    // Fetch from API
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
      credentials: "include",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMessage = errorData.error || `Failed to discover surf spots: ${response.status}`;
      throw new Error(errorMessage);
    }

    const result = await response.json();

    // API returns { data: SurfDiscoveryResponse }
    // Transform date strings back to Date objects
    if (result.data?.recommendations) {
      result.data.recommendations = result.data.recommendations.map((rec: any) => ({
        ...rec,
        window: {
          ...rec.window,
          start: new Date(rec.window.start),
          end: new Date(rec.window.end),
        },
      }));
    }

    const discoveryData = result.data as SurfDiscoveryResponse;

    // Save to localStorage cache
    if (cacheKey) {
      try {
        const cacheEntry: CachedDiscoveryData = {
          discovery: discoveryData,
          timestamp: Date.now(),
          optionsHash,
        };
        localStorage.setItem(cacheKey, JSON.stringify(cacheEntry));
      } catch (error) {
        console.warn("Failed to cache discovery data:", error);
      }
    }

    setIsCached(false);
    return discoveryData;
  }, [
    user,
    userLocation,
    radiusMiles,
    horizonHours,
    maxResults,
    includeHome,
    cacheKey,
    optionsHash,
  ]);

  // Use standard data fetcher pattern
  // Skip initial fetch if we have valid cached data
  const { data: freshData, loading, error, refetch } = useDataFetcher(
    fetchSurfDiscovery,
    {
      immediate: immediate && enabled && !!user && !cachedData,
      skip: !enabled || !user,
      onSuccess,
      onError,
    }
  );

  // Use cached data if available, otherwise use fresh data
  const discovery = cachedData?.discovery || freshData;

  // Clear cache and refetch (for pull-to-refresh)
  const clearCacheAndRefetch = useCallback(async () => {
    if (cacheKey) {
      localStorage.removeItem(cacheKey);
    }
    setCachedData(null);
    setIsCached(false);
    await refetch();
  }, [cacheKey, refetch]);

  return {
    discovery: discovery ?? null,
    loading: loading && !cachedData,
    error,
    refetch,
    hasRecommendations: discovery !== null && discovery.recommendations.length > 0,
    isCached,
    clearCacheAndRefetch,
  };
}

/**
 * Clear all discovery caches for a user (call when profile/preferences change)
 */
export function clearDiscoveryCache(userId?: string): void {
  if (typeof window === "undefined") return;

  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key?.startsWith(CACHE_KEY_PREFIX)) {
        // If userId provided, only clear that user's cache
        if (!userId || key.includes(userId)) {
          keysToRemove.push(key);
        }
      }
    }
    keysToRemove.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.warn("Failed to clear discovery cache:", error);
  }
}
