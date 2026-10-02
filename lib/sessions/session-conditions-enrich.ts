import type { SupabaseClient } from "@supabase/supabase-js";
import type { DisplaySwellWindow } from "@/lib/domains/conditions/display-swell";
import {
  fetchMopFocusRatio,
  fetchMopHour,
  MopHourPendingError,
  type MopHour,
} from "@/lib/services/cdip-mop/mop-client";
import {
  pickForecastRowAtOrBefore,
  resolveSessionConditions,
  type SessionConditions,
  type SessionConditionsRow,
  type SessionConditionsSource,
} from "./session-conditions";

const HOUR_MS = 60 * 60 * 1000;
/** Live runs take sessions queued (logged, or moved) or surfed in this window; older leftovers are backfill's. */
const LIVE_LOOKBACK_MS = 72 * HOUR_MS;
/** An hour MOP still hasn't published a day later isn't coming. */
const MOP_GIVE_UP_MS = 24 * HOUR_MS;
/** nearshore_focus_ratio is numeric(4,2). */
const MAX_FOCUS_RATIO = 99.99;
/** Postgres foreign_key_violation. */
const FOREIGN_KEY_VIOLATION = "23503";
/** MOP's nowcast lands about an hour behind; wait until the arrival hour has been published. */
const MOP_PUBLISH_LAG_MS = 2 * HOUR_MS;
const FORECAST_LOOKBACK_MS = 3 * HOUR_MS;
/** session_forecast_snapshots holds the nearest row, which can be after arrival; allow the half hour either side of a row. */
const SNAPSHOT_AFTER_ARRIVAL_MS = 30 * 60 * 1000;
const DEFAULT_BATCH_SIZE = 200;
const CONCURRENCY = 4;

export const SESSION_CONDITIONS_COLUMNS = [
  "swell_period_s",
  "swell_direction_deg",
  "swell_height_ft",
  "offshore_swell_period_s",
  "offshore_swell_direction_deg",
  "offshore_swell_height_ft",
  "wind_speed_mph",
  "wind_direction",
  "wind_direction_deg",
] as const;

export interface PendingSession {
  id: string;
  beach_id: string;
  arrival_time: string;
  conditions_source: string | null;
  nearshore_source: string | null;
  swell_period_s: number | null;
  swell_direction_deg: number | null;
  swell_height_ft: number | null;
  offshore_swell_period_s: number | null;
  offshore_swell_direction_deg: number | null;
  offshore_swell_height_ft: number | null;
  wind_speed_mph: number | null;
  wind_direction: string | null;
  wind_direction_deg: number | null;
}

export interface EnrichBeach {
  id: string;
  mop_point_id: string | null;
  swell_window_center_deg: number | null;
  swell_window_halfwidth_deg: number | null;
}

export type SessionPatch = Record<string, string | number | boolean | null>;

/** A failed store call, with the Postgres error code when PostgREST returned one. */
export class SessionConditionsStoreError extends Error {
  constructor(message: string, readonly code: string | null = null) {
    super(message);
    this.name = "SessionConditionsStoreError";
  }
}

export type PendingSessionsQuery =
  | { kind: "live"; recentSinceIso: string; arrivalToIso: string; limit: number }
  | { kind: "backfill"; arrivalFromIso: string; arrivalToIso: string; limit: number };

export interface SessionConditionsStore {
  listPendingSessions(query: PendingSessionsQuery): Promise<PendingSession[]>;
  loadBeaches(ids: string[]): Promise<Map<string, EnrichBeach>>;
  loadForecastRows(beachId: string, fromIso: string, toIso: string): Promise<SessionConditionsRow[]>;
  loadSnapshot(sessionId: string): Promise<SessionConditionsRow | null>;
  /** Writes only where every patched column is still null; false when a guard stopped it. */
  updateSession(id: string, patch: SessionPatch): Promise<boolean>;
}

export interface EnrichSummary {
  selected: number;
  updated: number;
  conditionsFilled: number;
  nearshoreFilled: number;
  unavailable: number;
  unmapped: number;
  /** MOP hasn't published the hour yet; retried next run. */
  pending: number;
  /**
   * The database rejects every write to these sessions. Today: one test account with no auth.users row, whose
   * updates fail update_beach_affinity_trigger's FK. Expected, so counted rather than logged.
   */
  unwritable: number;
  errors: number;
  /** Backfill: pass as `since` for the next batch; null once a batch comes back short. */
  nextSince: string | null;
}

export interface EnrichOptions {
  mode: "live" | "backfill";
  /** Backfill only: the oldest arrival to consider. */
  since?: Date;
  now: Date;
  batchSize?: number;
  mop?: {
    fetchMopHour: (pointId: string, at: Date) => Promise<MopHour | null>;
    fetchMopFocusRatio: (pointId: string, at: Date) => Promise<number | null>;
  };
}

const round = (value: number, places: number): number => {
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
};
const wholeDegrees = (value: number): number => ((Math.round(value) % 360) + 360) % 360;

function beachWindow(beach: EnrichBeach | undefined): DisplaySwellWindow | null {
  const centerDeg = beach?.swell_window_center_deg;
  const halfwidthDeg = beach?.swell_window_halfwidth_deg;
  return typeof centerDeg === "number" && Number.isFinite(centerDeg)
    && typeof halfwidthDeg === "number" && Number.isFinite(halfwidthDeg)
    ? { centerDeg, halfwidthDeg }
    : null;
}

function snapshotFits(snapshot: SessionConditionsRow, arrivalMs: number): boolean {
  const atMs = Date.parse(snapshot.forecast_at);
  return Number.isFinite(atMs)
    && atMs <= arrivalMs + SNAPSHOT_AFTER_ARRIVAL_MS
    && atMs >= arrivalMs - FORECAST_LOOKBACK_MS;
}

/**
 * Fill only the groups the session is missing. A group (displayed swell, raw offshore swell, wind) is
 * filled whole or not at all, so a user's wind never sits beside a forecast direction.
 */
function conditionsPatch(session: PendingSession, resolved: SessionConditions): SessionPatch {
  const groups: Array<ReadonlyArray<keyof PendingSession & keyof SessionConditions>> = [
    ["swell_period_s", "swell_direction_deg", "swell_height_ft"],
    ["offshore_swell_period_s", "offshore_swell_direction_deg", "offshore_swell_height_ft"],
    ["wind_speed_mph", "wind_direction", "wind_direction_deg"],
  ];
  const patch: SessionPatch = {};
  for (const group of groups) {
    if (group.some((column) => session[column] !== null)) continue;
    for (const column of group) {
      const value = resolved[column];
      if (value !== null) patch[column] = value;
    }
  }
  if (["wind_speed_mph", "wind_direction", "wind_direction_deg"].some((column) => column in patch)) {
    patch.conditions_wind_filled = true;
  }
  if (resolved.conditions_forecast_at !== null) patch.conditions_forecast_at = resolved.conditions_forecast_at;
  patch.conditions_source = resolved.conditions_source;
  return patch;
}

async function resolveConditions(
  store: SessionConditionsStore,
  session: PendingSession,
  beach: EnrichBeach | undefined,
): Promise<SessionConditions> {
  const arrivalMs = Date.parse(session.arrival_time);
  const window = beachWindow(beach);
  const rows = await store.loadForecastRows(
    session.beach_id,
    new Date(arrivalMs - FORECAST_LOOKBACK_MS).toISOString(),
    session.arrival_time,
  );
  const row = pickForecastRowAtOrBefore(rows, session.arrival_time);
  if (row) return resolveSessionConditions(row, window, "forecast_row");

  // enhanced_forecasts keeps about a week; older sessions fall back to the row their snapshot froze.
  const snapshot = await store.loadSnapshot(session.id);
  const source: SessionConditionsSource = "snapshot_backfill";
  return snapshot && snapshotFits(snapshot, arrivalMs)
    ? resolveSessionConditions(snapshot, window, source)
    : resolveSessionConditions(null, window, source);
}

function nearshoreFields(hour: MopHour, focusRatio: number | null, source: string): SessionPatch {
  return {
    nearshore_point_id: hour.pointId,
    nearshore_observed_at: hour.observedAt,
    nearshore_hs_m: round(hour.hsM, 2),
    nearshore_tp_s: round(hour.tpS, 1),
    nearshore_dp_deg: wholeDegrees(hour.dpDeg),
    nearshore_dm_deg: hour.dmDeg === null ? null : wholeDegrees(hour.dmDeg),
    nearshore_swellband_tm_s: hour.swellbandTmS === null ? null : round(hour.swellbandTmS, 1),
    nearshore_focus_ratio: focusRatio !== null && focusRatio <= MAX_FOCUS_RATIO ? focusRatio : null,
    nearshore_source: source,
  };
}

async function runPool<T>(items: T[], worker: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.min(CONCURRENCY, items.length) }, async () => {
    while (next < items.length) {
      const item = items[next];
      next += 1;
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

/**
 * Give logged sessions the conditions they were surfed in: swell and wind from the forecast row at or
 * before paddle-out, and the CDIP MOP nearshore hour for California beaches. Fills nulls only.
 */
export async function enrichSessionConditions(
  store: SessionConditionsStore,
  options: EnrichOptions,
): Promise<EnrichSummary> {
  const mop = options.mop ?? { fetchMopHour, fetchMopFocusRatio };
  const nowMs = options.now.getTime();
  const limit = options.batchSize ?? DEFAULT_BATCH_SIZE;
  const arrivalToIso = new Date(nowMs - MOP_PUBLISH_LAG_MS).toISOString();
  const summary: EnrichSummary = {
    selected: 0,
    updated: 0,
    conditionsFilled: 0,
    nearshoreFilled: 0,
    unavailable: 0,
    unmapped: 0,
    pending: 0,
    unwritable: 0,
    errors: 0,
    nextSince: null,
  };

  const sessions = await store.listPendingSessions(
    options.mode === "backfill"
      ? { kind: "backfill", arrivalFromIso: (options.since ?? new Date(0)).toISOString(), arrivalToIso, limit }
      : { kind: "live", recentSinceIso: new Date(nowMs - LIVE_LOOKBACK_MS).toISOString(), arrivalToIso, limit },
  );
  summary.selected = sessions.length;
  // A cursor, so rows that keep failing can't hold a backfill on the same batch forever.
  if (options.mode === "backfill" && sessions.length === limit) summary.nextSince = sessions[sessions.length - 1].arrival_time;
  if (sessions.length === 0) return summary;
  const beaches = await store.loadBeaches([...new Set(sessions.map((s) => s.beach_id))]);

  await runPool(sessions, async (session) => {
    const beach = beaches.get(session.beach_id);
    let patch: SessionPatch = {};
    try {
      if (session.conditions_source === null) {
        const resolved = await resolveConditions(store, session, beach);
        patch = conditionsPatch(session, resolved);
        if (resolved.conditions_source !== "none") summary.conditionsFilled += 1;
      }

      if (session.nearshore_source === null) {
        const pointId = beach?.mop_point_id ?? null;
        if (!pointId) {
          patch.nearshore_source = "unmapped";
          summary.unmapped += 1;
        } else {
          const at = new Date(session.arrival_time);
          const ageMs = nowMs - at.getTime();
          const markUnavailable = () => {
            Object.assign(patch, { nearshore_point_id: pointId, nearshore_source: "unavailable" });
            summary.unavailable += 1;
          };
          try {
            const hour = await mop.fetchMopHour(pointId, at);
            if (hour) {
              const focusRatio = await mop.fetchMopFocusRatio(pointId, at).catch(() => null);
              const source = ageMs > LIVE_LOOKBACK_MS ? "cdip_mop_backfill" : "cdip_mop_nowcast";
              Object.assign(patch, nearshoreFields(hour, focusRatio, source));
              summary.nearshoreFilled += 1;
            } else {
              markUnavailable();
            }
          } catch (error) {
            if (error instanceof MopHourPendingError) {
              if (ageMs > MOP_GIVE_UP_MS) markUnavailable();
              else summary.pending += 1;
            } else {
              summary.errors += 1;
              console.warn(`[session-conditions] MOP ${pointId} failed for session ${session.id}; retrying next run:`, error);
            }
          }
        }
      }

      if (Object.keys(patch).length > 0 && (await store.updateSession(session.id, patch))) summary.updated += 1;
    } catch (error) {
      if (error instanceof SessionConditionsStoreError && error.code === FOREIGN_KEY_VIOLATION) {
        summary.unwritable += 1;
        return;
      }
      summary.errors += 1;
      console.error(`[session-conditions] session ${session.id} failed:`, error);
    }
  });

  return summary;
}

const PENDING_SESSION_COLUMNS = [
  "id",
  "beach_id",
  "arrival_time",
  "conditions_source",
  "nearshore_source",
  ...SESSION_CONDITIONS_COLUMNS,
].join(", ");

const FORECAST_ROW_COLUMNS = [
  "forecast_at",
  "data_source",
  "wave_height",
  "wave_period",
  "wave_direction",
  "wave_direction_om",
  "swell_1_height",
  "swell_1_period",
  "swell_1_direction",
  "swell_height_om",
  "swell_period_om",
  "swell_direction_om",
  "wind_speed",
  "wind_direction",
  "wind_direction_deg",
].join(", ");

function unwrap<T>(result: { data: T | null; error: { message?: string; code?: string } | null }, what: string): T | null {
  if (result.error) {
    throw new SessionConditionsStoreError(`${what}: ${result.error.message ?? "unknown error"}`, result.error.code ?? null);
  }
  return result.data;
}

/** PostgREST access for the enrich job; the cron passes the service-role client. */
export function createSupabaseSessionConditionsStore(supabase: SupabaseClient): SessionConditionsStore {
  return {
    async listPendingSessions(query) {
      const pending = () =>
        supabase
          .from("sessions")
          .select(PENDING_SESSION_COLUMNS)
          .is("deleted_at", null)
          .or("conditions_source.is.null,nearshore_source.is.null")
          .not("beach_id", "is", null);
      if (query.kind === "backfill") {
        const result = await pending()
          .gte("arrival_time", query.arrivalFromIso)
          .lte("arrival_time", query.arrivalToIso)
          .order("arrival_time", { ascending: true })
          .limit(query.limit);
        return (unwrap(result, "pending sessions") ?? []) as unknown as PendingSession[];
      }
      // Queued recently (logged late, or moved) or surfed recently; two reads rather than nested OR filters.
      const [queued, surfed] = await Promise.all([
        pending()
          .gte("conditions_queued_at", query.recentSinceIso)
          .lte("arrival_time", query.arrivalToIso)
          .order("arrival_time", { ascending: false })
          .limit(query.limit),
        pending()
          .gte("arrival_time", query.recentSinceIso)
          .lte("arrival_time", query.arrivalToIso)
          .order("arrival_time", { ascending: false })
          .limit(query.limit),
      ]);
      const byId = new Map<string, PendingSession>();
      for (const row of [
        ...((unwrap(queued, "queued sessions") ?? []) as unknown as PendingSession[]),
        ...((unwrap(surfed, "recent sessions") ?? []) as unknown as PendingSession[]),
      ]) {
        byId.set(row.id, row);
      }
      return [...byId.values()]
        .sort((a, b) => Date.parse(b.arrival_time) - Date.parse(a.arrival_time))
        .slice(0, query.limit);
    },
    async loadBeaches(ids) {
      const result = await supabase
        .from("beaches")
        .select("id, mop_point_id, swell_window_center_deg, swell_window_halfwidth_deg")
        .in("id", ids);
      const rows = (unwrap(result, "beaches") ?? []) as unknown as EnrichBeach[];
      return new Map(rows.map((beach) => [beach.id, beach]));
    },
    async loadForecastRows(beachId, fromIso, toIso) {
      const result = await supabase
        .from("enhanced_forecasts")
        .select(FORECAST_ROW_COLUMNS)
        .eq("beach_id", beachId)
        .gte("forecast_at", fromIso)
        .lte("forecast_at", toIso);
      return (unwrap(result, "forecast rows") ?? []) as unknown as SessionConditionsRow[];
    },
    async loadSnapshot(sessionId) {
      const result = await supabase
        .from("session_forecast_snapshots")
        .select("forecast_snapshot")
        .eq("session_id", sessionId)
        .maybeSingle();
      const row = unwrap(result, "forecast snapshot") as { forecast_snapshot: SessionConditionsRow | null } | null;
      return row?.forecast_snapshot ?? null;
    },
    async updateSession(id, patch) {
      let query = supabase.from("sessions").update(patch).eq("id", id);
      for (const column of Object.keys(patch)) {
        // The marker is NOT NULL; the job only raises it on wind it fills, so guard on false.
        query = column === "conditions_wind_filled" ? query.eq(column, false) : query.is(column, null);
      }
      const result = await query.select("id");
      const rows = unwrap(result, "session update") as Array<{ id: string }> | null;
      return (rows?.length ?? 0) > 0;
    },
  };
}
