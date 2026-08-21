/**
 * Timezone Utilities (server-only)
 *
 * Uses geo-tz for coordinate-to-timezone lookup (offline, no API calls).
 *
 * IMPORTANT: geo-tz depends on Node built-ins like `fs`, so this module must
 * never be imported from client components or any code that can be bundled for
 * the browser.
 */

import { find as findCanonical } from "geo-tz";
import { find } from "geo-tz/now";
import { DEFAULT_TIMEZONE } from "./timezone-constants";

export { DEFAULT_TIMEZONE } from "./timezone-constants";
export { getLocalHour, isNightHour } from "./timezone-utils.shared";

type ZoneLookup = (lat: number, lon: number) => string[];

function resolveZone(
  lookup: ZoneLookup,
  lat: number,
  lon: number
): string | null {
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
    const timezone = lookup(lat, lon)[0];
    if (!timezone) return null;
    new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date(0));
    return timezone;
  } catch {
    return null;
  }
}

/**
 * Resolve a coordinate timezone without substituting a geographic default.
 * Use this when timezone is part of persisted location truth.
 *
 * Uses the offset-merged `geo-tz/now` dataset — right for local-time math, wrong
 * for anything persisted. Use `findCanonicalTimezoneFromCoords` for writes.
 */
export function findTimezoneFromCoords(lat: number, lon: number): string | null {
  return resolveZone(find, lat, lon);
}

/**
 * Resolve the CANONICAL IANA zone for a coordinate, for values written to the
 * database.
 *
 * `geo-tz/now` merges zones that currently share an offset: it returns
 * 'America/Caracas' for Puerto Rico and 'America/Los_Angeles' for Baja
 * California. The full dataset used here returns 'America/Puerto_Rico' and
 * 'America/Tijuana'.
 *
 * Returns null rather than a default: a beach whose coordinates cannot be
 * resolved should be rejected, not silently filed in Pacific time. That silent
 * default is what put 9 Gulf Coast and Long Island beaches 2-3 hours off until
 * the 2026-08-20 repair.
 */
export function findCanonicalTimezoneFromCoords(
  lat: number,
  lon: number
): string | null {
  return resolveZone(findCanonical, lat, lon);
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
