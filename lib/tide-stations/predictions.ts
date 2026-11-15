import { unstable_cache } from "next/cache";
import { NoaaTideRequestError } from "@/lib/services/noaa-coops/datagetter";
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
 * through seaLevelOffsetFt, which knows the 941* ids and the subordinate stations
 * NOAA listed under a 941* reference on Nov 14 2026. A station added since then
 * still gets it here from tide_stations.reference_station_id. A subordinate
 * station's table is its reference station's table plus offsets, so it takes the
 * reference station's adjustment in any region (Steven, Nov 11 2026).
 * Returns the extra feet this module must add, and the total shown on the page.
 */
export function californiaAdjustment(
  station: Pick<TideStationRow, "source_station_id" | "reference_station_id">
): { appliedByServiceFt: number; extraFt: number } {
  const appliedByServiceFt = seaLevelOffsetFt(station.source_station_id);
  if (appliedByServiceFt !== 0) return { appliedByServiceFt, extraFt: 0 };
  if (!station.reference_station_id) return { appliedByServiceFt: 0, extraFt: 0 };
  return { appliedByServiceFt: 0, extraFt: seaLevelOffsetFt(station.reference_station_id) };
}

async function fetchNoaaSeries(station: TideStationRow, nowMs: number): Promise<StationSeries> {
  const { start, end } = stationSeriesWindow(nowMs);
  // Daily snapshots include a buffer so yesterday's data can cover today's whole request.
  start.setTime(start.getTime() - 24 * HOUR_MS);
  end.setTime(end.getTime() + 2 * 24 * HOUR_MS);
  const startIso = start.toISOString();
  const endIso = end.toISOString();
  const id = station.source_station_id;
  // Subordinate stations answer only interval=hilo; the curve is drawn from their extremes.
  // A failed hourly call is not a failed page: the curve falls back to the extremes too.
  const [extremeResult, hourlyResult] = await Promise.allSettled([
    fetchHighLowTidePredictions(id, startIso, endIso),
    station.station_kind === "reference"
      ? fetchHourlyTidePredictions(id, startIso, endIso)
      : Promise.resolve([]),
  ]);
  // Inspect both failures before falling back: a faster transport failure must not hide a parser bug.
  for (const result of [extremeResult, hourlyResult]) {
    if (result.status === "rejected" && !(result.reason instanceof NoaaTideRequestError)) {
      throw result.reason;
    }
  }
  if (extremeResult.status === "rejected") throw extremeResult.reason;
  const extremes = extremeResult.value;
  const hourly = hourlyResult.status === "fulfilled" ? hourlyResult.value : [];
  if (hourlyResult.status === "rejected") {
    console.warn("Tide station hourly predictions failed", {
      stationId: station.id,
      message: hourlyResult.reason.message,
    });
  }
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

type GoodStationSeries = Extract<StationSeries, { status: "ok" }>;
class NoLastGoodTidesError extends Error {}

function dailySnapshot(
  station: TideStationRow,
  day: number,
  series?: GoodStationSeries,
): Promise<GoodStationSeries> {
  // Immutable daily entries use the SAME loader for writes and reads (Next keys include its source).
  // A miss throws instead of persisting an empty value; false preserves the page's 12 h ISR.
  return unstable_cache(
    async (): Promise<GoodStationSeries> => {
      if (!series) throw new NoLastGoodTidesError();
      return series;
    },
    ["noaa-station-last-good-v1", station.source_station_id, station.station_kind,
      station.reference_station_id ?? "", String(day)],
    { revalidate: false },
  )();
}

function coversWindow(series: GoodStationSeries, start: Date, end: Date): boolean {
  const startMs = start.getTime();
  const endMs = end.getTime();
  if (Date.parse(series.windowStart) > startMs || Date.parse(series.windowEnd) < endMs) return false;
  const spansWindow = (points: Array<{ ts: string }>): boolean =>
    points.length > 0 && Date.parse(points[0].ts) <= startMs &&
    Date.parse(points[points.length - 1].ts) >= endMs;
  if (!spansWindow(series.extremes)) return false;
  return series.hourly.length === 0 || (spansWindow(series.hourly) && series.hourly.every((p, i, points) =>
    i === 0 || Date.parse(p.ts) - Date.parse(points[i - 1].ts) <= HOUR_MS));
}

function trimToWindow(series: GoodStationSeries, start: Date, end: Date): GoodStationSeries {
  const within = (p: { ts: string }): boolean =>
    Date.parse(p.ts) >= start.getTime() && Date.parse(p.ts) <= end.getTime();
  return {
    ...series,
    hourly: series.hourly.filter(within),
    extremes: series.extremes.filter(within),
    windowStart: start.toISOString(),
    windowEnd: end.toISOString(),
  };
}

/** Only real, covering predictions can rescue a NOAA transport failure. */
export async function getStationSeries(station: TideStationRow, nowMs: number): Promise<StationSeries> {
  if (station.source === "ticon") return computeHarmonicSeries(station, nowMs);
  const { start, end } = stationSeriesWindow(nowMs);
  const day = Math.floor(nowMs / (24 * HOUR_MS));
  try {
    const series = await fetchNoaaSeries(station, day * 24 * HOUR_MS);
    if (series.status !== "ok") return series;
    await dailySnapshot(station, day, series);
    return trimToWindow(series, start, end);
  } catch (error) {
    if (!(error instanceof NoaaTideRequestError)) throw error;
    for (const snapshotDay of [day, day - 1, day - 2]) {
      try {
        const series = await dailySnapshot(station, snapshotDay);
        if (coversWindow(series, start, end)) return trimToWindow(series, start, end);
      } catch (cacheError) {
        if (!(cacheError instanceof NoLastGoodTidesError)) throw cacheError;
      }
    }
    console.warn("Tide station predictions failed", {
      stationId: station.id,
      message: error.message,
    });
    throw error;
  }
}
