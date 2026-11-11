/**
 * Hub data for /buoys, /buoys/[country] and /buoys/[country]/[region]. One
 * station list read plus one batched latest-reading read per 100 stations.
 */

import type { LatestWaveReading } from "@/lib/services/wave-stations/lookup";
import type { WaveStationRow } from "@/lib/services/wave-stations/types";
import { countryName, regionName } from "./geo-names";
import { orEmptyWhenMissing, type BuoyPageSource } from "./source";
import { classifyStationStatus, evaluateStationIndexability, type StationStatus } from "./status";

export interface HubStation {
  station: WaveStationRow;
  latest: LatestWaveReading | null;
  status: StationStatus;
  indexable: boolean;
}

export interface HubGroup {
  /** Region code, or null for stations without one. */
  code: string | null;
  name: string;
  stations: HubStation[];
}

interface CountrySummary {
  code: string;
  name: string;
  stationCount: number;
  liveCount: number;
}

function toHubStation(
  station: WaveStationRow,
  latest: Map<string, LatestWaveReading>,
  nowMs: number,
): HubStation {
  const status = classifyStationStatus(station.last_wave_observed_at, nowMs);
  return {
    station,
    latest: status === "offline" ? null : latest.get(station.id) ?? null,
    status,
    indexable: evaluateStationIndexability(station, nowMs).indexable,
  };
}

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name);

interface RootHub {
  countries: CountrySummary[];
  /** Stations the registry could not place in a country (open ocean, unknown owner). */
  unplaced: HubStation[];
  all: WaveStationRow[];
}

export async function loadRootHub(source: BuoyPageSource, now: Date): Promise<RootHub | null> {
  const stations = await orEmptyWhenMissing(() => source.listStations({}), []);
  if (stations.length === 0) return null;
  const nowMs = now.getTime();
  const counts = new Map<string, CountrySummary>();
  const unplacedRows: WaveStationRow[] = [];
  for (const station of stations) {
    if (!station.country_code) {
      unplacedRows.push(station);
      continue;
    }
    const summary = counts.get(station.country_code) ?? {
      code: station.country_code,
      name: countryName(station.country_code),
      stationCount: 0,
      liveCount: 0,
    };
    summary.stationCount += 1;
    if (classifyStationStatus(station.last_wave_observed_at, nowMs) === "fresh") summary.liveCount += 1;
    counts.set(station.country_code, summary);
  }
  const latest = await source.getLatestWaveObservations(unplacedRows);
  return {
    countries: [...counts.values()].sort((a, b) => b.stationCount - a.stationCount || a.name.localeCompare(b.name)),
    unplaced: unplacedRows.map((station) => toHubStation(station, latest, nowMs)).sort((a, b) => byName(a.station, b.station)),
    all: stations,
  };
}

export interface AreaHub {
  countryCode: string;
  regionCode: string | null;
  groups: HubGroup[];
  stationCount: number;
  liveCount: number;
  indexableCount: number;
}

/** Country hub (grouped by region) or region hub (one group). Null when there are no stations. */
export async function loadAreaHub(
  source: BuoyPageSource,
  countryCode: string,
  regionCode: string | null,
  now: Date,
): Promise<AreaHub | null> {
  const country = countryCode.toUpperCase();
  const region = regionCode?.toUpperCase() ?? null;
  const stations = await orEmptyWhenMissing(
    () => source.listStations({ country, ...(region ? { region } : {}) }),
    [],
  );
  if (stations.length === 0) return null;
  const nowMs = now.getTime();
  const latest = await source.getLatestWaveObservations(stations);
  const groups = new Map<string, HubGroup>();
  for (const station of stations) {
    const key = station.region ?? "";
    const group = groups.get(key) ?? {
      code: station.region,
      name: station.region ? regionName(country, station.region) : "Offshore and other waters",
      stations: [],
    };
    group.stations.push(toHubStation(station, latest, nowMs));
    groups.set(key, group);
  }
  const sorted = [...groups.values()]
    .map((group) => ({ ...group, stations: group.stations.sort((a, b) => byName(a.station, b.station)) }))
    // Named regions first, alphabetically; the unnamed group last.
    .sort((a, b) => (a.code === null ? 1 : 0) - (b.code === null ? 1 : 0) || a.name.localeCompare(b.name));
  const all = sorted.flatMap((group) => group.stations);
  return {
    countryCode: country,
    regionCode: region,
    groups: sorted,
    stationCount: all.length,
    liveCount: all.filter((item) => item.status === "fresh").length,
    indexableCount: all.filter((item) => item.indexable).length,
  };
}

/** Pins for a static map, one per 0.1° cell so a busy coast stays under the URL limit. */
export function mapPins(stations: Array<Pick<WaveStationRow, "lat" | "lon">>, maxPins = 250): Array<{ latitude: number; longitude: number }> {
  const cells = new Map<string, { latitude: number; longitude: number }>();
  for (const station of stations) {
    const latitude = Math.round(station.lat * 10) / 10;
    const longitude = Math.round(station.lon * 10) / 10;
    cells.set(`${latitude},${longitude}`, { latitude, longitude });
  }
  return [...cells.values()].slice(0, maxPins);
}
