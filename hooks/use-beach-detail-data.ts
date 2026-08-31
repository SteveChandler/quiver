import { useEffect, useCallback, useMemo, useRef } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useOptionalAuth } from "@/context/auth-context";
import { forecastCache, RequestCache } from "@/lib/utils/request-cache";
import type { Beach } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { trackFallback } from "@/lib/monitoring/fallback-tracker";

export interface BeachSources {
  camera_url?: string | null;
  cam_thumbnail_url?: string | null;
  embed_allowed?: boolean | null;
  diorama_url?: string | null;
}

export interface BeachForecastMetadata {
  cached?: boolean;
  stale?: boolean;
  missing?: boolean;
  displayStale?: boolean;
  reason?: string | null;
  dataSource?: string;
  lastUpdated?: string;
  dataAge?: string;
  stalenessThreshold?: number;
}

interface UseBeachDetailDataOptions {
  beachId: string;
  initialBeach?: Beach | null;
  forecastDays?: number;
}

/**
 * Custom hook for Beach Detail page that fetches all data in parallel using
 * useDataFetcher for consistency with the repo's data fetching pattern.
 * Public beach metadata and identity-scoped forecasts use in-memory caches.
 */
export function useBeachDetailData({
  beachId,
  initialBeach = null,
  forecastDays = 10,
}: UseBeachDetailDataOptions) {
  const identity = useOptionalAuth()?.user?.id ?? "anon";
  const previousIdentityRef = useRef(identity);

  useEffect(() => {
    if (previousIdentityRef.current === identity) return;
    forecastCache.clear();
    previousIdentityRef.current = identity;
  }, [identity]);

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
      `/api/forecasts/update-enhanced?beachId=${beachId}&days=${forecastDays}&allowStale=display`,
      {
        cache: "no-store",
      }
    );
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    // Surface instrumentation headers for forecast_ready event metadata.
    // See app/api/forecasts/update-enhanced/route.ts for header semantics.
    const sourceHeader = res.headers.get("X-Quiver-Source");
    const cachedHeader = res.headers.get("X-Quiver-Cached");
    return {
      ...json,
      _meta: {
        source: sourceHeader ?? undefined,
        cached:
          cachedHeader === "true"
            ? true
            : cachedHeader === "false"
              ? false
              : undefined,
      },
    };
  }, [beachId, forecastDays]);

  const {
    data: forecastRawData,
    loading: forecastLoading,
    error: forecastError,
    refetch: refetchForecast,
  } = useDataFetcher(fetchForecasts, {
    cacheKey: RequestCache.createKey(
      "beach-detail-forecasts",
      identity,
      beachId,
      forecastDays,
    ),
    cache: forecastCache,
  });

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

  const forecastMetadata = useMemo<BeachForecastMetadata | null>(() => {
    return (
      forecastRawData?.data?.metadata ||
      forecastRawData?.metadata ||
      null
    );
  }, [forecastRawData]);

  // Forecast cache instrumentation surfaced from response headers
  // (X-Quiver-Source / X-Quiver-Cached). Consumed by forecast_ready event.
  const forecastSource = useMemo<string | undefined>(
    () => forecastRawData?._meta?.source,
    [forecastRawData],
  );
  const forecastCached = useMemo<boolean | undefined>(
    () => forecastRawData?._meta?.cached,
    [forecastRawData],
  );

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
    forecastMetadata,
    forecastSource,
    forecastCached,
    sources,
    loading,
    errors,
    refetch,
    refreshForecast,
  };
}
