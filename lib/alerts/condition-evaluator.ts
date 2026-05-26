import type { AlertConditions, BeachAlertMeta, ForecastHour } from "./types";
import { isWithinArc, resolveWindDirection } from "./degree-utils";
import { normalizeTideStage } from "@/lib/beginner/beginner-window-evaluator";

export function evaluateConditions(
  conditions: AlertConditions,
  forecast: ForecastHour,
  beach: BeachAlertMeta,
): boolean {
  if (conditions.swell_height_min != null) {
    if (
      forecast.wave_height == null ||
      forecast.wave_height < conditions.swell_height_min
    )
      return false;
  }
  if (conditions.swell_height_max != null) {
    if (
      forecast.wave_height == null ||
      forecast.wave_height > conditions.swell_height_max
    )
      return false;
  }
  if (conditions.swell_period_min != null) {
    const period = forecast.swell_1_period ?? forecast.wave_period;
    if (period == null || period < conditions.swell_period_min) return false;
  }
  if (
    conditions.swell_direction_min_deg != null &&
    conditions.swell_direction_max_deg != null
  ) {
    if (forecast.swell_1_direction == null) return false;
    if (
      !isWithinArc(
        forecast.swell_1_direction,
        conditions.swell_direction_min_deg,
        conditions.swell_direction_max_deg,
      )
    )
      return false;
  }
  if (conditions.wind_direction != null) {
    if (forecast.wind_direction_deg == null) return false;
    const resolved = resolveWindDirection(
      forecast.wind_direction_deg,
      beach.wind_offshore_deg,
      beach.wind_offshore_tol_deg,
      beach.aspect_deg,
    );
    if (resolved !== conditions.wind_direction) return false;
  }
  if (conditions.wind_speed_max_kt != null) {
    if (
      forecast.wind_speed == null ||
      forecast.wind_speed > conditions.wind_speed_max_kt
    )
      return false;
  }
  if (conditions.tide_height_min_ft != null) {
    if (
      forecast.tide_height == null ||
      forecast.tide_height < conditions.tide_height_min_ft
    )
      return false;
  }
  if (conditions.tide_height_max_ft != null) {
    if (
      forecast.tide_height == null ||
      forecast.tide_height > conditions.tide_height_max_ft
    )
      return false;
  }
  if (conditions.tide_direction != null) {
    if (
      forecast.tide_status == null ||
      forecast.tide_status !== conditions.tide_direction
    )
      return false;
  }
  if (
    conditions.avoid_tide_statuses &&
    conditions.avoid_tide_statuses.length > 0
  ) {
    const tideStage = normalizeTideStage(forecast.tide_status);
    const blockedStages = conditions.avoid_tide_statuses
      .map((stage) => normalizeTideStage(stage))
      .filter((stage): stage is NonNullable<typeof tideStage> => stage != null);
    if (tideStage != null && blockedStages.includes(tideStage)) return false;
  }
  if (
    conditions.local_time_start != null &&
    conditions.local_time_end != null
  ) {
    if (
      !isForecastWithinLocalTimeRange(
        forecast.forecast_at,
        beach.timezone,
        conditions.local_time_start,
        conditions.local_time_end,
      )
    )
      return false;
  }
  if (conditions.days_of_week && conditions.days_of_week.length > 0) {
    const localDay = getLocalDayOfWeek(forecast.forecast_at, beach.timezone);
    if (localDay == null || !conditions.days_of_week.includes(localDay)) {
      return false;
    }
  }
  return true;
}

function getLocalDayOfWeek(forecastAt: string, timezone: string): number | null {
  const date = new Date(forecastAt);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    weekday: "short",
  });
  const weekday = formatter.format(date);
  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const index = days.indexOf(weekday);
  return index >= 0 ? index : null;
}

function isForecastWithinLocalTimeRange(
  forecastAt: string,
  timezone: string,
  start: string,
  end: string,
): boolean {
  const forecastMinutes = getLocalMinutes(forecastAt, timezone);
  const startMinutes = parseTimeToMinutes(start);
  const endMinutes = parseTimeToMinutes(end);
  if (forecastMinutes == null || startMinutes == null || endMinutes == null) {
    return false;
  }
  if (startMinutes <= endMinutes) {
    return forecastMinutes >= startMinutes && forecastMinutes <= endMinutes;
  }
  return forecastMinutes >= startMinutes || forecastMinutes <= endMinutes;
}

function getLocalMinutes(forecastAt: string, timezone: string): number | null {
  const date = new Date(forecastAt);
  if (Number.isNaN(date.getTime())) return null;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const parts = formatter.formatToParts(date);
  const hour = Number(parts.find((part) => part.type === "hour")?.value);
  const minute = Number(parts.find((part) => part.type === "minute")?.value);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
}

function parseTimeToMinutes(value: string): number | null {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (hour > 23 || minute > 59) return null;
  return hour * 60 + minute;
}
