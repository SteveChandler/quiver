/**
 * Tide Diagnostics Generator
 *
 * Utility to generate TideDiagnostics from EnhancedForecastEntity data.
 * This allows the enhanced tide components to work with the forecast data
 * already available in forecast-tab.tsx without additional API calls.
 */

import type { EnhancedForecastEntity } from "@/types/forecast";
import { getLatestUpdatedAt } from "./forecast-client-utils";
import type {
  TideDiagnostics,
  TideExtreme,
  TideRawSample,
  TideDatum,
  TideUnits,
  TideDataFreshness,
  TideVerificationStatus,
} from "@/types/tide-diagnostics";
import {
  getVerificationStatus,
  calculateConfidenceScore,
} from "@/types/tide-diagnostics";

/**
 * Parse height from string like "5.2 ft" or "3.1" or "-0.5 ft"
 */
function parseHeight(value?: string | null): number | null {
  if (!value) return null;
  const match = /-?\d+(?:\.\d+)?/.exec(value);
  return match ? Number.parseFloat(match[0]) : null;
}

/**
 * Parse time from string like "2:30 PM" or "14:30" or ISO string
 */
function parseTime(
  timeStr?: string | null,
  baseDate?: Date
): Date | null {
  if (!timeStr) return null;

  // Try ISO format first
  const isoDate = new Date(timeStr);
  if (!Number.isNaN(isoDate.getTime())) {
    return isoDate;
  }

  // Try "HH:mm" or "H:mm" format
  const time24Match = /^(\d{1,2}):(\d{2})(?::(\d{2}))?$/.exec(timeStr);
  if (time24Match) {
    const base = baseDate || new Date();
    const result = new Date(base);
    result.setHours(
      parseInt(time24Match[1], 10),
      parseInt(time24Match[2], 10),
      time24Match[3] ? parseInt(time24Match[3], 10) : 0,
      0
    );
    return result;
  }

  // Try "H:mm AM/PM" format
  const time12Match = /^(\d{1,2}):(\d{2})\s*(AM|PM)$/i.exec(timeStr);
  if (time12Match) {
    const base = baseDate || new Date();
    const result = new Date(base);
    let hours = parseInt(time12Match[1], 10);
    const minutes = parseInt(time12Match[2], 10);
    const isPM = time12Match[3].toUpperCase() === "PM";

    if (isPM && hours < 12) hours += 12;
    if (!isPM && hours === 12) hours = 0;

    result.setHours(hours, minutes, 0, 0);
    return result;
  }

  return null;
}

/**
 * Find the next high and low tides from forecast data
 */
function findNextExtremes(
  forecasts: EnhancedForecastEntity[],
  now: Date
): { nextHigh: TideExtreme | null; nextLow: TideExtreme | null } {
  let nextHigh: TideExtreme | null = null;
  let nextLow: TideExtreme | null = null;

  for (const forecast of forecasts) {
    // Parse the forecast date/time
    const dateStr = forecast.forecast_date?.includes("T")
      ? forecast.forecast_date.split("T")[0]
      : forecast.forecast_date;
    const baseDate = dateStr ? new Date(dateStr) : now;

    // Check next_tide_time and next_tide_type
    if (forecast.next_tide_time && forecast.next_tide_type) {
      const tideTime = parseTime(forecast.next_tide_time, baseDate);
      const tideHeight = parseHeight(forecast.next_tide_height);

      if (tideTime && tideTime > now && tideHeight !== null) {
        const type = forecast.next_tide_type.toLowerCase();

        if (type.includes("high") && !nextHigh) {
          nextHigh = { time: tideTime, height: tideHeight };
        } else if (type.includes("low") && !nextLow) {
          nextLow = { time: tideTime, height: tideHeight };
        }
      }
    }

    // Also check tide_status for current/upcoming tides
    if (!nextHigh || !nextLow) {
      const currentHeight = parseHeight(forecast.tide_height);
      const forecastTime = parseTime(forecast.forecast_time, baseDate);

      if (forecastTime && forecastTime > now && currentHeight !== null) {
        const status = (forecast.tide_status || "").toLowerCase();

        // If we see "high slack" and don't have nextHigh yet
        if (status.includes("high") && status.includes("slack") && !nextHigh) {
          nextHigh = { time: forecastTime, height: currentHeight };
        }
        // If we see "low slack" and don't have nextLow yet
        if (status.includes("low") && status.includes("slack") && !nextLow) {
          nextLow = { time: forecastTime, height: currentHeight };
        }
      }
    }

    // Stop if we found both
    if (nextHigh && nextLow) break;
  }

  return { nextHigh, nextLow };
}

/**
 * Generate raw sample from forecasts for diagnostics display
 */
function generateRawSample(
  forecasts: EnhancedForecastEntity[],
  maxSamples: number = 5
): TideRawSample[] {
  const samples: TideRawSample[] = [];

  for (const forecast of forecasts.slice(0, maxSamples * 2)) {
    if (forecast.next_tide_time && forecast.next_tide_height && forecast.next_tide_type) {
      const type = forecast.next_tide_type.toLowerCase();
      samples.push({
        t: `${forecast.forecast_date} ${forecast.next_tide_time}`,
        v: forecast.next_tide_height,
        type: type.includes("high") ? "H" : "L",
      });

      if (samples.length >= maxSamples) break;
    }
  }

  return samples;
}

/**
 * Get the latest (most recent) updated_at timestamp from forecasts array as milliseconds.
 *
 * Uses the shared getLatestUpdatedAt utility from forecast-client-utils.
 * Returns 0 if no valid timestamp found.
 */
function getLatestUpdatedAtFromForecasts(
  forecasts: EnhancedForecastEntity[]
): number {
  const latest = getLatestUpdatedAt(forecasts);
  return latest ? new Date(latest).getTime() : 0;
}

/**
 * Determine data freshness based on forecast timestamps
 *
 * Uses the LATEST updated_at across all forecasts, not forecasts[0]
 * which may be an older lookback row.
 */
function getDataFreshness(
  forecasts: EnhancedForecastEntity[]
): TideDataFreshness {
  if (forecasts.length === 0) return "stale";

  // CRITICAL FIX: Use max(updated_at) instead of forecasts[0].updated_at
  const latestUpdatedAt = getLatestUpdatedAtFromForecasts(forecasts);
  if (latestUpdatedAt === 0) return "cached";

  const now = new Date();
  const ageMinutes = (now.getTime() - latestUpdatedAt) / (1000 * 60);

  if (ageMinutes < 30) return "fresh";
  if (ageMinutes < 120) return "cached";
  return "stale";
}

/**
 * Get current tide height from the forecast closest to now
 */
function getCurrentHeight(
  forecasts: EnhancedForecastEntity[],
  now: Date
): number | null {
  let closestForecast: EnhancedForecastEntity | null = null;
  let closestDiff = Infinity;

  for (const forecast of forecasts) {
    const dateStr = forecast.forecast_date?.includes("T")
      ? forecast.forecast_date.split("T")[0]
      : forecast.forecast_date;
    const forecastTime = parseTime(forecast.forecast_time, new Date(dateStr));

    if (forecastTime) {
      const diff = Math.abs(now.getTime() - forecastTime.getTime());
      if (diff < closestDiff) {
        closestDiff = diff;
        closestForecast = forecast;
      }
    }
  }

  return closestForecast ? parseHeight(closestForecast.tide_height) : null;
}

export interface GenerateTideDiagnosticsOptions {
  /** Beach name for display */
  beachName?: string;
  /** Override station ID (default: derived or "unknown") */
  stationId?: string;
  /** Override station name (default: derived from beach name) */
  stationName?: string;
  /** Whether this is the primary station */
  isPrimaryStation?: boolean;
}

/**
 * Generate TideDiagnostics from EnhancedForecastEntity array
 *
 * This creates a complete TideDiagnostics object using the tide data
 * embedded in the forecast entities. Some fields are approximated
 * since we don't have direct NOAA API access here.
 *
 * @param forecasts - Array of EnhancedForecastEntity with tide data
 * @param options - Optional configuration
 * @returns TideDiagnostics object ready for use with enhanced tide components
 */
export function generateTideDiagnosticsFromForecasts(
  forecasts: EnhancedForecastEntity[],
  options: GenerateTideDiagnosticsOptions = {}
): TideDiagnostics {
  const now = new Date();
  const {
    beachName = "Unknown Beach",
    stationId = "derived",
    stationName = beachName,
    isPrimaryStation = true,
  } = options;

  // Find next high and low tides
  const { nextHigh, nextLow } = findNextExtremes(forecasts, now);

  // Calculate minutes to next extremes
  const minutesToNextHigh = nextHigh
    ? Math.round((nextHigh.time.getTime() - now.getTime()) / (1000 * 60))
    : null;
  const minutesToNextLow = nextLow
    ? Math.round((nextLow.time.getTime() - now.getTime()) / (1000 * 60))
    : null;

  // Get current height
  const nowHeight = getCurrentHeight(forecasts, now);

  // Generate raw sample
  const rawSample = generateRawSample(forecasts);

  // Determine data freshness
  const dataFreshness = getDataFreshness(forecasts);

  // Get last fetch time from the LATEST updated_at (not forecasts[0] which may be old)
  const latestUpdatedAtMs = getLatestUpdatedAtFromForecasts(forecasts);
  const lastFetchTime = latestUpdatedAtMs > 0
    ? new Date(latestUpdatedAtMs)
    : now;

  // Count forecasts with tide data
  const forecastsWithTideData = forecasts.filter(
    (f) => f.tide_height || f.next_tide_height
  );

  // Build the diagnostics object
  const partialDiagnostics: Partial<TideDiagnostics> = {
    stationId,
    stationName,
    isPrimaryStation,
    beachName,
    datum: "MLLW" as TideDatum,
    units: "feet" as TideUnits,
    timezone: "Local",
    nowHeightFromSource: nowHeight,
    nowHeightInterpolated: nowHeight,
    interpolationMethod: "linear",
    nextHigh,
    nextLow,
    minutesToNextHigh,
    minutesToNextLow,
    rawSample,
    totalPredictions: forecastsWithTideData.length,
    sourceUrl: "https://tidesandcurrents.noaa.gov/",
    stationPageUrl: "https://tidesandcurrents.noaa.gov/",
    dataFreshness,
    lastFetchTime,
    cacheHit: true,
    cacheTtlRemaining: null,
    isValidated: forecastsWithTideData.length > 0,
    validationErrors: forecastsWithTideData.length === 0
      ? ["No tide data available in forecasts"]
      : [],
  };

  // Calculate verification status and confidence
  const verificationStatus = getVerificationStatus(partialDiagnostics);
  const confidenceScore = calculateConfidenceScore(partialDiagnostics);

  return {
    ...partialDiagnostics,
    verificationStatus,
    confidenceScore,
  } as TideDiagnostics;
}

export default generateTideDiagnosticsFromForecasts;
