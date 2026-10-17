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

import { getLocalHourFormatter } from '@/lib/services/discovery/window-selector/time-slot-utils';
import type { EnhancedForecastEntity } from '@/types/forecast';

// The conversion below builds two Intl formatters per call and is a pure
// function of its arguments, yet one bulk or regional request asks for the same
// few instants (each local day's 06:00 and 18:00 light bounds) thousands of
// times. Remembering the instant keeps the result identical and cut about two
// thirds of the CPU in local profiles of the 240 h bulk timeline and the
// regional forecast data load. Keys grow by a few per local day per timezone,
// so the map is cleared rather than left to grow for the life of a long-lived
// instance.
const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_CACHED_LOCAL_INSTANTS = 5000;
const localInstantMsByKey = new Map<string, number>();

/**
 * Convert a local date/time string in a given timezone to a UTC Date.
 *
 * `forecast_time` stores LOCAL time (e.g., "15:00:00" means 3pm Pacific),
 * so we find the corresponding UTC timestamp using the timezone offset in
 * effect at that instant (not at the wall time read as UTC).
 */
export function localDateTimeToUTC(dateStr: string, timeStr: string, tz: string): Date {
  const key = `${tz}|${dateStr}T${timeStr}`;
  const cachedMs = localInstantMsByKey.get(key);
  // Hand out a fresh Date each time: callers keep it as an interval bound.
  if (cachedMs !== undefined) return new Date(cachedMs);

  // An invalid timezone throws here, before anything is cached.
  const resolved = computeLocalDateTimeToUTC(dateStr, timeStr, tz);
  const resolvedMs = resolved.getTime();
  if (Number.isFinite(resolvedMs)) {
    if (localInstantMsByKey.size >= MAX_CACHED_LOCAL_INSTANTS) localInstantMsByKey.clear();
    localInstantMsByKey.set(key, resolvedMs);
  }
  return resolved;
}

const offsetFormatterByTz = new Map<string, Intl.DateTimeFormat>();

function offsetFormatter(tz: string): Intl.DateTimeFormat {
  const cached = offsetFormatterByTz.get(tz);
  if (cached) return cached;
  // An invalid timezone throws a RangeError here, before anything is cached.
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hourCycle: "h23",
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "numeric",
    minute: "numeric",
    second: "numeric",
  });
  offsetFormatterByTz.set(tz, formatter);
  return formatter;
}

/** UTC offset of `tz` at the instant `ms`, in ms (PST is -8 h). */
function utcOffsetMsAt(ms: number, tz: string): number {
  const wall: Record<string, number> = {};
  for (const part of offsetFormatter(tz).formatToParts(new Date(ms))) {
    if (part.type !== "literal") wall[part.type] = Number(part.value);
  }
  const wallAsUtc = Date.UTC(wall.year, wall.month - 1, wall.day, wall.hour, wall.minute, wall.second);
  return wallAsUtc - Math.floor(ms / 1000) * 1000;
}

function computeLocalDateTimeToUTC(dateStr: string, timeStr: string, tz: string): Date {
  offsetFormatter(tz);
  const wallAsUtcMs = Date.parse(`${dateStr}T${timeStr}Z`);
  if (!Number.isFinite(wallAsUtcMs)) return new Date(NaN);

  // The offset must be the one in effect at the resulting instant, not at the
  // wall time read as UTC: on a DST-change day those two instants straddle the
  // transition. Zones change offset at most once within a day either side, so
  // the two offsets around the wall time are the only candidates.
  const offsetBefore = utcOffsetMsAt(wallAsUtcMs - DAY_MS, tz);
  const offsetAfter = utcOffsetMsAt(wallAsUtcMs + DAY_MS, tz);
  if (offsetBefore === offsetAfter) return new Date(wallAsUtcMs - offsetBefore);
  const candidates = Array.from(new Set([offsetBefore, offsetAfter]))
    .map((offset) => ({ offset, instant: wallAsUtcMs - offset }))
    .filter(({ offset, instant }) => utcOffsetMsAt(instant, tz) === offset)
    .sort((left, right) => left.instant - right.instant);

  // Ambiguous wall time (clocks fell back): the first occurrence. Missing wall
  // time (clocks sprang forward): read it with the pre-transition offset, which
  // lands just after the gap, like Temporal's "compatible" mode.
  const resolvedMs = candidates[0]?.instant ?? wallAsUtcMs - offsetBefore;
  return new Date(resolvedMs);
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
        getLocalHourFormatter(beachTz).format(forecastAtDate),
        10
      );

      if (localHourOfForecastAt === forecastTimeHour) {
        // forecast_at is already proper UTC (local rendering matches forecast_time)
        return forecastAtDate;
      }

      // Check if forecast_time is UTC (matches forecast_at UTC hour directly)
      const forecastAtUtcHour = forecastAtDate.getUTCHours();
      if (forecastAtUtcHour === forecastTimeHour) {
        // forecast_time is in UTC, and forecast_at is proper UTC — use forecast_at directly
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
