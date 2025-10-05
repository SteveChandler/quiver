/**
 * Morning Intel Utilities
 * Helper functions for analyzing and formatting surf conditions
 */

import { format, parseISO } from "date-fns";
import { zonedTimeToUtc, utcToZonedTime, formatInTimeZone } from "date-fns-tz";
import type {
  SurfMetrics,
  TideMetrics,
  SwellComponent,
  WindMetrics,
  MorningIntelData,
  ForecastSlice,
} from "@/types/morning-intel";

const FEET_TO_METERS = 0.3048;
const METERS_TO_FEET = 3.28084;

// Ocean Beach, San Diego faces approximately WSW (260-270°)
const OB_SHORE_NORMAL = 270; // degrees

/**
 * Convert wave height description to readable format
 */
export function getWaveHeightDescription(heightFeet: number): string {
  if (heightFeet < 1) return "flat";
  if (heightFeet < 2) return "ankle";
  if (heightFeet < 3) return "knee";
  if (heightFeet < 4) return "waist";
  if (heightFeet < 5) return "chest";
  if (heightFeet < 6) return "head";
  if (heightFeet < 8) return "overhead";
  if (heightFeet < 10) return "double overhead";
  return "triple overhead+";
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
export function tideAt(
  targetTime: string, // "06:00"
  tides: ForecastSlice["tides"],
  timezone: string
): TideMetrics {
  if (!tides || tides.length === 0) {
    return {
      height: 0,
      direction: "slack",
      nextEvent: null,
    };
  }

  // Parse target time in the specified timezone
  const now = new Date();
  const todayStr = format(now, "yyyy-MM-dd");
  const targetDateStr = `${todayStr}T${targetTime}:00`;
  const targetDate = zonedTimeToUtc(targetDateStr, timezone);

  // Find closest tide reading
  let closestTide = tides[0];
  let minDiff = Math.abs(
    new Date(tides[0].ts).getTime() - targetDate.getTime()
  );

  for (const tide of tides) {
    const diff = Math.abs(new Date(tide.ts).getTime() - targetDate.getTime());
    if (diff < minDiff) {
      minDiff = diff;
      closestTide = tide;
    }
  }

  // Determine tide direction by comparing with next reading
  const tideIndex = tides.indexOf(closestTide);
  let direction: "rising" | "falling" | "slack" = "slack";

  if (tideIndex < tides.length - 1) {
    const currentHeight = closestTide.tide_height_m;
    const nextHeight = tides[tideIndex + 1].tide_height_m;
    const diff = nextHeight - currentHeight;

    if (diff > 0.05) direction = "rising";
    else if (diff < -0.05) direction = "falling";
  }

  // Find next high/low tide event
  let nextEvent: TideMetrics["nextEvent"] = null;
  for (let i = tideIndex + 1; i < tides.length; i++) {
    const tide = tides[i];
    const prevTide = tides[i - 1];
    const nextTide = tides[i + 1];

    if (prevTide && nextTide) {
      const isHigh =
        tide.tide_height_m > prevTide.tide_height_m &&
        tide.tide_height_m > nextTide.tide_height_m;
      const isLow =
        tide.tide_height_m < prevTide.tide_height_m &&
        tide.tide_height_m < nextTide.tide_height_m;

      if (isHigh || isLow) {
        const tideTime = utcToZonedTime(new Date(tide.ts), timezone);
        nextEvent = {
          type: isHigh ? "HIGH" : "LOW",
          height: Number((tide.tide_height_m * METERS_TO_FEET).toFixed(1)),
          time: format(tideTime, "HH:mm"),
        };
        break;
      }
    }
  }

  return {
    height: Number((closestTide.tide_height_m * METERS_TO_FEET).toFixed(1)),
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
  const targetDate = zonedTimeToUtc(targetDateStr, timezone);

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
 */
export function calculateOnOffshore(
  windDir: number,
  beachAspect: number
): boolean {
  // Offshore wind is roughly opposite to shore normal (within 90° tolerance)
  const diff = normalizeAngle(windDir - beachAspect);
  // Offshore: wind coming from land (90° to 270° relative to shore normal)
  return diff > 45 && diff < 315;
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
export function degreesToCardinal(degrees: number): string {
  const normalized = normalizeAngle(degrees);
  const cardinals = ["N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE", "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW"];
  const index = Math.round(normalized / 22.5) % 16;
  return cardinals[index];
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
  const endTime =
    bestForecasts[bestForecasts.length - 1].forecast_time.substring(0, 5);

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
 * Render Markdown body for intel post
 */
export function renderIntelMarkdown(data: MorningIntelData): string {
  const { spotName, time, surf, tide, swells, wind, bestWindow, confidence, notes } =
    data;

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

  return `**${spotName} — Morning Surf Intel (${time})**

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
