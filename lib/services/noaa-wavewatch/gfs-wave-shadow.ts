import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { createContextLogger } from "@/lib/logger";
import { getNormalizedForecastAt } from "@/lib/services/forecast/datetime-utils";
import { FORECAST_CONFIG } from "./constants";
import { fetchOpenMeteoData, type OpenMeteoFetchOptions } from "./api-client";
import { numberOrNull, openMeteoTimeToDate } from "./data-processors";
import type { OpenMeteoMarineResponse } from "./types";

const log = createContextLogger("GfsWaveShadow");

export const GFS_WAVE_SHADOW_MODEL = "ncep_gfswave016";
export const GFS_WAVE_SHADOW_SOURCE = "open_meteo";
export const GFS_WAVE_SHADOW_TABLE = "gfs_wave_shadow_forecasts";
// Disabled 2026-06-18 while mixed-swell promotion is paused. Re-enable only
// with Seaside's DEFAULT_PROMOTION_ENABLED in mixed_swell_shadow.py.
export const GFS_WAVE_SHADOW_CAPTURE_DISABLED = true;

export type GfsWaveShadowCaptureStatus =
  | "ok"
  | "all_zero_wave_height"
  | "missing_wave_height";

export interface GfsWaveShadowPoint {
  timestamp: string;
  source_model: string;
  source: typeof GFS_WAVE_SHADOW_SOURCE;
  capture_status: GfsWaveShadowCaptureStatus;
  wave_height_m: number | null;
  wave_period_s: number | null;
  wave_direction_deg: number | null;
  wave_peak_period_s: number | null;
  swell_height_m: number | null;
  swell_period_s: number | null;
  swell_direction_deg: number | null;
  swell_wave_peak_period_s: number | null;
  wind_wave_height_m: number | null;
  wind_wave_period_s: number | null;
  wind_wave_direction_deg: number | null;
  wind_wave_peak_period_s: number | null;
  secondary_swell_height_m: number | null;
  secondary_swell_period_s: number | null;
  secondary_swell_direction_deg: number | null;
  tertiary_swell_height_m: number | null;
  tertiary_swell_period_s: number | null;
  tertiary_swell_direction_deg: number | null;
}

export interface GfsWaveShadowForecast {
  source_model: string;
  source: typeof GFS_WAVE_SHADOW_SOURCE;
  fetched_at: string;
  all_zero_wave_height: boolean;
  points: GfsWaveShadowPoint[];
}

export interface GfsWaveShadowRow extends Omit<GfsWaveShadowPoint, "timestamp"> {
  beach_id: string;
  predicted_at: string;
  forecast_horizon_hours: number;
  fetched_at: string;
}

function valueAt(values: unknown[] | undefined, index: number): number | null {
  return numberOrNull(values?.[index]);
}

function nullGfsValues(): Pick<
  GfsWaveShadowPoint,
  | "wave_height_m"
  | "wave_period_s"
  | "wave_direction_deg"
  | "wave_peak_period_s"
  | "swell_height_m"
  | "swell_period_s"
  | "swell_direction_deg"
  | "swell_wave_peak_period_s"
  | "wind_wave_height_m"
  | "wind_wave_period_s"
  | "wind_wave_direction_deg"
  | "wind_wave_peak_period_s"
  | "secondary_swell_height_m"
  | "secondary_swell_period_s"
  | "secondary_swell_direction_deg"
  | "tertiary_swell_height_m"
  | "tertiary_swell_period_s"
  | "tertiary_swell_direction_deg"
> {
  return {
    wave_height_m: null,
    wave_period_s: null,
    wave_direction_deg: null,
    wave_peak_period_s: null,
    swell_height_m: null,
    swell_period_s: null,
    swell_direction_deg: null,
    swell_wave_peak_period_s: null,
    wind_wave_height_m: null,
    wind_wave_period_s: null,
    wind_wave_direction_deg: null,
    wind_wave_peak_period_s: null,
    secondary_swell_height_m: null,
    secondary_swell_period_s: null,
    secondary_swell_direction_deg: null,
    tertiary_swell_height_m: null,
    tertiary_swell_period_s: null,
    tertiary_swell_direction_deg: null,
  };
}

export function isGfsWaveShadowCaptureEnabled(): boolean {
  // GFS_WAVE_SHADOW_CAPTURE_DISABLED is the only control. A
  // GFS_WAVE_SHADOW_CAPTURE_ENABLED env var used to be consulted here, but the
  // constant short-circuited it, so the var could never turn capture on and
  // reading it only implied a switch that did not exist.
  return !GFS_WAVE_SHADOW_CAPTURE_DISABLED;
}

export function isAllZeroWaveHeightPayload(
  payload: OpenMeteoMarineResponse | null | undefined,
): boolean {
  const values = payload?.hourly?.wave_height ?? [];
  const numericValues = values
    .map((value) => numberOrNull(value))
    .filter((value): value is number => value != null);

  return numericValues.length > 0 && numericValues.every((value) => value === 0);
}

export function buildGfsWaveShadowForecast(
  payload: OpenMeteoMarineResponse | null,
  options: {
    model?: string;
    forecastDays: number;
    fetchedAt?: Date;
  },
): GfsWaveShadowForecast | null {
  const hourly = payload?.hourly;
  if (!hourly?.time?.length) return null;

  const model = options.model ?? GFS_WAVE_SHADOW_MODEL;
  const allZeroWaveHeight = isAllZeroWaveHeightPayload(payload);
  const stepHours = FORECAST_CONFIG.FORECAST_INTERVAL_HOURS;
  const maxForecasts = Math.min(
    options.forecastDays * FORECAST_CONFIG.FORECASTS_PER_DAY,
    Math.floor(hourly.time.length / stepHours),
  );
  const fetchedAt = (options.fetchedAt ?? new Date()).toISOString();
  const points: GfsWaveShadowPoint[] = [];

  for (let step = 0; step < maxForecasts; step += 1) {
    const index = step * stepHours;
    const forecastTime = openMeteoTimeToDate(hourly.time[index]);
    if (!forecastTime) continue;

    const timestamp = forecastTime.toISOString();
    const waveHeight = valueAt(hourly.wave_height, index);
    const captureStatus: GfsWaveShadowCaptureStatus = allZeroWaveHeight
      ? "all_zero_wave_height"
      : waveHeight == null
        ? "missing_wave_height"
        : "ok";

    points.push({
      timestamp,
      source_model: model,
      source: GFS_WAVE_SHADOW_SOURCE,
      capture_status: captureStatus,
      ...(captureStatus === "ok"
        ? {
            wave_height_m: waveHeight,
            wave_period_s: valueAt(hourly.wave_period, index),
            wave_direction_deg: valueAt(hourly.wave_direction, index),
            wave_peak_period_s: valueAt(hourly.wave_peak_period, index),
            swell_height_m: valueAt(hourly.swell_wave_height, index),
            swell_period_s: valueAt(hourly.swell_wave_period, index),
            swell_direction_deg: valueAt(hourly.swell_wave_direction, index),
            swell_wave_peak_period_s: valueAt(
              hourly.swell_wave_peak_period,
              index,
            ),
            wind_wave_height_m: valueAt(hourly.wind_wave_height, index),
            wind_wave_period_s: valueAt(hourly.wind_wave_period, index),
            wind_wave_direction_deg: valueAt(hourly.wind_wave_direction, index),
            wind_wave_peak_period_s: valueAt(
              hourly.wind_wave_peak_period,
              index,
            ),
            secondary_swell_height_m: valueAt(
              hourly.secondary_swell_wave_height,
              index,
            ),
            secondary_swell_period_s: valueAt(
              hourly.secondary_swell_wave_period,
              index,
            ),
            secondary_swell_direction_deg: valueAt(
              hourly.secondary_swell_wave_direction,
              index,
            ),
            tertiary_swell_height_m: valueAt(
              hourly.tertiary_swell_wave_height,
              index,
            ),
            tertiary_swell_period_s: valueAt(
              hourly.tertiary_swell_wave_period,
              index,
            ),
            tertiary_swell_direction_deg: valueAt(
              hourly.tertiary_swell_wave_direction,
              index,
            ),
          }
        : nullGfsValues()),
    });
  }

  return {
    source_model: model,
    source: GFS_WAVE_SHADOW_SOURCE,
    fetched_at: fetchedAt,
    all_zero_wave_height: allZeroWaveHeight,
    points,
  };
}

function slotMs(date: Date): number {
  const stepMs = FORECAST_CONFIG.FORECAST_INTERVAL_HOURS * 60 * 60 * 1000;
  return Math.floor(date.getTime() / stepMs) * stepMs;
}

function pointsBySlot(shadow: GfsWaveShadowForecast): Map<number, GfsWaveShadowPoint> {
  const out = new Map<number, GfsWaveShadowPoint>();
  for (const point of shadow.points) {
    out.set(slotMs(new Date(point.timestamp)), point);
  }
  return out;
}

export function buildGfsWaveShadowRows(params: {
  beachId: string;
  generatedAt: Date;
  forecastTimes: Date[];
  shadow: GfsWaveShadowForecast | null;
}): GfsWaveShadowRow[] {
  if (!params.shadow) return [];

  const bySlot = pointsBySlot(params.shadow);
  const rows: GfsWaveShadowRow[] = [];

  for (const forecastTime of params.forecastTimes) {
    const forecastHorizonHours = Math.max(
      0,
      Math.round(
        (forecastTime.getTime() - params.generatedAt.getTime()) /
          (60 * 60 * 1000),
      ),
    );
    if (forecastHorizonHours > 168) continue;

    const point = bySlot.get(slotMs(forecastTime));
    if (!point) continue;
    if (point.capture_status !== "ok") continue;

    const { timestamp: _timestamp, ...rowValues } = point;
    rows.push({
      beach_id: params.beachId,
      predicted_at: getNormalizedForecastAt(forecastTime),
      forecast_horizon_hours: forecastHorizonHours,
      fetched_at: params.shadow.fetched_at,
      ...rowValues,
    });
  }

  return rows;
}

export function mapGfsWaveShadowRowsForInsert(
  rows: GfsWaveShadowRow[],
): Array<Record<string, unknown>> {
  return rows.map((row) => ({ ...row }));
}

export async function fetchGfsWaveShadowForecast(
  latitude: number,
  longitude: number,
  days: number,
  options: { signal?: AbortSignal } = {},
): Promise<GfsWaveShadowForecast | null> {
  const fetchOptions: OpenMeteoFetchOptions = {
    model: GFS_WAVE_SHADOW_MODEL,
    timeformat: "unixtime",
    timezone: "America/Los_Angeles",
  };
  if (options.signal) {
    fetchOptions.signal = options.signal;
  }

  const payload = await fetchOpenMeteoData(
    latitude,
    longitude,
    days,
    fetchOptions,
  );
  return buildGfsWaveShadowForecast(payload, {
    model: GFS_WAVE_SHADOW_MODEL,
    forecastDays: days,
  });
}

export async function logGfsWaveShadowRows(
  rows: GfsWaveShadowRow[],
): Promise<void> {
  const okRows = rows.filter((row) => row.capture_status === "ok");
  if (!okRows.length) return;
  if (!isGfsWaveShadowCaptureEnabled()) return;

  try {
    const supabase = await createSupabaseServiceRoleClient();
    const { error } = await supabase
      .from(GFS_WAVE_SHADOW_TABLE as never)
      .upsert(mapGfsWaveShadowRowsForInsert(okRows) as never, {
        onConflict: "beach_id,predicted_at,source_model",
        ignoreDuplicates: true,
      });

    if (error) {
      log.warn("logGfsWaveShadowRows: insert failed", {
        rowCount: okRows.length,
        error: error.message,
        code: error.code,
      });
    }
  } catch (err) {
    log.warn("logGfsWaveShadowRows: unexpected error", {
      rowCount: okRows.length,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}
