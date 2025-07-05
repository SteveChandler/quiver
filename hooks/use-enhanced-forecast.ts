import { useCallback, useEffect, useState } from "react";
import { useCachedApi } from "@/hooks/use-cached-api";
import { forecastCache, RequestCache } from "@/lib/utils/request-cache";
import { getTodayDateString } from "@/lib/utils/forecast-ui-utils";
import type { EnhancedForecastEntity } from "@/types/forecast";

interface ForecastData {
  forecasts: EnhancedForecastEntity[];
  forecastsByDate: Record<string, EnhancedForecastEntity[]>;
}

interface UseEnhancedForecastOptions {
  beachId?: string;
  defaultDays?: number;
  immediate?: boolean;
  autoGenerate?: boolean;
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
  setSelectedDate: (date: string) => void;
  refetch: () => Promise<void>;
  invalidateCache: () => void;
  handleRefresh: () => Promise<void>;
}

export function useEnhancedForecast({
  beachId,
  defaultDays = 12,
  immediate = true,
  autoGenerate = true,
}: UseEnhancedForecastOptions): UseEnhancedForecastReturn {
  const [updating, setUpdating] = useState(false);
  const [autoGenerating, setAutoGenerating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [hasTriedAutoGeneration, setHasTriedAutoGeneration] = useState(false);

  // Memoized fetch function to prevent recreating on every render
  const fetchForecasts = useCallback(async (): Promise<ForecastData> => {
    if (!beachId) {
      throw new Error("Beach ID is required");
    }

    const response = await fetch(
      `/api/forecasts/update-enhanced?beachId=${beachId}&days=${defaultDays}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch enhanced forecasts");
    }

    const data = await response.json();

    if (!data.success) {
      throw new Error(data.error || "Failed to fetch forecasts");
    }

    return {
      forecasts: data.data?.forecasts || [],
      forecastsByDate: data.data?.forecastsByDate || {},
    };
  }, [beachId, defaultDays]);

  // Memoized function to generate forecasts for a beach
  const generateForecasts = useCallback(async (): Promise<ForecastData> => {
    if (!beachId) {
      throw new Error("Beach ID is required");
    }

    console.log(`Auto-generating forecasts for beach ${beachId}`);

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

  // Create stable cache key
  const cacheKey = RequestCache.createKey(
    "enhanced-forecasts",
    beachId,
    defaultDays
  );

  // Use cached API hook with memoized fetch function
  const {
    data: forecastData,
    loading,
    error,
    refetch,
    invalidateCache,
  } = useCachedApi(fetchForecasts, cacheKey, {
    cache: forecastCache,
    immediate: immediate && Boolean(beachId),
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

  // Set default selected date when data loads
  useEffect(() => {
    if (availableDates.length > 0 && !selectedDate) {
      setSelectedDate(getTodayDateString());
    }
  }, [availableDates, selectedDate]);

  // Memoized refresh handler
  const handleRefresh = useCallback(async () => {
    setUpdating(true);
    try {
      await invalidateCache();
      await refetch();
    } catch (err) {
      console.error("Error refreshing forecasts:", err);
    } finally {
      setUpdating(false);
    }
  }, [invalidateCache, refetch]);

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
    setSelectedDate,
    refetch,
    invalidateCache,
    handleRefresh,
  };
}
