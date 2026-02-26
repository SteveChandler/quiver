"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/context/auth-context";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import {
  CACHE_KEY_PREFIX,
  hashDiscoveryOptions,
  readFromCache,
  writeToCache,
  type CachedDiscoveryData,
} from "@/lib/utils/discovery-cache-utils";
import type { SurfDiscoveryResponse, TimeSlot } from "@/types/personalization";

/**
 * Options for useSurfDiscovery hook
 */
interface UseSurfDiscoveryOptions {
  /** User's GPS location (required for discovery) */
  userLocation?: { lat: number; lon: number };
  /** Search radius in miles (default: 25) */
  radiusMiles?: number;
  /** Hard cap for window start time in hours (e.g. 24 for next-day UX) */
  horizonHours?: number;
  /** Maximum recommendations to return (default: 5, max: 10) */
  maxResults?: number;
  /** Filter windows to specific time of day (default: 'any') */
  timeSlot?: TimeSlot;
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
    timeSlot,
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
    return hashDiscoveryOptions({
      userLocation:
        userLat !== undefined && userLon !== undefined
          ? { lat: userLat, lon: userLon }
          : undefined,
      radiusMiles,
      horizonHours,
      maxResults,
      timeSlot,
    });
  }, [userLat, userLon, radiusMiles, horizonHours, maxResults, timeSlot]);

  // Generate cache key for this user + options combination
  const cacheKey = useMemo(() => {
    if (!user?.id) return null;
    return `${CACHE_KEY_PREFIX}${user.id}_${optionsHash}`;
  }, [user?.id, optionsHash]);

  // If the cache key changes (e.g. location/options change), ensure we don't keep using
  // cached data from a previous key. This also allows `useDataFetcher` to re-run when
  // `immediate` toggles back to true (because `cachedData` becomes null).
  // Also track if this is a change (not initial mount) to trigger refetch.
  const isInitialMountRef = useRef(true);
  useEffect(() => {
    if (prevCacheKeyRef.current !== cacheKey) {
      setCachedData(null);
      setIsCached(false);
      prevCacheKeyRef.current = cacheKey;
    }
    // After initial mount, mark as no longer initial
    if (isInitialMountRef.current) {
      isInitialMountRef.current = false;
    }
  }, [cacheKey]);

  // Load cached data on mount (uses shared utility that handles Date restoration)
  useEffect(() => {
    if (typeof window === "undefined" || !user?.id || !enabled) return;
    if (!cacheKey) return;

    const cached = readFromCache(cacheKey);
    if (cached) {
      setCachedData(cached);
      setIsCached(true);
    }
  }, [user?.id, enabled, cacheKey]);

  // Memoized fetch function to discover surf spots
  const fetchSurfDiscovery = useCallback(async () => {
    if (!user) {
      throw new Error("User must be authenticated to discover surf spots");
    }

    // Build query parameters
    const params = new URLSearchParams();

    // GPS parameters (use primitives to avoid object-identity re-renders)
    if (userLat !== undefined && userLon !== undefined) {
      params.set("lat", userLat.toString());
      params.set("lon", userLon.toString());
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

    if (timeSlot) {
      params.set("timeSlot", timeSlot);
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

    // Save to localStorage cache using shared utility
    if (cacheKey) {
      writeToCache(cacheKey, discoveryData, optionsHash);
    }

    setIsCached(false);
    return discoveryData;
  }, [
    user,
    userLat,
    userLon,
    radiusMiles,
    horizonHours,
    maxResults,
    timeSlot,
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

  // Refetch when options change (e.g., timeSlot) - debounced to prevent rapid clicks
  const prevOptionsHashRef = useRef(optionsHash);
  useEffect(() => {
    // Skip if this is initial mount or options haven't changed
    if (isInitialMountRef.current || prevOptionsHashRef.current === optionsHash) {
      prevOptionsHashRef.current = optionsHash;
      return;
    }
    prevOptionsHashRef.current = optionsHash;

    // Debounce to prevent rapid time slot switching from hitting rate limits
    const timeoutId = setTimeout(() => {
      refetch();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [optionsHash, refetch]);

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