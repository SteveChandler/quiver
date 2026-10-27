import { METERS_TO_FEET } from "@/lib/utils/unit-conversions";
import { selectTideSeries } from "@/lib/services/tide-forecast-selection";

/** One hourly tide height in feet, as selectTideSeries keeps it. */
export interface TideSeriesSample {
  /** tide_forecasts.ts exactly as stored. */
  ts: string;
  heightFt: number;
}

export interface TideSeriesRow {
  beach_id: string;
  ts: string;
  tide_ft: number | null;
  tide_height_m: number | null;
  source: string | null;
  station_id: string | null;
  created_at: string | null;
}

interface TideSeriesQuery {
  in(column: "beach_id", values: string[]): TideSeriesQuery;
  gte(column: "ts", value: string): TideSeriesQuery;
  lt(column: "ts", value: string): TideSeriesQuery;
  order(column: "beach_id" | "ts" | "source", options: { ascending: boolean }): TideSeriesQuery;
  range(from: number, to: number): PromiseLike<{ data: TideSeriesRow[] | null; error: { message?: string } | null }>;
}

/** The subset of the Supabase client the loader uses, so tests can stub it. */
export interface TideSeriesClient {
  from(table: "tide_forecasts"): {
    select(columns: string): TideSeriesQuery;
  };
}

const HOUR_MS = 60 * 60 * 1000;
/** PostgREST returns at most this many rows per request, without saying it truncated. */
export const TIDE_SERIES_PAGE_SIZE = 1000;
const TIDE_SERIES_COLUMNS = "beach_id, ts, tide_ft, tide_height_m, source, station_id, created_at";

/** Beaches per request so one hourly row per beach-hour fits a single page. */
function beachesPerChunk(startIso: string, endIso: string): number {
  const hours = Math.ceil((Date.parse(endIso) - Date.parse(startIso)) / HOUR_MS);
  if (!Number.isFinite(hours) || hours <= 0) return TIDE_SERIES_PAGE_SIZE;
  return Math.max(1, Math.floor(TIDE_SERIES_PAGE_SIZE / hours));
}

/**
 * Reads one chunk of beaches page by page. (beach_id, ts, source) is the table's unique key, so
 * ordering on it is total and pages neither skip nor repeat a row. Extra rows per hour (noaa beside
 * noaa_hilo_interpolated, an old station's rows) can push a chunk past one page; a short page ends it.
 */
async function loadChunk(
  client: TideSeriesClient,
  beachIds: string[],
  startIso: string,
  endIso: string,
): Promise<TideSeriesRow[]> {
  const rows: TideSeriesRow[] = [];
  for (;;) {
    const { data, error } = await client
      .from("tide_forecasts")
      .select(TIDE_SERIES_COLUMNS)
      .in("beach_id", beachIds)
      .gte("ts", startIso)
      .lt("ts", endIso)
      .order("beach_id", { ascending: true })
      .order("ts", { ascending: true })
      .order("source", { ascending: true })
      .range(rows.length, rows.length + TIDE_SERIES_PAGE_SIZE - 1);
    if (error) throw new Error(error.message ?? "tide_forecasts read failed");
    const page = data ?? [];
    rows.push(...page);
    if (page.length < TIDE_SERIES_PAGE_SIZE) return rows;
  }
}

function toSamples(rows: readonly TideSeriesRow[]): TideSeriesSample[] {
  return selectTideSeries(rows).flatMap((row) => {
    const heightFt = row.tide_ft ?? (row.tide_height_m == null ? null : row.tide_height_m * METERS_TO_FEET);
    return heightFt == null || !Number.isFinite(heightFt) ? [] : [{ ts: row.ts, heightFt }];
  });
}

/**
 * Each beach's hourly tide series for [startIso, endIso), one station and one row per UTC hour
 * (selectTideSeries). Beaches with no usable sample are absent from the map. Throws on a read error.
 */
export async function loadTideSeriesByBeach(
  client: TideSeriesClient,
  beachIds: readonly string[],
  startIso: string,
  endIso: string,
): Promise<Map<string, TideSeriesSample[]>> {
  const uniqueIds = [...new Set(beachIds)];
  const chunkSize = beachesPerChunk(startIso, endIso);
  const rowsByBeach = new Map<string, TideSeriesRow[]>();
  for (let index = 0; index < uniqueIds.length; index += chunkSize) {
    const rows = await loadChunk(client, uniqueIds.slice(index, index + chunkSize), startIso, endIso);
    for (const row of rows) {
      const beachRows = rowsByBeach.get(row.beach_id);
      if (beachRows) beachRows.push(row);
      else rowsByBeach.set(row.beach_id, [row]);
    }
  }

  // Station choice is per beach, so the series is selected per beach, never across the chunk.
  const series = new Map<string, TideSeriesSample[]>();
  for (const [beachId, rows] of rowsByBeach) {
    const samples = toSamples(rows);
    if (samples.length > 0) series.set(beachId, samples);
  }
  return series;
}
