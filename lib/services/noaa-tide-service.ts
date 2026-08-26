import { fetchWithTimeout } from "@/lib/utils/fetch-utils";
import { calculateDistance } from "@/lib/utils/distance-utils";
import { parseCOOPSTimestampToUnixSecondsUTC } from "@/lib/services/noaa-coops/tide-analysis";
import {
  isPreferredTideForecastRow,
  type TideForecastSelectionRow,
} from "@/lib/services/tide-forecast-selection";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

export type TidePrediction = {
  ts: string;
  tide_height_m: number;
  tide_phase: string | null;
};

export type HighLowTidePrediction = {
  ts: string;
  tide_height_m: number;
  type: "high" | "low";
};

export type CachedTidePredictionsResult = {
  predictions: TidePrediction[];
  latestCreatedAt: string | null;
};

type StationMeta = { id: string; name: string; lat: number; lon: number };
type TideForecastClient = Pick<SupabaseClient<Database>, "from">;
type TideForecastRow = TideForecastSelectionRow & { created_at: string | null };

const tideStationsCache: { at: number; stations: StationMeta[] } = {
  at: 0,
  stations: [],
};

const predictionCacheTtlMs = 15 * 60 * 1000;
const predictionCacheMaxEntries = 100;

const hourlyPredictionsCache = new Map<
  string,
  { at: number; data: TidePrediction[] }
>();

const highLowPredictionsCache = new Map<
  string,
  { at: number; data: HighLowTidePrediction[] }
>();

function getCachedPredictions<T>(
  cache: Map<string, { at: number; data: T[] }>,
  key: string
): T[] | null {
  const cached = cache.get(key);
  if (!cached) return null;
  if (Date.now() - cached.at > predictionCacheTtlMs) {
    cache.delete(key);
    return null;
  }
  return [...cached.data];
}

function setCachedPredictions<T>(
  cache: Map<string, { at: number; data: T[] }>,
  key: string,
  data: T[]
): void {
  if (cache.size >= predictionCacheMaxEntries && !cache.has(key)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
  cache.set(key, { at: Date.now(), data: [...data] });
}

function toYmd(value: string): string {
  return value.replace(/[-:]|T.*$/g, "").slice(0, 8);
}

function parseNoaaGmtTimestamp(timestamp: unknown): string | null {
  if (typeof timestamp !== "string") return null;
  const parsedSeconds = parseCOOPSTimestampToUnixSecondsUTC(timestamp);
  if (parsedSeconds != null) {
    return new Date(parsedSeconds * 1000).toISOString();
  }

  if (!/(?:Z|[+-]\d{2}:?\d{2})$/.test(timestamp)) return null;
  const fallbackMs = Date.parse(timestamp);
  if (Number.isNaN(fallbackMs)) return null;
  return new Date(fallbackMs).toISOString();
}

function filterPredictionsToWindow<T extends { ts: string }>(
  predictions: T[],
  startIso: string,
  endIso: string
): T[] {
  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs)) return predictions;
  return predictions.filter((prediction) => {
    const predictionMs = Date.parse(prediction.ts);
    return predictionMs >= startMs && predictionMs <= endMs;
  });
}

async function getTideStations(): Promise<StationMeta[]> {
  const now = Date.now();
  if (
    tideStationsCache.stations.length &&
    now - tideStationsCache.at < 24 * 60 * 60 * 1000
  ) {
    return tideStationsCache.stations;
  }
  const url =
    "https://api.tidesandcurrents.noaa.gov/mdapi/prod/webapi/stations.json?type=tidepredictions";
  const res = await fetchWithTimeout(url, { timeoutMs: 20000 });
  if (!res.ok) throw new Error(`NOAA stations failed: ${res.status}`);
  const json = await res.json();
  const list: StationMeta[] = (json?.stations || [])
    .map((s: any) => ({
      id: String(s.id),
      name: String(s.name || s.id),
      lat: Number(s.lat),
      lon: Number(s.lng ?? s.lon),
    }))
    .filter((s: StationMeta) => isFinite(s.lat) && isFinite(s.lon));
  tideStationsCache.stations = list;
  tideStationsCache.at = now;
  return list;
}

export async function getNearestTideStation(
  lat: number,
  lon: number,
  maxKm = 120
): Promise<StationMeta | null> {
  const stations = await getTideStations();
  let best: StationMeta | null = null;
  let bestKm = Infinity;
  for (const s of stations) {
    const d = calculateDistance(
      { lat, lon },
      { lat: s.lat, lon: s.lon },
      "km"
    );
    if (d < bestKm && d <= maxKm) {
      best = s;
      bestKm = d;
    }
  }
  return best;
}

export async function fetchHourlyTidePredictions(
  stationId: string,
  startIso: string,
  endIso: string
): Promise<TidePrediction[]> {
  const cacheKey = `hourly|${stationId}|${toYmd(startIso)}|${toYmd(endIso)}`;
  const cached = getCachedPredictions(hourlyPredictionsCache, cacheKey);
  if (cached) return filterPredictionsToWindow(cached, startIso, endIso);

  // NOAA CO-OPS datagetter expects begin_date/end_date as YYYYMMDD (date only) or "YYYYMMDD HH:MM"
  const begin_date = toYmd(startIso);
  const end_date = toYmd(endIso);
  const params = new URLSearchParams({
    station: stationId,
    product: "predictions",
    interval: "h", // hourly
    datum: "MLLW",
    time_zone: "gmt",
    units: "metric",
    format: "json",
    begin_date,
    end_date,
  });
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${params.toString()}`;
  const res = await fetchWithTimeout(url, { timeoutMs: 20000 });
  if (!res.ok) {
    const body = await res.text();
    console.warn("NOAA tide request failed", {
      status: res.status,
      url,
      body: body.slice(0, 300),
    });
    throw new Error(`NOAA tide failed: ${res.status}`);
  }
  const json = await res.json();
  const preds: TidePrediction[] = (json?.predictions || [])
    .map((p: any) => {
      const ts = parseNoaaGmtTimestamp(p?.t);
      const tideHeightM = Number(p?.v);
      if (!ts || !Number.isFinite(tideHeightM)) return null;
      return {
        ts,
        tide_height_m: tideHeightM,
        tide_phase: typeof p?.type === "string" ? p.type : null,
      };
    })
    .filter((p: TidePrediction | null): p is TidePrediction => Boolean(p));

  setCachedPredictions(hourlyPredictionsCache, cacheKey, preds);
  return filterPredictionsToWindow(preds, startIso, endIso);
}

export async function fetchHighLowTidePredictions(
  stationId: string,
  startIso: string,
  endIso: string
): Promise<HighLowTidePrediction[]> {
  const cacheKey = `hilo|${stationId}|${toYmd(startIso)}|${toYmd(endIso)}`;
  const cached = getCachedPredictions(highLowPredictionsCache, cacheKey);
  if (cached) return filterPredictionsToWindow(cached, startIso, endIso);

  const begin_date = toYmd(startIso);
  const end_date = toYmd(endIso);
  const params = new URLSearchParams({
    station: stationId,
    product: "predictions",
    interval: "hilo",
    datum: "MLLW",
    time_zone: "gmt",
    units: "metric",
    format: "json",
    begin_date,
    end_date,
  });
  const url = `https://api.tidesandcurrents.noaa.gov/api/prod/datagetter?${params.toString()}`;
  const res = await fetchWithTimeout(url, { timeoutMs: 20000 });
  if (!res.ok) {
    const body = await res.text();
    console.warn("NOAA high/low tide request failed", {
      status: res.status,
      url,
      body: body.slice(0, 300),
    });
    throw new Error(`NOAA high/low tide failed: ${res.status}`);
  }

  const json = await res.json();
  const predictions: HighLowTidePrediction[] = (json?.predictions || [])
    .map((p: any) => {
      const ts = parseNoaaGmtTimestamp(p?.t);
      const tideHeightM = Number(p?.v);
      if (!ts || !Number.isFinite(tideHeightM)) return null;
      if (p?.type !== "H" && p?.type !== "L") return null;
      return {
        ts,
        tide_height_m: tideHeightM,
        type: p.type === "H" ? "high" : "low",
      };
    })
    .filter(
      (prediction: HighLowTidePrediction | null): prediction is HighLowTidePrediction =>
        Boolean(prediction)
    );

  setCachedPredictions(highLowPredictionsCache, cacheKey, predictions);
  return filterPredictionsToWindow(predictions, startIso, endIso);
}

function dedupeCachedRows(rows: TideForecastRow[]): TideForecastRow[] {
  const byTimestamp = new Map<string, TideForecastRow>();
  for (const row of rows) {
    if (!row.ts || typeof row.tide_height_m !== "number" || !Number.isFinite(row.tide_height_m)) {
      continue;
    }

    const existing = byTimestamp.get(row.ts);
    if (!existing || isPreferredTideForecastRow(row, existing)) {
      byTimestamp.set(row.ts, row);
    }
  }

  return [...byTimestamp.values()].sort(
    (a, b) => Date.parse(a.ts) - Date.parse(b.ts)
  );
}

export async function fetchCachedHourlyTidePredictions(
  supabase: TideForecastClient,
  beachId: string,
  startIso: string,
  endIso: string
): Promise<CachedTidePredictionsResult> {
  const { data, error } = await supabase
    .from("tide_forecasts")
    .select("ts, tide_height_m, tide_phase, created_at, source")
    .eq("beach_id", beachId)
    .gte("ts", startIso)
    .lte("ts", endIso)
    .order("ts", { ascending: true });

  if (error) {
    throw new Error(error.message || "Failed to fetch cached tide predictions");
  }

  const rows = dedupeCachedRows((data || []) as TideForecastRow[]);
  const latestCreatedAt =
    rows.reduce<string | null>((latest, row) => {
      if (!row.created_at) return latest;
      if (!latest) return row.created_at;
      return Date.parse(row.created_at) > Date.parse(latest) ? row.created_at : latest;
    }, null) ?? null;

  return {
    predictions: rows.map((row) => ({
      ts: row.ts,
      tide_height_m: row.tide_height_m as number,
      tide_phase: row.tide_phase ?? null,
    })),
    latestCreatedAt,
  };
}

export function hasSufficientCachedTideCoverage(
  predictions: TidePrediction[],
  startIso: string,
  endIso: string
): boolean {
  if (!predictions.length) return false;

  const startMs = Date.parse(startIso);
  const endMs = Date.parse(endIso);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) {
    return false;
  }

  const hourMs = 60 * 60 * 1000;
  const expectedHours = Math.max(1, Math.floor((endMs - startMs) / hourMs));
  const uniqueHourKeys = new Set(
    predictions.map((prediction) => {
      const timeMs = Date.parse(prediction.ts);
      return Math.floor(timeMs / hourMs);
    })
  );
  const validHourCount = [...uniqueHourKeys].filter((hourKey) =>
    Number.isFinite(hourKey)
  ).length;

  const sorted = [...predictions].sort(
    (a, b) => Date.parse(a.ts) - Date.parse(b.ts)
  );
  const firstMs = Date.parse(sorted[0].ts);
  const lastMs = Date.parse(sorted[sorted.length - 1].ts);
  const startCovered = firstMs <= startMs + 90 * 60 * 1000;
  const endCovered = lastMs >= endMs - 90 * 60 * 1000;
  const minimumHours = Math.ceil(expectedHours * 0.8);

  return startCovered && endCovered && validHourCount >= minimumHours;
}
