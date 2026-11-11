/**
 * Fixture-backed BuoyPageSource for unit tests and `next dev` with
 * BUOY_PAGES_FIXTURES=1. Reads real NDBC and Open-Meteo captures from
 * __tests__/fixtures/ndbc-wave-stations at run time; nothing is bundled.
 */

import { readFileSync } from "node:fs";
import path from "node:path";

import { buildStationId, buildStationSlug } from "@/lib/services/wave-stations/catalogue";
import {
  cleanStationName,
  deriveNdbcLocation,
  parseActiveStationsXml,
  parseCdipStationId,
  parseLatestObs,
  parseSpecFile,
} from "@/lib/services/wave-stations/ndbc/parsers";
import type { StationBeaches } from "@/lib/services/wave-stations";
import type {
  WaveObservationValues,
  WaveStationObservationRow,
  WaveStationRow,
} from "@/lib/services/wave-stations/types";
import { haversineDistance } from "@/lib/utils/geo-utils";
import type { BeachForecastSummary } from "./beach-summaries";
import { parseModelResponse, type ModelSeries } from "./model-at-buoy";
import type { BuoyPageSource } from "./source";

const HOUR_MS = 60 * 60 * 1000;

function fixtureDir(): string {
  return path.join(process.cwd(), "__tests__", "fixtures", "ndbc-wave-stations");
}

function read(relative: string): string | null {
  try {
    return readFileSync(path.join(fixtureDir(), relative), "utf8");
  } catch {
    return null;
  }
}

const TXT_COLUMNS: Record<string, keyof WaveObservationValues> = {
  WDIR: "wind_direction_deg",
  WSPD: "wind_speed_ms",
  GST: "wind_gust_ms",
  WVHT: "wave_height_m",
  DPD: "dominant_period_s",
  APD: "average_period_s",
  MWD: "mean_wave_direction_deg",
  PRES: "pressure_hpa",
  ATMP: "air_temp_c",
  WTMP: "water_temp_c",
};

/** Minimal realtime2 .txt reader (test fixtures only). */
function parseRealtimeTxt(text: string): Array<{ observedAt: string; values: Partial<WaveObservationValues> }> {
  const lines = text.split("\n").filter((line) => line.trim());
  const header = lines[0]?.replace(/^#/, "").trim().split(/\s+/) ?? [];
  return lines
    .filter((line) => !line.startsWith("#"))
    .flatMap((line) => {
      const cells = line.trim().split(/\s+/);
      const [yy, mo, dd, hh, mi] = cells.map(Number);
      const at = Date.UTC(yy, mo - 1, dd, hh, mi);
      if (!Number.isFinite(at)) return [];
      const values: Partial<WaveObservationValues> = {};
      for (const [column, field] of Object.entries(TXT_COLUMNS)) {
        const token = cells[header.indexOf(column)];
        const value = token === undefined || token === "MM" ? NaN : Number(token);
        (values as Record<string, number | null>)[field] = Number.isFinite(value) ? value : null;
      }
      return [{ observedAt: new Date(at).toISOString(), values }];
    });
}

const EMPTY_VALUES: WaveObservationValues = {
  wave_height_m: null, dominant_period_s: null, average_period_s: null, mean_wave_direction_deg: null,
  swell_height_m: null, swell_period_s: null, swell_direction_deg: null, wind_wave_height_m: null,
  wind_wave_period_s: null, wind_wave_direction_deg: null, steepness: null, water_temp_c: null,
  air_temp_c: null, wind_speed_ms: null, wind_direction_deg: null, wind_gust_ms: null, pressure_hpa: null,
};

function mergeValues(
  target: Map<string, WaveStationObservationRow>,
  stationId: string,
  observedAt: string,
  values: Partial<WaveObservationValues>,
): void {
  const existing = target.get(observedAt) ?? {
    ...EMPTY_VALUES,
    station_id: stationId,
    observed_at: observedAt,
    source: "ndbc" as const,
    fetched_at: observedAt,
  };
  for (const [key, value] of Object.entries(values)) {
    if (value !== null && value !== undefined) (existing as unknown as Record<string, unknown>)[key] = value;
  }
  target.set(observedAt, existing);
}

interface FixtureSourceOptions {
  /** Move every timestamp so the newest capture lands 20 minutes before now. */
  shiftToNow?: boolean;
  nowMs?: number;
}

const FIXTURE_BEACHES: Record<string, StationBeaches> = {
  "ndbc:46225": {
    relation: "fed_by",
    beaches: [
      {
        id: "fixture-beach-blacks", name: "Blacks (fixture)", slug: null, state: "CA",
        lat: 32.889, lon: -117.253, distance_km: 13.6, links: ["cdip_station"],
      },
    ],
  },
};

export function createFixtureSource(options: FixtureSourceOptions = {}): BuoyPageSource {
  const xml = read("activestations.xml") ?? "";
  const latestObs = parseLatestObs(read("latest_obs.txt") ?? "#STN\n#text\n");
  const histories = new Map<string, Map<string, WaveStationObservationRow>>();

  for (const sourceId of ["46225", "46086"]) {
    const stationId = buildStationId("ndbc", sourceId);
    const rows = new Map<string, WaveStationObservationRow>();
    const txt = read(`buoy-pages/${sourceId}.txt`);
    if (txt) for (const obs of parseRealtimeTxt(txt)) mergeValues(rows, stationId, obs.observedAt, obs.values);
    const spec = read(`buoy-pages/${sourceId}.spec`);
    if (spec) for (const obs of parseSpecFile(spec, sourceId)) mergeValues(rows, stationId, obs.observedAt, obs.values);
    histories.set(stationId, rows);
  }
  for (const obs of latestObs) {
    const stationId = buildStationId("ndbc", obs.sourceStationId);
    const rows = histories.get(stationId) ?? new Map<string, WaveStationObservationRow>();
    if (!histories.has(stationId)) histories.set(stationId, rows);
    if (!rows.has(obs.observedAt)) mergeValues(rows, stationId, obs.observedAt, obs.values);
  }

  const newestCapture = Math.max(
    ...[...histories.values()].flatMap((rows) => [...rows.keys()].map((at) => Date.parse(at))),
  );
  const nowMs = options.nowMs ?? Date.now();
  const shiftMs = options.shiftToNow && Number.isFinite(newestCapture)
    ? Math.floor((nowMs - 20 * 60 * 1000 - newestCapture) / HOUR_MS) * HOUR_MS
    : 0;
  const shift = (iso: string): string => new Date(Date.parse(iso) + shiftMs).toISOString();

  const observations = new Map<string, WaveStationObservationRow[]>();
  for (const [stationId, rows] of histories) {
    observations.set(
      stationId,
      [...rows.values()]
        .map((row) => ({ ...row, observed_at: shift(row.observed_at), fetched_at: shift(row.fetched_at) }))
        .sort((a, b) => a.observed_at.localeCompare(b.observed_at)),
    );
  }

  const stations: WaveStationRow[] = parseActiveStationsXml(xml).map((raw) => {
    const id = buildStationId("ndbc", raw.id);
    const rows = observations.get(id) ?? [];
    const waves = rows.filter((row) => row.wave_height_m !== null);
    const location = deriveNdbcLocation(raw.rawName, raw.owner, raw.program);
    const name = cleanStationName(raw.rawName, raw.id);
    const hasSpec = rows.some((row) => row.swell_height_m !== null);
    return {
      id,
      source: "ndbc",
      source_station_id: raw.id,
      name,
      slug: buildStationSlug(name, raw.id),
      country_code: location.countryCode,
      region: location.region,
      lat: raw.lat,
      lon: raw.lon,
      station_type: raw.type,
      owner: raw.owner,
      program: raw.program,
      cdip_station_id: parseCdipStationId(raw.rawName),
      has_wave: waves.length > 0,
      has_swell_split: hasSpec,
      has_met: raw.hasMet,
      license: "public-domain-us-gov",
      attribution: raw.owner && raw.owner !== "NDBC"
        ? `NOAA National Data Buoy Center (NDBC); station operated by ${raw.owner}`
        : "NOAA National Data Buoy Center (NDBC)",
      active: true,
      first_seen_at: "2026-11-10T00:00:00.000Z",
      last_observed_at: rows[rows.length - 1]?.observed_at ?? null,
      last_wave_observed_at: waves[waves.length - 1]?.observed_at ?? null,
      spec_checked_at: null,
      spec_last_modified: null,
      spec_last_observed_at: null,
      created_at: "2026-11-10T00:00:00.000Z",
      updated_at: "2026-11-10T00:00:00.000Z",
    };
  });
  const byId = new Map(stations.map((station) => [station.id, station]));

  const model = (sourceId: string): ModelSeries | null => {
    const text = read(`buoy-pages/open-meteo-${sourceId}.json`);
    if (!text) return null;
    const parsed = parseModelResponse(JSON.parse(text));
    if (!parsed) return null;
    return { ...parsed, hours: parsed.hours.map((hour) => ({ ...hour, t: hour.t + shiftMs })) };
  };

  return {
    async getStationBySlug(slug) {
      return stations.find((station) => station.slug === slug) ?? null;
    },
    async findStationsByAlternateId(alternateId) {
      const lower = alternateId.toLowerCase();
      const n = /^\d+$/.test(alternateId) ? String(Number(alternateId)) : null;
      return stations
        .filter((station) =>
          station.source_station_id.toLowerCase() === lower
          || (n !== null && station.cdip_station_id !== null && String(Number(station.cdip_station_id)) === n))
        .map((station) => ({ id: station.id, slug: station.slug }));
    },
    async listStations(filter) {
      return stations
        .filter((station) => !filter.country || station.country_code === filter.country.toUpperCase())
        .filter((station) => !filter.region || station.region === filter.region.toUpperCase())
        .filter((station) => filter.includeNonWave || station.has_wave)
        .filter((station) => filter.includeInactive || station.active)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
    async getLatestObservation(stationId) {
      const rows = observations.get(stationId) ?? [];
      const waves = rows.filter((row) => row.wave_height_m !== null);
      return { latestWave: waves[waves.length - 1] ?? null, latestAny: rows[rows.length - 1] ?? null };
    },
    async getObservationHistory(stationId, hours) {
      const since = nowMs - hours * HOUR_MS;
      return (observations.get(stationId) ?? []).filter((row) => Date.parse(row.observed_at) >= since);
    },
    async getNearbyStations(lat, lon, limit) {
      return stations
        .filter((station) => station.has_wave && station.active)
        .map((station) => ({ ...station, distance_km: haversineDistance(lat, lon, station.lat, station.lon) }))
        .sort((a, b) => a.distance_km - b.distance_km)
        .slice(0, limit);
    },
    async getLatestWaveObservations(list) {
      const latest = new Map<string, WaveStationObservationRow>();
      for (const station of list) {
        const row = (observations.get(station.id) ?? []).find((obs) => obs.observed_at === station.last_wave_observed_at);
        if (row) latest.set(station.id, row);
      }
      return latest;
    },
    async getBeachesForStation(stationId) {
      return FIXTURE_BEACHES[stationId] ?? { relation: "nearby", beaches: [] };
    },
    async getBeachForecastSummaries(beachIds) {
      const summaries = new Map<string, BeachForecastSummary>();
      for (const id of beachIds) summaries.set(id, { href: null, city: "San Diego", forecastLabel: "2-3ft" });
      return summaries;
    },
    async fetchModelAtBuoy(lat, lon) {
      const station = stations
        .filter((candidate) => byId.has(candidate.id))
        .find((candidate) => Math.abs(candidate.lat - lat) < 1e-6 && Math.abs(candidate.lon - lon) < 1e-6);
      return station ? model(station.source_station_id) : null;
    },
  };
}
