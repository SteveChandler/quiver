import { useCallback } from "react";
import {
  useCachedBeachData,
  useCachedForecastData,
} from "@/hooks/use-cached-api";
import { useDataFetcher } from "@/hooks/use-data-fetcher";
import { getBeachById } from "@/actions/beach-actions";
import { getBeachForecasts } from "@/actions/forecast-actions";
import { getSessionsByBeach } from "@/actions/session-actions";
import type { Beach, Forecast, SessionWithDetails } from "@/types/database";

interface EnhancedBeachData {
  beach: Beach | null;
  forecasts: Forecast[];
  sessions: SessionWithDetails[];
}

interface UseEnhancedBeachDataOptions {
  includeSessions?: boolean;
  immediate?: boolean;
}

export function useEnhancedBeachData(
  beachId: string,
  options: UseEnhancedBeachDataOptions = {}
) {
  const { includeSessions = true, immediate = true } = options;

  // Fetch beach data with caching
  const fetchBeachData = useCallback(async () => {
    const result = await getBeachById(beachId);
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch beach data");
  }, [beachId]);

  // Fetch forecasts with caching
  const fetchForecasts = useCallback(async () => {
    const result = await getBeachForecasts(beachId);
    if (result.success && result.data) {
      return result.data;
    }
    throw new Error(result.error || "Failed to fetch forecasts");
  }, [beachId]);

  // Fetch sessions (no caching for now as they change frequently)
  const fetchSessions = useCallback(async () => {
    if (!includeSessions) return [];
    const result = await getSessionsByBeach(beachId);
    return result.success ? result.data || [] : [];
  }, [beachId, includeSessions]);

  // Use cached API for beach data (changes rarely)
  const {
    data: beach,
    loading: beachLoading,
    error: beachError,
    refetch: refetchBeach,
  } = useCachedBeachData<Beach>(fetchBeachData, beachId, { immediate });

  // Use cached API for forecasts (changes every ~15 minutes)
  const {
    data: forecasts,
    loading: forecastsLoading,
    error: forecastsError,
    refetch: refetchForecasts,
  } = useCachedForecastData<Forecast[]>(fetchForecasts, beachId, undefined, {
    immediate,
  });

  // Use regular data fetcher for sessions (change frequently, no caching needed)
  const {
    data: sessions,
    loading: sessionsLoading,
    error: sessionsError,
    refetch: refetchSessions,
  } = useDataFetcher(fetchSessions, { immediate });

  // Computed values
  const todaysForecasts =
    forecasts?.filter(
      (f) => f.forecast_date === new Date().toISOString().split("T")[0]
    ) || [];

  const forecastDates = [
    ...new Set(forecasts?.map((f) => f.forecast_date) || []),
  ].sort();

  const isLoading =
    beachLoading || forecastsLoading || (includeSessions && sessionsLoading);
  const hasError =
    beachError || forecastsError || (includeSessions && sessionsError);

  const refetchAll = useCallback(async () => {
    const promises = [refetchBeach(), refetchForecasts()];
    if (includeSessions) {
      promises.push(refetchSessions());
    }
    await Promise.all(promises);
  }, [refetchBeach, refetchForecasts, refetchSessions, includeSessions]);

  return {
    // Core data
    beach,
    forecasts: forecasts || [],
    sessions: sessions || [],

    // Computed data
    todaysForecasts,
    forecastDates,

    // Combined state
    data: {
      beach,
      forecasts: forecasts || [],
      sessions: sessions || [],
    } as EnhancedBeachData,

    // Loading states
    loading: isLoading,
    beachLoading,
    forecastsLoading,
    sessionsLoading,

    // Error states
    error: hasError,
    beachError,
    forecastsError,
    sessionsError,

    // Actions
    refetch: refetchAll,
    refetchBeach,
    refetchForecasts,
    refetchSessions,

    // Convenience getters
    hasBeach: Boolean(beach),
    hasForecasts: Boolean(forecasts && forecasts.length > 0),
    hasSessions: Boolean(sessions && sessions.length > 0),
    hasTodaysForecasts: Boolean(todaysForecasts.length > 0),
  };
}

// Helper function to get forecast for specific date
export function useForecastForDate(
  beachId: string,
  date: string,
  options: UseEnhancedBeachDataOptions = {}
) {
  const { forecasts, ...rest } = useEnhancedBeachData(beachId, {
    ...options,
    includeSessions: false, // Don't need sessions for just forecast
  });

  const dateForecasts = forecasts.filter((f) => f.forecast_date === date);

  return {
    ...rest,
    forecasts: dateForecasts,
    hasForecasts: dateForecasts.length > 0,
  };
}
