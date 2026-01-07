/**
 * Timezone Utilities (client-safe)
 *
 * IMPORTANT: Do NOT import `geo-tz` here (it depends on Node `fs` and breaks
 * client bundling). Server-only callers should import from
 * `lib/utils/timezone-utils.server.ts`.
 */

/**
 * Default timezone fallback for when timezone is unknown.
 */
export const DEFAULT_TIMEZONE = "America/Los_Angeles";

/**
 * Client-safe fallback for coordinate-to-timezone lookup.
 *
 * We cannot derive timezone from coordinates in the browser without shipping
 * heavy boundary data or calling an external API, so we return a safe default.
 */
export function getTimezoneFromCoords(_lat: number, _lon: number): string {
  return DEFAULT_TIMEZONE;
}

/**
 * Get the local hour (0-23) for a date in a specific timezone
 *
 * Uses Intl.DateTimeFormat for reliable timezone conversion without
 * requiring additional dependencies like date-fns-tz.
 *
 * @param date - The Date object to get the hour from
 * @param timezone - IANA timezone identifier
 * @returns Hour of the day (0-23) in the specified timezone
 *
 * @example
 * // If date is 2025-11-25T09:00:00Z (9 AM UTC):
 * getLocalHour(date, 'America/Los_Angeles') // → 1 (1 AM Pacific)
 * getLocalHour(date, 'America/New_York')    // → 4 (4 AM Eastern)
 * getLocalHour(date, 'Pacific/Honolulu')    // → 23 (11 PM Hawaii, previous day)
 */
export function getLocalHour(date: Date, timezone: string): number {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      hour12: false,
    });

    const hourStr = formatter.format(date);
    // Intl returns "24" for midnight in some locales, normalize to 0
    const hour = parseInt(hourStr, 10);
    return hour === 24 ? 0 : hour;
  } catch (error) {
    console.error(
      `❌ [getLocalHour] Error converting to timezone ${timezone}:`,
      error
    );
    // Fallback to UTC hour
    return date.getUTCHours();
  }
}

/**
 * Check if an hour is during nighttime (unrealistic for surfing)
 *
 * Night hours are defined as 6 PM to 6 AM (18:00 - 05:59)
 * This conservative cutoff accounts for winter sunset times and
 * ensures recommendations are for daylight hours year-round.
 *
 * @param hour - Hour of the day (0-23)
 * @returns true if the hour is during nighttime
 */
export function isNightHour(hour: number): boolean {
  return hour >= 18 || hour < 6;
}

/**
 * Check if a forecast time is during nighttime at a beach location
 *
 * Combines coordinate-to-timezone lookup and night hour check
 * into a single convenience function.
 *
 * @param forecastDate - Forecast date string (YYYY-MM-DD)
 * @param forecastTime - Forecast time string (HH:MM:SS)
 * @param beachLat - Beach latitude
 * @param beachLon - Beach longitude
 * @returns true if the forecast time is during nighttime at the beach
 *
 * @example
 * // Check if 09:00:00 UTC is nighttime at San Diego
 * isNightTimeAtBeach('2025-11-25', '09:00:00', 32.7157, -117.1611) // → true (1 AM Pacific)
 */
export function isNightTimeAtBeach(
  forecastDate: string,
  forecastTime: string,
  beachLat: number,
  beachLon: number
): boolean {
  const beachTz = getTimezoneFromCoords(beachLat, beachLon);
  // Parse as UTC since forecast times are stored in UTC
  const utcDate = new Date(`${forecastDate}T${forecastTime}Z`);
  const localHour = getLocalHour(utcDate, beachTz);
  return isNightHour(localHour);
}

