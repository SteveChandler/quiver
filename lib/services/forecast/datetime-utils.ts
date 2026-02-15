/**
 * Date/Time Normalization Utilities
 *
 * Functions for normalizing dates and times to forecast grid intervals.
 */

/**
 * Get a normalized forecast_at ISO 8601 UTC timestamp rounded to 3-hour intervals.
 *
 * Uses UTC methods to avoid server-timezone dependency.
 * This replaces the old pattern of getNormalizedDateString + getNormalizedTimeString.
 *
 * Valid output hours: 00, 03, 06, 09, 12, 15, 18, 21 (all UTC)
 */
export function getNormalizedForecastAt(date: Date): string {
  const roundedHour = Math.floor(date.getUTCHours() / 3) * 3;
  const d = new Date(date);
  d.setUTCHours(roundedHour, 0, 0, 0);
  return d.toISOString().replace(".000Z", "Z");
}

/**
 * Get normalized date string (YYYY-MM-DD) in UTC.
 * @deprecated Use getNormalizedForecastAt() which returns a full ISO 8601 timestamptz.
 */
export function getNormalizedDateString(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get normalized time string rounded to 3-hour intervals.
 * @deprecated Use getNormalizedForecastAt() which returns a full ISO 8601 timestamptz.
 *
 * Valid times: 00:00:00, 03:00:00, 06:00:00, 09:00:00,
 *              12:00:00, 15:00:00, 18:00:00, 21:00:00
 */
export function getNormalizedTimeString(date: Date): string {
  const currentHour = date.getUTCHours();
  const roundedHour = Math.floor(currentHour / 3) * 3;
  const hours = String(roundedHour).padStart(2, "0");
  return `${hours}:00:00`;
}
