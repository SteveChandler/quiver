import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";

import { angleDifference } from "@/lib/domains/shared/angle-utils";

import type { SwellCrossing } from "./crossing";
import type { BeachSwellEvent } from "./detector";
import { readAllPages } from "./paging";
import { SWELL_EVENT_DETECTOR_VERSION, SWELL_EVENT_THRESHOLDS } from "./exposure";

const SWELL_EVENT_SNAPSHOTS_TABLE = "swell_event_forecast_snapshots";
const SWELL_EVENT_CROSSING_HISTORY_RPC = "swell_event_crossing_history";

/** Callers load snapshots from this many days back so a moving peak keeps its key. */
export const SWELL_EVENT_KEY_REUSE_DAYS = 4;
const KEY_REUSE_MAX_PEAK_HOURS = 36;
const KEY_REUSE_MAX_PERIOD_S = 3;
const BEACH_ID_CHUNK = 100;
const HOUR_MS = 60 * 60 * 1000;

const SNAPSHOT_COLUMNS = [
  "beach_id",
  "event_key",
  "detector_version",
  "run_date",
  "detected_at",
  "direction_deg",
  "direction_band",
  "period_s",
  "peak_offshore_height_ft",
  "peak_face_height_ft",
  "exposure",
  "energy_ratio",
  "arrival_at",
  "peak_at",
  "fade_at",
  "crossing_direction_deg",
  "crossing_period_s",
  "crossing_offshore_height_ft",
].join(",");

export interface SwellEventSnapshot {
  beachId: string;
  eventKey: string;
  detectorVersion: string;
  runDate: string;
  detectedAt: string;
  directionDeg: number;
  directionBand: string;
  periodS: number;
  peakOffshoreHeightFt: number;
  peakFaceHeightFt: number;
  exposure: number;
  energyRatio: number;
  arrivalAt: string;
  peakAt: string;
  fadeAt: string | null;
  crossingDirectionDeg: number | null;
  crossingPeriodS: number | null;
  crossingOffshoreHeightFt: number | null;
}

/** Narrow local row type: the table is not in the generated database types yet. */
export interface SwellEventSnapshotRow {
  beach_id: string;
  event_key: string;
  detector_version: string;
  run_date: string;
  detected_at: string;
  direction_deg: number;
  direction_band: string;
  period_s: number;
  peak_offshore_height_ft: number;
  peak_face_height_ft: number;
  exposure: number;
  energy_ratio: number;
  arrival_at: string;
  peak_at: string;
  fade_at: string | null;
  crossing_direction_deg: number | null;
  crossing_period_s: number | null;
  crossing_offshore_height_ft: number | null;
}

function numeric(value: unknown): number | null {
  const parsed = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : null;
}

function instant(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : null;
}

function text(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function snapshotFromRow(row: Record<string, unknown>): SwellEventSnapshot | null {
  const beachId = text(row.beach_id);
  const eventKey = text(row.event_key);
  const detectorVersion = text(row.detector_version);
  const runDate = text(row.run_date);
  const detectedAt = instant(row.detected_at);
  const directionDeg = numeric(row.direction_deg);
  const directionBand = text(row.direction_band);
  const periodS = numeric(row.period_s);
  const peakOffshoreHeightFt = numeric(row.peak_offshore_height_ft);
  const peakFaceHeightFt = numeric(row.peak_face_height_ft);
  const exposure = numeric(row.exposure);
  const energyRatio = numeric(row.energy_ratio);
  const arrivalAt = instant(row.arrival_at);
  const peakAt = instant(row.peak_at);
  const fadeAt = row.fade_at === null || row.fade_at === undefined ? null : instant(row.fade_at);
  if (
    !beachId || !eventKey || !detectorVersion || !runDate || !detectedAt || directionDeg === null
    || !directionBand || periodS === null || peakOffshoreHeightFt === null || peakFaceHeightFt === null
    || exposure === null || energyRatio === null || !arrivalAt || !peakAt
    || (row.fade_at !== null && row.fade_at !== undefined && fadeAt === null)
  ) {
    return null;
  }
  return {
    beachId, eventKey, detectorVersion, runDate, detectedAt, directionDeg, directionBand, periodS,
    peakOffshoreHeightFt, peakFaceHeightFt, exposure, energyRatio, arrivalAt, peakAt, fadeAt,
    crossingDirectionDeg: numeric(row.crossing_direction_deg),
    crossingPeriodS: numeric(row.crossing_period_s),
    crossingOffshoreHeightFt: numeric(row.crossing_offshore_height_ft),
  };
}

export async function loadRecentSwellSnapshots(
  supabase: SupabaseClient<Database>,
  beachIds: string[],
  since: Date,
): Promise<SwellEventSnapshot[]> {
  // The table is not in the generated types; rows are validated field by field below.
  const client = supabase as unknown as SupabaseClient;
  const ids = [...new Set(beachIds)];
  const snapshots: SwellEventSnapshot[] = [];
  for (let start = 0; start < ids.length; start += BEACH_ID_CHUNK) {
    const chunk = ids.slice(start, start + BEACH_ID_CHUNK);
    const rows = await readAllPages(async (offset, limit) => {
      const { data, error } = await client
        .from(SWELL_EVENT_SNAPSHOTS_TABLE)
        .select(SNAPSHOT_COLUMNS)
        .in("beach_id", chunk)
        .eq("detector_version", SWELL_EVENT_DETECTOR_VERSION)
        .gte("detected_at", since.toISOString())
        .order("detected_at", { ascending: false })
        .order("beach_id", { ascending: true })
        .order("event_key", { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) throw new Error(`Failed to load swell event snapshots: ${error.message}`);
      return (data ?? []) as unknown as Array<Record<string, unknown>>;
    });
    for (const row of rows) {
      const snapshot = snapshotFromRow(row);
      if (snapshot) snapshots.push(snapshot);
    }
  }
  return snapshots;
}

interface KeyMatch {
  eventIndex: number;
  snapshot: SwellEventSnapshot;
  peakDiffHours: number;
  periodDiff: number;
}

/**
 * Reuses an earlier run's event key when a detection is the same swell at the
 * same beach, so a peak that drifts across midnight keeps one identity.
 * Callers pass snapshots from the last SWELL_EVENT_KEY_REUSE_DAYS days.
 */
export function resolveEventKeys(
  events: BeachSwellEvent[],
  snapshots: SwellEventSnapshot[],
): BeachSwellEvent[] {
  const latestByKey = new Map<string, SwellEventSnapshot>();
  for (const snapshot of snapshots) {
    const key = `${snapshot.beachId}|${snapshot.eventKey}`;
    const current = latestByKey.get(key);
    if (!current || Date.parse(snapshot.detectedAt) > Date.parse(current.detectedAt)) {
      latestByKey.set(key, snapshot);
    }
  }

  const matches: KeyMatch[] = [];
  events.forEach((event, eventIndex) => {
    for (const snapshot of latestByKey.values()) {
      // Angle, not band: a swell near a band edge (e.g. 202.5°) flips S↔SW between runs.
      if (snapshot.beachId !== event.beachId) continue;
      if (angleDifference(snapshot.directionDeg, event.directionDeg) > SWELL_EVENT_THRESHOLDS.trackDirectionDeg) continue;
      const peakDiffHours = Math.abs(Date.parse(snapshot.peakAt) - Date.parse(event.peakAt)) / HOUR_MS;
      const periodDiff = Math.abs(snapshot.periodS - event.periodS);
      if (peakDiffHours <= KEY_REUSE_MAX_PEAK_HOURS && periodDiff <= KEY_REUSE_MAX_PERIOD_S) {
        matches.push({ eventIndex, snapshot, peakDiffHours, periodDiff });
      }
    }
  });
  // Closest pairs claim keys first so two detections never share one key.
  matches.sort((left, right) => left.peakDiffHours - right.peakDiffHours || left.periodDiff - right.periodDiff);

  const assigned = new Map<number, string>();
  const usedKeys = new Set<string>();
  for (const match of matches) {
    const scopedKey = `${match.snapshot.beachId}|${match.snapshot.eventKey}`;
    if (assigned.has(match.eventIndex) || usedKeys.has(scopedKey)) continue;
    assigned.set(match.eventIndex, match.snapshot.eventKey);
    usedKeys.add(scopedKey);
  }

  return events.map((event, eventIndex) => {
    let eventKey = assigned.get(eventIndex) ?? event.eventKey;
    if (!assigned.has(eventIndex)) {
      // A reused key can equal another detection's natural key; suffix the newcomer.
      let suffix = 2;
      while (usedKeys.has(`${event.beachId}|${eventKey}`)) {
        eventKey = `${event.eventKey}:${suffix}`;
        suffix += 1;
      }
      usedKeys.add(`${event.beachId}|${eventKey}`);
    }
    return eventKey === event.eventKey ? event : { ...event, eventKey };
  });
}

export function toSwellEventSnapshotRow(
  event: BeachSwellEvent,
  detectedAt: Date,
  crossing: SwellCrossing | null = null,
): SwellEventSnapshotRow {
  return {
    beach_id: event.beachId,
    event_key: event.eventKey,
    detector_version: SWELL_EVENT_DETECTOR_VERSION,
    run_date: detectedAt.toISOString().slice(0, 10),
    detected_at: detectedAt.toISOString(),
    direction_deg: event.directionDeg,
    direction_band: event.directionBand,
    period_s: event.periodS,
    peak_offshore_height_ft: event.peakOffshoreHeightFt,
    peak_face_height_ft: event.peakFaceHeightFt,
    exposure: event.exposure,
    energy_ratio: event.energyRatio,
    arrival_at: event.arrivalAt,
    peak_at: event.peakAt,
    fade_at: event.fadeAt,
    crossing_direction_deg: crossing?.directionDeg ?? null,
    crossing_period_s: crossing?.periodS ?? null,
    crossing_offshore_height_ft: crossing?.peakOffshoreHeightFt ?? null,
  };
}

export async function upsertSwellEventSnapshots(
  supabase: SupabaseClient<Database>,
  rows: SwellEventSnapshotRow[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const client = supabase as unknown as SupabaseClient;
  const { error } = await client
    .from(SWELL_EVENT_SNAPSHOTS_TABLE)
    .upsert(rows, { onConflict: "beach_id,event_key,run_date" });
  if (error) throw new Error(`Failed to write swell event snapshots: ${error.message}`);
  return rows.length;
}

export interface SwellCrossingHistory {
  /** Distinct run dates with any snapshot for the candidate beaches. */
  historyDays: number;
  /** Crossed events (latest snapshot each) that peaked in the window, with beach-local peak dates. */
  crossings: Array<{ beachId: string; eventKey: string; peakDate: string }>;
}

/** One aggregate round trip; the RPC picks each event's latest snapshot server side. */
export async function loadSwellCrossingHistory(
  supabase: SupabaseClient<Database>,
  beachIds: string[],
  since: Date,
): Promise<SwellCrossingHistory> {
  const client = supabase as unknown as SupabaseClient;
  const { data, error } = await client.rpc(SWELL_EVENT_CROSSING_HISTORY_RPC, {
    p_beach_ids: [...new Set(beachIds)],
    p_since: since.toISOString(),
  });
  if (error) throw new Error(`Failed to load swell crossing history: ${error.message}`);
  const value = (data ?? {}) as { history_days?: unknown; crossings?: unknown };
  const crossings = Array.isArray(value.crossings) ? value.crossings : [];
  return {
    historyDays: numeric(value.history_days) ?? 0,
    crossings: crossings.flatMap((entry) => {
      const row = (entry ?? {}) as Record<string, unknown>;
      const beachId = text(row.beach_id);
      const eventKey = text(row.event_key);
      const peakDate = text(row.peak_date);
      return beachId && eventKey && peakDate ? [{ beachId, eventKey, peakDate }] : [];
    }),
  };
}
