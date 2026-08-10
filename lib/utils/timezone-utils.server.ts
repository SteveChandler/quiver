/**
 * Timezone Utilities (server-only)
 *
 * Uses geo-tz for coordinate-to-timezone lookup (offline, no API calls).
 *
 * IMPORTANT: geo-tz depends on Node built-ins like `fs`, so this module must
 * never be imported from client components or any code that can be bundled for
 * the browser.
 */

import { find } from "geo-tz/now";
import { DEFAULT_TIMEZONE } from "./timezone-constants";

export { DEFAULT_TIMEZONE } from "./timezone-constants";
export { getLocalHour, isNightHour } from "./timezone-utils.shared";

/**
 * Resolve a coordinate timezone without substituting a geographic default.
 * Use this when timezone is part of persisted location truth.
 */
export function findTimezoneFromCoords(lat: number, lon: number): string | null {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lon) ||
    lat < -90 ||
    lat > 90 ||
    lon < -180 ||
    lon > 180
  ) {
    return null;
  }

  try {
    const timezone = find(lat, lon)[0];
    if (!timezone) return null;
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return timezone;
  } catch {
    return null;
  }
}

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
