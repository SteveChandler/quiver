/**
 * Timezone Utilities
 *
 * Helper functions for timezone-aware operations, particularly for
 * determining local time at beach locations for filtering and display.
 *
 * Uses geo-tz for coordinate-to-timezone lookup (offline, no API calls).
 *
 * @module lib/utils/timezone-utils
 */

import { find } from 'geo-tz';

/**
 * Default timezone fallback for when coordinates are missing or invalid
 */
const DEFAULT_TIMEZONE = 'America/Los_Angeles';

/**
 * Get the timezone for a given lat/lon coordinate
 *
 * Uses geo-tz library which includes embedded timezone boundary data,
 * so no external API calls are needed.
 *
 * @param lat - Latitude coordinate
 * @param lon - Longitude coordinate
 * @returns IANA timezone identifier (e.g., 'America/Los_Angeles', 'Pacific/Honolulu')
 *
 * @example
 * getTimezoneFromCoords(32.7157, -117.1611) // San Diego → 'America/Los_Angeles'
 * getTimezoneFromCoords(21.3069, -157.8583) // Honolulu → 'Pacific/Honolulu'
 * getTimezoneFromCoords(25.7617, -80.1918)  // Miami → 'America/New_York'
 */
export function getTimezoneFromCoords(lat: number, lon: number): string {
  // Handle missing or invalid coordinates
  if (!lat || !lon || !isFinite(lat) || !isFinite(lon)) {
    console.warn(
      `⚠️ [getTimezoneFromCoords] Invalid coordinates (${lat}, ${lon}), using fallback: ${DEFAULT_TIMEZONE}`
    );
    return DEFAULT_TIMEZONE;
  }

  try {
    const timezones = find(lat, lon);
    if (timezones.length === 0) {
      console.warn(
        `⚠️ [getTimezoneFromCoords] No timezone found for (${lat}, ${lon}), using fallback: ${DEFAULT_TIMEZONE}`
      );
      return DEFAULT_TIMEZONE;
    }
    return timezones[0];
  } catch (error) {
    console.error(`❌ [getTimezoneFromCoords] Error looking up timezone:`, error);
    return DEFAULT_TIMEZONE;
  }
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
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
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

