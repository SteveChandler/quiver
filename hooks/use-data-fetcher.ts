import { useState, useEffect, useCallback, useRef } from "react";

interface DataFetcherState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
}

interface DataFetcherOptions {
  immediate?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export function useDataFetcher<T>(
  fetchFn: () => Promise<T>,
  options: DataFetcherOptions = {}
) {
  const { immediate = true, onSuccess, onError } = options;

  // Use ref to store the latest fetch function to avoid dependency issues
  const fetchFnRef = useRef(fetchFn);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update refs when props change
  fetchFnRef.current = fetchFn;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const [state, setState] = useState<DataFetcherState<T>>({
    data: null,
    loading: immediate,
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

  useEffect(() => {
    if (immediate) {
      fetchData();
    }
  }, [fetchData, immediate]);

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

// Specialized hook for API calls
export function useApiCall<T>(
  url: string,
  options: RequestInit & DataFetcherOptions = {}
) {
  const { immediate = true, onSuccess, onError, ...fetchOptions } = options;

  const fetchFn = useCallback(async () => {
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}`);
    }

    return response.json();
  }, [url, fetchOptions]);

  return useDataFetcher<T>(fetchFn, { immediate, onSuccess, onError });
}

// Hook for server actions
export function useServerAction<T, Args extends any[]>(
  action: (
    ...args: Args
  ) => Promise<{ success: boolean; data?: T; error?: string }>,
  options: DataFetcherOptions = {}
) {
  const { immediate = false, onSuccess, onError } = options;

  // Use ref to store the latest action function
  const actionRef = useRef(action);
  const onSuccessRef = useRef(onSuccess);
  const onErrorRef = useRef(onError);

  // Update refs when props change
  actionRef.current = action;
  onSuccessRef.current = onSuccess;
  onErrorRef.current = onError;

  const [state, setState] = useState<DataFetcherState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: Args) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await actionRef.current(...args);

        if (result.success && result.data) {
          setState({
            data: result.data,
            loading: false,
            error: null,
          });

          if (onSuccessRef.current) {
            onSuccessRef.current(result.data);
          }
        } else {
          throw new Error(result.error || "Action failed");
        }
      } catch (error) {
        const errorMessage =
          error instanceof Error ? error.message : "Action failed";
        setState({
          data: null,
          loading: false,
          error: errorMessage,
        });

        if (onErrorRef.current) {
          onErrorRef.current(errorMessage);
        }
      }
    },
    [] // Empty dependency array since we use refs
  );

  return {
    ...state,
    execute,
    reset: () => setState({ data: null, loading: false, error: null }),
  };
}
