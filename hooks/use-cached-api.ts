import { useState, useEffect, useCallback, useRef } from "react";
import {
  apiCache,
  forecastCache,
  beachCache,
  RequestCache,
} from "@/lib/utils/request-cache";

interface CachedApiState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface CachedApiOptions {
  immediate?: boolean;
  cache?: RequestCache;
  cacheKey?: string;
  cacheTTL?: number;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useCachedApi<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  options: CachedApiOptions = {}
) {
  const {
    immediate = true,
    cache = apiCache,
    cacheTTL,
    onSuccess,
    onError,
  } = options;

  const fetchFnRef = useRef(fetchFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update refs when props change
  fetchFnRef.current = fetchFn;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const [state, setState] = useState<CachedApiState<T>>(() => {
    // Check cache immediately on mount
    const cachedData = cache.get<T>(cacheKey);
    return {
      data: cachedData,
      loading: immediate && !cachedData,
      error: null,
    };
  });

  const fetchData = useCallback(
    async (bypassCache = false) => {
      // Check cache first unless bypassing
      if (!bypassCache) {
        const cachedData = cache.get<T>(cacheKey);
        if (cachedData) {
          setState({
            data: cachedData,
            loading: false,
            error: null,
          });

          if (onSuccessRef.current) {
            onSuccessRef.current(cachedData);
          }
          return cachedData;
        }
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await fetchFnRef.current();

        // Cache the result
        cache.set(cacheKey, result, cacheTTL);

        setState({
          data: result,
          loading: false,
          error: null,
        });

        if (onSuccessRef.current) {
          onSuccessRef.current(result);
        }

        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Failed to fetch data";

        setState({
          data: null,
          loading: false,
          error: errorMessage,
        });

        if (onErrorRef.current) {
          onErrorRef.current(errorMessage);
        }

        throw error;
      }
    },
    [cache, cacheKey, cacheTTL]
  );

  useEffect(() => {
    if (immediate && !state.data) {
      fetchData();
    }
  }, [fetchData, immediate, state.data]);

  const invalidateCache = useCallback(() => {
    cache.delete(cacheKey);
  }, [cache, cacheKey]);

  const refetch = useCallback(() => {
    return fetchData(true); // Bypass cache
  }, [fetchData]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
    invalidateCache();
  }, [invalidateCache]);

  return {
    ...state,
    refetch,
    reset,
    invalidateCache,
    isCached: Boolean(state.data && !state.loading),
  };
}

// Specialized hook for beach data
export function useCachedBeachData<T>(
  fetchFn: () => Promise<T>,
  beachId: string,
  options: Omit<CachedApiOptions, "cache" | "cacheKey"> = {}
) {
  const cacheKey = RequestCache.createKey("beach", beachId);
  return useCachedApi(fetchFn, cacheKey, {
    ...options,
    cache: beachCache,
  });
}

// Specialized hook for forecast data
export function useCachedForecastData<T>(
  fetchFn: () => Promise<T>,
  beachId: string,
  days?: number,
  options: Omit<CachedApiOptions, "cache" | "cacheKey"> = {}
) {
  const cacheKey = RequestCache.createKey("forecast", beachId, days);
  return useCachedApi(fetchFn, cacheKey, {
    ...options,
    cache: forecastCache,
  });
}

// Map-specific caching helpers
export function useCachedMapData<T>(
  fetchFn: () => Promise<T>,
  cacheKey: string,
  options: Omit<CachedApiOptions, "cache" | "cacheKey"> = {}
) {
  return useCachedApi(fetchFn, cacheKey, {
    ...options,
    cache: apiCache,
  });
}

// Helper to create location-based cache keys with reasonable precision
export function createLocationCacheKey(
  prefix: string,
  latitude: number,
  longitude: number,
  precision: number = 3 // 3 decimal places ≈ 100m precision
): string {
  const lat = latitude.toFixed(precision);
  const lng = longitude.toFixed(precision);
  return RequestCache.createKey(prefix, lat, lng);
}

// Helper to create cached fetch function for map API calls
export function createCachedMapFetch<T>(apiPath: string, ttl: number) {
  return (latitude: number, longitude: number): Promise<T> => {
    // Use aggressive rounding for buoy conditions since it's fallback data
    const precision = apiPath.includes("buoys/conditions") ? 1 : 3; // 1 decimal = ~10km zones
    const cacheKey = createLocationCacheKey(
      apiPath,
      latitude,
      longitude,
      precision
    );

    // Check cache first
    const cached = apiCache.get<T>(cacheKey);
    if (cached) {
      return Promise.resolve(cached);
    }

    // Fetch and cache
    return fetch(`${apiPath}?latitude=${latitude}&longitude=${longitude}`, {
      headers: { Accept: "application/json" },
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
