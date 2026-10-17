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
import { angleDifference, normalizeAngle } from "@/lib/domains/shared/angle-utils";
import type { WindOrientation } from "@/lib/domains/shared/wind-orientation";
import { parseWindSpeedOrNull } from "@/lib/utils/number-parsing";
import { degreeToCardinal } from "@/lib/utils/geo-utils";

export { normalizeAngle };

/** At or below this speed the wind reads as calm whatever its direction. */
const CALM_MPH = 3;
/** Within this many degrees of straight onshore counts as onshore. */
const ONSHORE_CONE_DEG = 45;

const UNKNOWN_WIND: WindMetrics = {
  // WindMetrics requires numbers; N/A marks these as sentinels, not measured zero or north.
  speed: 0,
  direction: 0,
  cardinal: "N/A",
  offshore: false,
  description: "N/A",
  relation: null,
};

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
 * True when the wind can't be judged against this beach: no speed, or a
 * non-calm wind with no relation. Such wind stays out of verdicts and copy.
 */
export function isWindUnknown(wind: WindMetrics): boolean {
  if (wind.description === "N/A") return true;
  // Stored intel from before `relation` existed carries its relation in the description.
  if (wind.relation === undefined) return false;
  return wind.speed > CALM_MPH && wind.relation === null;
}

/**
 * Get wind metrics at a specific time, judged against the beach's resolved
 * orientation. Without one the wind gets a plain speed reading and no relation.
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
  timezone: string,
  orientation: WindOrientation | null = null
): WindMetrics {
  if (forecasts.length === 0) {
    return UNKNOWN_WIND;
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

  const windSpeed = parseWindSpeedOrNull(closestForecast.wind_speed);
  if (windSpeed === null) return UNKNOWN_WIND;
  const windDir = closestForecast.wind_direction;
  const hasDirection = windDir != null && Number.isFinite(windDir);
  const offshoreDeg = orientation?.offshoreDeg ?? null;
  let relation: WindMetrics["relation"] = null;
  if (hasDirection && orientation && offshoreDeg != null) {
    const fromOffshore = angleDifference(windDir, offshoreDeg);
    relation = fromOffshore <= orientation.toleranceDeg
      ? "offshore"
      : fromOffshore >= 180 - ONSHORE_CONE_DEG ? "onshore" : "cross-shore";
  }
  const offshore = relation === "offshore";

  let description: string;
  if (windSpeed === 0) {
    description = "calm";
  } else if (relation === null) {
    description = `${formatWindSpeed(windSpeed)} wind`;
  } else if (relation === "offshore") {
    description = windSpeed < 5 ? "light offshore" : "offshore";
  } else if (relation === "onshore") {
    description = windSpeed < 8 ? "light onshore" : "onshore";
  } else {
    description = "cross-shore";
  }

  return {
    speed: Math.round(windSpeed),
    direction: hasDirection ? Math.round(windDir) : 0,
    cardinal: hasDirection ? degreeToCardinal(windDir) : "N/A",
    offshore,
    description,
    relation,
  };
}

/**
 * Analyze wind conditions relative to beach preferences
 */
export function analyzeWindConditions(
  wind: WindMetrics,
  _beach: BeachPreferences
): ConditionEvaluation {
  if (isWindUnknown(wind)) {
    return { status: "acceptable", emoji: "⚠️", message: "", excluded: true };
  }
  // Known but without a relation means calm (see isWindUnknown).
  if (wind.relation == null) {
    const direction = wind.cardinal === "N/A" ? "" : ` ${wind.cardinal}`;
    return {
      status: "optimal",
      emoji: "✅",
      message: `Light winds (${formatWindSpeed(wind.speed)}${direction})`,
    };
  }

  const isOffshore = wind.relation === "offshore";

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
