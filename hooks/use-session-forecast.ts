"use client";

import { useMemo, useCallback } from "react";
import { useDataFetcher } from "./use-data-fetcher";
import { isNightHour } from "@/lib/utils/timezone-utils";
import { formatWaveHeightRangeString } from "@/lib/utils/wave-height-formatter";
import { SET_WAVE_VARIANCE } from "@/lib/utils/wave-height-transformer";
import { extractForecastDate, extractLocalHour } from "@/lib/utils/forecast-at-adapter";

interface SessionForecastData {
  wave_height?: number;
  wave_height_range?: string;
  wind_speed?: number;
  wind_direction?: string;
  water_temp?: number;
  tide_height: number | null;
  tide_status: string | null;
  isNightSession: boolean;
}

interface UseSessionForecastResult {
  forecastData: SessionForecastData | null;
  loading: boolean;
  error: string | null;
}

function parseNumericValue(value: unknown): number | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value !== "string") return undefined;

  // Handles values like "2.2 ft", "10 mph", "56°F", "2-4 ft" (becomes 2), etc.
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : undefined;
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
    const today = new Date().toISOString().split("T")[0];
    const queryOptions =
      forecastDate < today ? { startDate: forecastDate } : undefined;
    const result = await getEnhancedBeachForecasts(beachId, 10, queryOptions);

    if (result.success && result.data) {
      // Filter to the specific date
      const filtered = result.data.filter((f) =>
        f.forecast_at ? extractForecastDate(f.forecast_at) === forecastDate : f.forecast_date === forecastDate
      );

      return filtered;
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
        forecastHour: forecast.forecast_at ? extractLocalHour(forecast.forecast_at) : getForecastHour(forecast.forecast_time),
      }))
      .filter((f) => f.forecastHour !== null)
      .sort((a, b) => {
        const aDiff = Math.abs(a.forecastHour! - sessionHour);
        const bDiff = Math.abs(b.forecastHour! - sessionHour);
        return aDiff - bDiff;
      });

    const bestForecast = sortedForecasts[0];
    if (!bestForecast) return null;

    const parsedWaveHeight = parseNumericValue(bestForecast.wave_height);
    const parsedWindSpeed = parseNumericValue(bestForecast.wind_speed);
    const parsedWaterTemp = parseNumericValue(bestForecast.water_temp);

    // Parse tide_height from string to number (handles values like "2.5 ft")
    const parsedTideHeight = parseNumericValue(bestForecast.tide_height);

    // Determine if this is a night session based on the forecast hour
    const forecastHour = bestForecast.forecastHour ?? 0;
    const isNightSession = isNightHour(Math.floor(forecastHour));

    // Compute wave height range string (e.g., "2-3ft")
    const waveHeightRange =
      parsedWaveHeight !== undefined && parsedWaveHeight > 0
        ? formatWaveHeightRangeString(
            parsedWaveHeight,
            parsedWaveHeight * SET_WAVE_VARIANCE
          )
        : undefined;

    return {
      wave_height: parsedWaveHeight,
      wave_height_range: waveHeightRange,
      wind_speed: parsedWindSpeed,
      wind_direction: bestForecast.wind_direction || undefined,
      water_temp: parsedWaterTemp,
      tide_height: parsedTideHeight ?? null,
      tide_status: bestForecast.tide_status || null,
      isNightSession,
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
