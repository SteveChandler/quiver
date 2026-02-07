/**
 * Timezone Utilities (server-only)
 *
 * Uses geo-tz for coordinate-to-timezone lookup (offline, no API calls).
 *
 * IMPORTANT: geo-tz depends on Node built-ins like `fs`, so this module must
 * never be imported from client components or any code that can be bundled for
 * the browser.
 */

import { find } from "geo-tz";

/**
 * Default timezone fallback for when coordinates are missing or invalid
 */
const DEFAULT_TIMEZONE = "America/Los_Angeles";

/**
 * Get the timezone for a given lat/lon coordinate.
 */
export function getTimezoneFromCoords(lat: number, lon: number): string {
  // Handle missing or invalid coordinates
  if (!lat || !lon || !isFinite(lat) || !isFinite(lon)) {
    return DEFAULT_TIMEZONE;
  }

  try {
    const timezones = find(lat, lon);
    if (timezones.length === 0) {
      return DEFAULT_TIMEZONE;
    }
    return timezones[0];
  } catch {
    return DEFAULT_TIMEZONE;
  }
}

/**
 * Get the local hour (0-23) for a date in a specific timezone.
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
  } catch {
    return date.getUTCHours();
  }
}

/**
 * Check if an hour is during nighttime (unrealistic for surfing).
 *
 * Night hours are defined as 9 PM to 5 AM (21:00 - 04:59).
 * This allows for:
 * - Dawn patrol sessions starting around 5-6 AM
 * - Evening glass-off sessions until sunset (varies by season, ~8 PM in summer)
 */
export function isNightHour(hour: number): boolean {
  return hour >= 21 || hour < 5;
}



