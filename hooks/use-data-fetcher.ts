import { useState, useEffect, useCallback, useRef } from "react";
import { apiCache, RequestCache } from "@/lib/utils/request-cache";

interface DataFetcherState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  cacheKey?: string;
}

interface DataFetcherOptions<T = any> {
  immediate?: boolean;
  skip?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  initialData?: T;
  /** When provided, results are read from / written to the cache before fetching. */
  cacheKey?: string;
  /** TTL in milliseconds for cached entries. Defaults to the cache's own default TTL. */
  cacheTTL?: number;
  /** Cache instance to use. Defaults to the shared `apiCache`. */
  cache?: RequestCache;
}

export function useDataFetcher<T>(
  fetchFn: () => Promise<T>,
  options: DataFetcherOptions<T> = {}
) {
  const {
    immediate = true,
    skip = false,
    onSuccess,
    onError,
    initialData,
    cacheKey,
    cacheTTL,
    cache = apiCache,
  } = options;

  // Use ref to store the latest fetch function to avoid dependency issues
  const fetchFnRef = useRef(fetchFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);
  const cacheKeyRef = useRef(cacheKey);
  const cacheTTLRef = useRef(cacheTTL);
  const cacheRef = useRef(cache);
  const requestSequenceRef = useRef(0);

  // Update refs when props change
  fetchFnRef.current = fetchFn;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;
  cacheKeyRef.current = cacheKey;
  cacheTTLRef.current = cacheTTL;
  cacheRef.current = cache;

  const [state, setState] = useState<DataFetcherState<T>>(() => {
    // Seed initial state from cache when a cacheKey is provided
    if (cacheKey) {
      const cachedData = cache.get<T>(cacheKey);
      if (cachedData !== null) {
        return { data: cachedData, loading: false, error: null, cacheKey };
      }
    }
    return {
      data: (initialData as T | null) ?? null,
      loading: immediate && !skip,
      error: null,
      cacheKey,
    };
  });

  const fetchData = useCallback(async (bypassCache = false) => {
    const requestSequence = ++requestSequenceRef.current;
    const requestCacheKey = cacheKeyRef.current;

    // Return cached data immediately when available and not forcing a refresh
    if (!bypassCache && requestCacheKey) {
      const cachedData = cacheRef.current.get<T>(requestCacheKey);
      if (cachedData !== null) {
        setState({ data: cachedData, loading: false, error: null, cacheKey: requestCacheKey });
        if (onSuccessRef.current) {
          onSuccessRef.current(cachedData);
        }
        return cachedData;
      }
    }

    setState((prev) => {
      if (prev.loading && prev.error === null) return prev;
      return { ...prev, loading: true, error: null };
    });

    try {
      const result = await fetchFnRef.current();
      if (
        requestSequence !== requestSequenceRef.current ||
        requestCacheKey !== cacheKeyRef.current
      ) {
        return result;
      }

      // Populate cache when a key is provided
      if (requestCacheKey) {
        cacheRef.current.set(requestCacheKey, result, cacheTTLRef.current);
      }

      setState({
        data: result,
        loading: false,
        error: null,
        cacheKey: requestCacheKey,
      });

      if (onSuccessRef.current) {
        onSuccessRef.current(result);
      }

      return result;
    } catch (error) {
      if (
        requestSequence !== requestSequenceRef.current ||
        requestCacheKey !== cacheKeyRef.current
      ) {
        return;
      }
      const errorMessage =
        error instanceof Error ? error.message : "Failed to fetch data";
      setState({
        data: null,
        loading: false,
        error: errorMessage,
        cacheKey: requestCacheKey,
      });

      if (onErrorRef.current) {
        onErrorRef.current(errorMessage);
      }
    }
  }, []); // Empty dependency array since we use refs

  // Track previous skip and fetchFn to detect changes
  const prevSkipRef = useRef(skip);
  const prevFetchFnRef = useRef(fetchFn);
  const prevCacheKeyRef = useRef(cacheKey);
  const hasRunInitialRef = useRef(false);

  useEffect(() => {
    const wasSkipped = prevSkipRef.current;
    const fetchFnChanged = prevFetchFnRef.current !== fetchFn;
    const cacheKeyChanged = prevCacheKeyRef.current !== cacheKey;

    // Trigger fetch when:
    // 1. immediate is true, not skipped, and initial fetch hasn't run yet
    // 2. skip transitions from true to false (enables a previously disabled fetch)
    // 3. fetchFn identity changes while not skipped (callers use useCallback
    //    with deps, so a new identity signals changed parameters)
    const shouldFetch =
      (!hasRunInitialRef.current && immediate && !skip) ||
      (wasSkipped && !skip) ||
      (!skip && (fetchFnChanged || cacheKeyChanged));

    if (shouldFetch) {
      fetchData();
    }

    if (!skip) {
      hasRunInitialRef.current = true;
    }
    prevSkipRef.current = skip;
    prevFetchFnRef.current = fetchFn;
    prevCacheKeyRef.current = cacheKey;
  }, [cacheKey, fetchData, immediate, skip, fetchFn]);

  const retry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const reset = useCallback(() => {
    requestSequenceRef.current += 1;
    setState({
      data: null,
      loading: false,
      error: null,
      cacheKey: cacheKeyRef.current,
    });
  }, []);

  // Removes the cached entry so the next fetch hits the network.
  const invalidateCache = useCallback(() => {
    if (cacheKeyRef.current) {
      cacheRef.current.delete(cacheKeyRef.current);
    }
  }, []);

  // refetch bypasses the cache and forces a network request
  const refetch = useCallback(() => fetchData(true), [fetchData]);

  const cacheKeyMatches = state.cacheKey === cacheKey;

  return {
    data: cacheKeyMatches ? state.data : null,
    loading: cacheKeyMatches ? state.loading : immediate && !skip,
    error: cacheKeyMatches ? state.error : null,
    refetch,
    retry,
    reset,
    invalidateCache,
  };
}
