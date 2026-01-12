/**
 * Tide Analyzer Module
 * 
 * Handles all tide-related analysis and calculations:
 * - Tide height interpolation at specific times
 * - Tide direction determination (rising/falling/slack)
 * - Tide window recommendations based on beach preferences
 * - Next tide event prediction (high/low)
 * 
 * Extracted from lib/utils/morning-intel-utils.ts as part of P1 refactoring
 * to reduce complexity and improve maintainability.
 */

import { format } from "date-fns";
import { fromZonedTime } from "date-fns-tz";
import type {
  TideMetrics,
  ForecastSlice,
  BeachPreferences,
} from "@/types/morning-intel";

const METERS_TO_FEET = 3.28084;

/**
 * Type for tide direction
 */
export type TideDirection = "rising" | "falling" | "slack";

/**
 * Normalize tide status string to a valid TideDirection
 * 
 * @param status - Raw tide status string from API
 * @returns Normalized tide direction
 * @private
 */
function normalizeTideDirection(status: string | null | undefined): TideDirection {
  if (!status) return "slack";
  const normalized = status.toLowerCase().trim();
  if (normalized === "rising" || normalized === "falling") {
    return normalized as TideDirection;
  }
  return "slack";
}

/**
 * Recommend best tide window based on beach preferences and forecast data
 * 
 * Analyzes morning forecasts (6am-10am) to find optimal tide conditions
 * based on beach-specific tide preferences.
 * 
 * @param forecasts - Array of forecast data points
 * @param beachPrefs - Beach-specific preferences including tide range
 * @returns Tide metrics with recommended time and optimal range
 * 
 * @example
 * ```typescript
 * const tideWindow = recommendTideWindow(forecasts, {
 *   tideMinFt: 2,
 *   tideMaxFt: 5
 * });
 * // Returns: { height: 3.5, direction: 'rising', recommendedTime: '08:00' }
 * ```
 */
export function recommendTideWindow(
  forecasts: ForecastSlice["forecasts"],
  beachPrefs: BeachPreferences | null
): TideMetrics & { recommendedTime?: string; optimalRange?: string | null } {
  if (!forecasts || forecasts.length === 0) {
    return { height: 0, direction: "slack", nextEvent: null };
  }

  // Get morning forecasts (6am-10am) with tide data
  const morningForecasts = forecasts.filter((f) => {
    const hour = parseInt(f.forecast_time.split(":")[0]);
    return hour >= 6 && hour <= 10 && f.tide_height !== null;
  });

  if (morningForecasts.length === 0) {
    // Fallback to first forecast with tide data
    const forecastWithTide = forecasts.find((f) => f.tide_height !== null);
    return {
      height: forecastWithTide?.tide_height || 0,
      direction: normalizeTideDirection(forecastWithTide?.tide_status),
      nextEvent: null, // Next tide event would need to be calculated from tides array
    };
  }

  // Find best tide based on beach preferences
  let bestForecast = morningForecasts[0];

  if (beachPrefs && beachPrefs.tideMinFt !== null && beachPrefs.tideMaxFt !== null) {
    // Score each forecast based on how close it is to optimal tide range
    const scoredForecasts = morningForecasts.map((f) => {
      const tideHeight = f.tide_height || 0;
      const midTide = (beachPrefs.tideMinFt! + beachPrefs.tideMaxFt!) / 2;
      const distance = Math.abs(tideHeight - midTide);
      const isInRange =
        tideHeight >= beachPrefs.tideMinFt! && tideHeight <= beachPrefs.tideMaxFt!;
      return {
        forecast: f,
        score: isInRange ? 100 - distance : -distance,
      };
    });

    // Get forecast with best score
    scoredForecasts.sort((a, b) => b.score - a.score);
    bestForecast = scoredForecasts[0].forecast;
  }

  return {
    height: bestForecast.tide_height || 0,
    direction: normalizeTideDirection(bestForecast.tide_status),
    nextEvent: null, // Next tide event would need to be calculated from tides array
    recommendedTime: bestForecast.forecast_time,
    optimalRange:
      beachPrefs && beachPrefs.tideMinFt !== null && beachPrefs.tideMaxFt !== null
        ? `${beachPrefs.tideMinFt}-${beachPrefs.tideMaxFt} ft`
        : null,
  };
}

/**
 * Get tide metrics at a specific time
 * 
 * Interpolates tide height between known tide events and determines
 * tide direction and next tide event.
 * 
 * @param targetTime - Time in HH:mm format (e.g., "08:00")
 * @param tides - Array of tide data points
 * @param timezone - IANA timezone string (e.g., "America/Los_Angeles")
 * @returns Tide metrics including height, direction, and next event
 * 
 * @example
 * ```typescript
 * const tide = tideAt("08:00", tideData, "America/Los_Angeles");
 * // Returns: { height: 3.2, direction: 'rising', nextEvent: { type: 'HIGH', height: 5.1, time: '10:30' } }
 * ```
 */
export function tideAt(
  targetTime: string,
  tides: ForecastSlice["tides"],
  timezone: string
): TideMetrics {
  if (tides.length === 0) {
    return { height: 0, direction: "slack", nextEvent: null };
  }

  // Convert target time to timestamp for comparison
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const targetDateStr = `${todayStr}T${targetTime}:00`;
  const targetDate = fromZonedTime(new Date(targetDateStr), timezone);
  const targetTs = targetDate.getTime();

  // Find the two tide entries that bracket the target time
  let beforeTide = tides[0];
  let afterTide = tides[tides.length - 1];

  for (let i = 0; i < tides.length - 1; i++) {
    const currentTs = new Date(tides[i].ts).getTime();
    const nextTs = new Date(tides[i + 1].ts).getTime();

    if (currentTs <= targetTs && targetTs <= nextTs) {
      beforeTide = tides[i];
      afterTide = tides[i + 1];
      break;
    }
  }

  // Interpolate tide height
  const beforeTs = new Date(beforeTide.ts).getTime();
  const afterTs = new Date(afterTide.ts).getTime();
  const ratio = (targetTs - beforeTs) / (afterTs - beforeTs);
  const heightM = beforeTide.tide_height_m + ratio * (afterTide.tide_height_m - beforeTide.tide_height_m);
  const heightFt = heightM * METERS_TO_FEET;

  // Determine tide direction
  let direction: "rising" | "falling" | "slack" = "slack";
  if (afterTide.tide_height_m > beforeTide.tide_height_m + 0.1) {
    direction = "rising";
  } else if (afterTide.tide_height_m < beforeTide.tide_height_m - 0.1) {
    direction = "falling";
  }

  // Find next tide event (high or low)
  let nextEvent: TideMetrics["nextEvent"] = null;
  for (let i = 0; i < tides.length - 1; i++) {
    const currentTs = new Date(tides[i].ts).getTime();
    if (currentTs > targetTs && tides[i].tide_phase) {
      const phase = tides[i].tide_phase?.toUpperCase();
      if (phase === "HIGH" || phase === "LOW") {
        nextEvent = {
          type: phase as "HIGH" | "LOW",
          height: tides[i].tide_height_m * METERS_TO_FEET,
          time: format(new Date(tides[i].ts), "HH:mm"),
        };
        break;
      }
    }
  }

  return {
    height: heightFt,
    direction,
    nextEvent,
  };
}






