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
  setSelectedDate: (date: string) => void;
  refetch: () => Promise<void>;
  invalidateCache: () => void;
  handleRefresh: () => Promise<void>;
}

export function useEnhancedForecast({
  beachId,
  defaultDays = 12,
  immediate = true,
}: UseEnhancedForecastOptions): UseEnhancedForecastReturn {
  const [updating, setUpdating] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string>("");

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
    setSelectedDate,
    refetch,
    invalidateCache,
    handleRefresh,
  };
}
