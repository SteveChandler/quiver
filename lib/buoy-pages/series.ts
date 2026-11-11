/**
 * Observation history to chart series. Charts are anchored to the newest
 * reading, never to render time, so ISR output only changes with new data.
 */

import type { WaveStationObservationRow } from "@/lib/services/wave-stations/types";

const HOUR_MS = 60 * 60 * 1000;

/** Compact chart point; heights in metres, periods in seconds, directions in degrees. */
export interface TrendPoint {
  t: number;
  hs: number | null;
  dpd: number | null;
  mwd: number | null;
  swH: number | null;
  swP: number | null;
  swD: number | null;
  wwH: number | null;
  wwP: number | null;
}

function finiteOrNull(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function round(value: number | null, digits: number): number | null {
  if (value === null) return null;
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function mean(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  return present.reduce((sum, value) => sum + value, 0) / present.length;
}

/** Circular mean so 350° and 10° average to 0°, not 180°. */
function meanDirection(values: Array<number | null>): number | null {
  const present = values.filter((value): value is number => value !== null);
  if (present.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const degrees of present) {
    const radians = (degrees * Math.PI) / 180;
    x += Math.cos(radians);
    y += Math.sin(radians);
  }
  if (Math.abs(x) < 1e-9 && Math.abs(y) < 1e-9) return null;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Rows that carry a wave height, oldest first. */
function waveRows(rows: WaveStationObservationRow[]): WaveStationObservationRow[] {
  return rows
    .filter((row) => finiteOrNull(row.wave_height_m) !== null && Number.isFinite(Date.parse(row.observed_at)))
    .sort((a, b) => Date.parse(a.observed_at) - Date.parse(b.observed_at));
}

/**
 * Bucket wave rows into fixed UTC buckets (hourly by default) and average each
 * one. A 30-day page stays under ~720 points.
 */
export function buildTrendSeries(
  rows: WaveStationObservationRow[],
  bucketMs: number = HOUR_MS,
): TrendPoint[] {
  const buckets = new Map<number, WaveStationObservationRow[]>();
  for (const row of waveRows(rows)) {
    const key = Math.floor(Date.parse(row.observed_at) / bucketMs) * bucketMs;
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, bucket]) => ({
      t,
      hs: round(mean(bucket.map((row) => finiteOrNull(row.wave_height_m))), 2),
      dpd: round(mean(bucket.map((row) => finiteOrNull(row.dominant_period_s))), 1),
      mwd: round(meanDirection(bucket.map((row) => finiteOrNull(row.mean_wave_direction_deg))), 0),
      swH: round(mean(bucket.map((row) => finiteOrNull(row.swell_height_m))), 2),
      swP: round(mean(bucket.map((row) => finiteOrNull(row.swell_period_s))), 1),
      swD: round(meanDirection(bucket.map((row) => finiteOrNull(row.swell_direction_deg))), 0),
      wwH: round(mean(bucket.map((row) => finiteOrNull(row.wind_wave_height_m))), 2),
      wwP: round(mean(bucket.map((row) => finiteOrNull(row.wind_wave_period_s))), 1),
    }));
}

export type TrendDirection = "building" | "fading" | "steady";

export interface HeightTrend {
  direction: TrendDirection;
  /** Recent mean minus the mean 5-7 h earlier, metres. */
  deltaM: number;
}

const TREND_MIN_DELTA_M = 0.15;
const TREND_MIN_RATIO = 0.15;

/**
 * Six-hour height trend: mean of the last hour of readings against the mean
 * of readings 5-7 hours before the newest one. A change counts only when it is
 * at least 0.15 m and 15% of the earlier height; otherwise "steady". Returns
 * null when either window has no readings.
 */
export function computeHeightTrend(rows: WaveStationObservationRow[]): HeightTrend | null {
  const waves = waveRows(rows);
  const newest = waves[waves.length - 1];
  if (!newest) return null;
  const newestAt = Date.parse(newest.observed_at);
  const inWindow = (fromHoursAgo: number, toHoursAgo: number) =>
    waves
      .filter((row) => {
        const age = newestAt - Date.parse(row.observed_at);
        return age >= toHoursAgo * HOUR_MS && age <= fromHoursAgo * HOUR_MS;
      })
      .map((row) => row.wave_height_m as number);
  const recent = mean(inWindow(1, 0));
  const earlier = mean(inWindow(7, 5));
  if (recent === null || earlier === null) return null;
  const deltaM = recent - earlier;
  const threshold = Math.max(TREND_MIN_DELTA_M, TREND_MIN_RATIO * earlier);
  if (deltaM >= threshold) return { direction: "building", deltaM };
  if (deltaM <= -threshold) return { direction: "fading", deltaM };
  return { direction: "steady", deltaM };
}

export interface HourlyObservation {
  t: number;
  hs: number;
}

/**
 * Mean observed height per nearest whole hour, for matching against hourly
 * model output (model values are instants on the hour).
 */
export function hourlyObservedHeights(rows: WaveStationObservationRow[]): HourlyObservation[] {
  const buckets = new Map<number, number[]>();
  for (const row of waveRows(rows)) {
    const key = Math.round(Date.parse(row.observed_at) / HOUR_MS) * HOUR_MS;
    const bucket = buckets.get(key) ?? [];
    bucket.push(row.wave_height_m as number);
    buckets.set(key, bucket);
  }
  return [...buckets.entries()]
    .sort(([a], [b]) => a - b)
    .map(([t, values]) => ({ t, hs: values.reduce((sum, value) => sum + value, 0) / values.length }));
}

const SPLIT_ROW_MAX_LAG_MS = 90 * 60 * 1000;

function hasSplit(row: WaveStationObservationRow): boolean {
  return finiteOrNull(row.swell_height_m) !== null && finiteOrNull(row.wind_wave_height_m) !== null;
}

/**
 * The single row behind the "Now" block. The 15-minute latest feed stores a
 * reading before the hourly .spec check adds its swell split, so for a station
 * with a split the newest wave row often has none yet. Use the newest row that
 * carries the split when it is at most 90 minutes older than the newest wave
 * row; otherwise the newest wave row, shown without a split.
 */
export function selectNowObservation(
  hasSwellSplit: boolean,
  newestWave: WaveStationObservationRow | null,
  history: WaveStationObservationRow[],
): WaveStationObservationRow | null {
  if (!newestWave || !hasSwellSplit || hasSplit(newestWave)) return newestWave;
  const newestAt = Date.parse(newestWave.observed_at);
  const withSplit = waveRows(history)
    .filter((row) => hasSplit(row) && newestAt - Date.parse(row.observed_at) <= SPLIT_ROW_MAX_LAG_MS)
    .pop();
  return withSplit ?? newestWave;
}
