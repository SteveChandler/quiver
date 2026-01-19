import { calculateDistance } from "@/lib/utils/distance-utils";
import { fetchWithTimeout } from "@/lib/utils/fetch-utils";

type NDBCStation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type?: string;
  data?: string; // "y" = realtime data available, "n" = no data
};

type NDBCObservation = {
  ts: string; // ISO
  wave_height_m: number | null; // WVHT meters
  wave_period_s: number | null; // DPD seconds
  wave_direction_deg: number | null; // MWD degrees
  wind_speed_ms: number | null; // WSPD m/s
  wind_direction_deg: number | null; // WDIR degrees
  water_temp_c: number | null; // WTMP water temperature in Celsius
};

/**
 * Fetch the active NDBC station list (lat/lon) and cache in memory
 */
const stationCache: { at: number; stations: NDBCStation[] } = {
  at: 0,
  stations: [],
};

/**
 * Cache for NDBC observations (10-minute TTL to reduce API calls)
 */
const observationCache: Map<
  string,
  { at: number; obs: NDBCObservation | null }
> = new Map();
const OBS_CACHE_TTL = 10 * 60 * 1000; // 10 minutes

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
      data: s.data, // "y" = realtime data available
    }))
    .filter(
      (s: NDBCStation) =>
        isFinite(s.lat) && isFinite(s.lon) && s.id && s.data === "y"
    );
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

/**
 * Fetch latest realtime2 observation file and parse header/row
 * Uses in-memory cache with 10-minute TTL to reduce external API calls
 * Searches through up to 20 recent rows to find one with valid wave height data
 */
export async function fetchLatestNDBCObservation(
  stationId: string
): Promise<NDBCObservation | null> {
  // Check cache first
  const cached = observationCache.get(stationId);
  if (cached && Date.now() - cached.at < OBS_CACHE_TTL) {
    return cached.obs;
  }

  const url = `https://www.ndbc.noaa.gov/data/realtime2/${stationId}.txt`;
  const res = await fetchWithTimeout(url, { timeoutMs: 15000 });
  if (!res.ok) {
    // Cache null result to avoid repeated failed requests
    observationCache.set(stationId, { at: Date.now(), obs: null });
    return null;
  }
  const text = await res.text();
  const lines = text.split(/\r?\n/).filter(Boolean);
  // Find header line starting with '#YY'
  const headerIdx = lines.findIndex((l) => l.startsWith("#YY"));
  if (headerIdx === -1 || headerIdx + 1 >= lines.length) {
    observationCache.set(stationId, { at: Date.now(), obs: null });
    return null;
  }
  const header = lines[headerIdx].replace(/^#/, "").trim().split(/\s+/);
  const asNum = (val?: string) => (val && val !== "MM" ? Number(val) : NaN);

  const getFromDataLine = (dataLine: string[], name: string) => {
    const idx = header.indexOf(name);
    return idx >= 0 ? dataLine[idx] : undefined;
  };

  // Search through up to 20 recent data rows to find one with valid wave height
  const MAX_ROWS_TO_SEARCH = 20;
  for (
    let i = headerIdx + 1;
    i < Math.min(headerIdx + 1 + MAX_ROWS_TO_SEARCH, lines.length);
    i++
  ) {
    const dataLine = lines[i].trim().split(/\s+/);

    const yy = asNum(getFromDataLine(dataLine, "YY"));
    const mo = asNum(getFromDataLine(dataLine, "MM"));
    const dd = asNum(getFromDataLine(dataLine, "DD"));
    const hh = asNum(getFromDataLine(dataLine, "hh"));
    const mi = asNum(getFromDataLine(dataLine, "mm"));

    let ts: string;
    if ([yy, mo, dd, hh].every((n) => isFinite(n))) {
      // Construct UTC date safely
      // Handle both 2-digit (legacy) and 4-digit (current) NDBC year formats
      const year = yy > 99 ? Number(yy) : 2000 + Number(yy);
      const monthIdx = Math.max(0, Math.min(11, Number(mo) - 1));
      const day = Math.max(1, Math.min(31, Number(dd)));
      const hour = Math.max(0, Math.min(23, Number(hh)));
      const minute = isFinite(mi) ? Math.max(0, Math.min(59, Number(mi))) : 0;
      ts = new Date(
        Date.UTC(year, monthIdx, day, hour, minute, 0)
      ).toISOString();
    } else {
      // Invalid timestamp, skip this row
      continue;
    }

    const WVHT = asNum(getFromDataLine(dataLine, "WVHT")); // meters
    const DPD = asNum(getFromDataLine(dataLine, "DPD"));
    const MWD = asNum(getFromDataLine(dataLine, "MWD"));
    const WSPD = asNum(getFromDataLine(dataLine, "WSPD"));
    const WDIR = asNum(getFromDataLine(dataLine, "WDIR"));
    const WTMP = asNum(getFromDataLine(dataLine, "WTMP")); // water temperature in Celsius

    // Only return this observation if it has valid wave height data
    if (isFinite(WVHT)) {
      const obs: NDBCObservation = {
        ts,
        wave_height_m: WVHT,
        wave_period_s: isFinite(DPD) ? DPD : null,
        wave_direction_deg: isFinite(MWD) ? MWD : null,
        wind_speed_ms: isFinite(WSPD) ? WSPD : null,
        wind_direction_deg: isFinite(WDIR) ? WDIR : null,
        water_temp_c: isFinite(WTMP) ? WTMP : null,
      };

      // Cache the observation
      observationCache.set(stationId, { at: Date.now(), obs });

      return obs;
    }
  }

  // No valid wave data found in recent rows
  observationCache.set(stationId, { at: Date.now(), obs: null });
  return null;
}
