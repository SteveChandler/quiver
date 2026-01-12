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

  // Track previous skip value to trigger fetch when skip becomes false
  const prevSkipRef = useRef(skip);

  useEffect(() => {
    const wasSkipped = prevSkipRef.current;
    const isCurrentlySkipped = skip;

    // Trigger fetch when immediate is true and not skipped,
    // or when skip changes from true to false
    if ((immediate && !skip) || (wasSkipped && !isCurrentlySkipped)) {
      fetchData();
    }

    prevSkipRef.current = skip;
  }, [fetchData, immediate, skip]);

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