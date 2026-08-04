import {
  numberOrNull,
  openMeteoTimeToDate,
} from "@/lib/services/noaa-wavewatch/data-processors";
import { FORECAST_CONFIG } from "@/lib/services/noaa-wavewatch/constants";
import type { OpenMeteoMarineResponse } from "@/lib/services/noaa-wavewatch/types";
import type {
  MarineComponent,
  PointMarineForecastRow,
} from "./types";

function valueAt(values: number[] | undefined, index: number): number | null {
  return numberOrNull(values?.[index]);
}

function buildComponent(
  height: number | null,
  period: number | null,
  direction: number | null,
): MarineComponent | null {
  if (height == null || period == null || direction == null) return null;
  return { heightM: height, periodS: period, directionDeg: direction };
}

export function isAllZeroWaveHeightSeries(
  payload: OpenMeteoMarineResponse | null | undefined,
): boolean {
  const values = payload?.hourly?.wave_height ?? [];
  const numericValues = values
    .map((value) => numberOrNull(value))
    .filter((value): value is number => value != null);

  return numericValues.length > 0 && numericValues.every((value) => value === 0);
}

export function normalizePointMarineForecastRows(
  payload: OpenMeteoMarineResponse,
  days: number,
): PointMarineForecastRow[] {
  const hourly = payload.hourly;
  if (!hourly?.time?.length) return [];

  const stepHours = FORECAST_CONFIG.FORECAST_INTERVAL_HOURS;
  const maxRows = Math.min(
    days * FORECAST_CONFIG.FORECASTS_PER_DAY,
    Math.ceil(hourly.time.length / stepHours),
  );
  const rows: PointMarineForecastRow[] = [];

  for (let step = 0; step < maxRows; step += 1) {
    const index = step * stepHours;
    const forecastDate = openMeteoTimeToDate(hourly.time[index]);
    if (!forecastDate) continue;

    rows.push({
      forecastAt: forecastDate.toISOString(),
      total: buildComponent(
        valueAt(hourly.wave_height, index),
        valueAt(hourly.wave_period, index),
        valueAt(hourly.wave_direction, index),
      ),
      swell1: buildComponent(
        valueAt(hourly.swell_wave_height, index),
        valueAt(hourly.swell_wave_period, index),
        valueAt(hourly.swell_wave_direction, index),
      ),
      swell2: buildComponent(
        valueAt(hourly.secondary_swell_wave_height, index),
        valueAt(hourly.secondary_swell_wave_period, index),
        valueAt(hourly.secondary_swell_wave_direction, index),
      ),
      swell3: buildComponent(
        valueAt(hourly.tertiary_swell_wave_height, index),
        valueAt(hourly.tertiary_swell_wave_period, index),
        valueAt(hourly.tertiary_swell_wave_direction, index),
      ),
      windWave: buildComponent(
        valueAt(hourly.wind_wave_height, index),
        valueAt(hourly.wind_wave_period, index),
        valueAt(hourly.wind_wave_direction, index),
      ),
    });
  }

  return rows;
}

export function hasCompleteSwellComponent(row: PointMarineForecastRow): boolean {
  return row.swell1 != null
    && row.swell1.heightM > 0
    && row.swell1.periodS > 0;
}
