import { fetchWithTimeout } from "@/lib/utils/fetch-utils";
import { calculateDistance } from "@/lib/utils/distance-utils";

type TidePrediction = {
  ts: string;
  tide_height_m: number;
  tide_phase: string | null;
};

type StationMeta = { id: string; name: string; lat: number; lon: number };

const tideStationsCache: { at: number; stations: StationMeta[] } = {
  at: 0,
  stations: [],
};

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
    const d = calculateDistance(lat, lon, s.lat, s.lon, "km");
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
  // NOAA CO-OPS datagetter expects begin_date/end_date as YYYYMMDD (date only) or "YYYYMMDD HH:MM"
  const toYmd = (d: string) => d.replace(/[-:]|T.*$/g, "").slice(0, 8); // YYYYMMDD
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
  const preds: TidePrediction[] = (json?.predictions || []).map((p: any) => ({
    ts: new Date(p.t).toISOString(),
    tide_height_m: Number(p.v),
    tide_phase: p.type || null,
  }));
  return preds;
}
