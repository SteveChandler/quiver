import {
  fetchHighLowTidePredictions,
  fetchHourlyTidePredictions,
} from "@/lib/services/noaa-tide-service";
import { seaLevelOffsetFt } from "@/lib/services/noaa-coops/api-client";

import { predictExtremesFromConstituents, predictHourlyFromConstituents } from "./harmonics";
import type { TideExtremePoint, TideHeightPoint } from "./series";
import type { TideStationRow } from "./types";

const HOUR_MS = 3_600_000;
/** One day back so "now" sits inside the series; nine ahead so a cached page still covers a full week. */
const WINDOW_BACK_MS = 24 * HOUR_MS;
const WINDOW_AHEAD_MS = 9 * 24 * HOUR_MS;

export type StationSeries =
  | {
      status: "ok";
      /** Hourly heights, or empty when the source publishes only highs and lows. */
      hourly: TideHeightPoint[];
      extremes: TideExtremePoint[];
      windowStart: string;
      windowEnd: string;
      /** Feet Quiver adds to NOAA's table (California sea-level adjustment). */
      adjustmentFt: number;
    }
  | { status: "failed"; reason: string };

function stationSeriesWindow(nowMs: number): { start: Date; end: Date } {
  const hour = Math.floor(nowMs / HOUR_MS) * HOUR_MS;
  return { start: new Date(hour - WINDOW_BACK_MS), end: new Date(hour + WINDOW_AHEAD_MS) };
}

export function computeHarmonicSeries(station: TideStationRow, nowMs: number): StationSeries {
  if (!station.constituents?.length) return { status: "failed", reason: "no-constituents" };
  const { start, end } = stationSeriesWindow(nowMs);
  const offset = station.datum_offset_m ?? 0;
  const hourly = predictHourlyFromConstituents(station.constituents, offset, start, end);
  const extremes = predictExtremesFromConstituents(station.constituents, offset, start, end);
  if (!extremes.length) return { status: "failed", reason: "no-extremes" };
  return {
    status: "ok",
    hourly,
    extremes,
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
    adjustmentFt: 0,
  };
}

const FT_TO_M = 0.3048;

/**
 * Feet of sea-level adjustment on top of NOAA's table. noaa-tide-service adds it
 * by id prefix (941*), which misses California subordinate stations with other
 * ids (TWC0439 Mormon Island sits beside 9410660 LA Outer Harbor). Those take
 * their reference station's adjustment, so neighbours on one page agree.
 * Returns the extra feet this module must add, and the total shown on the page.
 */
export function californiaAdjustment(
  station: Pick<TideStationRow, "source_station_id" | "reference_station_id" | "country_code" | "region">
): { appliedByServiceFt: number; extraFt: number } {
  const appliedByServiceFt = seaLevelOffsetFt(station.source_station_id);
  if (appliedByServiceFt !== 0) return { appliedByServiceFt, extraFt: 0 };
  const inCalifornia = station.country_code === "US" && station.region === "CA";
  if (!inCalifornia || !station.reference_station_id) return { appliedByServiceFt: 0, extraFt: 0 };
  return { appliedByServiceFt: 0, extraFt: seaLevelOffsetFt(station.reference_station_id) };
}

async function fetchNoaaSeries(station: TideStationRow, nowMs: number): Promise<StationSeries> {
  const { start, end } = stationSeriesWindow(nowMs);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const id = station.source_station_id;
  // Subordinate stations answer only interval=hilo; the curve is drawn from their extremes.
  // A failed hourly call is not a failed page: the curve falls back to the extremes too.
  const [extremes, hourly] = await Promise.all([
    fetchHighLowTidePredictions(id, startIso, endIso),
    station.station_kind === "reference"
      ? fetchHourlyTidePredictions(id, startIso, endIso).catch((error: unknown) => {
          console.warn("Tide station hourly predictions failed", {
            stationId: station.id,
            message: error instanceof Error ? error.message : "Unknown error",
          });
          return [];
        })
      : Promise.resolve([]),
  ]);
  if (!extremes.length) return { status: "failed", reason: "noaa-empty" };
  const { appliedByServiceFt, extraFt } = californiaAdjustment(station);
  const extraM = extraFt * FT_TO_M;
  const adjust = (heightM: number): number => Math.round((heightM + extraM) * 1000) / 1000;
  return {
    status: "ok",
    hourly: hourly.map((p) => ({ ts: p.ts, heightM: adjust(p.tide_height_m) })),
    extremes: extremes.map((p) => ({ ts: p.ts, type: p.type, heightM: adjust(p.tide_height_m) })),
    windowStart: startIso,
    windowEnd: endIso,
    adjustmentFt: appliedByServiceFt + extraFt,
  };
}

export async function getStationSeries(station: TideStationRow, nowMs: number): Promise<StationSeries> {
  if (station.source === "ticon") return computeHarmonicSeries(station, nowMs);
  try {
    return await fetchNoaaSeries(station, nowMs);
  } catch (error) {
    console.warn("Tide station predictions failed", {
      stationId: station.id,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return { status: "failed", reason: "noaa-error" };
  }
}
