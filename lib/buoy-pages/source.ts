/**
 * Everything a buoy page reads, behind one interface so tests and local
 * fixture runs can render real-shaped data without the remote catalogue.
 */

import {
  getBeachesForStation,
  getLatestObservation,
  getNearbyStations,
  getObservationHistory,
  getStationBySlug,
  getStationSlugById,
  listStations,
  type LatestObservation,
  type ListStationsFilter,
  type NearbyWaveStation,
  type StationBeaches,
} from "@/lib/services/wave-stations";
import {
  findStationsByAlternateId,
  getLatestWaveObservations,
  type LatestWaveReading,
  type StationIdMatch,
} from "@/lib/services/wave-stations/lookup";
import type { WaveStationObservationRow, WaveStationRow } from "@/lib/services/wave-stations/types";
import { getBeachForecastSummaries, type BeachForecastSummary } from "./beach-summaries";
import { fetchModelAtBuoy, type ModelSeries } from "./model-at-buoy";

export interface BuoyPageSource {
  getStationBySlug(slug: string): Promise<WaveStationRow | null>;
  getStationSlugById(id: string): Promise<string | null>;
  findStationsByAlternateId(alternateId: string): Promise<StationIdMatch[]>;
  listStations(filter: ListStationsFilter): Promise<WaveStationRow[]>;
  getLatestObservation(stationId: string): Promise<LatestObservation>;
  getObservationHistory(stationId: string, hours: number): Promise<WaveStationObservationRow[]>;
  getNearbyStations(lat: number, lon: number, limit: number): Promise<NearbyWaveStation[]>;
  getLatestWaveObservations(
    stations: Array<Pick<WaveStationRow, "id" | "last_wave_observed_at">>,
  ): Promise<Map<string, LatestWaveReading>>;
  getBeachesForStation(stationId: string): Promise<StationBeaches>;
  getBeachForecastSummaries(beachIds: string[], now: Date): Promise<Map<string, BeachForecastSummary>>;
  fetchModelAtBuoy(lat: number, lon: number): Promise<ModelSeries | null>;
}

const catalogueSource: BuoyPageSource = {
  getStationBySlug: (slug) => getStationBySlug(slug),
  getStationSlugById: (id) => getStationSlugById(id),
  findStationsByAlternateId: (alternateId) => findStationsByAlternateId(alternateId),
  listStations: (filter) => listStations(filter),
  getLatestObservation: (stationId) => getLatestObservation(stationId),
  getObservationHistory: (stationId, hours) => getObservationHistory(stationId, hours),
  getNearbyStations: (lat, lon, limit) => getNearbyStations(lat, lon, limit),
  getLatestWaveObservations: (stations) => getLatestWaveObservations(stations),
  getBeachesForStation: (stationId) => getBeachesForStation(stationId),
  getBeachForecastSummaries: (beachIds, now) => getBeachForecastSummaries(beachIds, now),
  fetchModelAtBuoy: (lat, lon) => fetchModelAtBuoy(lat, lon),
};

/**
 * `next dev` with BUOY_PAGES_FIXTURES=1 renders from the captured NDBC files in
 * __tests__/fixtures (read from disk at run time, never bundled). Production
 * and preview builds always read the catalogue.
 */
export async function getBuoyPageSource(): Promise<BuoyPageSource> {
  if (process.env.NODE_ENV === "development" && process.env.BUOY_PAGES_FIXTURES === "1") {
    const { createFixtureSource } = await import("./dev-fixture-source");
    return createFixtureSource({ shiftToNow: true });
  }
  return catalogueSource;
}

const MISSING_OBJECT_CODES = new Set(["PGRST205", "PGRST202", "42P01", "42883"]);
const CATALOGUE_OBJECTS = /\b(wave_stations|wave_station_observations|get_nearby_wave_stations)\b/;
const MISSING_OBJECT_MESSAGE = /could not find the (table|function)|relation .* does not exist|function .* does not exist/i;

/**
 * True only when a catalogue table or RPC does not exist yet (migration not
 * applied): PostgREST PGRST205/PGRST202 or Postgres 42P01, naming one of the
 * catalogue objects. Pages treat that as "no stations" (a real 404). A missing
 * column, a timeout or any other error is rethrown, so ISR keeps serving the
 * last good page instead of caching a 404.
 */
export function isMissingCatalogueError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  if (!CATALOGUE_OBJECTS.test(message)) return false;
  const code = (error as { code?: unknown } | null)?.code;
  if (typeof code === "string" && code) return MISSING_OBJECT_CODES.has(code);
  return MISSING_OBJECT_MESSAGE.test(message);
}

export async function orEmptyWhenMissing<T>(read: () => Promise<T>, empty: T): Promise<T> {
  try {
    return await read();
  } catch (error) {
    if (isMissingCatalogueError(error)) return empty;
    throw error;
  }
}
