import "server-only";

import { resolveCountyGeneralAdvisory } from "@/lib/services/county-beach-advisories/general-streak";
import { COUNTY_GENERAL_ADVISORY_MIN_SITES } from "@/lib/services/county-beach-advisories/types";
import type { WaterQualityHoldClient } from "@/lib/recommendations/major-event-hold/water-quality";
import { COUNTY_RAIN_CLUSTER, RAIN_READING_MAX_AGE_MS } from "./rainfall-runoff";
import {
  RAIN_ADVISORY_EVENTS_TABLE,
  countyTransitions,
  metarTransitions,
  rainAdvisoryEventSchema,
  type MetarRainSignal,
  type RainAdvisoryEvent,
  type RainAdvisoryTransition,
} from "./rain-advisory-events";

interface StoreError { code?: string; message?: string }
interface StoreResult { data: unknown; error: StoreError | null }
interface StoreQuery extends PromiseLike<StoreResult> {
  select(columns: string): StoreQuery;
  eq(column: string, value: string): StoreQuery;
  gte(column: string, value: string): StoreQuery;
  gt(column: string, value: number): StoreQuery;
  order(column: string, options: { ascending: boolean }): StoreQuery;
  limit(count: number): StoreQuery;
  single(): PromiseLike<StoreResult>;
}
interface StoreTable {
  select(columns: string): StoreQuery;
  insert(values: never): StoreQuery;
  update(values: never): StoreQuery;
}
interface SyncClient { from(table: string): StoreTable }
type EventRef = { id: string; region: string };
export type RainAdvisorySyncResult =
  | { status: "ok"; opened: EventRef[]; extended: EventRef[]; ended: EventRef[] }
  | { status: "table_missing" }
  | { status: "error"; error: unknown };

function missingTable(error: unknown): boolean {
  return !!error && typeof error === "object" && "code" in error
    && (error.code === "42P01" || error.code === "PGRST205");
}

function syncFailure(error: unknown): RainAdvisorySyncResult {
  return missingTable(error) ? { status: "table_missing" } : { status: "error", error };
}

function parseEvent(raw: unknown): RainAdvisoryEvent | null {
  const parsed = rainAdvisoryEventSchema.safeParse(raw);
  if (!parsed.success) throw new Error("Invalid rain advisory event row");
  return parsed.data;
}

async function readEvent(
  client: SyncClient,
  region: string,
  activeOnly: boolean,
): Promise<RainAdvisoryEvent | null> {
  let query = client.from(RAIN_ADVISORY_EVENTS_TABLE as never).select("*").eq("region", region);
  if (activeOnly) query = query.eq("status", "active");
  const { data, error } = await query.order("started_at", { ascending: false }).limit(1);
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Invalid rain advisory event response");
  return data.length ? parseEvent(data[0]) : null;
}

async function applyTransition(
  client: SyncClient,
  transition: RainAdvisoryTransition,
  region: string,
  now: Date,
  result: Extract<RainAdvisorySyncResult, { status: "ok" }>,
  active: RainAdvisoryEvent | null,
  signal?: MetarRainSignal,
): Promise<void> {
  if (transition.kind === "open") {
    const { data, error } = await client.from(RAIN_ADVISORY_EVENTS_TABLE as never)
      .insert(transition.event as never).select("id").single();
    if (error && error.code === "23505") return;
    if (error) throw error;
    if (!data || typeof data !== "object" || !("id" in data) || typeof data.id !== "string") {
      throw new Error("Rain advisory insert returned no id");
    }
    result.opened.push({ id: data.id, region });
    return;
  }
  if (transition.kind === "extend") {
    const sources = signal && active?.source === "metar_runoff"
      ? { ...active.sources, metar: { stations: signal.stations, total_in: signal.totalIn, window_end: signal.windowEnd } }
      : active?.sources;
    const { data, error } = await client.from(RAIN_ADVISORY_EVENTS_TABLE as never)
      .update({ last_rain_at: transition.last_rain_at, expires_at: transition.expires_at,
        updated_at: now.toISOString(), ...(sources ? { sources } : {}) } as never)
      .eq("id", transition.id).eq("status", "active").select("id");
    if (error) throw error;
    if (!Array.isArray(data)) throw new Error("Invalid rain advisory update response");
    if (data.length) result.extended.push({ id: transition.id, region });
    return;
  }
  const { data, error } = await client.from(RAIN_ADVISORY_EVENTS_TABLE as never)
    .update({ status: "ended", ended_at: transition.ended_at, end_reason: transition.end_reason,
      updated_at: now.toISOString() } as never)
    .eq("id", transition.id).eq("status", "active").select("id");
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Invalid rain advisory update response");
  if (data.length) result.ended.push({ id: transition.id, region });
}

function emptyResult(): Extract<RainAdvisorySyncResult, { status: "ok" }> {
  return { status: "ok", opened: [], extended: [], ended: [] };
}

export async function syncMetarRainAdvisories(
  providedClient: unknown,
  signals: readonly MetarRainSignal[],
  now: Date,
): Promise<RainAdvisorySyncResult> {
  const result = emptyResult();
  const client = providedClient as SyncClient;
  try {
    for (const signal of signals) {
      const active = await readEvent(client, signal.region, true);
      for (const transition of metarTransitions(signal, active)) {
        await applyTransition(client, transition, signal.region, now, result, active, signal);
      }
    }
    return result;
  } catch (error) {
    return syncFailure(error);
  }
}

async function latestSanDiegoRainAt(client: SyncClient, now: Date): Promise<string | null> {
  const { data, error } = await client.from("rainfall_runoff_readings")
    .select("window_end, total_in")
    .eq("cluster_id", COUNTY_RAIN_CLUSTER.id)
    .gte("window_end", new Date(now.getTime() - RAIN_READING_MAX_AGE_MS).toISOString())
    .gt("total_in", 0)
    .order("window_end", { ascending: false }).limit(1);
  if (error) throw error;
  if (!Array.isArray(data)) throw new Error("Invalid San Diego rain response");
  const raw = data[0] as Record<string, unknown> | undefined;
  if (!raw) return null;
  return typeof raw.window_end === "string" && Number.isFinite(Date.parse(raw.window_end))
    && Date.parse(raw.window_end) <= now.getTime() ? raw.window_end : null;
}

export async function syncCountyRainAdvisory(
  providedClient: unknown,
  run: { id: string; fetched_at: string; advisory_count: number },
  now: Date,
): Promise<RainAdvisorySyncResult> {
  const result = emptyResult();
  const client = providedClient as SyncClient;
  try {
    const active = await readEvent(client, COUNTY_RAIN_CLUSTER.id, true);
    const general = run.advisory_count >= COUNTY_GENERAL_ADVISORY_MIN_SITES;
    if (!general && !active) return result;
    const latest = general && !active ? await readEvent(client, COUNTY_RAIN_CLUSTER.id, false) : active;
    // Only an open needs the streak start; an active event stays as it is while the County lists.
    const streak = general && !active
      ? await resolveCountyGeneralAdvisory(client as unknown as WaterQualityHoldClient, run, now) : null;
    const needsRain = general && !active && latest?.status === "ended" && !!streak?.streakStartedAt
      && Date.parse(latest.started_at) >= Date.parse(streak.streakStartedAt);
    const sanDiegoRainAt = needsRain ? await latestSanDiegoRainAt(client, now) : null;
    for (const transition of countyTransitions({
      runFetchedAt: run.fetched_at, general, streakStartedAt: streak?.streakStartedAt ?? null, sanDiegoRainAt,
    }, active, latest)) {
      await applyTransition(client, transition, COUNTY_RAIN_CLUSTER.id, now, result, active);
    }
    return result;
  } catch (error) {
    return syncFailure(error);
  }
}
