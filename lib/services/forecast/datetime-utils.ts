/**
 * Date/Time Normalization Utilities
 *
 * Functions for normalizing dates and times to forecast grid intervals.
 */

/**
 * Get normalized date string (YYYY-MM-DD) in local timezone
 */
export function getNormalizedDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Get normalized time string rounded to 3-hour intervals
 *
 * Valid times: 00:00:00, 03:00:00, 06:00:00, 09:00:00,
 *              12:00:00, 15:00:00, 18:00:00, 21:00:00
 */
export function getNormalizedTimeString(date: Date): string {
  const currentHour = date.getHours();
  const roundedHour = Math.floor(currentHour / 3) * 3;
  const hours = String(roundedHour).padStart(2, "0");
  return `${hours}:00:00`;
}
