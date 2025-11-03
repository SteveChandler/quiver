/**
 * Morning Intel Utilities
 * Helper functions for analyzing and formatting surf conditions
 *
 * NOTE: This file is being refactored into focused modules.
 * Formatting functions have been extracted to lib/formatters/intel-formatter.ts
 */

import { format, parseISO } from "date-fns";
import { fromZonedTime, toZonedTime, formatInTimeZone } from "date-fns-tz";
import type {
  SurfMetrics,
  TideMetrics,
  SwellComponent,
  WindMetrics,
  MorningIntelData,
  ForecastSlice,
  BeachPreferences,
  ConditionEvaluation,
  ConditionsAnalysis,
} from "@/types/morning-intel";

// Re-export formatting functions for backward compatibility
export {
  getWaveHeightDescription,
  deriveSurfRange,
  renderIntelMarkdown,
} from "@/lib/formatters/intel-formatter";

// Re-export swell analysis functions for backward compatibility
export {
  primarySecondarySwell,
  analyzeSwellMatch,
  isAngleInWindow,
} from "@/lib/analyzers/swell-analyzer";

// Re-export wind analysis functions for backward compatibility
export {
  windAt,
  calculateOnOffshore,
  normalizeAngle,
  degreesToCardinal,
  analyzeWindConditions,
} from "@/lib/analyzers/wind-analyzer";

// Import for internal use in this module
import {
  primarySecondarySwell,
  analyzeSwellMatch,
} from "@/lib/analyzers/swell-analyzer";

import {
  windAt,
  calculateOnOffshore,
  normalizeAngle,
  analyzeWindConditions,
} from "@/lib/analyzers/wind-analyzer";

const FEET_TO_METERS = 0.3048;
const METERS_TO_FEET = 3.28084;

// Ocean Beach, San Diego faces approximately WSW (260-270°)
const OB_SHORE_NORMAL = 270; // degrees

/**
 * Type for tide direction
 */
type TideDirection = "rising" | "falling" | "slack";

/**
 * Normalize tide status string to a valid TideDirection
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

// Surf range derivation moved to IntelFormatter module

/**
 * Get tide metrics at a specific time
 */
function tideAt(
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

// primarySecondarySwell function moved to lib/analyzers/swell-analyzer.ts

// windAt function moved to lib/analyzers/wind-analyzer.ts

// calculateOnOffshore function moved to lib/analyzers/wind-analyzer.ts

// normalizeAngle function moved to lib/analyzers/wind-analyzer.ts

// degreesToCardinal function moved to lib/analyzers/wind-analyzer.ts

/**
 * Calculate best surf window heuristic
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
    const time = parseInt(f.forecast_time.split(":")[0]);
    if (time < 6 || time > 10) return false;

    const windSpeed = f.wind_speed || 999;
    const period = f.wave_period || f.swell_period || 0;
    const windDir = f.wind_direction || 0;

    const isWindGood =
      windSpeed < 8 || calculateOnOffshore(windDir, OB_SHORE_NORMAL);
    const isPeriodGood = period >= 10;

    return isWindGood && isPeriodGood;
  });

  if (bestForecasts.length === 0) {
    return "Variable conditions; check throughout the morning";
  }

  const startTime = bestForecasts[0].forecast_time.substring(0, 5);
  let endTime = bestForecasts[bestForecasts.length - 1].forecast_time.substring(0, 5);

  // If only one forecast matches, extend window by 2 hours for a meaningful range
  if (bestForecasts.length === 1) {
    const startHour = parseInt(startTime.split(":")[0]);
    const startMin = parseInt(startTime.split(":")[1]);
    const endHour = startHour + 2;
    // Cap at 10:00 to stay within morning window
    const cappedEndHour = Math.min(endHour, 10);
    endTime = `${cappedEndHour.toString().padStart(2, "0")}:${startMin.toString().padStart(2, "0")}`;
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
 * Find the next best surf window from current time onwards
 * More flexible than bestWindowHeuristic - works for entire day
 */
export function findNextBestWindow(
  forecasts: Array<{
    forecast_time: string;
    forecast_date: string;
    wind_speed: number | null;
    wind_direction: number | null;
    wave_period: number | null;
    swell_1_period: number | null;
    tide_height: number | null;
  }>,
  currentTime: Date,
  beachAspect: number = OB_SHORE_NORMAL
): {
  startTime: string | null;
  endTime: string | null;
  description: string;
  conditions: string;
} | null {
  if (forecasts.length === 0) {
    return null;
  }

  const today = currentTime.toISOString().split("T")[0];
  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  // Filter to future forecasts only
  const futureForecasts = forecasts.filter((f) => {
    if (f.forecast_date !== today) return false;
    const [hour, minute] = f.forecast_time.split(":").map(Number);
    return hour > currentHour || (hour === currentHour && minute > currentMinute);
  });

  if (futureForecasts.length === 0) {
    return null;
  }

  // Score each forecast based on conditions
  const scoredForecasts = futureForecasts.map((f) => {
    let score = 0;
    const windSpeed = f.wind_speed || 999;
    const period = f.wave_period || f.swell_1_period || 0;
    const windDir = f.wind_direction || 0;

    // Wind scoring (most important)
    const isOffshore = calculateOnOffshore(windDir, beachAspect);
    if (isOffshore && windSpeed < 5) score += 40;
    else if (isOffshore && windSpeed < 10) score += 30;
    else if (windSpeed < 5) score += 20;
    else if (windSpeed < 10) score += 10;

    // Period scoring
    if (period >= 12) score += 30;
    else if (period >= 10) score += 20;
    else if (period >= 8) score += 10;

    // Tide scoring (prefer mid-tide)
    const tideHeight = f.tide_height || 0;
    if (tideHeight >= 2 && tideHeight <= 5) score += 20;
    else if (tideHeight >= 1.5 && tideHeight <= 6) score += 10;

    // Time of day bonus (prefer early morning and late afternoon)
    const hour = parseInt(f.forecast_time.split(":")[0]);
    if (hour >= 6 && hour <= 9) score += 10;
    else if (hour >= 16 && hour <= 18) score += 5;

    return { forecast: f, score };
  });

  // Sort by score
  scoredForecasts.sort((a, b) => b.score - a.score);

  // Get top 30% of forecasts to find a window
  const topCount = Math.max(1, Math.ceil(scoredForecasts.length * 0.3));
  const topForecasts = scoredForecasts.slice(0, topCount);

  if (topForecasts.length === 0 || topForecasts[0].score < 20) {
    return {
      startTime: null,
      endTime: null,
      description: "Variable conditions",
      conditions: "Check detailed forecast for conditions",
    };
  }

  // Find continuous window from top forecasts
  const bestForecast = topForecasts[0].forecast;
  const startTime = bestForecast.forecast_time.substring(0, 5);

  // Extend window by looking at adjacent good forecasts
  // Cap at 4 hours max and require similar quality (>= 75% of best score)
  const startIdx = futureForecasts.indexOf(bestForecast);
  let endIdx = startIdx;
  const bestScore = topForecasts[0].score;
  const MAX_WINDOW_FORECASTS = 4; // Cap at ~4 hours (assuming hourly forecasts)

  while (
    endIdx < futureForecasts.length - 1 &&
    (endIdx - startIdx) < MAX_WINDOW_FORECASTS &&
    scoredForecasts.find((s) => s.forecast === futureForecasts[endIdx + 1])?.score &&
    scoredForecasts.find((s) => s.forecast === futureForecasts[endIdx + 1])!.score >= bestScore * 0.75
  ) {
    endIdx++;
  }

  // Default to 2-hour window if only one forecast
  let endTime = futureForecasts[endIdx].forecast_time.substring(0, 5);
  if (startTime === endTime) {
    const [hour, minute] = startTime.split(":").map(Number);
    const endHour = hour + 2;

    // If the 2-hour window would extend beyond a reasonable time (8 PM / 20:00),
    // don't create a window - conditions are too late in the day
    if (endHour > 20) {
      return {
        startTime: null,
        endTime: null,
        description: "Too late in the day",
        conditions: "Check tomorrow's forecast for better windows",
      };
    }

    endTime = `${endHour.toString().padStart(2, "0")}:${minute.toString().padStart(2, "0")}`;
  }

  // Build description
  const wind = bestForecast.wind_speed || 0;
  const windDir = bestForecast.wind_direction || 0;
  const isOffshore = calculateOnOffshore(windDir, beachAspect);
  const period = bestForecast.wave_period || bestForecast.swell_1_period || 0;

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

  return {
    startTime,
    endTime,
    description: topForecasts[0].score >= 50 ? "Excellent conditions" : "Good conditions",
    conditions,
  };
}

/**
 * Calculate confidence based on data completeness
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

// isAngleInWindow function moved to lib/analyzers/swell-analyzer.ts

// analyzeSwellMatch function moved to lib/analyzers/swell-analyzer.ts

// analyzeWindConditions function moved to lib/analyzers/wind-analyzer.ts

/**
 * Analyze tide conditions relative to beach preferences
 */
function analyzeTideConditions(
  tideHeight: number,
  beach: BeachPreferences
): ConditionEvaluation {
  // If no tide preference defined, consider acceptable
  if (beach.tideMinFt == null || beach.tideMaxFt == null) {
    return {
      status: "acceptable",
      emoji: "⚠️",
      message: `${tideHeight.toFixed(1)} ft (no preference set)`,
    };
  }

  // Check if tide is within preferred range
  if (tideHeight >= beach.tideMinFt && tideHeight <= beach.tideMaxFt) {
    return {
      status: "optimal",
      emoji: "✅",
      message: `${tideHeight.toFixed(1)} ft - within optimal range (${beach.tideMinFt}-${beach.tideMaxFt} ft)`,
    };
  }

  // Check if tide is close to the range (within 1 ft)
  const belowMin = beach.tideMinFt - tideHeight;
  const aboveMax = tideHeight - beach.tideMaxFt;

  if ((belowMin > 0 && belowMin <= 1) || (aboveMax > 0 && aboveMax <= 1)) {
    return {
      status: "acceptable",
      emoji: "⚠️",
      message: `${tideHeight.toFixed(1)} ft - close to optimal range (${beach.tideMinFt}-${beach.tideMaxFt} ft)`,
    };
  }

  return {
    status: "poor",
    emoji: "❌",
    message: `${tideHeight.toFixed(1)} ft - outside optimal range (${beach.tideMinFt}-${beach.tideMaxFt} ft)`,
  };
}

/**
 * Calculate overall conditions score and analysis
 */
export function analyzeConditions(
  forecast: {
    swellDirection?: number | null;
    wind: WindMetrics;
    tide: TideMetrics;
  },
  beach: BeachPreferences
): ConditionsAnalysis {
  const swellEval = analyzeSwellMatch(forecast.swellDirection, beach);
  const windEval = analyzeWindConditions(forecast.wind, beach);
  const tideEval = analyzeTideConditions(forecast.tide.height, beach);

  // Calculate score: optimal = 3.33 points, acceptable = 1.67 points, poor = 0 points
  const scoreMap = { optimal: 3.33, acceptable: 1.67, poor: 0 };
  const score = Math.round(
    scoreMap[swellEval.status] +
      scoreMap[windEval.status] +
      scoreMap[tideEval.status]
  );

  return {
    score: Math.min(10, score),
    swell: swellEval,
    wind: windEval,
    tide: tideEval,
  };
}

// Intel markdown rendering moved to IntelFormatter module
