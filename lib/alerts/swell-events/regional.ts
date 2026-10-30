import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import type { Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import type { RegionSwellEvent } from "@/types/region-swell-events";
import { angleDifference } from "@/lib/domains/shared/angle-utils";
import { SWELL_TRACKING_RULES, groupEvents, type SwellGroup } from "@/lib/services/discovery/swell-tracking";
import { getLocalDateStr, getLocalHour } from "@/lib/services/discovery/window-selector/time-slot-utils";
import { degreeToCardinal, degreesToCardinal } from "@/lib/utils/geo-utils";

import {
  SWELL_EVENT_BASELINE_LOOKBACK_HOURS,
  detectBeachSwellEvents,
  isSwellEventCurrent,
  toSwellEventBeach,
  type BeachSwellEvent,
} from "./detector";
import { earlyLookPeaks, fetchWamDays, historyLine, regionModelBuoy, type EarlyLookPeak, type WamDay } from "./early-look";
import { SWELL_EVENT_THRESHOLDS } from "./exposure";
import { EXCLUDE_SYNTHETIC_ROWS_FILTER } from "./forecast-rows";
import { readAllPages } from "./paging";
import { ratingWindow } from "./regional-rating";

export { confidenceFor, rateRegionEvents } from "./regional-rating";

type Client = SupabaseClient<Database>;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Stored forecasts end at about 11.8 days; WAM early looks cover the rest. */
const DETECTION_HORIZON_DAYS = 12;
const REGION_CACHE_SECONDS = 10_800;
// Bump when the cached shape or its contents change, so a deploy never reads an older build.
// v2: events still in the water past their peak day; rating rows span each event's window.
// v3: one swell the detector peaked more than once shows as one event.
const REGION_CACHE_VERSION = "v3";
const FEET_PER_METER = 3.281;
// Small parallel chunks keep each paged read short without a burst on the DB.
const BEACH_CHUNK_SIZE = 20;
// Below this a region has no "which beaches are working" to show, so no model buoy is fetched.
const MIN_REGION_BEACHES = 3;

const BEACH_COLUMNS = "id, name, slug, lat, lon, swell_window_center_deg, swell_window_halfwidth_deg, swell_access_factors, terrain_enabled, shoaling_factors, deepwater_decay_factor";
// The story's scoring select (week-scout-story-source.ts readChunk), less the columns nothing here reads.
const FORECAST_COLUMNS = "beach_id, forecast_at, wave_height, wave_period, wind_speed, tide_height, tide_status, swell_1_height, swell_1_period, swell_1_direction, swell_2_height, swell_2_period, swell_2_direction, data_source";

type BeachRow = { id: string; name: string; lat: number; lon: number } & Parameters<typeof toSwellEventBeach>[0];
type ForecastRow = Pick<
  EnhancedForecastEntity,
  | "forecast_at"
  | "wave_height"
  | "wave_period"
  | "wind_speed"
  | "tide_height"
  | "tide_status"
  | "swell_1_height"
  | "swell_1_period"
  | "swell_1_direction"
  | "swell_2_height"
  | "swell_2_period"
  | "swell_2_direction"
> & { beach_id: string; data_source: string | null };

/** The forecast columns rating reads, per daylight hour. */
export type RatingRow = Pick<
  EnhancedForecastEntity,
  "forecast_at" | "wave_height" | "wave_period" | "wind_speed" | "tide_height" | "tide_status" | "swell_1_period"
>;

export interface RegionBeach {
  id: string;
  name: string;
  lat: number;
  lon: number;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
}

export interface InternalRegionEvent {
  key: string;
  kind: "swell" | "storm";
  /** "wam": an early-look peak past the stored forecast, with no beach ratings. */
  source: RegionSwellEvent["source"];
  directionDeg: number | null;
  directionLabel: string | null;
  periodS: number | null;
  arrivalAt: string | null;
  peakAt: string;
  fadeAt: string | null;
  peakLocalDate: string;
  offshoreFt: string | null;
  history: string | null;
}

type UnkeyedRegionEvent = Omit<InternalRegionEvent, "key">;

/** The cached part of a region build: plain JSON, so it survives unstable_cache. */
interface RegionBase {
  beaches: RegionBeach[];
  events: UnkeyedRegionEvent[];
  /** Daylight rows inside any detected event's rating window. */
  rowsByBeach: Record<string, RatingRow[]>;
}

export interface RegionBuild extends Omit<RegionBase, "events"> {
  region: string;
  timezone: string;
  buoy: { id: string; name: string } | null;
  wamDays: WamDay[] | null;
  /** Chronological by peak. */
  events: InternalRegionEvent[];
}

async function readRegionBeaches(client: Client, region: string): Promise<BeachRow[]> {
  return readAllPages(async (offset, limit) => {
    const { data, error } = await client.from("beaches")
      .select(BEACH_COLUMNS)
      .eq("region", region)
      .is("deleted_at", null)
      .order("id", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Failed to load region beaches: ${error.message}`);
    return (data ?? []) as unknown as BeachRow[];
  });
}

async function readForecastRows(client: Client, beachIds: string[], from: Date, to: Date): Promise<ForecastRow[]> {
  const chunks = Array.from({ length: Math.ceil(beachIds.length / BEACH_CHUNK_SIZE) }, (_, index) =>
    beachIds.slice(index * BEACH_CHUNK_SIZE, (index + 1) * BEACH_CHUNK_SIZE));
  const pages = await Promise.all(chunks.map((chunk) => readAllPages(async (offset, limit) => {
    const { data, error } = await client.from("enhanced_forecasts")
      .select(FORECAST_COLUMNS)
      .in("beach_id", chunk)
      .or(EXCLUDE_SYNTHETIC_ROWS_FILTER)
      .gte("forecast_at", from.toISOString())
      .lt("forecast_at", to.toISOString())
      .order("beach_id", { ascending: true })
      .order("forecast_at", { ascending: true })
      .range(offset, offset + limit - 1);
    if (error) throw new Error(`Failed to load region forecast rows: ${error.message}`);
    return (data ?? []) as unknown as ForecastRow[];
  })));
  return pages.flat();
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** One swell across the region: its strongest group's lead, over the window of every group joined to it. */
interface RegionRun {
  lead: BeachSwellEvent;
  arrivalAt: string;
  fadeAt: string | null;
}

const earlier = (left: string, right: string): string => (Date.parse(right) < Date.parse(left) ? right : left);

function runSpan(run: RegionRun): { startMs: number; endMs: number } {
  return ratingWindow({ arrivalAt: run.arrivalAt, peakAt: run.lead.peakAt, fadeAt: run.fadeAt });
}

/**
 * The detector can peak one long swell more than once (a three-day SSW plateau read as three events),
 * and groupEvents keeps one event per beach in a group, so the splits survive grouping. Groups of one
 * kind whose leads match in direction and period and whose windows overlap are one swell.
 */
function joinRuns(groups: readonly SwellGroup[]): RegionRun[] {
  const runs: RegionRun[] = [];
  for (const { lead } of [...groups].sort((left, right) => right.lead.peakEnergy - left.lead.peakEnergy)) {
    const own = ratingWindow(lead);
    const run = runs.find((candidate) => {
      const span = runSpan(candidate);
      return angleDifference(candidate.lead.directionDeg, lead.directionDeg) <= SWELL_EVENT_THRESHOLDS.trackDirectionDeg
        && Math.abs(candidate.lead.periodS - lead.periodS) <= SWELL_TRACKING_RULES.groupPeriodS
        && own.startMs < span.endMs
        && span.startMs < own.endMs;
    });
    if (!run) {
      runs.push({ lead, arrivalAt: lead.arrivalAt, fadeAt: lead.fadeAt });
      continue;
    }
    // A missing fade means peak + 24 h, so ends compare as windows; the run never ends before either does.
    if (own.endMs > runSpan(run).endMs) run.fadeAt = lead.fadeAt ?? new Date(own.endMs).toISOString();
    run.arrivalAt = earlier(run.arrivalAt, lead.arrivalAt);
  }
  return runs;
}

function detectedEvent(run: RegionRun): UnkeyedRegionEvent {
  const { lead } = run;
  return {
    kind: lead.kind ?? "swell",
    source: "forecast",
    directionDeg: lead.directionDeg,
    directionLabel: lead.directionLabel,
    periodS: round1(lead.periodS),
    arrivalAt: run.arrivalAt,
    peakAt: lead.peakAt,
    fadeAt: run.fadeAt,
    peakLocalDate: lead.peakLocalDate,
    offshoreFt: `${Math.round(lead.peakOffshoreHeightFt)} ft`,
    history: null,
  };
}

function earlyLookEvent(peak: EarlyLookPeak): UnkeyedRegionEvent {
  return {
    kind: peak.kind,
    source: "wam",
    directionDeg: peak.directionDeg,
    directionLabel: peak.directionDeg === null ? null : degreeToCardinal(peak.directionDeg),
    periodS: peak.periodS === null ? null : round1(peak.periodS),
    arrivalAt: null,
    peakAt: peak.peakAt,
    fadeAt: null,
    peakLocalDate: peak.localDate,
    offshoreFt: `${Math.round(peak.maxHsM * FEET_PER_METER)} ft`,
    history: null,
  };
}

/**
 * Region-scoped keys, unique within this response. A storm key ends in ":s" like the detector's.
 * Keys are per response, not stable across builds: the card must not persist them.
 */
function withKeys(region: string, events: readonly UnkeyedRegionEvent[]): InternalRegionEvent[] {
  const used = new Set<string>();
  return events.map((event) => {
    const band = event.directionDeg === null ? "X" : degreesToCardinal(event.directionDeg);
    const base = `${region}:${band}:${event.peakLocalDate}`;
    const suffix = event.kind === "storm" ? ":s" : "";
    let key = `${base}${suffix}`;
    for (let copy = 2; used.has(key); copy += 1) key = `${base}.${copy}${suffix}`;
    used.add(key);
    return { ...event, key };
  });
}

/** The number in "9 ft"; an event with no height never leads its day. */
function offshoreFeet(event: InternalRegionEvent): number {
  const feet = event.offshoreFt === null ? Number.NaN : Number.parseFloat(event.offshoreFt);
  return Number.isNaN(feet) ? Number.NEGATIVE_INFINITY : feet;
}

function isDaylight(at: Date, timezone: string): boolean {
  const hour = getLocalHour(at, timezone);
  return hour !== null
    && hour >= SWELL_EVENT_THRESHOLDS.daylightStartHour
    && hour < SWELL_EVENT_THRESHOLDS.daylightEndHour;
}

async function loadRegionBase(input: { client: Client; region: string; now: Date; timezone: string }): Promise<RegionBase> {
  const { client, region, now, timezone } = input;
  const beachRows = await readRegionBeaches(client, region);
  const from = new Date(now.getTime() - SWELL_EVENT_BASELINE_LOOKBACK_HOURS * HOUR_MS);
  const to = new Date(now.getTime() + DETECTION_HORIZON_DAYS * DAY_MS);
  // One read feeds both detection (swell partitions) and rating (height, wind, tide).
  const rows = beachRows.length ? await readForecastRows(client, beachRows.map((beach) => beach.id), from, to) : [];
  const rowsByBeach = Map.groupBy(rows, (row) => row.beach_id);

  const detected = beachRows.flatMap((beach) => {
    try {
      return detectBeachSwellEvents(
        { beach: toSwellEventBeach(beach), forecasts: rowsByBeach.get(beach.id) ?? [], now, timezone },
        { stormClass: true, horizonDays: DETECTION_HORIZON_DAYS },
      );
    } catch (error) {
      // One beach's bad rows must not void the region.
      console.warn("[regional] detection failed", { beachId: beach.id, error: String(error) });
      return [];
    }
  }).filter((event) => isSwellEventCurrent(event, now));

  // Kinds group apart: a storm that grows into a swell shows as two events.
  const events = [
    ...joinRuns(groupEvents(detected.filter((event) => event.kind !== "storm"))),
    ...joinRuns(groupEvents(detected.filter((event) => event.kind === "storm"))),
  ].map(detectedEvent);

  const windows = events.map(ratingWindow);
  const ratingRows: Record<string, RatingRow[]> = {};
  for (const beach of beachRows) {
    ratingRows[beach.id] = (rowsByBeach.get(beach.id) ?? []).flatMap((row) => {
      const at = new Date(row.forecast_at);
      const atMs = at.getTime();
      const inWindow = windows.some((window) => atMs >= window.startMs && atMs < window.endMs);
      if (!inWindow || !isDaylight(at, timezone)) return [];
      return [{
        forecast_at: row.forecast_at,
        wave_height: row.wave_height,
        wave_period: row.wave_period,
        wind_speed: row.wind_speed,
        tide_height: row.tide_height,
        tide_status: row.tide_status,
        swell_1_period: row.swell_1_period,
      }];
    });
  }

  return {
    beaches: beachRows.map((beach) => ({
      id: beach.id,
      name: beach.name,
      lat: beach.lat,
      lon: beach.lon,
      swell_window_center_deg: beach.swell_window_center_deg ?? null,
      swell_window_halfwidth_deg: beach.swell_window_halfwidth_deg ?? null,
    })),
    events,
    rowsByBeach: ratingRows,
  };
}

/**
 * Every swell and storm in a region, out 15 days. The stored-forecast part (beaches, detection,
 * grouping, the rows rating needs) is cached 3 h per region and local day. WAM early looks and
 * history lines are added outside that cache: fetchWamDays carries its own 3 h fetch cache, and an
 * Open-Meteo outage then costs one response its early looks rather than baking into the region for 3 h.
 */
export async function buildRegionEvents(input: {
  client: Client;
  region: string;
  now: Date;
  timezone: string;
}): Promise<RegionBuild> {
  const today = getLocalDateStr(input.now, input.timezone);
  const base = await unstable_cache(
    () => loadRegionBase(input),
    ["region-swell-events", REGION_CACHE_VERSION, input.region, today],
    { revalidate: REGION_CACHE_SECONDS },
  )();

  const buoy = base.beaches.length >= MIN_REGION_BEACHES ? regionModelBuoy(base.beaches) : null;
  const wamDays = buoy ? await fetchWamDays(buoy, input.timezone) : null;
  const early = wamDays ? earlyLookPeaks(wamDays, base.events, today) : [];
  const wamByDate = new Map((wamDays ?? []).map((day) => [day.localDate, day]));
  const chronological = withKeys(input.region, [...base.events, ...early.map(earlyLookEvent)])
    .sort((left, right) => Date.parse(left.peakAt) - Date.parse(right.peakAt));
  // The history line is about the day's WAM peak, so only the day's biggest event carries it.
  const biggestOfDay = new Map<string, InternalRegionEvent>();
  for (const event of chronological) {
    const leader = biggestOfDay.get(event.peakLocalDate);
    if (!leader || offshoreFeet(event) > offshoreFeet(leader)) biggestOfDay.set(event.peakLocalDate, event);
  }
  const events = chronological.map((event) => {
    const wamDay = wamByDate.get(event.peakLocalDate);
    if (!buoy || !wamDay || biggestOfDay.get(event.peakLocalDate) !== event) return event;
    return { ...event, history: historyLine(buoy, wamDay.maxHsM, input.timezone) };
  });

  return {
    ...base,
    region: input.region,
    timezone: input.timezone,
    buoy: buoy ? { id: buoy.id, name: buoy.name } : null,
    wamDays,
    events,
  };
}
