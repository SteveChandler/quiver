"use client";

import { useMemo, useCallback } from "react";
import { useDataFetcher } from "./use-data-fetcher";

interface SessionForecastData {
  wave_height?: number;
  wind_speed?: number;
  wind_direction?: string;
  water_temp?: number;
}

interface UseSessionForecastResult {
  forecastData: SessionForecastData | null;
  loading: boolean;
  error: string | null;
}

/**
 * Hook to get forecast data for a specific session date/time/beach
 * Used in Session Conditions to show forecast vs actual comparison
 */
export function useSessionForecast(
  beachId: string | null,
  sessionDate: string | null,
  sessionTime: string | null
): UseSessionForecastResult {
  // Convert session date to forecast date format (YYYY-MM-DD)
  const forecastDate = useMemo(() => {
    if (!sessionDate) return null;

    try {
      // Handle different date formats
      const date = new Date(sessionDate);
      if (isNaN(date.getTime())) return null;

      return date.toISOString().split("T")[0];
    } catch {
      return null;
    }
  }, [sessionDate]);

  // Fetch enhanced forecasts for the session date
  const fetchEnhancedForecasts = useCallback(async () => {
    if (!beachId || !forecastDate) return [];

    const { getEnhancedBeachForecasts } = await import(
      "@/actions/forecast-actions"
    );
    const result = await getEnhancedBeachForecasts(beachId, 10);

    if (result.success && result.data) {
      // Filter to the specific date
      return result.data.filter((f) => f.forecast_date === forecastDate);
    }

    throw new Error(result.error || "Failed to fetch enhanced forecasts");
  }, [beachId, forecastDate]);

  const {
    data: forecasts,
    loading,
    error,
  } = useDataFetcher(fetchEnhancedForecasts, {
    immediate: Boolean(beachId && forecastDate),
  });

  // Find the best forecast for the session time
  const forecastData = useMemo((): SessionForecastData | null => {
    if (!forecasts || forecasts.length === 0 || !sessionTime) {
      return null;
    }

    // Convert session time to 24-hour format for comparison
    const sessionHour = getSessionHour(sessionTime);
    if (sessionHour === null) return null;

    // Find the forecast closest to the session time
    const sortedForecasts = forecasts
      .map((forecast) => ({
        ...forecast,
        forecastHour: getForecastHour(forecast.forecast_time),
      }))
      .filter((f) => f.forecastHour !== null)
      .sort((a, b) => {
        const aDiff = Math.abs(a.forecastHour! - sessionHour);
        const bDiff = Math.abs(b.forecastHour! - sessionHour);
        return aDiff - bDiff;
      });

    const bestForecast = sortedForecasts[0];
    if (!bestForecast) return null;

    return {
      wave_height: bestForecast.wave_height || undefined,
      wind_speed: bestForecast.wind_speed || undefined,
      wind_direction: bestForecast.wind_direction || undefined,
      water_temp: bestForecast.water_temp || undefined,
    };
  }, [forecasts, sessionTime]);

  // Check if the session date is in the past
  const isHistoricalDate = useMemo(() => {
    if (!forecastDate) return false;
    const today = new Date().toISOString().split("T")[0];
    return forecastDate < today;
  }, [forecastDate]);

  return {
    forecastData,
    loading: Boolean(beachId && forecastDate) && loading,
    error:
      error ||
      (beachId && forecastDate && !loading && !forecasts?.length
        ? isHistoricalDate
          ? "No historical forecast data available"
          : "No forecasts found for this date"
        : null),
  };
}

/**
 * Convert session time (like "06:30 AM") to 24-hour format number
 */
function getSessionHour(timeString: string): number | null {
  try {
    // Handle formats like "06:30 AM", "6:30 AM", "18:30", etc.
    const cleanTime = timeString.trim().toUpperCase();

    if (cleanTime.includes("AM") || cleanTime.includes("PM")) {
      // 12-hour format
      const [timePart, period] = cleanTime.split(/\s+(AM|PM)/);
      const [hours, minutes] = timePart.split(":").map(Number);

      let hour24 = hours;
      if (period === "PM" && hours !== 12) hour24 += 12;
      if (period === "AM" && hours === 12) hour24 = 0;

      return hour24 + (minutes || 0) / 60;
    } else {
      // 24-hour format
      const [hours, minutes] = timeString.split(":").map(Number);
      return hours + (minutes || 0) / 60;
    }
  } catch {
    return null;
  }
}

/**
 * Convert forecast time (like "06:00") to number for comparison
 */
function getForecastHour(timeString: string): number | null {
  try {
    const [hours, minutes] = timeString.split(":").map(Number);
    return hours + (minutes || 0) / 60;
  } catch {
    return null;
  }
}
