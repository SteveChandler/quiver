import { evaluateConditions } from "@/lib/alerts/condition-evaluator";
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
import { expandForecastHoursToHourly, type AlertTideSample } from "@/lib/alerts/hourly-forecast-hours";

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

interface SelectFreshAlertWindowInput {
  conditions: AlertConditions;
  forecastRows: EnhancedForecastAlertRow[];
  beach: AlertRevalidationBeachMeta;
  now?: Date;
  diagnosticAt?: string;
  /** Match on hourly rows (ALERT_HOURLY_WINDOWS); the caller resolves the flag for the rule's owner. */
  hourly?: boolean;
  tideSamples?: AlertTideSample[] | null;
}

/** The one preparation both alert crons use: parse, optionally expand to hourly, keep daylight. */
export function prepareAlertForecastHours(
  forecastRows: EnhancedForecastAlertRow[],
  beach: { lat: number; lon: number },
  options: { hourly: boolean; tideSamples?: AlertTideSample[] | null },
): { daylight: ForecastHour[]; maxWaveByForecastAt: Map<string, number> } {
  const parsed = forecastRows.map(parseEnhancedForecastHour);
  const rowMaxWave = buildMaxWaveByForecastAt(forecastRows);
  const { hours, maxWaveByForecastAt } = options.hourly
    ? expandForecastHoursToHourly({ hours: parsed, maxWaveByForecastAt: rowMaxWave, tideSamples: options.tideSamples })
    : { hours: parsed, maxWaveByForecastAt: rowMaxWave };
  return { daylight: filterToDaylight(hours, beach.lat, beach.lon), maxWaveByForecastAt };
}

export function selectFreshAlertWindow(input: SelectFreshAlertWindowInput): FoundWindow | null {
  return selectFreshAlertWindowWithDiagnostics(input).window;
}

export function selectFreshAlertWindowWithDiagnostics({
  conditions,
  forecastRows,
  beach,
  now = new Date(),
  diagnosticAt,
  hourly = false,
  tideSamples = null,
}: SelectFreshAlertWindowInput): { window: FoundWindow | null; diagnostic?: string } {
  if (forecastRows.length === 0) return { window: null, diagnostic: "no_forecasts" };

  const { daylight, maxWaveByForecastAt } = prepareAlertForecastHours(forecastRows, beach, { hourly, tideSamples });
  if (daylight.length === 0) return { window: null, diagnostic: "no_daylight_forecasts" };

  const allWindows = findMatchingWindows(conditions, daylight, beach);
  if (allWindows.length === 0) {
    // Describe the hour nearest the queued best hour, rather than implying every hour failed identically.
    const targetMs = diagnosticAt ? Date.parse(diagnosticAt) : now.getTime();
    const sample = daylight.reduce((nearest, hour) =>
      Math.abs(Date.parse(hour.forecast_at) - targetMs) < Math.abs(Date.parse(nearest.forecast_at) - targetMs)
        ? hour : nearest
    );
    const failures = describeFailedConditions(conditions, sample, beach);
    return { window: null, diagnostic: `forecast_at=${sample.forecast_at};${failures.join(";")}` };
  }

  const minRideable = getMinRideable(beach as unknown as Beach);
  const windows = allWindows.filter((window) =>
    isViableWindow(window, daylight, maxWaveByForecastAt, minRideable)
  );
  if (windows.length === 0) return { window: null, diagnostic: "no_viable_window" };

  const window = selectActionableAlertWindow(windows, now);
  return window ? { window } : { window: null, diagnostic: "no_actionable_window" };
}

function describeFailedConditions(
  conditions: AlertConditions,
  forecast: ForecastHour,
  beach: AlertRevalidationBeachMeta,
): string[] {
  const failures: string[] = [];
  const bounds: Array<{
    key: keyof AlertConditions;
    field: string;
    actual: number | null;
    bound: "min" | "max";
  }> = [
    { key: "swell_height_min", field: "wave_height", actual: forecast.wave_height, bound: "min" },
    { key: "swell_height_max", field: "wave_height", actual: forecast.wave_height, bound: "max" },
    { key: "swell_period_min", field: "wave_period", actual: forecast.wave_period ?? forecast.swell_1_period, bound: "min" },
    { key: "wind_speed_max_kt", field: "wind_speed_kt", actual: forecast.wind_speed, bound: "max" },
    { key: "tide_height_min_ft", field: "tide_height_ft", actual: forecast.tide_height, bound: "min" },
    { key: "tide_height_max_ft", field: "tide_height_ft", actual: forecast.tide_height, bound: "max" },
  ];
  for (const { key, field, actual, bound } of bounds) {
    const expected = conditions[key];
    if (expected == null || evaluateConditions({ [key]: expected }, forecast, beach)) continue;
    const comparison = actual == null ? ",expected " : bound === "min" ? "<" : ">";
    failures.push(`${field}=${actual ?? "missing"}${comparison}${bound} ${expected}`);
  }

  const groups: Array<{ keys: Array<keyof AlertConditions>; actual: Record<string, unknown> }> = [
    { keys: ["swell_direction_min_deg", "swell_direction_max_deg"], actual: { swell_1_direction: forecast.swell_1_direction } },
    { keys: ["wind_direction"], actual: { wind_direction_deg: forecast.wind_direction_deg } },
    { keys: ["tide_direction"], actual: { tide_status: forecast.tide_status } },
    { keys: ["avoid_tide_statuses"], actual: { tide_status: forecast.tide_status } },
    { keys: ["local_time_start", "local_time_end"], actual: { forecast_at: forecast.forecast_at, timezone: beach.timezone } },
    { keys: ["days_of_week"], actual: { forecast_at: forecast.forecast_at, timezone: beach.timezone } },
  ];
  for (const { keys, actual } of groups) {
    const rule = Object.fromEntries(keys.map((key) => [key, conditions[key]]));
    if (evaluateConditions(rule, forecast, beach)) continue;
    failures.push(`${JSON.stringify(actual)} fails ${JSON.stringify(rule)}`);
  }
  return failures;
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
    // window_end is exclusive: on hourly rows the hour at window_end is a real, non-matching hour.
    if (hourMs < startMs || hourMs >= endMs) return max;
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
