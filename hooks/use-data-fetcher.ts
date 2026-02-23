import { useState, useEffect, useCallback, useRef } from "react";

interface DataFetcherState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface DataFetcherOptions<T = any> {
  immediate?: boolean;
  skip?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
  initialData?: T;
}

export function useDataFetcher<T>(
  fetchFn: () => Promise<T>,
  options: DataFetcherOptions<T> = {}
) {
  const { immediate = true, skip = false, onSuccess, onError, initialData } = options;

  // Use ref to store the latest fetch function to avoid dependency issues
  const fetchFnRef = useRef(fetchFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update refs when props change
  fetchFnRef.current = fetchFn;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const [state, setState] = useState<DataFetcherState<T>>({
    data: (initialData as T | null) ?? null,
    loading: immediate && !skip,
    error: null,
  });

  const fetchData = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await fetchFnRef.current();
      setState({
        data: result,
        loading: false,
        error: null,
      });

      if (onSuccessRef.current) {
        onSuccessRef.current(result);
      }
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
    }
  }, []); // Empty dependency array since we use refs

  // Track previous skip and fetchFn to detect changes
  const prevSkipRef = useRef(skip);
  const prevFetchFnRef = useRef(fetchFn);

  useEffect(() => {
    const wasSkipped = prevSkipRef.current;
    const fetchFnChanged = prevFetchFnRef.current !== fetchFn;

    // Trigger fetch when:
    // 1. immediate is true and not skipped (initial mount or re-run)
    // 2. skip changes from true to false
    // 3. fetchFn identity changes while not skipped (callers use useCallback
    //    with deps, so a new identity signals changed parameters)
    if ((immediate && !skip) || (wasSkipped && !skip) || (!skip && fetchFnChanged)) {
      fetchData();
    }

    prevSkipRef.current = skip;
    prevFetchFnRef.current = fetchFn;
  }, [fetchData, immediate, skip, fetchFn]);

  const retry = useCallback(() => {
    fetchData();
  }, [fetchData]);

  const reset = useCallback(() => {
    setState({
      data: null,
      loading: false,
      error: null,
    });
  }, []);

  return {
    ...state,
    refetch: fetchData,
    retry,
    reset,
  };
}