import { cache } from "react";

import { getTideMetaData, tideExtremesWindow, type TideMetaData } from "@/lib/seo/tide-meta-data";
import { formatStationTime } from "@/lib/tide-stations/format";
import { metresToFeet, type TideExtremePoint } from "@/lib/tide-stations/series";
import { loadStationTideView, type CityTideView } from "@/lib/tides/city-tide-view";
import type { TideScheduleEntry } from "@/types/forecast";

/**
 * The NOAA station table a beach's tide rows come from, in the shape the beach
 * page's client tide modules already read (`raw_forecast.tide_schedule`).
 */
export interface BeachStationTide {
  timeZone: string;
  stationName: string;
  /** Seconds since epoch, feet, high/low: the TideScheduleEntry shape. */
  schedule: TideScheduleEntry[];
}

interface BeachTidePageData {
  /** What the page shows: the station's own highs and lows when the table loaded. */
  display: TideMetaData;
  /**
   * The stored-row read. Indexing and the sitemap decide "has tide data" from
   * these rows, so a NOAA outage never changes whether the page is indexed.
   */
  rows: TideMetaData;
  stationTide: BeachStationTide | null;
  /** The station view the page shows above the fold: the same one `/tide/<city>` renders. */
  view: CityTideView | null;
}

/** Same rounding as formatFeet on the station page, so 5.65 ft prints the same everywhere. */
function roundFeet(heightM: number): number {
  const feet = Number(metresToFeet(heightM).toFixed(1));
  return Object.is(feet, -0) ? 0 : feet;
}

function firstAfter(
  extremes: TideExtremePoint[],
  type: TideExtremePoint["type"],
  fromMs: number,
  toMs: number
): TideExtremePoint | null {
  return (
    extremes.find((e) => {
      const ms = Date.parse(e.ts);
      return e.type === type && ms > fromMs && ms <= toMs;
    }) ?? null
  );
}

/**
 * Next high and low from the station view, over the same 24 hours the stored-row
 * search covers (the display times carry no date). Time, height and timestamp of
 * each come from one extreme, so they cannot disagree.
 */
export function stationTideMeta(rows: TideMetaData, view: CityTideView, nowMs: number): TideMetaData {
  const toMs = Date.parse(tideExtremesWindow(new Date(nowMs)).to);
  const high = firstAfter(view.extremes, "high", nowMs, toMs);
  const low = firstAfter(view.extremes, "low", nowMs, toMs);
  return {
    ...rows,
    nextHighTime: high ? formatStationTime(high.ts, view.timeZone) : null,
    nextLowTime: low ? formatStationTime(low.ts, view.timeZone) : null,
    nextHighHeight: high ? roundFeet(high.heightM) : null,
    nextLowHeight: low ? roundFeet(low.heightM) : null,
    nextHighAt: high?.ts ?? null,
    nextLowAt: low?.ts ?? null,
  };
}

export function toBeachStationTide(view: CityTideView): BeachStationTide | null {
  if (!view.station || view.extremes.length === 0) return null;
  return {
    timeZone: view.timeZone,
    stationName: view.station.name,
    schedule: view.extremes.map((e) => ({
      time: Math.floor(Date.parse(e.ts) / 1000),
      // Unrounded: the client rounds once with toFixed(1), as formatFeet does. A second rounding printed 5.7 for 5.6.
      height: metresToFeet(e.heightM),
      type: e.type,
    })),
  };
}

/**
 * The beach tide page's tide data. The hero, title, dataset schema and client
 * tide modules all read the station table that `/tide/<city>` and
 * `/tides/station/...` show, so every page prints the same minute. Without a
 * station table (model tides, no registry row, NOAA down) everything stays on
 * the stored rows, as before.
 *
 * React-cached so generateMetadata and the page share one read.
 */
export const getBeachTidePageData = cache(
  async (beachId: string, beachTimezone?: string | null): Promise<BeachTidePageData> => {
    const rows = await getTideMetaData(beachId, beachTimezone);
    if (rows.availability || !rows.stationId) return { display: rows, rows, stationTide: null, view: null };
    const nowMs = Date.now();
    const view = await loadStationTideView(rows.stationId, nowMs);
    const stationTide = view ? toBeachStationTide(view) : null;
    if (!view || !stationTide) return { display: rows, rows, stationTide: null, view: null };
    return { display: stationTideMeta(rows, view, nowMs), rows, stationTide, view };
  }
);

/**
 * The station table as `GET /api/beaches/[id]/tide-station` sends it to the app:
 * every high and low of the series (one day back, nine ahead) and the curve the
 * station pages draw. Heights are unrounded feet; the app rounds once.
 */
export interface BeachStationTidePayload {
  timeZone: string;
  station: { name: string; slug: string; sourceStationId: string };
  extremes: Array<{ at: string; type: TideExtremePoint["type"]; heightFt: number }>;
  curve: Array<{ at: string; heightFt: number }>;
}

export function toBeachStationTidePayload(view: CityTideView): BeachStationTidePayload | null {
  if (!view.station || view.extremes.length === 0 || view.curve.length < 2) return null;
  return {
    timeZone: view.timeZone,
    station: view.station,
    extremes: view.extremes.map((e) => ({ at: e.ts, type: e.type, heightFt: metresToFeet(e.heightM) })),
    curve: view.curve.map((p) => ({ at: new Date(p.timestamp).toISOString(), heightFt: p.heightFt })),
  };
}
