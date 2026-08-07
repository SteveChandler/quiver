/**
 * Wind Analysis Module
 * Extracted from morning-intel-utils.ts as part of Phase 7.2.3 refactoring
 *
 * Provides utilities for analyzing wind conditions:
 * - Wind metrics calculation
 * - Offshore/onshore determination
 * - Wind direction conversion
 * - Wind condition evaluation
 */

import { format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import type {
  WindMetrics,
  BeachPreferences,
  ConditionEvaluation,
} from "@/types/morning-intel";
import { formatWindSpeed } from "@/lib/formatters/surf-data";
import { normalizeAngle } from "@/lib/domains/shared/angle-utils";

export { normalizeAngle };

// Ocean Beach, San Diego faces approximately WSW (260-270°)
const OB_SHORE_NORMAL = 270; // degrees

/**
 * Convert degrees to cardinal direction
 */
function degreesToCardinal(degrees: number): string {
  const normalized = normalizeAngle(degrees);
  const directions = [
    "N", "NNE", "NE", "ENE",
    "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW",
    "W", "WNW", "NW", "NNW"
  ];
  const index = Math.round(normalized / 22.5) % 16;
  return directions[index];
}

/**
 * Calculate if wind is offshore relative to beach orientation
 * Wind is considered offshore if it's within ±45° of the beach normal
 */
export function calculateOnOffshore(windDir: number, beachNormal: number): boolean {
  const angleDiff = Math.abs(normalizeAngle(windDir - beachNormal));
  // Offshore is within 45° on either side (0-45° or 315-360°)
  return angleDiff <= 45 || angleDiff >= 315;
}

/**
 * Get wind metrics at a specific time
 */
export function windAt(
  targetTime: string,
  forecasts: Array<{
    forecast_at?: string;
    forecast_date: string;
    forecast_time: string;
    wind_speed?: number | null;
    wind_direction?: number | null;
  }>,
  timezone: string
): WindMetrics {
  if (forecasts.length === 0) {
    return {
      speed: 0,
      direction: 0,
      cardinal: "N/A",
      offshore: false,
      description: "N/A",
    };
  }

  // Find forecast closest to target time
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const targetDateStr = `${todayStr}T${targetTime}:00`;
  const targetDate = fromZonedTime(new Date(targetDateStr), timezone);

  let closestForecast = forecasts[0];
  // Prefer forecast_at, fallback to legacy forecast_date + forecast_time
  const firstForecastDate = forecasts[0].forecast_at
    ? new Date(forecasts[0].forecast_at)
    : new Date(`${forecasts[0].forecast_date}T${forecasts[0].forecast_time}Z`);
  let minDiff = Math.abs(firstForecastDate.getTime() - targetDate.getTime());

  for (const forecast of forecasts) {
    // Prefer forecast_at, fallback to legacy forecast_date + forecast_time
    const forecastDate = forecast.forecast_at
      ? new Date(forecast.forecast_at)
      : new Date(`${forecast.forecast_date}T${forecast.forecast_time}Z`);
    const diff = Math.abs(forecastDate.getTime() - targetDate.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closestForecast = forecast;
    }
  }

  const windSpeed = closestForecast.wind_speed || 0;
  const windDir = closestForecast.wind_direction || 0;
  const offshore = calculateOnOffshore(windDir, OB_SHORE_NORMAL);

  let description = "N/A";
  if (windSpeed === 0) {
    description = "calm";
  } else if (offshore) {
    description = windSpeed < 5 ? "light offshore" : "offshore";
  } else {
    const angleDiff = Math.abs(normalizeAngle(windDir - OB_SHORE_NORMAL));
    if (angleDiff > 135) {
      // Onshore
      description = windSpeed < 8 ? "light onshore" : "onshore";
    } else {
      // Cross-shore
      description = "cross-shore";
    }
  }

  return {
    speed: Math.round(windSpeed),
    direction: Math.round(windDir),
    cardinal: degreesToCardinal(windDir),
    offshore,
    description,
  };
}

/**
 * Analyze wind conditions relative to beach preferences
 */
export function analyzeWindConditions(
  wind: WindMetrics,
  beach: BeachPreferences
): ConditionEvaluation {
  // If no wind offshore preference defined, evaluate based on general conditions
  if (!beach.windOffshoreDeg) {
    if (wind.speed < 5) {
      return {
        status: "optimal",
        emoji: "✅",
        message: `Light winds (${formatWindSpeed(wind.speed)} ${wind.cardinal})`,
      };
    } else if (wind.speed < 10) {
      return {
        status: "acceptable",
        emoji: "⚠️",
        message: `Moderate winds (${formatWindSpeed(wind.speed)} ${wind.cardinal})`,
      };
    } else {
      return {
        status: "poor",
        emoji: "❌",
        message: `Strong winds (${formatWindSpeed(wind.speed)} ${wind.cardinal})`,
      };
    }
  }

  // Calculate if wind is offshore
  const tolerance = beach.windOffshoreTol || 45;
  const angleDiff = Math.abs(normalizeAngle(wind.direction - beach.windOffshoreDeg));
  const isOffshore = angleDiff <= tolerance || angleDiff >= (360 - tolerance);

  if (isOffshore && wind.speed < 8) {
    return {
      status: "optimal",
      emoji: "✅",
      message: `${wind.description} (${formatWindSpeed(wind.speed)} ${wind.cardinal})`,
    };
  } else if (isOffshore || wind.speed < 8) {
    return {
      status: "acceptable",
      emoji: "⚠️",
      message: `${wind.description} (${formatWindSpeed(wind.speed)} ${wind.cardinal})`,
    };
  } else {
    return {
      status: "poor",
      emoji: "❌",
      message: `${wind.description} (${formatWindSpeed(wind.speed)} ${wind.cardinal})`,
    };
  }
}
