/**
 * Timezone utilities shared by the client-safe and server-only modules.
 *
 * This module uses only the platform Intl API so it can be imported into
 * browser bundles without shipping geographic timezone boundary data.
 */

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
 * Check if an hour is during nighttime (unrealistic for surfing).
 *
 * Night hours are defined as 9 PM to 5 AM (21:00 - 04:59).
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
