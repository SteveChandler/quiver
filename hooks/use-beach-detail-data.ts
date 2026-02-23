import { useEffect, useCallback, useMemo } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";

export interface BeachSources {
  camera_url?: string | null;
  embed_allowed?: boolean | null;
  // Add other source fields as needed
}

interface UseBeachDetailDataOptions {
  beachId: string;
  initialBeach?: Beach | null;
  forecastDays?: number;
}

/**
 * Custom hook for Beach Detail page that fetches all data in parallel using
 * useDataFetcher for consistency with the repo's data fetching pattern.
 * HTTP caching is preserved via fetch options (force-cache, revalidate: 600).
 */
export function useBeachDetailData({
  beachId,
  initialBeach = null,
  forecastDays = 10,
}: UseBeachDetailDataOptions) {
  // Fetch beach data — skip when initialBeach is already available
  const fetchBeach = useCallback(async () => {
    const res = await fetch(`/api/beaches/${beachId}`, {
      cache: "force-cache",
      next: { revalidate: 600 }, // Revalidate after 10 minutes (matches API cache)
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [beachId]);

  const {
    data: beachRawData,
    loading: beachLoading,
    error: beachError,
  } = useDataFetcher(fetchBeach, {
    skip: !!initialBeach,
    initialData: initialBeach ? { data: { beach: initialBeach } } : undefined,
  });

  // Fetch forecasts
  const fetchForecasts = useCallback(async () => {
    const res = await fetch(
      `/api/forecasts/update-enhanced?beachId=${beachId}&days=${forecastDays}`,
      {
        cache: "force-cache",
        next: { revalidate: 600 },
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [beachId, forecastDays]);

  const {
    data: forecastRawData,
    loading: forecastLoading,
    error: forecastError,
    refetch: refetchForecast,
  } = useDataFetcher(fetchForecasts);

  // Fetch sources — don't retry on error (sources are non-critical)
  const fetchSources = useCallback(async () => {
    const res = await fetch(`/api/beaches/${beachId}/sources`, {
      cache: "force-cache",
      next: { revalidate: 600 },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  }, [beachId]);

  const {
    data: sourcesRawData,
    loading: sourcesLoading,
    error: sourcesError,
  } = useDataFetcher(fetchSources);

  // Extract actual data from API responses
  const beach = useMemo(() => {
    if (initialBeach) return initialBeach;
    return (
      beachRawData?.data?.beach ||
      beachRawData?.beach ||
      beachRawData?.data ||
      null
    );
  }, [beachRawData, initialBeach]);

  const forecasts = useMemo(() => {
    const data =
      forecastRawData?.data?.forecasts || forecastRawData?.forecasts || [];
    if (forecastError) {
      console.debug("Warning: Forecast data unavailable:", forecastError);
      return [];
    }
    return data as EnhancedForecastEntity[];
  }, [forecastRawData, forecastError]);

  useEffect(() => {
    if (forecastError)
      trackFallback({
        domain: "beach-detail",
        field: "forecast_data",
        fallbackValue: "[]",
      });
  }, [forecastError]);

  const sources = useMemo(() => {
    if (sourcesError) {
      console.debug("Warning: Source data unavailable:", sourcesError);
      return null;
    }
    return (
      sourcesRawData?.data?.sources || sourcesRawData?.sources || null
    );
  }, [sourcesRawData, sourcesError]);

  // Combined loading state — only loading if beach is loading
  // (other data can load progressively)
  const loading = !initialBeach ? beachLoading : false;

  // Collect errors
  const errors = useMemo(
    () => ({
      beach: beachError || null,
      forecasts: forecastError || null,
      sources: sourcesError || null,
    }),
    [beachError, forecastError, sourcesError]
  );

  // Log successful data load in development
  useEffect(() => {
    if (beach && forecasts && !loading) {
      if (process.env.NODE_ENV === "development") {
        console.debug("Beach detail data loaded:", {
          beach: beach?.name,
          forecastCount: forecasts.length,
          hasSources: !!sources,
        });
      }
    }
  }, [beach, forecasts, sources, loading]);

  // refetch and refreshForecast both delegate to the forecast fetcher
  const refetch = useCallback(() => {
    refetchForecast();
  }, [refetchForecast]);

  /**
   * Force refresh forecast data immediately.
   * Use this after admin updates to bypass cache and show fresh data.
   */
  const refreshForecast = useCallback(async () => {
    await refetchForecast();
  }, [refetchForecast]);

  return {
    beach,
    forecasts,
    sources,
    loading,
    errors,
    refetch,
    refreshForecast,
  };
}
