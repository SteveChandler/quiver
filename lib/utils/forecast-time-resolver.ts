/**
 * Shared utility for resolving forecast times across timezone conventions.
 *
 * The database has two conventions for forecast times:
 * 1. **Proper UTC**: `forecast_at` is real UTC; rendering it in the beach
 *    timezone yields the same hour as `forecast_time`.
 * 2. **Legacy local-as-UTC**: `forecast_at` encodes local time with a `Z`
 *    suffix (e.g., `"2026-01-14T15:00:00Z"` for 3pm PST). In this case
 *    the UTC hours of `forecast_at` match `forecast_time` directly.
 *
 * The heuristic is reliable for all Americas timezones (UTC-4 through
 * UTC-10) because a non-zero UTC offset guarantees the two conventions
 * produce different hours. For UTC+0 beaches (not currently in scope),
 * both conventions yield the same result, so the heuristic is safe but
 * trivially true.
 *
 * @module lib/utils/forecast-time-resolver
 */

import type { EnhancedForecastEntity } from '@/types/forecast';

/**
 * Convert a local date/time string in a given timezone to a UTC Date.
 *
 * `forecast_time` stores LOCAL time (e.g., "15:00:00" means 3pm Pacific),
 * so we find the corresponding UTC timestamp by calculating the timezone
 * offset at that approximate time.
 */
export function localDateTimeToUTC(dateStr: string, timeStr: string, tz: string): Date {
  // Create a naive Date treating the local time as if it were UTC
  const naiveUtc = new Date(`${dateStr}T${timeStr}Z`);

  // Determine the timezone offset at this approximate time:
  // Compare the UTC representation vs the local representation of the same instant
  const utcRepr = naiveUtc.toLocaleString("en-US", { timeZone: "UTC" });
  const localRepr = naiveUtc.toLocaleString("en-US", { timeZone: tz });
  const utcDate = new Date(utcRepr);
  const localDate = new Date(localRepr);
  const offsetMs = utcDate.getTime() - localDate.getTime();

  // Shift by the offset: if tz is PST (UTC-8), offsetMs = +8h,
  // so naiveUtc + 8h converts "15:00 local" → "23:00 UTC"
  return new Date(naiveUtc.getTime() + offsetMs);
}

/**
 * Resolve the forecastTime for a forecast entity.
 *
 * When `beachTz` is provided, applies the two-convention heuristic to
 * determine whether `forecast_at` is proper UTC or legacy local-as-UTC.
 * Without a timezone, falls back to treating `forecast_at` as UTC directly.
 */
export function resolveForecastTime(
  forecast: EnhancedForecastEntity,
  beachTz?: string
): Date {
  if (forecast.forecast_date && forecast.forecast_time && beachTz) {
    const forecastAtDate = new Date(forecast.forecast_at);
    const forecastTimeHour = parseInt(forecast.forecast_time.split(':')[0], 10);

    // Check if forecast_at is already proper UTC: format it in beach TZ
    // and see if the local hour matches forecast_time
    try {
      const localHourOfForecastAt = parseInt(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: beachTz,
        }).format(forecastAtDate),
        10
      );

      if (localHourOfForecastAt === forecastTimeHour) {
        // forecast_at is already proper UTC (local rendering matches forecast_time)
        return forecastAtDate;
      }
    } catch {
      // Fall through to local interpretation
    }

    // forecast_at encodes local time as UTC — convert properly
    return localDateTimeToUTC(forecast.forecast_date, forecast.forecast_time, beachTz);
  }

  // No timezone available or no legacy fields — parse forecast_at as UTC
  return new Date(forecast.forecast_at);
}
