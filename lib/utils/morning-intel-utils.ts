/**
 * Morning Intel Utilities
 * Helper functions for analyzing and formatting surf conditions
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
 * Convert wave height description to readable format
 */
function getWaveHeightDescription(avgHeight: number): string {
  if (avgHeight < 1) return "Knee-high";
  if (avgHeight < 2) return "Waist-high";
  if (avgHeight < 3.5) return "Chest-high";
  if (avgHeight < 5) return "Head-high";
  if (avgHeight < 7) return "Overhead";
  return "Double overhead+";
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

/**
 * Derive surf range from forecast data
 */
export function deriveSurfRange(
  forecasts: ForecastSlice["forecasts"]
): SurfMetrics {
  const waveHeights = forecasts
    .map((f) => f.wave_height || f.swell_height || null)
    .filter((h): h is number => h !== null);

  if (waveHeights.length === 0) {
    return { min: 0, max: 0, dominant: "N/A" };
  }

  const min = Math.min(...waveHeights);
  const max = Math.max(...waveHeights);
  const avg = waveHeights.reduce((a, b) => a + b, 0) / waveHeights.length;

  return {
    min: Math.round(min * 10) / 10,
    max: Math.round(max * 10) / 10,
    dominant: getWaveHeightDescription(avg),
  };
}

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

/**
 * Extract primary and secondary swell components
 */
export function primarySecondarySwell(
  forecasts: ForecastSlice["forecasts"]
): { primary: SwellComponent | null; secondary: SwellComponent | null } {
  if (forecasts.length === 0) {
    return { primary: null, secondary: null };
  }

  // Get most recent forecast with swell data
  const forecastWithSwell = forecasts.find(
    (f) =>
      f.swell_height !== null &&
      f.swell_period !== null &&
      f.swell_direction !== null
  );

  if (!forecastWithSwell) {
    return { primary: null, secondary: null };
  }

  const primary: SwellComponent | null = forecastWithSwell.swell_height
    ? {
        height: Number(forecastWithSwell.swell_height.toFixed(1)),
        period: Math.round(forecastWithSwell.swell_period || 0),
        direction: Math.round(forecastWithSwell.swell_direction || 0),
        cardinal: degreesToCardinal(forecastWithSwell.swell_direction || 0),
      }
    : null;

  const secondary: SwellComponent | null =
    forecastWithSwell.secondary_swell_height
      ? {
          height: Number(forecastWithSwell.secondary_swell_height.toFixed(1)),
          period: Math.round(forecastWithSwell.secondary_swell_period || 0),
          direction: Math.round(
            forecastWithSwell.secondary_swell_direction || 0
          ),
          cardinal: degreesToCardinal(
            forecastWithSwell.secondary_swell_direction || 0
          ),
        }
      : null;

  return { primary, secondary };
}

/**
 * Get wind metrics at a specific time
 */
export function windAt(
  targetTime: string,
  forecasts: ForecastSlice["forecasts"],
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
  let minDiff = Math.abs(
    new Date(`${forecasts[0].forecast_date}T${forecasts[0].forecast_time}`)
      .getTime() - targetDate.getTime()
  );

  for (const forecast of forecasts) {
    const forecastDate = new Date(
      `${forecast.forecast_date}T${forecast.forecast_time}`
    );
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
 * Calculate if wind is offshore relative to beach orientation
 * Wind is considered offshore if it's within ±45° of the beach normal
 */
function calculateOnOffshore(windDir: number, beachNormal: number): boolean {
  const angleDiff = Math.abs(normalizeAngle(windDir - beachNormal));
  // Offshore is within 45° on either side (0-45° or 315-360°)
  return angleDiff <= 45 || angleDiff >= 315;
}

/**
 * Normalize angle to 0-360 range
 */
function normalizeAngle(angle: number): number {
  while (angle < 0) angle += 360;
  while (angle >= 360) angle -= 360;
  return angle;
}

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
    const period = f.wave_period || f.swell_period || 0;
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
  const period = bestForecast.wave_period || bestForecast.swell_period || 0;

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

/**
 * Check if angle is within window (handles 0/360 wraparound)
 */
function isAngleInWindow(
  angle: number,
  minDeg: number,
  maxDeg: number
): boolean {
  // Normalize all angles to 0-360
  const norm = (deg: number) => ((deg % 360) + 360) % 360;
  const a = norm(angle);
  const min = norm(minDeg);
  const max = norm(maxDeg);

  if (min <= max) {
    // Normal case: window doesn't cross 0°
    return a >= min && a <= max;
  } else {
    // Window crosses 0° (e.g., 350° to 10°)
    return a >= min || a <= max;
  }
}

/**
 * Analyze swell direction match with beach preferences
 */
function analyzeSwellMatch(
  swellDirection: number | null | undefined,
  beach: BeachPreferences
): ConditionEvaluation {
  // If no swell window defined, consider acceptable
  if (!beach.swellWindowMin || !beach.swellWindowMax) {
    return {
      status: "acceptable",
      emoji: "⚠️",
      message: "Swell direction not configured for this beach",
    };
  }

  // If no swell data, mark as poor
  if (swellDirection == null) {
    return {
      status: "poor",
      emoji: "❌",
      message: "No swell direction data available",
    };
  }

  // Check if swell is within window
  const isInWindow = isAngleInWindow(
    swellDirection,
    beach.swellWindowMin,
    beach.swellWindowMax
  );

  if (isInWindow) {
    return {
      status: "optimal",
      emoji: "✅",
      message: `${degreesToCardinal(swellDirection)} (${Math.round(swellDirection)}°) - within optimal window`,
    };
  }

  // Calculate how far outside the window
  const centerWindow = (beach.swellWindowMin + beach.swellWindowMax) / 2;
  const angleDiff = Math.abs(normalizeAngle(swellDirection - centerWindow));

  if (angleDiff < 45) {
    return {
      status: "acceptable",
      emoji: "⚠️",
      message: `${degreesToCardinal(swellDirection)} (${Math.round(swellDirection)}°) - slightly off optimal`,
    };
  }

  return {
    status: "poor",
    emoji: "❌",
    message: `${degreesToCardinal(swellDirection)} (${Math.round(swellDirection)}°) - outside optimal window`,
  };
}

/**
 * Analyze wind conditions relative to beach preferences
 */
function analyzeWindConditions(
  wind: WindMetrics,
  beach: BeachPreferences
): ConditionEvaluation {
  // If no wind offshore preference defined, evaluate based on general conditions
  if (!beach.windOffshoreDeg) {
    if (wind.speed < 5) {
      return {
        status: "optimal",
        emoji: "✅",
        message: `Light winds (${wind.speed} mph ${wind.cardinal})`,
      };
    } else if (wind.speed < 10) {
      return {
        status: "acceptable",
        emoji: "⚠️",
        message: `Moderate winds (${wind.speed} mph ${wind.cardinal})`,
      };
    } else {
      return {
        status: "poor",
        emoji: "❌",
        message: `Strong winds (${wind.speed} mph ${wind.cardinal})`,
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
      message: `${wind.description} (${wind.speed} mph ${wind.cardinal})`,
    };
  } else if (isOffshore || wind.speed < 8) {
    return {
      status: "acceptable",
      emoji: "⚠️",
      message: `${wind.description} (${wind.speed} mph ${wind.cardinal})`,
    };
  } else {
    return {
      status: "poor",
      emoji: "❌",
      message: `${wind.description} (${wind.speed} mph ${wind.cardinal})`,
    };
  }
}

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

/**
 * Render Markdown body for intel post
 */
export function renderIntelMarkdown(data: MorningIntelData): string {
  const {
    spotName,
    time,
    surf,
    tide,
    swells,
    wind,
    bestWindow,
    confidence,
    notes,
    conditions,
    beachPreferences,
  } = data;

  const tideDirection =
    tide.direction === "rising"
      ? "rising"
      : tide.direction === "falling"
      ? "falling"
      : "slack";

  const tideNext = tide.nextEvent
    ? `next ${tide.nextEvent.type} ${tide.nextEvent.height} ft @ ${tide.nextEvent.time}`
    : "N/A";

  const primarySwell = swells.primary
    ? `${swells.primary.height} ft @ ${swells.primary.period}s from ${swells.primary.cardinal} (${swells.primary.direction}°)`
    : "N/A";

  const secondarySwell = swells.secondary
    ? `${swells.secondary.height} ft @ ${swells.secondary.period}s from ${swells.secondary.cardinal} (${swells.secondary.direction}°)`
    : "N/A";

  // Build conditions section if available
  let conditionsSection = "";
  if (conditions && beachPreferences) {
    conditionsSection = `
📊 **CONDITIONS SCORE: ${conditions.score}/10**

${conditions.swell.emoji} **Swell Direction:** ${conditions.swell.message}
${conditions.wind.emoji} **Wind:** ${conditions.wind.message}
${conditions.tide.emoji} **Tide:** ${conditions.tide.message}`;

    if (beachPreferences.skillLevel) {
      conditionsSection += `\n🏄 **Skill Level:** ${beachPreferences.skillLevel}`;
    }

    if (beachPreferences.hazards && beachPreferences.hazards.length > 0) {
      conditionsSection += `\n\n⚠️ **HAZARDS:** ${beachPreferences.hazards.join(", ")}`;
    }

    conditionsSection += "\n";
  }

  return `**${spotName} — Morning Surf Intel (${time})**
${conditionsSection}
- **Surf:** ${surf.min}–${surf.max} ft (${surf.dominant})
- **Tide @ ${time}:** ${tide.height} ft, ${tideDirection} (${tideNext})
- **Swell:**
  - Primary: ${primarySwell}
  - Secondary: ${secondarySwell}
- **Wind:** ${wind.speed} mph ${wind.cardinal} (${wind.direction}°) — ${wind.description}
- **Best Window:** ${bestWindow}
- **Confidence:** ${confidence}

**Notes:** ${notes || "Standard morning conditions"}`;
}
