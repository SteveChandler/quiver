import type { ForecastHour } from "./types";

const HOUR_MS = 60 * 60 * 1000;
/** The forecast grid is 3-hourly; only its own gaps are filled, never a missing row. */
const MIN_EXPANDED_GAP_HOURS = 2;
const MAX_EXPANDED_GAP_HOURS = 3;
/** A NOAA sample counts for an hour only when the series brackets it this tightly. */
const MAX_TIDE_SAMPLE_GAP_MS = 2 * HOUR_MS;

export interface AlertTideSample {
  time: string;
  heightFt: number;
}

export interface HourlyExpansion {
  hours: ForecastHour[];
  maxWaveByForecastAt: Map<string, number>;
}

function lerp(a: number | null, b: number | null, t: number): number | null {
  if (a == null || b == null) return null;
  return a + (b - a) * t;
}

function lerpDegrees(a: number | null, b: number | null, t: number): number | null {
  if (a == null || b == null) return null;
  const delta = ((((b - a) % 360) + 540) % 360) - 180;
  return (a + delta * t + 360) % 360;
}

function tideStatusFromSlope(slope: number, fallback: string | null): string | null {
  if (slope > 0) return "Rising";
  if (slope < 0) return "Falling";
  return fallback;
}

/** Height at `ms` from samples that bracket it within MAX_TIDE_SAMPLE_GAP_MS, else null. */
function sampledTide(samples: { ms: number; heightFt: number }[], ms: number): number | null {
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.ms === ms) return s.heightFt;
    const next = samples[i + 1];
    if (next && s.ms < ms && ms < next.ms) {
      if (next.ms - s.ms > MAX_TIDE_SAMPLE_GAP_MS) return null;
      return s.heightFt + (next.heightFt - s.heightFt) * ((ms - s.ms) / (next.ms - s.ms));
    }
  }
  return null;
}

function applyTideSamples(hours: ForecastHour[], tideSamples: AlertTideSample[] | null | undefined): ForecastHour[] {
  if (!tideSamples || tideSamples.length === 0) return hours;
  const samples = tideSamples
    .map((s) => ({ ms: Date.parse(s.time), heightFt: s.heightFt }))
    .filter((s) => Number.isFinite(s.ms) && Number.isFinite(s.heightFt))
    .sort((a, b) => a.ms - b.ms);
  return hours.map((hour) => {
    const ms = Date.parse(hour.forecast_at);
    const height = sampledTide(samples, ms);
    if (height == null) return hour;
    const before = sampledTide(samples, ms - HOUR_MS);
    const after = sampledTide(samples, ms + HOUR_MS);
    const slope = before != null && after != null ? after - before : after != null ? after - height : before != null ? height - before : 0;
    return { ...hour, tide_height: height, tide_status: tideStatusFromSlope(slope, hour.tide_status) };
  });
}

/**
 * Expands 3-hourly forecast rows to hourly so alert windows describe the real stretch of
 * qualifying surf. Mirrors the native app's hourly rows (quiver-native hourly-forecast-rows.ts):
 * linear magnitudes, circular directions, nearest-row text, and only whole-hour gaps of 2–3 h.
 */
export function expandForecastHoursToHourly(input: {
  hours: ForecastHour[];
  maxWaveByForecastAt: Map<string, number>;
  tideSamples?: AlertTideSample[] | null;
}): HourlyExpansion {
  const sorted = [...input.hours].sort((a, b) => Date.parse(a.forecast_at) - Date.parse(b.forecast_at));
  const maxWave = new Map(input.maxWaveByForecastAt);
  const out: ForecastHour[] = [];
  for (let i = 0; i < sorted.length; i++) {
    const from = sorted[i];
    out.push(from);
    const to = sorted[i + 1];
    if (!to) continue;
    const gapHours = (Date.parse(to.forecast_at) - Date.parse(from.forecast_at)) / HOUR_MS;
    if (!Number.isInteger(gapHours) || gapHours < MIN_EXPANDED_GAP_HOURS || gapHours > MAX_EXPANDED_GAP_HOURS) continue;
    const fromMax = maxWave.get(from.forecast_at) ?? from.wave_height;
    const toMax = maxWave.get(to.forecast_at) ?? to.wave_height;
    for (let k = 1; k < gapHours; k++) {
      const t = k / gapHours;
      const nearest = t < 0.5 ? from : to;
      const forecastAt = new Date(Date.parse(from.forecast_at) + k * HOUR_MS).toISOString();
      const tide = lerp(from.tide_height, to.tide_height, t);
      const tideSlope = from.tide_height != null && to.tide_height != null ? to.tide_height - from.tide_height : 0;
      out.push({
        forecast_id: nearest.forecast_id,
        forecast_at: forecastAt,
        wave_height: lerp(from.wave_height, to.wave_height, t),
        wave_period: lerp(from.wave_period, to.wave_period, t),
        wave_direction: nearest.wave_direction,
        swell_1_height: lerp(from.swell_1_height, to.swell_1_height, t),
        swell_1_period: lerp(from.swell_1_period, to.swell_1_period, t),
        swell_1_direction: lerpDegrees(from.swell_1_direction, to.swell_1_direction, t),
        wind_speed: lerp(from.wind_speed, to.wind_speed, t),
        wind_direction_deg: lerpDegrees(from.wind_direction_deg, to.wind_direction_deg, t),
        tide_height: tide,
        tide_status: tideStatusFromSlope(tideSlope, nearest.tide_status),
      });
      const interpolatedMax = lerp(fromMax, toMax, t);
      if (interpolatedMax != null) maxWave.set(forecastAt, interpolatedMax);
    }
  }
  return { hours: applyTideSamples(out, input.tideSamples), maxWaveByForecastAt: maxWave };
}
