/**
 * Assembles one buoy station page. Pure composition over BuoyPageSource; the
 * route decides 404s and redirects from the result.
 */

import type { StationBeaches } from "@/lib/services/wave-stations";
import type { LatestWaveReading } from "@/lib/services/wave-stations/lookup";
import type { WaveStationObservationRow, WaveStationRow } from "@/lib/services/wave-stations/types";
import { findCanonicalTimezoneFromCoords } from "@/lib/utils/timezone-utils.server";
import { BEACH_SUMMARY_LIMIT, type BeachForecastSummary } from "./beach-summaries";
import { buildChartRanges, type ChartRange, type ChartRangeData } from "./chart-ranges";
import {
  compareModelToObserved,
  describeComparison,
  modelDailyPeaks,
  modelHoursFrom,
  type ModelDayPeak,
  type ModelHour,
  type ModelSeries,
} from "./model-at-buoy";
import { buildReadingSentence } from "./reading";
import {
  buildTrendSeries,
  computeHeightTrend,
  selectNowObservation,
  hourlyObservedHeights,
  type HourlyObservation,
  type TrendPoint,
} from "./series";
import { orEmptyWhenMissing, type BuoyPageSource } from "./source";
import { classifyStationStatus, evaluateStationIndexability, liveLimitMs, type StationIndexDecision, type StationStatus } from "./status";

const HISTORY_DAYS = 30;
const COMPARISON_DAYS = 5;
const DAY_MS = 24 * 60 * 60 * 1000;
const NEARBY_LIMIT = 6;

export interface NearbyBuoy {
  station: WaveStationRow;
  distanceKm: number;
  latest: LatestWaveReading | null;
  status: StationStatus;
}

export interface StationBeachView {
  id: string;
  name: string;
  distanceKm: number;
  summary: BeachForecastSummary | null;
}

export interface ModelBlock {
  gridLat: number;
  gridLon: number;
  /** Model hours from the comparison window start through the forecast end. */
  hours: ModelHour[];
  observed: HourlyObservation[];
  /** Newest reading time; the chart splits past and forecast here. */
  splitAt: number;
  comparisonText: string | null;
  peaks: ModelDayPeak[];
}

interface StationPageData {
  station: WaveStationRow;
  timeZone: string;
  status: StationStatus;
  index: StationIndexDecision;
  latestWave: WaveStationObservationRow | null;
  /** The one row every "Now" field comes from (see selectNowObservation); null when offline. */
  nowObservation: WaveStationObservationRow | null;
  latestAny: WaveStationObservationRow | null;
  reading: string | null;
  /** Hourly points over the stored history (up to 30 days). */
  trend: TrendPoint[];
  chartRanges: Partial<Record<ChartRange, ChartRangeData>>;
  model: ModelBlock | null;
  beaches: {
    relation: StationBeaches["relation"];
    items: StationBeachView[];
    /** Linked beaches left off the list (the list shows the closest ones). */
    moreCount: number;
    /** False when the forecast read failed: labels are unknown, not missing. */
    forecastsLoaded: boolean;
  };
  nearby: NearbyBuoy[];
  /** Distance to the closest listed beach, in km, for the explainer. */
  nearestBeachKm: number | null;
}

type StationLookup =
  | { kind: "found"; data: StationPageData }
  | { kind: "redirect"; slug: string }
  | { kind: "not-found" };

/**
 * Offshore points resolve to a nautical zone (Etc/GMT, no daylight saving):
 * 67 of 235 European buoys did on 2026-11-11, 1-2 h off the clock their
 * readers use. Those take their country's zone instead.
 */
const COUNTRY_TIME_ZONES: Record<string, string> = {
  BE: "Europe/Brussels",
  DE: "Europe/Berlin",
  DK: "Europe/Copenhagen",
  ES: "Europe/Madrid",
  FR: "Europe/Paris",
  GB: "Europe/London",
  GR: "Europe/Athens",
  IE: "Europe/Dublin",
  NL: "Europe/Amsterdam",
  NO: "Europe/Oslo",
  PT: "Europe/Lisbon",
};

export function stationTimeZone(station: Pick<WaveStationRow, "lat" | "lon" | "country_code">): string {
  const zone = findCanonicalTimezoneFromCoords(station.lat, station.lon);
  if (zone && !zone.startsWith("Etc/")) return zone;
  return (station.country_code ? COUNTRY_TIME_ZONES[station.country_code] : undefined) ?? zone ?? "UTC";
}

const NEARBY_RADIUS_KM = 300;
const NEARBY_WIDE_RADIUS_KM = 600;

/** Buoys within 300 km, or within 600 km when fewer than two are that close. */
export function withinNearbyRadius<T extends { distance_km: number }>(candidates: T[]): T[] {
  const close = candidates.filter((candidate) => candidate.distance_km <= NEARBY_RADIUS_KM);
  if (close.length >= 2) return close;
  return candidates.filter((candidate) => candidate.distance_km <= NEARBY_WIDE_RADIUS_KM);
}

function localDay(ms: number, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ms));
}

function buildModelBlock(
  model: ModelSeries | null,
  history: WaveStationObservationRow[],
  latestWave: WaveStationObservationRow | null,
  timeZone: string,
  nowMs: number,
): ModelBlock | null {
  if (!model || !latestWave) return null;
  const splitAt = Date.parse(latestWave.observed_at);
  const windowStart = splitAt - COMPARISON_DAYS * DAY_MS;
  const observed = hourlyObservedHeights(history).filter((point) => point.t >= windowStart);
  const hours = modelHoursFrom(model, windowStart);
  if (!hours.some((hour) => hour.hs !== null)) return null;
  return {
    gridLat: model.gridLat,
    gridLon: model.gridLon,
    hours,
    observed,
    splitAt,
    comparisonText: describeComparison(
      compareModelToObserved({ ...model, hours: hours.filter((hour) => hour.t <= splitAt) }, observed),
    ),
    // Days before today (station time) are gone even when the last reading is older.
    peaks: modelDailyPeaks(model, splitAt, timeZone).filter((peak) => peak.day >= localDay(nowMs, timeZone)),
  };
}

/**
 * Canonical slug for a legacy /buoys/{id} or /buoys/{slug} URL: an exact slug,
 * or an alternate id that matches exactly one station. Null otherwise.
 */
export async function resolveStationSlug(source: BuoyPageSource, slugOrId: string): Promise<string | null> {
  const station = await orEmptyWhenMissing(() => source.getStationBySlug(slugOrId), null);
  if (station?.duplicate_of) {
    return (await orEmptyWhenMissing(() => source.getStationSlugById(station.duplicate_of as string), null)) ?? station.slug;
  }
  if (station) return station.slug;
  const matches = await orEmptyWhenMissing(() => source.findStationsByAlternateId(slugOrId), []);
  return matches.length === 1 ? matches[0].slug : null;
}

/**
 * Resolve a slug, or an alternate id ("46225", CDIP "100") that matches exactly
 * one station, and load everything the page shows.
 */
export async function loadStationPage(
  source: BuoyPageSource,
  slugOrId: string,
  now: Date,
): Promise<StationLookup> {
  const station = await orEmptyWhenMissing(() => source.getStationBySlug(slugOrId), null);
  if (!station) {
    const matches = await orEmptyWhenMissing(() => source.findStationsByAlternateId(slugOrId), []);
    if (matches.length === 1 && matches[0].slug !== slugOrId) return { kind: "redirect", slug: matches[0].slug };
    return { kind: "not-found" };
  }
  // The same buoy from a second source: send readers to the primary station's page.
  if (station.duplicate_of) {
    const primarySlug = await orEmptyWhenMissing(() => source.getStationSlugById(station.duplicate_of as string), null);
    if (primarySlug && primarySlug !== station.slug) return { kind: "redirect", slug: primarySlug };
  }
  // Met-only stations have nothing to show. A station that once reported waves
  // keeps its page (offline, noindex) even after the registry clears has_wave.
  if (!station.has_wave && !station.last_wave_observed_at) return { kind: "not-found" };

  const nowMs = now.getTime();
  const timeZone = stationTimeZone(station);
  const [latest, historyRaw, beachLinks, nearbyRaw, model] = await Promise.all([
    source.getLatestObservation(station.id),
    source.getObservationHistory(station.id, (HISTORY_DAYS + 1) * 24),
    source.getBeachesForStation(station.id).catch((error: unknown) => {
      // Beach links are a side block; a failed read must not take the buoy page down.
      console.warn("[buoy-pages] beach links failed", {
        station: station.id,
        message: error instanceof Error ? error.message : String(error),
      });
      return { relation: "nearby", beaches: [] } as StationBeaches;
    }),
    source.getNearbyStations(station.lat, station.lon, NEARBY_LIMIT + 1),
    source.fetchModelAtBuoy(station.lat, station.lon),
  ]);

  // Start the history at a UTC midnight so regenerations within a day keep the same window.
  const historyStart = Math.floor(nowMs / DAY_MS) * DAY_MS - HISTORY_DAYS * DAY_MS;
  const history = historyRaw.filter((row) => Date.parse(row.observed_at) >= historyStart);
  const nearbyStations = withinNearbyRadius(nearbyRaw.filter((candidate) => candidate.id !== station.id)).slice(0, NEARBY_LIMIT);
  const listedBeaches = beachLinks.beaches.slice(0, BEACH_SUMMARY_LIMIT);
  const [nearbyLatest, beachSummaries] = await Promise.all([
    source.getLatestWaveObservations(nearbyStations),
    source.getBeachForecastSummaries(listedBeaches.map((beach) => beach.id), now).catch((error: unknown) => {
      console.warn("[buoy-pages] beach summaries failed", {
        station: station.id,
        message: error instanceof Error ? error.message : String(error),
      });
      return null;
    }),
  ]);

  const status = station.has_wave
    ? classifyStationStatus(station.last_wave_observed_at ?? latest.latestWave?.observed_at, nowMs, liveLimitMs(station))
    : "offline";
  const showNow = status !== "offline" ? selectNowObservation(station.has_swell_split, latest.latestWave, history) : null;

  return {
    kind: "found",
    data: {
      station,
      timeZone,
      status,
      index: evaluateStationIndexability(station, nowMs),
      latestWave: latest.latestWave,
      nowObservation: showNow,
      latestAny: latest.latestAny,
      // "Over the last 6 hours" is only true while the reading is fresh.
      reading: showNow
        ? buildReadingSentence(showNow, status === "fresh" ? computeHeightTrend(history) : null)
        : null,
      trend: buildTrendSeries(history),
      chartRanges: buildChartRanges(history, timeZone),
      model: status === "offline" ? null : buildModelBlock(model, history, latest.latestWave, timeZone, nowMs),
      beaches: {
        relation: beachLinks.relation,
        items: listedBeaches.map((beach) => ({
          id: beach.id,
          name: beach.name,
          distanceKm: beach.distance_km,
          summary: beachSummaries?.get(beach.id) ?? null,
        })),
        moreCount: beachLinks.beaches.length - listedBeaches.length,
        forecastsLoaded: beachSummaries !== null,
      },
      nearby: nearbyStations.map((candidate) => ({
        station: candidate,
        distanceKm: candidate.distance_km,
        latest: nearbyLatest.get(candidate.id) ?? null,
        status: classifyStationStatus(candidate.last_wave_observed_at, nowMs, liveLimitMs(candidate)),
      })),
      nearestBeachKm: beachLinks.beaches.length > 0
        ? Math.min(...beachLinks.beaches.map((beach) => beach.distance_km))
        : null,
    },
  };
}
