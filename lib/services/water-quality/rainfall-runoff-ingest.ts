import {
  INGEST_RAIN_CLUSTERS,
  RAIN_STATIONS,
  clusterRainfall,
  stationRainfall,
  type AwcMetar,
  type RainfallReading,
  type StationRainfall,
} from "./rainfall-runoff";

interface RainfallIngestDeps {
  fetchMetars: (icao: string) => Promise<AwcMetar[]>;
  writeReadings: (readings: RainfallReading[]) => Promise<void>;
  now?: Date;
}

interface RainfallIngestResult {
  written: number;
  skipped: string[];
  readings: RainfallReading[];
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
  for (const cluster of INGEST_RAIN_CLUSTERS) {
    const stations = Object.fromEntries(cluster.stations
      .filter((icao) => perStation.has(icao))
      .map((icao) => [icao, perStation.get(icao) as StationRainfall]));
    const total = clusterRainfall(stations);
    if (total === null) { skipped.push(cluster.id); continue; }
    readings.push({
      cluster_id: cluster.id,
      window_end: windowEnd.toISOString(),
      total_in: total,
      station_totals: Object.fromEntries(Object.entries(stations).map(([icao, s]) => [icao, s.total_in])),
    });
  }
  if (readings.length) await deps.writeReadings(readings);
  return { written: readings.length, skipped, readings };
}
