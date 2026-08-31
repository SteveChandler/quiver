import { useCallback, useEffect, useRef, useState } from "react";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { useOptionalAuth } from "@/context/auth-context";
import { forecastCache, RequestCache } from "@/lib/utils/request-cache";
import { getLocalDateString, resolveBeachTimezone } from "@/lib/utils/timezone-utils";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface ForecastData {
  forecasts: EnhancedForecastEntity[];
  forecastsByDate: Record<string, EnhancedForecastEntity[]>;
  servedFromCache: boolean;
  isStale: boolean;
  cacheAgeMs?: number;
}

interface UseEnhancedForecastOptions {
  beachId?: string;
  defaultDays?: number;
  immediate?: boolean;
  autoGenerate?: boolean;
  beachTimezone?: string | null;
}

interface UseEnhancedForecastReturn {
  data: ForecastData | null;
  forecasts: EnhancedForecastEntity[];
  forecastsByDate: Record<string, EnhancedForecastEntity[]>;
  availableDates: string[];
  selectedDate: string;
  selectedDateForecasts: EnhancedForecastEntity[];
  loading: boolean;
  error: string | null;
  updating: boolean;
  autoGenerating: boolean;
  isOfflineData: boolean;
  isStale: boolean;
  cacheAgeMs?: number;
  setSelectedDate: (date: string) => void;
  refetch: () => Promise<ForecastData | undefined>;
  invalidateCache: () => void;
  handleRefresh: () => Promise<void>;
}

export function useEnhancedForecast({
  beachId,
  defaultDays = 12,
  immediate = true,
  autoGenerate = true,
  beachTimezone,
}: UseEnhancedForecastOptions): UseEnhancedForecastReturn {
  const identity = useOptionalAuth()?.user?.id ?? "anon";
  const previousIdentityRef = useRef(identity);
  const [updating, setUpdating] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [hasTriedAutoGeneration, setHasTriedAutoGeneration] = useState(false);

  useEffect(() => {
    if (previousIdentityRef.current === identity) return;
    forecastCache.clear();
    previousIdentityRef.current = identity;
  }, [identity]);

  // Memoized fetch function to prevent recreating on every render
  const fetchForecasts = useCallback(async (): Promise<ForecastData> => {
    if (!beachId) {
      throw new Error("Beach ID is required");
    }

    const response = await fetch(
      `/api/forecasts/update-enhanced?beachId=${beachId}&days=${defaultDays}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      throw new Error("Failed to fetch enhanced forecasts");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch forecasts");
    }

    const cacheSource = response.headers.get("x-quiver-cache-source");
    const staleHeader = response.headers.get("x-quiver-cache-stale");
    const ageHeader = response.headers.get("x-quiver-cache-age");
    const timestampHeader = response.headers.get("x-quiver-cache-timestamp");
    const cacheAgeMs = ageHeader
      ? Number(ageHeader)
      : timestampHeader
      ? Date.now() - Number(timestampHeader)
      : undefined;

    return {
      forecasts: data.data?.forecasts || [],
      forecastsByDate: data.data?.forecastsByDate || {},
      servedFromCache: cacheSource === "offline",
      isStale: staleHeader === "true",
      cacheAgeMs: Number.isFinite(cacheAgeMs) ? cacheAgeMs : undefined,
    };
  }, [beachId, defaultDays]);

  // Memoized function to generate forecasts for a beach
  const generateForecasts = useCallback(async (): Promise<ForecastData> => {
    if (!beachId) {
      throw new Error("Beach ID is required");
    }

    const response = await fetch("/api/forecasts/update-enhanced", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ beachId }),
    });

    if (!response.ok) {
      throw new Error("Failed to generate enhanced forecasts");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to generate forecasts");
    }

    // After generation, fetch the new forecasts
    return await fetchForecasts();
  }, [beachId, fetchForecasts]);

  const cacheKey = RequestCache.createKey(
    "enhanced-forecasts",
    identity,
    beachId,
    defaultDays,
  );

  const {
    data: forecastData,
    loading,
    error,
    refetch,
    invalidateCache,
  } = useDataFetcher(fetchForecasts, {
    cacheKey,
    cache: forecastCache,
    immediate: immediate && Boolean(beachId),
    skip: !beachId,
  });

  // Auto-generate forecasts when no data exists
  useEffect(() => {
    if (
      autoGenerate &&
      beachId &&
      !loading &&
      !error &&
      !hasTriedAutoGeneration &&
      forecastData &&
      forecastData.forecasts.length === 0
    ) {
      setHasTriedAutoGeneration(true);
      setAutoGenerating(true);

      generateForecasts()
        .then(() => {
          // Invalidate cache and refetch to get new data
          invalidateCache();
          return refetch();
        })
        .catch((err) => {
          console.error("Auto-generation failed:", err);
          // Don't set error state for auto-generation failures
          // Let user manually trigger if needed
        })
        .finally(() => {
          setAutoGenerating(false);
        });
    }
  }, [
    autoGenerate,
    beachId,
    loading,
    error,
    hasTriedAutoGeneration,
    forecastData,
    generateForecasts,
    invalidateCache,
    refetch,
  ]);

  // Reset auto-generation flag when beach changes
  useEffect(() => {
    setHasTriedAutoGeneration(false);
    setAutoGenerating(false);
  }, [beachId]);

  // Extract data with defaults
  const forecasts = forecastData?.forecasts || [];
  const forecastsByDate = forecastData?.forecastsByDate || {};
  const availableDates = Object.keys(forecastsByDate).sort();
  const selectedDateForecasts = selectedDate
    ? forecastsByDate[selectedDate] || []
    : [];
  const isOfflineData = Boolean(forecastData?.servedFromCache);
  const isStale = Boolean(forecastData?.isStale);
  const cacheAgeMs = forecastData?.cacheAgeMs;

  // Set default selected date when data loads
  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(getLocalDateString(new Date(), resolveBeachTimezone(beachTimezone)));
    }
  }, [availableDates, selectedDate, beachTimezone]);

  // Simplified refresh handler - just refetch, let cache TTL handle staleness
  const handleRefresh = useCallback(async () => {
    setUpdating(true);
    try {
      await refetch();
    } catch (err) {
      console.error("Error refreshing forecasts:", err);
    } finally {
      setUpdating(false);
    }
  }, [refetch]);

  return {
    data: forecastData,
    forecasts,
    forecastsByDate,
    availableDates,
    selectedDate,
    selectedDateForecasts,
    loading,
    error,
    updating,
    autoGenerating,
    isOfflineData,
    isStale,
    cacheAgeMs,
    setSelectedDate,
    refetch,
    invalidateCache,
    handleRefresh,
  };
}
