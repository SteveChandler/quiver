import { synthesizeFromExtrema, type InternalPoint } from "@/components/forecast/tide-chart/tide-chart-helpers";
import { formatFeet, formatStationTime } from "@/lib/tide-stations/format";
import { getStationSeries } from "@/lib/tide-stations/predictions";
import { getNoaaTideStationBySourceId } from "@/lib/tide-stations/queries";
import type { TideStationRow } from "@/lib/tide-stations/types";
import {
  groupExtremesByLocalDay,
  metresToFeet,
  tideStateAt,
  type TideDay,
  type TideExtremePoint,
  type TideHeightPoint,
} from "@/lib/tide-stations/series";
import { formatPanelTideHeight, tideHeightOnCurve, type TidePanelPoint } from "@/lib/tides/tide-panel";

export interface CityTideStation {
  name: string;
  slug: string;
  sourceStationId: string;
}

/**
 * Everything the city tide page shows comes from this one series: the hero, the
 * chart, the week table and the page title. `station` is set when the series is
 * the NOAA station's own prediction table (the same one `/tides/station/...` shows).
 */
export interface CityTideView {
  timeZone: string;
  renderedAtMs: number;
  station: CityTideStation | null;
  extremes: TideExtremePoint[];
  curve: TidePanelPoint[];
  days: TideDay[];
}

interface CityTideHeadline {
  currentStatus: string | null;
  currentHeight: string | null;
  nextTideType: string | null;
  nextTideTime: string | null;
  nextTideHeight: string | null;
}

const WEEK_DAYS = 7;

function sortExtremes(extremes: TideExtremePoint[]): TideExtremePoint[] {
  return [...extremes].sort((a, b) => Date.parse(a.ts) - Date.parse(b.ts));
}

/** Hourly heights when the source has them; otherwise the beach-chart cosine between highs and lows. */
function curveFromSeries(hourly: TideHeightPoint[], extremes: TideExtremePoint[]): TidePanelPoint[] {
  if (hourly.length >= 2) {
    return hourly
      .map((p) => ({ timestamp: Date.parse(p.ts), heightFt: metresToFeet(p.heightM) }))
      .sort((a, b) => a.timestamp - b.timestamp);
  }
  return synthesizeFromExtrema(
    extremes.map<InternalPoint>((e) => ({
      t: e.ts,
      timestamp: Date.parse(e.ts),
      h: metresToFeet(e.heightM),
      isHigh: e.type === "high",
      isLow: e.type === "low",
    }))
  ).map((p) => ({ timestamp: p.timestamp, heightFt: p.h }));
}

export function buildCityTideView(input: {
  timeZone: string;
  renderedAtMs: number;
  station: CityTideStation | null;
  hourly: TideHeightPoint[];
  extremes: TideExtremePoint[];
}): CityTideView {
  const extremes = sortExtremes(input.extremes);
  return {
    timeZone: input.timeZone,
    renderedAtMs: input.renderedAtMs,
    station: input.station,
    extremes,
    curve: curveFromSeries(input.hourly, extremes),
    days: groupExtremesByLocalDay(extremes, input.timeZone, input.renderedAtMs, WEEK_DAYS),
  };
}

/**
 * The station's own prediction series, or null when the beach's tide rows do not
 * name a registry station or NOAA has no table for it. A registry or NOAA error is
 * logged and also yields null: the page then draws the beach's stored series,
 * which comes from the same station, so the page still agrees with itself.
 */
export async function loadStationTideView(
  sourceStationId: string | null | undefined,
  renderedAtMs: number
): Promise<CityTideView | null> {
  if (!sourceStationId || sourceStationId.startsWith("cached_")) return null;
  let station: TideStationRow | null;
  let series: Awaited<ReturnType<typeof getStationSeries>>;
  try {
    station = await getNoaaTideStationBySourceId(sourceStationId);
    if (!station) return null;
    series = await getStationSeries(station, renderedAtMs);
  } catch (error) {
    // Registry or NOAA down: the stored series is the same station's table, so the page still agrees with itself.
    console.warn("City tide page: station table unavailable, using stored series", {
      sourceStationId,
      message: error instanceof Error ? error.message : "Unknown error",
    });
    return null;
  }
  if (series.status !== "ok") return null;
  return buildCityTideView({
    timeZone: station.timezone,
    renderedAtMs,
    station: { name: station.name, slug: station.slug, sourceStationId: station.source_station_id },
    hourly: series.hourly,
    extremes: series.extremes,
  });
}

/** Hero and title values, read from the view's own curve and extremes. */
export function cityTideHeadline(view: CityTideView, atMs: number = view.renderedAtMs): CityTideHeadline {
  const state = tideStateAt(view.extremes, atMs);
  const height = tideHeightOnCurve(view.curve, atMs);
  return {
    currentStatus: state ? (state.direction === "rising" ? "Rising" : "Falling") : null,
    currentHeight: height == null ? null : formatPanelTideHeight(height),
    nextTideType: state ? (state.next.type === "high" ? "High" : "Low") : null,
    nextTideTime: state ? formatStationTime(state.next.ts, view.timeZone) : null,
    nextTideHeight: state ? formatFeet(state.next.heightM) : null,
  };
}
