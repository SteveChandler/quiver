"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { getBeachForecastPreview } from "@/actions/forecast-actions";
import type { ForecastPreview } from "@/types/forecast";

interface UseForecastPreviewOptions {
  enabled?: boolean;
  beachId?: string;
}

interface UseForecastPreviewReturn {
  forecastPreview: ForecastPreview | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

// Request deduplication cache
const requestCache = new Map<string, Promise<any>>();
const REQUEST_CACHE_TTL = 5000; // 5 seconds

export function useForecastPreview({
  enabled = false,
  beachId,
}: UseForecastPreviewOptions): UseForecastPreviewReturn {
  const [forecastPreview, setForecastPreview] =
    useState<ForecastPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const fetchForecast = useCallback(async (beachIdToFetch: string) => {
    // Check cache first for request deduplication
    const cacheKey = `forecast-preview-${beachIdToFetch}`;

    if (requestCache.has(cacheKey)) {
      return requestCache.get(cacheKey);
    }

    // Create new request
    const requestPromise = getBeachForecastPreview(beachIdToFetch);

    // Cache the promise
    requestCache.set(cacheKey, requestPromise);

    // Clear cache after TTL
    setTimeout(() => {
      requestCache.delete(cacheKey);
    }, REQUEST_CACHE_TTL);

    return requestPromise;
  }, []);

  const loadForecastPreview = useCallback(
    async (beachIdToLoad: string) => {
      // Cancel previous request if it exists
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }

      // Create new abort controller
      abortControllerRef.current = new AbortController();

      setLoading(true);
      setError(null);
      setForecastPreview(null);

      try {
        const result = await fetchForecast(beachIdToLoad);

        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        if (result.success && result.data) {
          setForecastPreview(result.data);
          setError(null);
        } else {
          setError("Failed to load forecast preview");
          setForecastPreview(null);
        }
      } catch (err) {
        // Check if request was aborted
        if (abortControllerRef.current?.signal.aborted) {
          return;
        }

        console.error("Error loading forecast preview:", err);
        setError("Error loading forecast preview");
        setForecastPreview(null);
      } finally {
        // Only update loading state if request wasn't aborted
        if (!abortControllerRef.current?.signal.aborted) {
          setLoading(false);
        }
      }
    },
    [fetchForecast]
  );

  const refetch = useCallback(() => {
    if (beachId) {
      loadForecastPreview(beachId);
    }
  }, [beachId, loadForecastPreview]);

  // Load forecast preview when enabled and beach ID is available
  useEffect(() => {
    if (enabled && beachId) {
      loadForecastPreview(beachId);
    } else {
      // Reset state when disabled or no beach ID
      setForecastPreview(null);
      setLoading(false);
      setError(null);
    }

    // Cleanup function
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [enabled, beachId, loadForecastPreview]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return {
    forecastPreview,
    loading,
    error,
    refetch,
  };
}
