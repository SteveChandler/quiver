/**
 * The buoy reading behind one beach, for GET /api/beaches/[id]/buoy (native
 * app). Same rules as the station page: one "Now" row, the same reading
 * sentence and status. Metric units, ISO timestamps.
 */

import { SITE_URL } from "@/lib/constants/seo";
import type { WaveStationObservationRow } from "@/lib/services/wave-stations/types";
import { stationPath } from "./geo-names";
import { buildReadingSentence } from "./reading";
import { buildTrendSeries, computeHeightTrend, selectNowObservation, type TrendDirection } from "./series";
import type { BuoyPageSource } from "./source";
import { classifyStationStatus, type StationStatus } from "./status";

const HOUR_MS = 60 * 60 * 1000;
const HISTORY_HOURS = 48;
// Read one extra hour; the chart keeps the last 48 h (the trend needs only 7 h).
const READ_HOURS = HISTORY_HOURS + 1;

export interface BeachBuoyNow {
  waveHeightM: number | null;
  dominantPeriodS: number | null;
  meanWaveDirectionDeg: number | null;
  swellHeightM: number | null;
  swellPeriodS: number | null;
  swellDirectionDeg: number | null;
  windWaveHeightM: number | null;
  windWavePeriodS: number | null;
  windWaveDirectionDeg: number | null;
  waterTempC: number | null;
}

export interface BeachBuoyHistoryPoint {
  t: string;
  hs: number | null;
  dpd: number | null;
  swH: number | null;
  swP: number | null;
  wwH: number | null;
}

export interface BeachBuoyPayload {
  relation: "forecast_station" | "nearby";
  distanceKm: number | null;
  station: {
    id: string;
    slug: string;
    name: string;
    sourceStationId: string;
    lat: number;
    lon: number;
    countryCode: string | null;
    region: string | null;
    hasSwellSplit: boolean;
    attribution: string;
    license: string;
    webUrl: string;
  };
  status: StationStatus;
  /** Time of the row `now` and `reading` come from. */
  observedAt: string | null;
  now: BeachBuoyNow | null;
  reading: string | null;
  trend: { direction: TrendDirection; deltaM: number } | null;
  history: BeachBuoyHistoryPoint[];
}

type BeachBuoyResult =
  | { kind: "beach-not-found" }
  | { kind: "no-station" }
  | { kind: "found"; payload: BeachBuoyPayload };

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toNow(row: WaveStationObservationRow): BeachBuoyNow {
  return {
    waveHeightM: row.wave_height_m,
    dominantPeriodS: row.dominant_period_s,
    meanWaveDirectionDeg: row.mean_wave_direction_deg,
    swellHeightM: row.swell_height_m,
    swellPeriodS: row.swell_period_s,
    swellDirectionDeg: row.swell_direction_deg,
    windWaveHeightM: row.wind_wave_height_m,
    windWavePeriodS: row.wind_wave_period_s,
    windWaveDirectionDeg: row.wind_wave_direction_deg,
    waterTempC: row.water_temp_c,
  };
}

export async function loadBeachBuoy(source: BuoyPageSource, beachId: string, now: Date): Promise<BeachBuoyResult> {
  const lookup = await source.getStationForBeach(beachId);
  if (lookup.kind !== "found") return lookup;
  const { station, relation, distance_km } = lookup.match;

  const nowMs = now.getTime();
  const [latest, rows] = await Promise.all([
    source.getLatestObservation(station.id),
    source.getObservationHistory(station.id, READ_HOURS),
  ]);

  const status = station.has_wave
    ? classifyStationStatus(station.last_wave_observed_at ?? latest.latestWave?.observed_at, nowMs)
    : "offline";
  // Every "now" field, observedAt and the reading come from this one row.
  const nowRow = status !== "offline" ? selectNowObservation(station.has_swell_split, latest.latestWave, rows) : null;
  // "Over the last 6 hours" is only true while the reading is fresh.
  const heightTrend = nowRow && status === "fresh" ? computeHeightTrend(rows) : null;
  const historyStart = nowMs - HISTORY_HOURS * HOUR_MS;

  return {
    kind: "found",
    payload: {
      relation,
      distanceKm: Number.isFinite(distance_km) ? roundTo(distance_km, 1) : null,
      station: {
        id: station.id,
        slug: station.slug,
        name: station.name,
        sourceStationId: station.source_station_id,
        lat: station.lat,
        lon: station.lon,
        countryCode: station.country_code,
        region: station.region,
        hasSwellSplit: station.has_swell_split,
        attribution: station.attribution,
        license: station.license,
        webUrl: `${SITE_URL}${stationPath(station.slug)}`,
      },
      status,
      observedAt: nowRow?.observed_at ?? null,
      now: nowRow ? toNow(nowRow) : null,
      reading: nowRow ? buildReadingSentence(nowRow, heightTrend) : null,
      trend: heightTrend ? { direction: heightTrend.direction, deltaM: roundTo(heightTrend.deltaM, 2) } : null,
      history: buildTrendSeries(rows.filter((row) => Date.parse(row.observed_at) >= historyStart))
        .map((point) => ({
          t: new Date(point.t).toISOString(),
          hs: point.hs,
          dpd: point.dpd,
          swH: point.swH,
          swP: point.swP,
          wwH: point.wwH,
        })),
    },
  };
}
