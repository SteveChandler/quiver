import { METERS_TO_FEET as FEET_PER_METER } from "@/lib/utils/unit-conversions";
import { selectTideSeries } from "@/lib/services/tide-forecast-selection";
import type { AlertTideSample } from "./hourly-forecast-hours";


interface AlertTideRow {
  ts: string;
  tide_ft: number | null;
  tide_height_m: number | null;
  source: string | null;
  station_id: string | null;
  created_at: string | null;
}

/** The subset of the Supabase client this module uses, so tests can stub it. */
export interface AlertTideClient {
  from(table: "tide_forecasts"): {
    select(columns: string): {
      eq(column: "beach_id", value: string): {
        gte(column: "ts", value: string): {
          lt(column: "ts", value: string): {
            order(column: "ts", options: { ascending: boolean }): PromiseLike<{ data: AlertTideRow[] | null; error: { message?: string } | null }>;
          };
        };
      };
    };
  };
}

/**
 * One beach's hourly NOAA tide heights for [startIso, endIso). Null means use the row tide.
 * tide_forecasts can hold several series for one hour (noaa and noaa_hilo_interpolated, an old
 * station's rows), so readers go through selectTideSeries, as the daily call does.
 */
export async function loadAlertTideSamples(
  supabase: AlertTideClient,
  beachId: string,
  startIso: string,
  endIso: string,
): Promise<AlertTideSample[] | null> {
  const { data, error } = await supabase
    .from("tide_forecasts")
    .select("ts, tide_ft, tide_height_m, source, station_id, created_at")
    .eq("beach_id", beachId)
    .gte("ts", startIso)
    .lt("ts", endIso)
    .order("ts", { ascending: true });
  if (error) {
    console.warn(`[alert-tide-samples] tide lookup failed for ${beachId}; using row tide:`, error.message ?? error);
    return null;
  }
  const samples = selectTideSeries(data ?? []).flatMap((row) => {
    const heightFt = row.tide_ft ?? (row.tide_height_m == null ? null : row.tide_height_m * FEET_PER_METER);
    return heightFt == null || !Number.isFinite(heightFt) ? [] : [{ time: row.ts, heightFt }];
  });
  return samples.length > 0 ? samples : null;
}

export function createAlertTideCache(supabase: AlertTideClient) {
  const cache = new Map<string, Promise<AlertTideSample[] | null>>();
  return (beachId: string, startIso: string, endIso: string): Promise<AlertTideSample[] | null> => {
    const key = `${beachId}|${startIso}|${endIso}`;
    let pending = cache.get(key);
    if (!pending) {
      pending = loadAlertTideSamples(supabase, beachId, startIso, endIso);
      cache.set(key, pending);
    }
    return pending;
  };
}
