import { filterToDaylight } from "@/lib/alerts/sunrise";
import { findMatchingWindows, type FoundWindow } from "@/lib/alerts/window-finder";
import { selectActionableAlertWindow } from "@/lib/alerts/actionable-window-selector";
import {
  parseSwellDirectionToDegrees,
  parseWindSpeedToKt,
} from "@/lib/alerts/forecast-parsers";
import type { AlertConditions, ForecastHour } from "@/lib/alerts/types";
import type { AlertRevalidationBeachMeta } from "@/lib/alerts/payload-builder";
import { getMinRideable, MINIMUM_VIABLE_WINDOW_MINUTES } from "@/lib/utils/surf-call-logic";
import type { Beach } from "@/types/database";

export type EnhancedForecastAlertRow = Record<string, unknown> & {
  id?: string;
  forecast_at: string;
  wave_height?: string | number | null;
  wave_period?: string | number | null;
  wave_direction?: string | null;
  swell_1_height?: string | number | null;
  swell_1_period?: string | number | null;
  swell_1_direction?: string | number | null;
  wind_speed?: string | number | null;
  wind_direction_deg?: string | number | null;
  tide_height?: string | number | null;
  tide_status?: string | null;
};

export interface SelectFreshAlertWindowInput {
  conditions: AlertConditions;
  forecastRows: EnhancedForecastAlertRow[];
  beach: AlertRevalidationBeachMeta;
  now?: Date;
}

export function selectFreshAlertWindow({
  conditions,
  forecastRows,
  beach,
  now = new Date(),
}: SelectFreshAlertWindowInput): FoundWindow | null {
  if (forecastRows.length === 0) return null;

  const parsed = forecastRows.map(parseEnhancedForecastHour);
  const daylight = filterToDaylight(parsed, beach.lat, beach.lon);
  if (daylight.length === 0) return null;

  const allWindows = findMatchingWindows(conditions, daylight, beach);
  if (allWindows.length === 0) return null;

  const maxWaveByForecastAt = buildMaxWaveByForecastAt(forecastRows);
  const minRideable = getMinRideable(beach as unknown as Beach);
  const windows = allWindows.filter((window) =>
    isViableWindow(window, daylight, maxWaveByForecastAt, minRideable)
  );
  if (windows.length === 0) return null;

  return selectActionableAlertWindow(windows, now);
}

export function parseEnhancedForecastHour(row: EnhancedForecastAlertRow): ForecastHour {
  return {
    forecast_id: typeof row.id === "string" && row.id.length > 0 ? row.id : undefined,
    forecast_at: row.forecast_at,
    wave_height: parseNumberish(row.wave_height),
    wave_period: parseNumberish(row.wave_period),
    wave_direction:
      typeof row.wave_direction === "string" && row.wave_direction.length > 0
        ? row.wave_direction
        : null,
    swell_1_height: parseNumberish(row.swell_1_height),
    swell_1_period: parseNumberish(row.swell_1_period),
    swell_1_direction: parseSwellDirectionToDegrees(
      row.swell_1_direction == null ? null : String(row.swell_1_direction)
    ),
    wind_speed: parseWindSpeed(row.wind_speed),
    wind_direction_deg: parseNumberish(row.wind_direction_deg),
    tide_height: parseNumberish(row.tide_height),
    tide_status: typeof row.tide_status === "string" ? row.tide_status : null,
  };
}

function parseNumberish(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseWindSpeed(value: unknown): number | null {
  if (value == null) return null;
  return parseWindSpeedToKt(String(value));
}

function buildMaxWaveByForecastAt(rows: EnhancedForecastAlertRow[]): Map<string, number> {
  const maxByForecastAt = new Map<string, number>();
  for (const row of rows) {
    const value = row.wave_height;
    if (value == null) continue;
    const numbers = String(value).match(/[\d.]+/g);
    if (!numbers) continue;
    const parsed = numbers.map(Number).filter((n) => Number.isFinite(n));
    if (parsed.length === 0) continue;
    maxByForecastAt.set(row.forecast_at, Math.max(...parsed));
  }
  return maxByForecastAt;
}

function isViableWindow(
  window: FoundWindow,
  daylight: ForecastHour[],
  maxWaveByForecastAt: Map<string, number>,
  minRideable: number
): boolean {
  const startMs = new Date(window.window_start).getTime();
  const endMs = new Date(window.window_end).getTime();
  const durationMinutes = (endMs - startMs) / 60000;
  if (durationMinutes < MINIMUM_VIABLE_WINDOW_MINUTES) return false;

  const maxWave = daylight.reduce<number | null>((max, hour) => {
    const hourMs = new Date(hour.forecast_at).getTime();
    if (hourMs < startMs || hourMs > endMs) return max;
    const candidate =
      maxWaveByForecastAt.get(hour.forecast_at) ??
      (typeof hour.wave_height === "number" && Number.isFinite(hour.wave_height)
        ? hour.wave_height
        : null);
    if (candidate === null) return max;
    return max === null ? candidate : Math.max(max, candidate);
  }, null);

  return maxWave === null || maxWave >= minRideable;
}
