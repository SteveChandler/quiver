/**
 * Session Window Scorer Module
 *
 * Handles scoring and selection of optimal surf session windows.
 * Decomposed from findNextBestWindow (complexity 68) into focused functions.
 *
 * Also includes:
 * - bestWindowHeuristic: Morning-specific window calculation
 * - confidenceHeuristic: Data completeness scoring
 *
 * @deprecated The `bestWindowHeuristic` function is deprecated in favor of
 * `calculateOptimalWindow` from `@/lib/scoring` which uses linear interpolation
 * for precise window boundaries instead of arbitrary hour ranges.
 *
 * Migration guide:
 * - bestWindowHeuristic() → calculateOptimalWindow() from @/lib/scoring
 * - findNextBestWindow() → calculateOptimalWindow() from @/lib/scoring
 *
 * Extracted from lib/utils/morning-intel-utils.ts as part of P1 refactoring
 * to reduce cyclomatic complexity and improve maintainability.
 */

import { calculateOnOffshore, windAt } from "@/lib/analyzers/wind-analyzer";
import { tideAt } from "@/lib/analyzers/tide-analyzer";
import type { ForecastSlice } from "@/types/morning-intel";

// Re-export unified scoring window calculator for forward compatibility
export { calculateOptimalWindow, formatTimeRange } from "@/lib/scoring";
export type { OptimalWindow, WindowCalculatorOptions } from "@/lib/scoring";

// Constants for window scoring
const OFFSHORE_STRONG_SCORE = 40;
const OFFSHORE_MODERATE_SCORE = 30;
const LIGHT_WIND_SCORE = 20;
const MODERATE_WIND_SCORE = 10;

const PERIOD_EXCELLENT_SCORE = 30;
const PERIOD_GOOD_SCORE = 20;
const PERIOD_FAIR_SCORE = 10;

const TIDE_OPTIMAL_SCORE = 20;
const TIDE_ACCEPTABLE_SCORE = 10;

const MORNING_BONUS = 10;
const AFTERNOON_BONUS = 5;

const MINIMUM_QUALITY_SCORE = 20;
const QUALITY_THRESHOLD = 0.75; // 75% of best score
const MAX_WINDOW_HOURS = 4;
const LATE_CUTOFF_HOUR = 20; // 8 PM

/**
 * Forecast with scoring data
 */
interface ScoredForecast {
  forecast: ForecastData;
  score: number;
}

interface LocalTimeParts {
  hour: number;
  minute: number;
  label: string;
}

/**
 * Minimal forecast data required for scoring
 */
export interface ForecastData {
  forecast_at?: string;
  forecast_time: string;
  forecast_date: string;
  wind_speed: number | null;
  wind_direction: number | null;
  wave_period: number | null;
  swell_1_period: number | null;
  tide_height: number | null;
}

function padTimePart(value: number): string {
  return value.toString().padStart(2, "0");
}

function localTimeFromForecast(
  forecast: Pick<ForecastData, "forecast_at" | "forecast_time">,
  timezone: string
): LocalTimeParts | null {
  if (forecast.forecast_at) {
    const forecastDate = new Date(forecast.forecast_at);
    if (!Number.isNaN(forecastDate.getTime())) {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: timezone,
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
      }).formatToParts(forecastDate);
      const hour = Number(parts.find((part) => part.type === "hour")?.value);
      const minute = Number(parts.find((part) => part.type === "minute")?.value);

      if (Number.isFinite(hour) && Number.isFinite(minute)) {
        return {
          hour,
          minute,
          label: `${padTimePart(hour)}:${padTimePart(minute)}`,
        };
      }
    }
  }

  const [hourRaw, minuteRaw = "0"] = forecast.forecast_time.split(":");
  const hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) {
    return null;
  }

  return {
    hour,
    minute,
    label: `${padTimePart(hour)}:${padTimePart(minute)}`,
  };
}

/**
 * Result of window finding
 */
export interface SessionWindow {
  startTime: string | null;
  endTime: string | null;
  description: string;
  conditions: string;
}

/**
 * Score an individual forecast based on wind, period, tide, and time of day
 * 
 * Scoring breakdown:
 * - Wind (max 40): Offshore + light is best
 * - Period (max 30): Longer periods score higher
 * - Tide (max 20): Mid-tide (2-5ft) is optimal
 * - Time (max 10): Early morning and late afternoon bonus
 * 
 * @param forecast - Forecast data point
 * @param beachAspect - Beach aspect in degrees (e.g., 270 for WSW)
 * @returns Score from 0-100
 * 
 * @example
 * ```typescript
 * const score = scoreForecast({
 *   wind_speed: 5,
 *   wind_direction: 90,
 *   wave_period: 12,
 *   tide_height: 3.5,
 *   forecast_time: '08:00'
 * }, 270);
 * // Returns: ~90 (offshore, light wind, long period, mid-tide, morning)
 * ```
 */
function scoreForecast(forecast: ForecastData, beachAspect: number): number {
  let score = 0;
  
  // Wind scoring (most important factor)
  const windSpeed = forecast.wind_speed || 999;
  const windDir = forecast.wind_direction || 0;
  const isOffshore = calculateOnOffshore(windDir, beachAspect);
  
  if (isOffshore && windSpeed < 5) score += OFFSHORE_STRONG_SCORE;
  else if (isOffshore && windSpeed < 10) score += OFFSHORE_MODERATE_SCORE;
  else if (windSpeed < 5) score += LIGHT_WIND_SCORE;
  else if (windSpeed < 10) score += MODERATE_WIND_SCORE;

  // Period scoring (swell quality)
  const period = forecast.wave_period || forecast.swell_1_period || 0;
  if (period >= 12) score += PERIOD_EXCELLENT_SCORE;
  else if (period >= 10) score += PERIOD_GOOD_SCORE;
  else if (period >= 8) score += PERIOD_FAIR_SCORE;

  // Tide scoring (prefer mid-tide)
  const tideHeight = forecast.tide_height || 0;
  if (tideHeight >= 2 && tideHeight <= 5) score += TIDE_OPTIMAL_SCORE;
  else if (tideHeight >= 1.5 && tideHeight <= 6) score += TIDE_ACCEPTABLE_SCORE;

  // Time of day bonus (prefer early morning and late afternoon)
  const hour = forecast.forecast_at
    ? new Date(forecast.forecast_at).getUTCHours()
    : parseInt(forecast.forecast_time?.split(":")[0] || '12');
  if (hour >= 6 && hour <= 9) score += MORNING_BONUS;
  else if (hour >= 16 && hour <= 18) score += AFTERNOON_BONUS;

  return score;
}

/**
 * Find the best forecast from scored forecasts
 * 
 * Returns null if no forecast meets minimum quality threshold.
 * 
 * @param scoredForecasts - Array of forecasts with scores
 * @returns Best scoring forecast or null
 */
function findBestForecast(scoredForecasts: ScoredForecast[]): ScoredForecast | null {
  if (scoredForecasts.length === 0) {
    return null;
  }

  // Sort by score descending
  scoredForecasts.sort((a, b) => b.score - a.score);

  // Check if top forecast meets minimum quality
  if (scoredForecasts[0].score < MINIMUM_QUALITY_SCORE) {
    return null;
  }

  return scoredForecasts[0];
}

/**
 * Extend window by finding adjacent good forecasts
 * 
 * Extends from the best forecast to include adjacent forecasts that:
 * - Score >= 75% of the best forecast's score
 * - Don't extend window beyond 4 hours
 * - Don't extend past reasonable time (8 PM)
 * 
 * @param bestForecast - The best scoring forecast
 * @param allForecasts - All future forecasts in order
 * @param scoredForecasts - Forecasts with scores
 * @returns Extended window times (start and end)
 */
function extendWindow(
  bestForecast: ForecastData,
  allForecasts: ForecastData[],
  scoredForecasts: ScoredForecast[]
): { startTime: string; endTime: string } {
  const startTime = bestForecast.forecast_time.substring(0, 5);
  const startIdx = allForecasts.indexOf(bestForecast);
  
  if (startIdx === -1) {
    return { startTime, endTime: startTime };
  }

  let endIdx = startIdx;
  const bestScore = scoredForecasts.find((s) => s.forecast === bestForecast)?.score || 0;

  // Extend window while conditions remain good
  while (
    endIdx < allForecasts.length - 1 &&
    (endIdx - startIdx) < MAX_WINDOW_HOURS &&
    scoredForecasts.find((s) => s.forecast === allForecasts[endIdx + 1])?.score &&
    scoredForecasts.find((s) => s.forecast === allForecasts[endIdx + 1])!.score >= bestScore * QUALITY_THRESHOLD
  ) {
    endIdx++;
  }

  // Default to 2-hour window if only one forecast
  let endTime = allForecasts[endIdx].forecast_time.substring(0, 5);
  
  if (startTime === endTime) {
    const [hour, minute] = startTime.split(":").map(Number);
    const endHour = hour + 2;

    // Don't create late windows
    if (endHour > LATE_CUTOFF_HOUR) {
      return { startTime, endTime: startTime }; // Signal too late
    }

    endTime = `${endHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  }

  return { startTime, endTime };
}

/**
 * Build human-readable description of conditions
 * 
 * Generates description and conditions text based on forecast data.
 * 
 * @param forecast - Best forecast data
 * @param score - Forecast score
 * @param beachAspect - Beach aspect in degrees
 * @returns Description and conditions text
 */
function buildWindowDescription(
  forecast: ForecastData,
  score: number,
  beachAspect: number
): { description: string; conditions: string } {
  const wind = forecast.wind_speed || 0;
  const windDir = forecast.wind_direction || 0;
  const isOffshore = calculateOnOffshore(windDir, beachAspect);
  const period = forecast.wave_period || forecast.swell_1_period || 0;

  // Build conditions text
  let conditions = "";
  if (isOffshore && wind < 8) {
    conditions = "Clean offshore winds";
  } else if (wind < 5) {
    conditions = "Light winds";
  } else {
    conditions = "Moderate conditions";
  }

  if (period >= 10) {
    conditions += ", quality swell";
  }

  // Build description
  const description = score >= 50 ? "Excellent conditions" : "Good conditions";

  return { description, conditions };
}

/**
 * Find the next best surf window from current time onwards
 * 
 * Main orchestrator that:
 * 1. Filters to future forecasts
 * 2. Scores each forecast
 * 3. Finds best forecast
 * 4. Extends window with adjacent good forecasts
 * 5. Builds human-readable description
 * 
 * More flexible than bestWindowHeuristic - works for entire day.
 * 
 * @param forecasts - Array of forecast data points
 * @param currentTime - Current time
 * @param beachAspect - Beach aspect in degrees (default 270 = WSW)
 * @returns Session window or null if no good window found
 * 
 * @example
 * ```typescript
 * const window = findNextBestWindow(forecasts, new Date(), 270);
 * // Returns: { startTime: '08:00', endTime: '10:00', description: 'Excellent conditions', conditions: 'Clean offshore winds, quality swell' }
 * ```
 */
export function findNextBestWindow(
  forecasts: ForecastData[],
  currentTime: Date,
  beachAspect: number = 270 // Default: Ocean Beach, San Diego (WSW)
): SessionWindow | null {
  if (forecasts.length === 0) {
    return null;
  }

  const today = currentTime.toISOString().split("T")[0];
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  // Filter to future forecasts only
  const futureForecasts = forecasts.filter((f) => {
    if (f.forecast_at) {
      const forecastDate = f.forecast_at.split("T")[0];
      if (forecastDate !== today) return false;
      const forecastTime = new Date(f.forecast_at);
      return forecastTime.getTime() > currentTime.getTime();
    }
    if (f.forecast_date !== today) return false;
    const [hour, minute] = f.forecast_time.split(":").map(Number);
    return hour > currentHour || (hour === currentHour && minute > currentMinute);
  });

  if (futureForecasts.length === 0) {
    return null;
  }

  // Score each forecast
  const scoredForecasts: ScoredForecast[] = futureForecasts.map((f) => ({
    forecast: f,
    score: scoreForecast(f, beachAspect),
  }));

  // Find best forecast
  const best = findBestForecast(scoredForecasts);
  
  if (!best) {
    return {
      startTime: null,
      endTime: null,
      description: "Variable conditions",
      conditions: "Check detailed forecast for conditions",
    };
  }

  // Extend window with adjacent good forecasts
  const { startTime, endTime } = extendWindow(best.forecast, futureForecasts, scoredForecasts);

  // Check if window is too late
  if (startTime === endTime) {
    return {
      startTime: null,
      endTime: null,
      description: "Too late in the day",
      conditions: "Check tomorrow's forecast for better windows",
    };
  }

  // Build description
  const { description, conditions } = buildWindowDescription(best.forecast, best.score, beachAspect);

  return {
    startTime,
    endTime,
    description,
    conditions,
  };
}

/**
 * Calculate best surf window heuristic for morning sessions
 * 
 * Focuses on early morning (6am-10am) window with optimal conditions:
 * - Lower to mid tide (2-5 ft)
 * - Offshore or light winds (< 8 mph)
 * - Period >= 10s
 * 
 * @param forecasts - Array of forecast data points
 * @param tides - Array of tide data points
 * @param timezone - IANA timezone string
 * @returns Human-readable window description (e.g., "08:00–10:00 on the drop; cleaner before onshores")
 * 
 * @example
 * ```typescript
 * const window = bestWindowHeuristic(forecasts, tides, "America/Los_Angeles");
 * // Returns: "08:00–10:00 on the drop; cleaner before onshores"
 * ```
 */
export function bestWindowHeuristic(
  forecasts: ForecastSlice["forecasts"],
  tides: ForecastSlice["tides"],
  timezone: string
): string {
  if (forecasts.length === 0) return "N/A";

  // Factors for best window:
  // 1. Lower to mid tide (2-5 ft)
  // 2. Offshore or light winds (< 8 mph)
  // 3. Period >= 10s
  // 4. Between 06:00 and 10:00

  const bestForecasts = forecasts.filter((f) => {
    const localTime = localTimeFromForecast(f, timezone);
    if (!localTime || localTime.hour < 6 || localTime.hour > 10) return false;

    const windSpeed = f.wind_speed || 999;
    const period = f.wave_period || f.swell_period || 0;
    const windDir = f.wind_direction || 0;

    const isWindGood =
      windSpeed < 8 || calculateOnOffshore(windDir, 270); // 270 = WSW (OB default)
    const isPeriodGood = period >= 10;

    return isWindGood && isPeriodGood;
  });

  if (bestForecasts.length === 0) {
    return "Variable conditions; check throughout the morning";
  }

  const start = localTimeFromForecast(bestForecasts[0], timezone);
  const end = localTimeFromForecast(
    bestForecasts[bestForecasts.length - 1],
    timezone
  );
  if (!start || !end) {
    return "Variable conditions; check throughout the morning";
  }

  const startTime = start.label;
  let endTime = end.label;

  // If only one forecast matches, extend window by 2 hours for a meaningful range
  if (bestForecasts.length === 1) {
    const endHour = start.hour + 2;
    // Cap at 10:00 to stay within morning window
    const cappedEndHour = Math.min(endHour, 10);
    endTime = `${padTimePart(cappedEndHour)}:${padTimePart(start.minute)}`;
  }

  // Validate that we have a meaningful window (start !== end)
  if (startTime === endTime) {
    return "Variable conditions; check throughout the morning";
  }

  // Check tide condition
  const midForecast = bestForecasts[Math.floor(bestForecasts.length / 2)];
  const tide = tideAt(midForecast.forecast_time, tides, timezone);

  let tideNote = "";
  if (tide.direction === "falling" && tide.height > 3) {
    tideNote = " on the drop";
  } else if (tide.direction === "rising" && tide.height < 4) {
    tideNote = " on the push";
  }

  const wind = windAt(startTime, forecasts, timezone);
  let windNote = "";
  if (wind.offshore) {
    windNote = "; cleaner before onshores";
  }

  return `${startTime}–${endTime}${tideNote}${windNote}`;
}

/**
 * Calculate confidence based on data completeness
 * 
 * Evaluates the completeness and quality of forecast data:
 * - Checks presence of required forecast fields
 * - Adds bonus for tide data availability
 * - Returns confidence level (High/Medium/Low)
 * 
 * Thresholds:
 * - High: >= 90% completeness
 * - Medium: >= 60% completeness
 * - Low: < 60% completeness
 * 
 * @param forecasts - Array of forecast data points
 * @param tides - Array of tide data points
 * @returns Confidence level
 * 
 * @example
 * ```typescript
 * const confidence = confidenceHeuristic(forecasts, tides);
 * // Returns: "High" (if data is 90%+ complete)
 * ```
 */
export function confidenceHeuristic(
  forecasts: ForecastSlice["forecasts"],
  tides: ForecastSlice["tides"]
): "Low" | "Medium" | "High" {
  if (forecasts.length === 0) return "Low";

  let totalFields = 0;
  let presentFields = 0;

  // Check forecast data completeness
  const requiredFields: Array<keyof ForecastSlice["forecasts"][0]> = [
    "wave_height",
    "wave_period",
    "wind_speed",
    "wind_direction",
    "swell_height",
    "swell_period",
    "swell_direction",
  ];

  forecasts.forEach((f) => {
    requiredFields.forEach((field) => {
      totalFields++;
      if (f[field] !== null && f[field] !== undefined) {
        presentFields++;
      }
    });
  });

  // Check tide data
  if (tides.length > 0) {
    presentFields += 10; // Boost for having tide data
  }
  totalFields += 10;

  const completeness = presentFields / totalFields;

  if (completeness >= 0.9) return "High";
  if (completeness >= 0.6) return "Medium";
  return "Low";
}
