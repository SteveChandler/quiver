/**
 * Model wave forecast at a buoy's position, for display beside what the buoy
 * measured. Display only: nothing here reads or writes forecast tables.
 *
 * Same request shape as app/api/beaches/[id]/big-swells: ECMWF WAM via the
 * Open-Meteo marine API, because it returns peak period, the same measure as
 * the buoy's dominant period. The shared forecast client
 * (lib/services/noaa-wavewatch/api-client.ts) has no past_days or Next cache
 * option, and the forecast pipeline depends on it, so it is not reused here.
 */

import type { HourlyObservation } from "./series";

export const MODEL_NAME = "ECMWF WAM";
const MODEL_ID = "ecmwf_wam025";
const PAST_DAYS = 5;
const FORECAST_DAYS = 7;
/** Model runs land every 6-12 h; one fetch per buoy per 3 h is enough. */
const MODEL_CACHE_SECONDS = 10_800;
const HOUR_MS = 60 * 60 * 1000;

export interface ModelHour {
  t: number;
  hs: number | null;
  tp: number | null;
  dir: number | null;
}

export interface ModelSeries {
  /** Centre of the model grid cell Open-Meteo answered with. */
  gridLat: number;
  gridLon: number;
  hours: ModelHour[];
}

function finiteOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** Parse an Open-Meteo marine response; null when the cell has no wave data (land-masked). */
export function parseModelResponse(json: unknown): ModelSeries | null {
  if (!json || typeof json !== "object") return null;
  const body = json as {
    latitude?: unknown;
    longitude?: unknown;
    hourly?: { time?: unknown; wave_height?: unknown; wave_peak_period?: unknown; wave_direction?: unknown };
  };
  const times = Array.isArray(body.hourly?.time) ? (body.hourly?.time as unknown[]) : [];
  const hs = Array.isArray(body.hourly?.wave_height) ? (body.hourly?.wave_height as unknown[]) : [];
  const tp = Array.isArray(body.hourly?.wave_peak_period) ? (body.hourly?.wave_peak_period as unknown[]) : [];
  const dir = Array.isArray(body.hourly?.wave_direction) ? (body.hourly?.wave_direction as unknown[]) : [];
  const gridLat = finiteOrNull(body.latitude);
  const gridLon = finiteOrNull(body.longitude);
  if (gridLat === null || gridLon === null) return null;

  const hours: ModelHour[] = [];
  times.forEach((time, index) => {
    if (typeof time !== "string") return;
    const t = Date.parse(/(?:Z|[+-]\d\d:\d\d)$/.test(time) ? time : `${time}Z`);
    if (!Number.isFinite(t)) return;
    hours.push({ t, hs: finiteOrNull(hs[index]), tp: finiteOrNull(tp[index]), dir: finiteOrNull(dir[index]) });
  });
  if (!hours.some((hour) => hour.hs !== null)) return null;
  return { gridLat, gridLon, hours };
}

export function buildModelUrl(lat: number, lon: number): string {
  const url = new URL("https://marine-api.open-meteo.com/v1/marine");
  url.search = new URLSearchParams({
    latitude: lat.toFixed(3),
    longitude: lon.toFixed(3),
    hourly: "wave_height,wave_peak_period,wave_direction",
    models: MODEL_ID,
    past_days: String(PAST_DAYS),
    forecast_days: String(FORECAST_DAYS),
    timezone: "UTC",
  }).toString();
  return url.toString();
}

/** Returns null on any failure; the page hides the block. */
export async function fetchModelAtBuoy(
  lat: number,
  lon: number,
  fetchImpl: typeof fetch = fetch,
): Promise<ModelSeries | null> {
  try {
    const response = await fetchImpl(buildModelUrl(lat, lon), {
      signal: AbortSignal.timeout(8_000),
      next: { revalidate: MODEL_CACHE_SECONDS },
    } as RequestInit);
    if (!response.ok) {
      console.warn("[buoy-pages] Open-Meteo HTTP failure", { status: response.status });
      return null;
    }
    return parseModelResponse(await response.json());
  } catch (error) {
    console.warn("[buoy-pages] Open-Meteo request failed", {
      message: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

interface ModelComparison {
  matchedHours: number;
  /** Sum of model height over sum of observed height for matched hours. */
  ratio: number;
  meanObservedM: number;
  meanModelM: number;
}

const MIN_MATCHED_HOURS = 24;

/** Hour-by-hour comparison of model and buoy over the hours both have. */
export function compareModelToObserved(
  model: ModelSeries,
  observed: HourlyObservation[],
): ModelComparison | null {
  const modelByHour = new Map<number, number>();
  for (const hour of model.hours) if (hour.hs !== null) modelByHour.set(hour.t, hour.hs);
  let modelSum = 0;
  let observedSum = 0;
  let matched = 0;
  for (const obs of observed) {
    const modelHs = modelByHour.get(obs.t);
    if (modelHs === undefined) continue;
    modelSum += modelHs;
    observedSum += obs.hs;
    matched += 1;
  }
  if (matched < MIN_MATCHED_HOURS || observedSum <= 0) return null;
  return {
    matchedHours: matched,
    ratio: modelSum / observedSum,
    meanObservedM: observedSum / matched,
    meanModelM: modelSum / matched,
  };
}

/**
 * "The model ran 18% low against the buoy over the last 5 days." Within 10%
 * reads as tracking.
 */
export function describeComparison(comparison: ModelComparison | null): string | null {
  if (!comparison) return null;
  const days = Math.max(1, Math.round(comparison.matchedHours / 24));
  const span = days === 1 ? "the last day" : `the last ${days} days`;
  const percent = Math.round(Math.abs(comparison.ratio - 1) * 100);
  if (percent < 10) return `Over ${span}, the model tracked the buoy within 10%.`;
  const side = comparison.ratio < 1 ? "low" : "high";
  return `Over ${span}, the model ran ${percent}% ${side} against the buoy.`;
}

export interface ModelDayPeak {
  /** Local calendar day, "2026-11-12". */
  day: string;
  label: string;
  hs: number;
  tp: number | null;
  dir: number | null;
}

/** Largest model height for each local day after `afterMs` (the newest reading). */
export function modelDailyPeaks(model: ModelSeries, afterMs: number, timeZone: string): ModelDayPeak[] {
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" });
  const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone, weekday: "short", month: "short", day: "numeric" });
  const peaks = new Map<string, ModelDayPeak>();
  for (const hour of model.hours) {
    if (hour.t <= afterMs || hour.hs === null) continue;
    const day = dayKey.format(new Date(hour.t));
    const existing = peaks.get(day);
    if (existing && existing.hs >= hour.hs) continue;
    peaks.set(day, { day, label: dayLabel.format(new Date(hour.t)), hs: hour.hs, tp: hour.tp, dir: hour.dir });
  }
  return [...peaks.values()].sort((a, b) => a.day.localeCompare(b.day));
}

/** Hours within the chart window: from `fromMs` through the end of the forecast. */
export function modelHoursFrom(model: ModelSeries, fromMs: number): ModelHour[] {
  return model.hours.filter((hour) => hour.t >= fromMs - HOUR_MS);
}
