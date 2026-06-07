import { calculateDistance } from "@/lib/utils/distance-utils";
import { fetchWithTimeout } from "@/lib/utils/fetch-utils";

export type NDBCStation = {
  id: string;
  name: string;
  lat: number;
  lon: number;
  type?: string;
  data?: string; // "y" = realtime data available, "n" = no data
};

export type NDBCObservation = {
  ts: string; // ISO
  wave_height_m: number | null; // WVHT meters
  wave_period_s: number | null; // DPD seconds
  wave_direction_deg: number | null; // MWD degrees
  wind_speed_ms: number | null; // WSPD m/s
  wind_direction_deg: number | null; // WDIR degrees
  water_temp_c: number | null; // WTMP water temperature in Celsius
};

export type NDBCObservationFetchStatus =
  | "ok"
  | "no_wave_data"
  | "not_found"
  | "error";

export type NDBCObservationFetchResult = {
  observations: NDBCObservation[];
  status: NDBCObservationFetchStatus;
  error?: string;
  httpStatus?: number;
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

export async function getActiveNDBCStations(): Promise<NDBCStation[]> {
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
 * Parse NDBC realtime2 text into an array of observations.
 * Shared by both fetchRecentNDBCObservations and fetchLatestNDBCObservation.
 */
function parseRealtime2Text(
  text: string,
  maxRows: number
): NDBCObservation[] {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const headerIdx = lines.findIndex((l) => l.startsWith("#YY"));
  if (headerIdx === -1 || headerIdx + 1 >= lines.length) return [];

  const header = lines[headerIdx].replace(/^#/, "").trim().split(/\s+/);
  // NDBC files have a units line (#yr) after the header (#YY). It's not
  // explicitly skipped — the numeric checks on YY/MM/DD/hh reject it.
  const asNum = (val?: string) => (val && val !== "MM" ? Number(val) : NaN);

  const getFromDataLine = (dataLine: string[], name: string) => {
    const idx = header.indexOf(name);
    return idx >= 0 ? dataLine[idx] : undefined;
  };

  const results: NDBCObservation[] = [];

  for (
    let i = headerIdx + 1;
    i < lines.length && results.length < maxRows;
    i++
  ) {
    const dataLine = lines[i].trim().split(/\s+/);

    const yy = asNum(getFromDataLine(dataLine, "YY"));
    const mo = asNum(getFromDataLine(dataLine, "MM"));
    const dd = asNum(getFromDataLine(dataLine, "DD"));
    const hh = asNum(getFromDataLine(dataLine, "hh"));
    const mi = asNum(getFromDataLine(dataLine, "mm"));

    if (![yy, mo, dd, hh].every((n) => isFinite(n))) continue;

    // Handle both 2-digit (legacy) and 4-digit (current) NDBC year formats
    const year = yy > 99 ? Number(yy) : 2000 + Number(yy);
    const monthIdx = Math.max(0, Math.min(11, Number(mo) - 1));
    const day = Math.max(1, Math.min(31, Number(dd)));
    const hour = Math.max(0, Math.min(23, Number(hh)));
    const minute = isFinite(mi) ? Math.max(0, Math.min(59, Number(mi))) : 0;
    const ts = new Date(
      Date.UTC(year, monthIdx, day, hour, minute, 0)
    ).toISOString();

    const WVHT = asNum(getFromDataLine(dataLine, "WVHT")); // meters
    // NDBC uses 99.0 as a secondary missing-value marker for wave height
    if (!isFinite(WVHT) || WVHT === 99.0) continue;

    const DPD = asNum(getFromDataLine(dataLine, "DPD"));
    const MWD = asNum(getFromDataLine(dataLine, "MWD"));
    const WSPD = asNum(getFromDataLine(dataLine, "WSPD"));
    const WDIR = asNum(getFromDataLine(dataLine, "WDIR"));
    const WTMP = asNum(getFromDataLine(dataLine, "WTMP"));

    results.push({
      ts,
      wave_height_m: WVHT,
      wave_period_s: isFinite(DPD) ? DPD : null,
      wave_direction_deg: isFinite(MWD) ? MWD : null,
      wind_speed_ms: isFinite(WSPD) ? WSPD : null,
      wind_direction_deg: isFinite(WDIR) ? WDIR : null,
      water_temp_c: isFinite(WTMP) ? WTMP : null,
    });
  }

  return results;
}

/**
 * Fetch multiple recent observations from an NDBC realtime2 file.
 * Returns up to `maxRows` observations with valid wave data, newest-first.
 * Does NOT use the in-memory observation cache (designed for batch/cron use).
 */
export async function fetchRecentNDBCObservations(
  stationId: string,
  maxRows: number = 48
): Promise<NDBCObservation[]> {
  const result = await fetchRecentNDBCObservationsWithStatus(
    stationId,
    maxRows
  );
  return result.observations;
}

/**
 * Fetch multiple recent observations and classify source-health outcome.
 * A 200 response with only WVHT=MM rows is not a transport failure; it means
 * the station currently has no usable wave-height observations for ML truth.
 */
export async function fetchRecentNDBCObservationsWithStatus(
  stationId: string,
  maxRows: number = 48
): Promise<NDBCObservationFetchResult> {
  const url = `https://www.ndbc.noaa.gov/data/realtime2/${stationId}.txt`;
  try {
    const res = await fetchWithTimeout(url, { timeoutMs: 15000 });
    if (!res.ok) {
      return {
        observations: [],
        status: res.status === 404 ? "not_found" : "error",
        httpStatus: res.status,
      };
    }

    const text = await res.text();
    const observations = parseRealtime2Text(text, maxRows);
    return {
      observations,
      status: observations.length > 0 ? "ok" : "no_wave_data",
    };
  } catch (error) {
    return {
      observations: [],
      status: "error",
      error: error instanceof Error ? error.message : "Unknown NDBC fetch error",
    };
  }
}

/**
 * Fetch latest realtime2 observation file and parse header/row.
 * Uses in-memory cache with 10-minute TTL to reduce external API calls.
 * Delegates to parseRealtime2Text for consistent parsing logic.
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
    observationCache.set(stationId, { at: Date.now(), obs: null });
    return null;
  }

  const text = await res.text();
  // Parse first valid observation (searching up to 20 rows)
  const observations = parseRealtime2Text(text, 1);
  const obs = observations[0] ?? null;

  observationCache.set(stationId, { at: Date.now(), obs });
  return obs;
}
