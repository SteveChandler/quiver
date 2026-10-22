import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  RAIN_READING_MAX_AGE_MS,
  RAIN_RUNOFF_THRESHOLD_IN,
  applyRainAdvisoryNotice,
  applyRainfallNotice,
  pushRainClusterFor,
  rainClusterFor,
  type RainRunoffMetadata,
  type RainfallReading,
} from "./rainfall-runoff";
import { RAIN_ADVISORY_DURATION_MS, RAIN_ADVISORY_EVENTS_TABLE, rainAdvisoryEventSchema, type RainAdvisoryEvent } from "./rain-advisory-events";

export const RAINFALL_READINGS_TABLE = "rainfall_runoff_readings";

interface BeachCoords {
  id: string;
  lat: number | null;
  lon: number | null;
}

interface ReadingsClient {
  from: (table: string) => ReadQuery;
}

interface ReadQuery extends PromiseLike<{ data: unknown; error: unknown }> {
  select: (columns: string) => ReadQuery;
  eq: (column: string, value: string) => ReadQuery;
  in: (column: string, values: readonly string[]) => ReadQuery;
  gte: (column: string, value: string) => ReadQuery;
  order: (column: string, options: { ascending: boolean }) => ReadQuery;
}

function parseReading(value: unknown): RainfallReading | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  const total = Number(row.total_in);
  if (typeof row.cluster_id !== "string" || typeof row.window_end !== "string" || !Number.isFinite(total)) return null;
  const stations = row.station_totals && typeof row.station_totals === "object"
    ? row.station_totals as Record<string, number> : {};
  return { cluster_id: row.cluster_id, window_end: row.window_end, total_in: total, station_totals: stations };
}

async function readActiveEvents(client: ReadingsClient): Promise<Map<string, RainAdvisoryEvent> | null> {
  try {
    const { data, error } = await client.from(RAIN_ADVISORY_EVENTS_TABLE)
      .select("*").eq("status", "active").eq("source", "metar_runoff");
    if (error || !Array.isArray(data)) return null;
    const events = new Map<string, RainAdvisoryEvent>();
    for (const raw of data) {
      const parsed = rainAdvisoryEventSchema.safeParse(raw);
      if (!parsed.success) return null;
      events.set(parsed.data.region, parsed.data);
    }
    return events;
  } catch {
    return null;
  }
}

/**
 * Display-path overlay for beach pages and discovery. Rain notices never
 * trigger recommendation holds. Rain pushes go only through
 * processRainAdvisoryPushes behind RAIN_ADVISORY_PUSH_ENABLED.
 */
export async function withRainfallNotice<T extends { beach_id: string; status: string; status_reason?: string | null; county_advisory_status?: string }>(
  rows: readonly T[],
  beaches: readonly BeachCoords[],
  providedClient?: ReadingsClient,
  now: Date = new Date(),
): Promise<Array<T & { rain_runoff?: RainRunoffMetadata }>> {
  const clusterByBeach = new Map<string, string>();
  for (const beach of beaches) {
    const cluster = rainClusterFor(beach.lat, beach.lon);
    if (cluster) clusterByBeach.set(beach.id, cluster.id);
  }
  if (!rows.some((row) => clusterByBeach.has(row.beach_id))) return [...rows];
  try {
    const client = providedClient ?? (createSupabaseServiceRoleClient() as unknown as ReadingsClient);
    const events = await readActiveEvents(client);
    if (events !== null) {
      return rows.map((row) => {
        const cluster = clusterByBeach.get(row.beach_id);
        return cluster ? applyRainAdvisoryNotice(row, events.get(cluster)) : row;
      });
    }
    const latest = await readLatestReadings(client, now);
    if (latest === null) return [...rows];
    return rows.map((row) => {
      const cluster = clusterByBeach.get(row.beach_id);
      return cluster ? applyRainfallNotice(row, latest.get(cluster), now) : row;
    });
  } catch (error) {
    console.warn("[rainfall-runoff] readings read failed", error);
    return [...rows];
  }
}

async function readLatestReadings(client: ReadingsClient, now: Date): Promise<Map<string, RainfallReading> | null> {
  const { data, error } = await client.from(RAINFALL_READINGS_TABLE)
    .select("cluster_id, window_end, total_in, station_totals")
    .gte("window_end", new Date(now.getTime() - RAIN_READING_MAX_AGE_MS).toISOString())
    .order("window_end", { ascending: false });
  if (error || !Array.isArray(data)) {
    console.warn("[rainfall-runoff] readings unavailable", error);
    return null;
  }
  const latest = new Map<string, RainfallReading>();
  for (const raw of data) {
    const reading = parseReading(raw);
    if (reading && !latest.has(reading.cluster_id)) latest.set(reading.cluster_id, reading);
  }
  return latest;
}

export interface RainPushCandidate {
  beachId: string;
  startsAt: string;
}

/** Beach id → why a go push must not name it. Absent beaches are clear. */
export type RainHeldBeaches = Map<string, "rain" | "unknown">;

export type ReadRainHeldBeaches = (candidates: readonly RainPushCandidate[], now: Date) => Promise<RainHeldBeaches>;

/**
 * Beaches a go push must not name: the gauges nearest the beach measured runoff
 * rain in the last 72 hours and the window starts before that can have cleared.
 * A missing or stale reading holds nothing, like the beach page notice. When the
 * readings cannot be read only beaches with gauges are withheld, and when the
 * beaches cannot be read nothing is, since no gauge is known to cover them.
 */
export async function readRainHeldBeaches(
  candidates: readonly RainPushCandidate[],
  now: Date,
  providedClient?: ReadingsClient,
): Promise<RainHeldBeaches> {
  const held: RainHeldBeaches = new Map();
  if (candidates.length === 0) return held;
  try {
    const client = providedClient ?? (createSupabaseServiceRoleClient() as unknown as ReadingsClient);
    const beachIds = [...new Set(candidates.map((candidate) => candidate.beachId.toLowerCase()))];
    const { data, error } = await client.from("beaches").select("id, lat, lon").in("id", beachIds);
    if (error || !Array.isArray(data)) {
      console.warn("[rainfall-runoff] push rain gate: beaches unavailable", error);
      return held;
    }
    const clusterByBeach = new Map<string, string>();
    for (const raw of data as BeachCoords[]) {
      const cluster = pushRainClusterFor(raw.lat, raw.lon);
      if (cluster) clusterByBeach.set(raw.id.toLowerCase(), cluster.id);
    }
    if (clusterByBeach.size === 0) return held;
    const latest = await readLatestReadings(client, now);
    for (const candidate of candidates) {
      const beachId = candidate.beachId.toLowerCase();
      const clusterId = clusterByBeach.get(beachId);
      if (!clusterId) continue;
      if (latest === null) {
        held.set(beachId, "unknown");
        continue;
      }
      const reading = latest.get(clusterId);
      if (!reading || reading.total_in < RAIN_RUNOFF_THRESHOLD_IN) continue;
      // No rain can have fallen after the reading, so 72 hours past it the runoff has cleared.
      const clearsAt = Date.parse(reading.window_end) + RAIN_ADVISORY_DURATION_MS;
      if (Date.parse(candidate.startsAt) < clearsAt) held.set(beachId, "rain");
    }
    return held;
  } catch (error) {
    console.warn("[rainfall-runoff] push rain gate unavailable", error);
    return held;
  }
}
