import type { SupabaseClient } from "@supabase/supabase-js";
import { unstable_cache } from "next/cache";

import type { Database } from "@/types/database";
import type { EnhancedForecastEntity } from "@/types/forecast";
import { groupEvents } from "@/lib/services/discovery/swell-tracking";
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

export { confidenceFor, rateRegionEvents } from "./regional-rating";

type Client = SupabaseClient<Database>;

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;
/** Stored forecasts end at about 11.8 days; WAM early looks cover the rest. */
const DETECTION_HORIZON_DAYS = 12;
const REGION_CACHE_SECONDS = 10_800;
const FEET_PER_METER = 3.281;
// Small parallel chunks keep each paged read short without a burst on the DB.
const BEACH_CHUNK_SIZE = 20;

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
  /** A WAM peak past the stored forecast: no beach ratings. */
  earlyLook: boolean;
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
  /** Daylight rows on each detected event's peak day. */
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

function detectedEvent(group: { lead: BeachSwellEvent }): UnkeyedRegionEvent {
  const { lead } = group;
  return {
    kind: lead.kind ?? "swell",
    earlyLook: false,
    directionDeg: lead.directionDeg,
    directionLabel: lead.directionLabel,
    periodS: round1(lead.periodS),
    arrivalAt: lead.arrivalAt,
    peakAt: lead.peakAt,
    fadeAt: lead.fadeAt,
    peakLocalDate: lead.peakLocalDate,
    offshoreFt: `${Math.round(lead.peakOffshoreHeightFt)} ft`,
    history: null,
  };
}

function earlyLookEvent(peak: EarlyLookPeak): UnkeyedRegionEvent {
  return {
    kind: peak.kind,
    earlyLook: true,
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
 * Region-scoped keys, unique within the list. A storm key ends in ":s" like the detector's;
 * an early look that later reaches the stored forecast keeps the same key.
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
  const today = getLocalDateStr(now, timezone);

  const detected = beachRows.flatMap((beach) => {
    try {
      return detectBeachSwellEvents(
        { beach: toSwellEventBeach(beach), forecasts: rowsByBeach.get(beach.id) ?? [], now, timezone },
        { stormClass: true, horizonDays: DETECTION_HORIZON_DAYS },
      );
    } catch {
      // One beach's bad rows must not void the region.
      return [];
    }
  }).filter((event) => isSwellEventCurrent(event, now) && event.peakLocalDate >= today);

  // Kinds group apart: a storm that grows into a swell shows as two events.
  const events = [
    ...groupEvents(detected.filter((event) => event.kind !== "storm")),
    ...groupEvents(detected.filter((event) => event.kind === "storm")),
  ].map(detectedEvent);

  const peakDates = new Set(events.map((event) => event.peakLocalDate));
  const ratingRows: Record<string, RatingRow[]> = {};
  for (const beach of beachRows) {
    ratingRows[beach.id] = (rowsByBeach.get(beach.id) ?? []).flatMap((row) => {
      const at = new Date(row.forecast_at);
      if (!peakDates.has(getLocalDateStr(at, timezone)) || !isDaylight(at, timezone)) return [];
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
    ["region-swell-events", input.region, today],
    { revalidate: REGION_CACHE_SECONDS },
  )();

  const buoy = regionModelBuoy(base.beaches);
  const wamDays = buoy ? await fetchWamDays(buoy, input.timezone) : null;
  const early = wamDays ? earlyLookPeaks(wamDays, base.events, today) : [];
  const wamByDate = new Map((wamDays ?? []).map((day) => [day.localDate, day]));
  const events = withKeys(input.region, [...base.events, ...early.map(earlyLookEvent)])
    .map((event) => {
      const wamDay = wamByDate.get(event.peakLocalDate);
      return buoy && wamDay ? { ...event, history: historyLine(buoy, wamDay.maxHsM, input.timezone) } : event;
    })
    .sort((left, right) => Date.parse(left.peakAt) - Date.parse(right.peakAt));

  return {
    ...base,
    region: input.region,
    timezone: input.timezone,
    buoy: buoy ? { id: buoy.id, name: buoy.name } : null,
    wamDays,
    events,
  };
}
