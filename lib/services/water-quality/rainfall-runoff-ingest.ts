import {
  COUNTY_RAIN_CLUSTER,
  INGEST_RAIN_CLUSTERS,
  MIN_STATION_HOURS,
  RAIN_STATIONS,
  clusterRainfall,
  stationRainfall,
  type AwcMetar,
  type RainfallReading,
  type StationRainfall,
} from "./rainfall-runoff";
import { rainEventRegion, type MetarRainSignal } from "./rain-advisory-events";

interface RainfallIngestDeps {
  fetchMetars: (icao: string) => Promise<AwcMetar[]>;
  writeReadings: (readings: RainfallReading[]) => Promise<void>;
  now?: Date;
}

interface RainfallIngestResult {
  written: number;
  skipped: string[];
  readings: RainfallReading[];
  signals: MetarRainSignal[];
}

const AWC_URL = "https://aviationweather.gov/api/data/metar";

/** One station per request: AWC truncates multi-station responses at ~400 reports. */
export async function fetchAwcMetars(icao: string): Promise<AwcMetar[]> {
  const response = await fetch(`${AWC_URL}?ids=${encodeURIComponent(icao)}&format=json&hours=74`, {
    headers: { "User-Agent": "Quiver Rainfall Runoff/1.0 (https://www.quiversurf.app/about)" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!response.ok) throw new Error(`AWC ${icao} HTTP ${response.status}`);
  const body: unknown = await response.json();
  if (!Array.isArray(body)) throw new Error(`AWC ${icao} returned a non-array body`);
  return body as AwcMetar[];
}

/**
 * San Diego needs all three stations, as the County expiry always has. Elsewhere
 * the usable stations decide, as the cluster total does, so one gappy station
 * cannot pin an advisory up; any fetched station reporting rain still blocks.
 */
function dryConfirmed(
  cluster: (typeof INGEST_RAIN_CLUSTERS)[number],
  stations: Readonly<Record<string, StationRainfall>>,
  anyRain: boolean,
): boolean {
  if (anyRain) return false;
  const usable = Object.values(stations).filter((station) => station.hours >= MIN_STATION_HOURS);
  if (cluster.id === COUNTY_RAIN_CLUSTER.id && usable.length !== cluster.stations.length) return false;
  return usable.length > 0 && usable.every((station) => station.total_in === 0);
}

export async function runRainfallRunoffIngest(deps: RainfallIngestDeps): Promise<RainfallIngestResult> {
  const now = deps.now ?? new Date();
  const windowEnd = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const perStation = new Map<string, StationRainfall>();
  // Sequential with one retry: AWC times out under bursts of parallel requests.
  for (const icao of RAIN_STATIONS) {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        perStation.set(icao, stationRainfall(await deps.fetchMetars(icao), windowEnd));
        break;
      } catch (error) {
        if (attempt === 2) console.warn(`[rainfall-runoff] ${icao} unavailable`, error instanceof Error ? error.message : error);
      }
    }
  }

  const readings: RainfallReading[] = [];
  const skipped: string[] = [];
  const signals: MetarRainSignal[] = [];
  for (const cluster of INGEST_RAIN_CLUSTERS) {
    const stations = Object.fromEntries(cluster.stations
      .filter((icao) => perStation.has(icao))
      .map((icao) => [icao, perStation.get(icao) as StationRainfall]));
    const total = clusterRainfall(stations);
    if (Object.keys(stations).length > 0) {
      const rainTimes = Object.values(stations).map((station) => station.last_rain_at).filter((time): time is string => time !== null);
      const signal = { windowEnd: windowEnd.toISOString(), totalIn: total,
        lastRainAt: rainTimes.length ? rainTimes.reduce((a, b) => Date.parse(a) > Date.parse(b) ? a : b) : null,
        dryConfirmed: dryConfirmed(cluster, stations, rainTimes.length > 0),
        stations: Object.keys(stations),
      };
      // San Diego rain both extends the County's event and opens our own gauge event.
      signals.push({ region: cluster.id, ...signal });
      if (rainEventRegion(cluster.id) !== cluster.id) signals.push({ region: rainEventRegion(cluster.id), ...signal });
    }
    if (total === null) { skipped.push(cluster.id); continue; }
    readings.push({
      cluster_id: cluster.id,
      window_end: windowEnd.toISOString(),
      total_in: total,
      // An incomplete County station must not count as dry when clearing the advisory.
      station_totals: Object.fromEntries(Object.entries(stations)
        .filter(([, s]) => cluster.id !== COUNTY_RAIN_CLUSTER.id || s.hours >= MIN_STATION_HOURS)
        .map(([icao, s]) => [icao, s.total_in])),
    });
  }
  if (readings.length) await deps.writeReadings(readings);
  return { written: readings.length, skipped, readings, signals };
}
