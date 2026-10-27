import { loadTideSeriesByBeach, type TideSeriesClient } from "@/lib/services/tide-series-loader";
import type { AlertTideSample } from "./hourly-forecast-hours";

/** The subset of the Supabase client this module uses, so tests can stub it. */
export type AlertTideClient = TideSeriesClient;

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
  try {
    const series = await loadTideSeriesByBeach(supabase, [beachId], startIso, endIso);
    const samples = (series.get(beachId) ?? []).map((sample) => ({ time: sample.ts, heightFt: sample.heightFt }));
    return samples.length > 0 ? samples : null;
  } catch (error) {
    console.warn(`[alert-tide-samples] tide lookup failed for ${beachId}; using row tide:`, error instanceof Error ? error.message : error);
    return null;
  }
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
