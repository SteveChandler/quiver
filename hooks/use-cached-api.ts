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
