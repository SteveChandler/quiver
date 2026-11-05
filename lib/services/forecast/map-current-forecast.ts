import type { SupabaseClient } from "@supabase/supabase-js";
import { designateCurrentRow } from "@/lib/services/current-conditions/current-row";
import { applyV51DisplayOverrideToForecasts } from "@/lib/services/forecast/v5-display-gate";
import { isFallbackForecastRow } from "@/lib/utils/forecast-row-source";
import type { Database } from "@/types/database.generated";
import type { EnhancedForecastEntity } from "@/types/forecast";

// A forecast row may stand in for "current conditions" only within one
// 3-hourly slot of now. Beyond that we are showing a stale or next-day row
// as current, which is worse than an honest gap.
export const CURRENT_CONDITIONS_TOLERANCE_MS = 3 * 60 * 60 * 1000;

export const BULK_FORECAST_SELECT =
  "beach_id, forecast_date, forecast_time, forecast_at, wave_height, wave_period, wave_period_om, wave_direction, wave_height_om, wave_direction_om, swell_height_om, swell_period_om, swell_direction_om, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, wind_wave_height, wind_wave_period, wind_wave_direction, wind_speed, wind_direction, wind_direction_deg, water_temp, tide_height, tide_status, confidence_score, data_source" as const;

export function resolveForecastFetchWindow(forecastAt: string | null): {
  start: Date;
  end: Date;
  selectedAt: Date | null;
} {
  const selectedMs = forecastAt ? Date.parse(forecastAt) : NaN;
  if (Number.isFinite(selectedMs)) {
    const selectedAt = new Date(selectedMs);
    return {
      selectedAt,
      start: new Date(selectedMs - 2 * 60 * 1000),
      end: new Date(selectedMs + 2 * 60 * 1000),
    };
  }

  const now = new Date();
  return {
    selectedAt: null,
    start: new Date(now.getTime() - 18 * 60 * 60 * 1000),
    end: new Date(now.getTime() + 42 * 60 * 60 * 1000),
  };
}

export async function fetchBulkForecastRowsWithV51Display(
  supabase: SupabaseClient<Database>,
  beachIds: string[],
  start: Date,
  end: Date,
  signal?: AbortSignal,
): Promise<{
  data: EnhancedForecastEntity[] | null;
  timelineRows: EnhancedForecastEntity[];
  error: { message: string } | null;
}> {
  signal?.throwIfAborted();
  const query = supabase
    .from("enhanced_forecasts")
    .select(BULK_FORECAST_SELECT)
    .in("beach_id", beachIds)
    .gte("forecast_at", start.toISOString())
    .lt("forecast_at", end.toISOString())
    .order("forecast_at", { ascending: true });
  const { data, error } = await (signal ? query.abortSignal(signal) : query);
  signal?.throwIfAborted();

  if (error || !data) {
    return {
      data: null,
      timelineRows: [],
      error: error ? { message: error.message } : null,
    };
  }

  const displayRows = await applyV51DisplayOverrideToForecasts(
    data as unknown as EnhancedForecastEntity[]
  );
  signal?.throwIfAborted();

  return {
    data: displayRows,
    timelineRows: data as unknown as EnhancedForecastEntity[],
    error: null,
  };
}

/** A FALLBACK row carries no model wave data: no height to display and a null height that would score as a flat 0. */
export function modelForecastRow(row: EnhancedForecastEntity | null): EnhancedForecastEntity | null {
  return row && !isFallbackForecastRow(row) ? row : null;
}

/** The row the map shows as a beach's current conditions. */
export function currentMapForecastRow(
  rows: EnhancedForecastEntity[],
  now: Date,
): EnhancedForecastEntity | null {
  return modelForecastRow(designateCurrentRow(rows, now, {
    toleranceMs: CURRENT_CONDITIONS_TOLERANCE_MS,
  })?.row ?? null);
}
