/**
 * Forecast At Adapter
 *
 * Utilities for working with the `forecast_at` timestamptz column.
 * Provides backward-compatible extraction of date/time parts and
 * timezone-aware grouping/sorting during the migration from
 * forecast_date + forecast_time to forecast_at.
 */

import { getLocalDateString, getLocalHour } from "./timezone-utils";

/**
 * Extract YYYY-MM-DD date string from a forecast_at ISO 8601 timestamp.
 * When timezone is provided, returns the date in that timezone.
 * Without timezone, returns the UTC date portion.
 */
export function extractForecastDate(
  forecastAt: string,
  timezone?: string
): string {
  if (timezone) {
    return getLocalDateString(new Date(forecastAt), timezone);
  }
  return forecastAt.split("T")[0];
}

/**
 * Extract HH:MM:SS time string from a forecast_at ISO 8601 timestamp.
 * When timezone is provided, returns the time in that timezone.
 * Without timezone, returns the UTC time portion.
 */
export function extractForecastTime(
  forecastAt: string,
  timezone?: string
): string {
  const date = new Date(forecastAt);
  if (timezone) {
    const hour = getLocalHour(date, timezone);
    // Use Intl.DateTimeFormat for correct local minutes in the given timezone
    const minuteParts = new Intl.DateTimeFormat("en-US", {
      minute: "2-digit",
      timeZone: timezone,
    }).formatToParts(date);
    const minutes = minuteParts.find((p) => p.type === "minute")?.value || "00";
    return `${String(hour).padStart(2, "0")}:${minutes.padStart(2, "0")}:00`;
  }
  return forecastAt.split("T")[1]?.split(/[Z+-]/)[0] || "00:00:00";
}

/**
 * Extract hour (0-23) from a forecast_at ISO 8601 timestamp.
 * When timezone is provided, returns the hour in that timezone.
 */
export function extractLocalHour(
  forecastAt: string,
  timezone?: string
): number {
  const date = new Date(forecastAt);
  if (timezone) {
    return getLocalHour(date, timezone);
  }
  return date.getUTCHours();
}

/**
 * Combine legacy forecast_date + forecast_time into an ISO 8601 UTC string.
 * Used during backfill and for code that still receives the old format.
 */
export function toForecastAt(
  forecastDate: string,
  forecastTime: string
): string {
  return `${forecastDate}T${forecastTime}Z`;
}

/**
 * Sort an array of objects with forecast_at chronologically.
 */
export function sortByForecastAt<T extends { forecast_at: string }>(
  forecasts: T[]
): T[] {
  return [...forecasts].sort(
    (a, b) =>
      new Date(a.forecast_at).getTime() - new Date(b.forecast_at).getTime()
  );
}

/**
 * Group forecasts by local date in the given timezone.
 */
export function groupByForecastDate<T extends { forecast_at: string }>(
  forecasts: T[],
  timezone: string
): Record<string, T[]> {
  const groups: Record<string, T[]> = {};
  for (const forecast of forecasts) {
    const date = extractForecastDate(forecast.forecast_at, timezone);
    if (!groups[date]) groups[date] = [];
    groups[date].push(forecast);
  }
  return groups;
}

/**
 * Check if a forecast_at timestamp is in the future.
 */
export function isForecastAtInFuture(forecastAt: string): boolean {
  return new Date(forecastAt).getTime() > Date.now();
}
