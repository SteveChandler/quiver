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
 * Resolve a beach timezone to a concrete IANA timezone string.
 * Centralises the `tz || DEFAULT_TIMEZONE` fallback so callers never
 * have to repeat it.
 */
export function resolveBeachTimezone(tz?: string | null): string {
  return tz || DEFAULT_TIMEZONE;
}

/**
 * Get a YYYY-MM-DD date string for a given Date in a specific timezone.
 *
 * This is used anywhere we need "today" semantics aligned to a beach's local
 * timezone (e.g., Surf Intel). This avoids UTC date rollovers causing false
 * "not available" states late afternoon local time.
 */
export function getLocalDateString(
  date: Date,
  timezone?: string | null
): string {
  const tz = timezone || DEFAULT_TIMEZONE;

  try {
    // Use formatToParts to avoid locale-dependent ordering.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(date);

    const year = parts.find((p) => p.type === "year")?.value;
    const month = parts.find((p) => p.type === "month")?.value;
    const day = parts.find((p) => p.type === "day")?.value;

    if (!year || !month || !day) {
      throw new Error("Missing date parts");
    }

    return `${year}-${month}-${day}`;
  } catch (error) {
    console.error(
      `❌ [getLocalDateString] Error converting to timezone ${tz}:`,
      error
    );
    // Fallback to local machine date.
    const d = date;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }
}

/**
 * Client-safe fallback for coordinate-to-timezone lookup.
 *
 * We cannot derive timezone from coordinates in the browser without shipping
 * heavy boundary data or calling an external API, so we return a safe default.
 */
function getTimezoneFromCoords(_lat: number, _lon: number): string {
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
 * Night hours are defined as 9 PM to 5 AM (21:00 - 04:59)
 * This allows for:
 * - Dawn patrol sessions starting around 5-6 AM
 * - Evening glass-off sessions until sunset (varies by season, ~8 PM in summer)
 *
 * @param hour - Hour of the day (0-23)
 * @returns true if the hour is during nighttime
 */
export function isNightHour(hour: number): boolean {
  return hour >= 21 || hour < 5;
}


