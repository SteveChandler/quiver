import { useState, useEffect, useCallback, useMemo } from "react";
import useSWR from "swr";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface BeachSources {
  camera_url?: string | null;
  // Add other source fields as needed
}

interface BeachDetailData {
  beach: Beach | null;
  forecasts: EnhancedForecastEntity[];
  sources: BeachSources | null;
}

interface BeachDetailState {
  data: BeachDetailData;
  loading: boolean;
  errors: {
    beach?: string | null;
    forecasts?: string | null;
    sources?: string | null;
  };
}

interface UseBeachDetailDataOptions {
  beachId: string;
  initialBeach?: Beach | null;
  forecastDays?: number;
}

// SWR fetcher function
const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  return body;
};

/**
 * Custom hook for Beach Detail page that fetches all data in parallel with SWR caching
 * This eliminates the waterfall pattern and provides instant subsequent loads
 */
export function useBeachDetailData({
  beachId,
  initialBeach = null,
  forecastDays = 10,
}: UseBeachDetailDataOptions) {
  // SWR configuration for optimal caching
  const swrConfig = {
    revalidateOnFocus: false,
    revalidateOnReconnect: true,
    dedupingInterval: 60000, // Dedupe requests within 60s
    errorRetryCount: 2,
  };

  // Fetch beach data only if we don't have initialBeach
  const shouldFetchBeach = !initialBeach;
  const {
    data: beachData,
    error: beachError,
    isLoading: beachLoading,
  } = useSWR(
    shouldFetchBeach ? `/api/beaches/${beachId}` : null,
    fetcher,
    {
      ...swrConfig,
      fallbackData: initialBeach ? { data: { beach: initialBeach } } : undefined,
    }
  );

  // Fetch forecasts with SWR
  const {
    data: forecastData,
    error: forecastError,
    isLoading: forecastLoading,
    mutate: mutateForecast,
  } = useSWR(
    `/api/forecasts/update-enhanced?beachId=${beachId}&days=${forecastDays}`,
    fetcher,
    swrConfig
  );

  // Fetch sources with SWR
  const {
    data: sourcesData,
    error: sourcesError,
    isLoading: sourcesLoading,
  } = useSWR(`/api/beaches/${beachId}/sources`, fetcher, {
    ...swrConfig,
    shouldRetryOnError: false, // Don't retry sources if they fail
  });

  // Extract actual data from API responses
  const beach = useMemo(() => {
    if (initialBeach) return initialBeach;
    return beachData?.data?.beach || beachData?.beach || beachData?.data || null;
  }, [beachData, initialBeach]);

  const forecasts = useMemo(() => {
    const data = forecastData?.data?.forecasts || forecastData?.forecasts || [];
    if (forecastError) {
      console.debug("⚠️ Forecast data unavailable:", forecastError);
      return [];
    }
    return data as EnhancedForecastEntity[];
  }, [forecastData, forecastError]);

  const sources = useMemo(() => {
    if (sourcesError) {
      console.debug("⚠️ Source data unavailable:", sourcesError);
      return null;
    }
    return sourcesData?.data?.sources || sourcesData?.sources || null;
  }, [sourcesData, sourcesError]);

  // Combined loading state - only loading if beach is loading
  // (other data can load progressively)
  const loading = shouldFetchBeach ? beachLoading : false;

  // Collect errors
  const errors = useMemo(
    () => ({
      beach: beachError?.message || null,
      forecasts: forecastError?.message || null,
      sources: sourcesError?.message || null,
    }),
    [beachError, forecastError, sourcesError]
  );

  // Log successful data load
  useEffect(() => {
    if (beach && forecasts && !loading) {
      if (process.env.NODE_ENV === "development") {
        console.log("✅ Beach detail data loaded with SWR caching:", {
          beach: beach?.name,
          forecastCount: forecasts.length,
          hasSources: !!sources,
          cached: "SWR auto-caching enabled",
        });
      }
    }
  }, [beach, forecasts, sources, loading]);

  // Refetch function
  const refetch = useCallback(() => {
    mutateForecast(); // SWR mutate triggers revalidation
  }, [mutateForecast]);

  return {
    beach,
    forecasts,
    sources,
    loading,
    errors,
    refetch,
  };
}
