import type { AlertTideSample } from "./hourly-forecast-hours";

/** The subset of the Supabase client this module uses, so tests can stub it. */
export interface AlertTideClient {
  from(table: "tide_forecasts"): {
    select(columns: string): {
      eq(column: "beach_id", value: string): {
        gte(column: "ts_utc", value: string): {
          lt(column: "ts_utc", value: string): {
            order(column: "ts_utc", options: { ascending: boolean }): PromiseLike<{ data: { ts_utc: string; tide_ft: number | null }[] | null; error: unknown }>;
          };
        };
      };
    };
  };
}

/** One beach's hourly NOAA tide heights for [startIso, endIso). Null means use the row tide. */
export async function loadAlertTideSamples(
  supabase: AlertTideClient,
  beachId: string,
  startIso: string,
  endIso: string,
): Promise<AlertTideSample[] | null> {
  const { data, error } = await supabase
    .from("tide_forecasts")
    .select("ts_utc, tide_ft")
    .eq("beach_id", beachId)
    .gte("ts_utc", startIso)
    .lt("ts_utc", endIso)
    .order("ts_utc", { ascending: true });
  if (error || !data || data.length === 0) return null;
  const samples = data
    .filter((row) => typeof row.tide_ft === "number" && Number.isFinite(row.tide_ft))
    .map((row) => ({ time: row.ts_utc, heightFt: row.tide_ft as number }));
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
