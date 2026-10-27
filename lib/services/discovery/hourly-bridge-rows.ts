/**
 * Where discovery surfaces fill hourly rows between the stored 3-hourly forecast rows.
 *
 * One rule for every reader of a surface's rows, so a bridged hour a request scored is the hour
 * its alignment, ids and windows describe:
 * - a scoped request (one forecastAt) bridges only the hours within 3 h of it, light ignored;
 * - an unscoped request bridges the hours in [startMs, endMs) that overlap usable light, by the
 *   same per-day light interval the selector's isDaylightInterval uses.
 * Stored rows are never dropped.
 */

import { bridgeForecastsHourly } from '@/lib/services/forecast/hourly-bridge';
import type { TideSeriesSample } from '@/lib/services/tide-series-loader';
import type { EnhancedForecastEntity } from '@/types/forecast';
import { usableLightIntervalForDate, type BeachSunTimes } from './daylight-eligibility';
import { getLocalDateStr } from './window-selector/time-slot-utils';

const HOUR_MS = 60 * 60 * 1000;
/** Covers a ±90 min alignment and the row end the scoped window reads. */
export const SCOPED_BRIDGE_RADIUS_MS = 3 * HOUR_MS;

interface BridgeForecastRowsOptions {
  /** Beach IANA timezone. */
  timezone: string;
  tide: readonly TideSeriesSample[] | null;
  /** The scoped hour; when set, light and the start/end bounds are ignored. */
  scopedAtMs?: number;
  sunTimes?: BeachSunTimes;
  /** Unscoped: bridge only hours at or after this instant. */
  startMs?: number;
  /** Unscoped: bridge only hours before this instant. */
  endMs?: number;
}

export function isBridgedForecast(row: EnhancedForecastEntity): boolean {
  return row.raw_forecast?.hourly_bridge != null;
}

/** One beach's rows with its bridged hours, in forecast_at order. */
export function bridgeBeachForecastRows(
  rows: readonly EnhancedForecastEntity[],
  options: BridgeForecastRowsOptions,
): EnhancedForecastEntity[] {
  const { timezone, tide, scopedAtMs, sunTimes, startMs, endMs } = options;
  if (scopedAtMs != null && Number.isFinite(scopedAtMs)) {
    return bridgeForecastsHourly(rows, tide, {
      timezone,
      startMs: scopedAtMs - SCOPED_BRIDGE_RADIUS_MS,
      endMs: scopedAtMs + SCOPED_BRIDGE_RADIUS_MS,
    });
  }
  // isDaylightInterval for a one-hour row, with each local day's light resolved once.
  const lightByDate = new Map<string, { start: Date; end: Date }>();
  const lightOf = (date: string): { start: Date; end: Date } => {
    let light = lightByDate.get(date);
    if (!light) {
      light = usableLightIntervalForDate(date, timezone, sunTimes);
      lightByDate.set(date, light);
    }
    return light;
  };
  const overlapsLight = (hourMs: number): boolean => {
    const firstDate = getLocalDateStr(new Date(hourMs), timezone);
    const lastDate = getLocalDateStr(new Date(hourMs + HOUR_MS - 1), timezone);
    return [...new Set([firstDate, lastDate])].some((date) => {
      const light = lightOf(date);
      return hourMs < light.end.getTime() && hourMs + HOUR_MS > light.start.getTime();
    });
  };
  return bridgeForecastsHourly(rows, tide, { timezone, startMs, endMs })
    .filter((row) => !isBridgedForecast(row) || overlapsLight(Date.parse(row.forecast_at)));
}

/** The tide read window for rows: one hour either side, so the series rate exists at the edges. */
export function tideWindowForRows(
  rows: Iterable<EnhancedForecastEntity>,
  scopedAtMs?: number,
): { startIso: string; endIso: string } | null {
  if (scopedAtMs != null && Number.isFinite(scopedAtMs)) {
    return {
      startIso: new Date(scopedAtMs - SCOPED_BRIDGE_RADIUS_MS - HOUR_MS).toISOString(),
      endIso: new Date(scopedAtMs + SCOPED_BRIDGE_RADIUS_MS + HOUR_MS).toISOString(),
    };
  }
  let minMs = Number.POSITIVE_INFINITY;
  let maxMs = Number.NEGATIVE_INFINITY;
  for (const row of rows) {
    const ms = Date.parse(row.forecast_at);
    if (!Number.isFinite(ms)) continue;
    if (ms < minMs) minMs = ms;
    if (ms > maxMs) maxMs = ms;
  }
  if (!Number.isFinite(minMs)) return null;
  return {
    startIso: new Date(minMs - HOUR_MS).toISOString(),
    endIso: new Date(maxMs + 2 * HOUR_MS).toISOString(),
  };
}
