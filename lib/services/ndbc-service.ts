import { calculateDistance } from "@/lib/utils/distance-utils";
import { fetchWithTimeout } from "@/lib/utils/fetch-utils";

type NDBCStation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type?: string;
};

type NDBCObservation = {
  ts: string; // ISO
  wave_height_m: number | null; // WVHT meters
  wave_period_s: number | null; // DPD seconds
  wave_direction_deg: number | null; // MWD degrees
  wind_speed_ms: number | null; // WSPD m/s
  wind_direction_deg: number | null; // WDIR degrees
};

/**
 * Fetch the active NDBC station list (lat/lon) and cache in memory
 */
const stationCache: { at: number; stations: NDBCStation[] } = {
  at: 0,
  stations: [],
};

async function getActiveNDBCStations(): Promise<NDBCStation[]> {
  const now = Date.now();
  if (
    stationCache.stations.length &&
    now - stationCache.at < 6 * 60 * 60 * 1000
  ) {
    return stationCache.stations;
  }
  const url = "https://www.ndbc.noaa.gov/ndbcmapstations.json";
  const res = await fetchWithTimeout(url, { timeoutMs: 20000 });
  if (!res.ok) throw new Error(`NDBC stations failed: ${res.status}`);
  const json = await res.json();
  const stations: NDBCStation[] = (json?.station || [])
    .map((s: any) => ({
      id: String(s.id),
      name: String(s.name || s.id || "Station"),
      lat: Number(s.lat),
      lon: Number(s.lon ?? s.lng),
      type: s.type,
    }))
    .filter((s: NDBCStation) => isFinite(s.lat) && isFinite(s.lon) && s.id);
  stationCache.stations = stations;
  stationCache.at = now;
  return stations;
}

export async function getNearestNDBCStation(
  lat: number,
  lon: number,
  maxKm = 80
): Promise<NDBCStation | null> {
  const stations = await getActiveNDBCStations();
  let best: NDBCStation | null = null;
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

/**
 * Fetch latest realtime2 observation file and parse header/row
 */
export async function fetchLatestNDBCObservation(
  stationId: string
): Promise<NDBCObservation | null> {
  const url = `https://www.ndbc.noaa.gov/data/realtime2/${stationId}.txt`;
  const res = await fetchWithTimeout(url, { timeoutMs: 15000 });
  if (!res.ok) return null;
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  // Find header line starting with '#YY'
  const headerIdx = lines.findIndex((l) => l.startsWith("#YY"));
  if (headerIdx === -1 || headerIdx + 1 >= lines.length) return null;
  const header = lines[headerIdx].replace(/^#/, "").trim().split(/\s+/);
  const dataLine = lines[headerIdx + 1].trim().split(/\s+/);
  const asNum = (val?: string) => (val && val !== "MM" ? Number(val) : NaN);

  const get = (name: string) => {
    const idx = header.indexOf(name);
    return idx >= 0 ? dataLine[idx] : undefined;
  };

  const yy = asNum(get("YY"));
  const mo = asNum(get("MM"));
  const dd = asNum(get("DD"));
  const hh = asNum(get("hh"));
  const mi = asNum(get("mm"));
  let ts: string;
  if ([yy, mo, dd, hh].every((n) => isFinite(n))) {
    // Construct UTC date safely
    const year = 2000 + Number(yy);
    const monthIdx = Math.max(0, Math.min(11, Number(mo) - 1));
    const day = Math.max(1, Math.min(31, Number(dd)));
    const hour = Math.max(0, Math.min(23, Number(hh)));
    const minute = isFinite(mi) ? Math.max(0, Math.min(59, Number(mi))) : 0;
    ts = new Date(Date.UTC(year, monthIdx, day, hour, minute, 0)).toISOString();
  } else {
    ts = new Date().toISOString();
  }

  const WVHT = asNum(get("WVHT")); // meters
  const DPD = asNum(get("DPD"));
  const MWD = asNum(get("MWD"));
  const WSPD = asNum(get("WSPD"));
  const WDIR = asNum(get("WDIR"));

  const obs: NDBCObservation = {
    ts,
    wave_height_m: isFinite(WVHT) ? WVHT : null,
    wave_period_s: isFinite(DPD) ? DPD : null,
    wave_direction_deg: isFinite(MWD) ? MWD : null,
    wind_speed_ms: isFinite(WSPD) ? WSPD : null,
    wind_direction_deg: isFinite(WDIR) ? WDIR : null,
  };
  return obs;
}
