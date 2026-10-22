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
import { RAIN_ADVISORY_EVENTS_TABLE, rainAdvisoryEventSchema, type RainAdvisoryEvent } from "./rain-advisory-events";

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
    if (latest === null) {
      console.warn("[rainfall-runoff] readings unavailable");
      return [...rows];
    }
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
  if (error || !Array.isArray(data)) return null;
  const latest = new Map<string, RainfallReading>();
  for (const raw of data) {
    const reading = parseReading(raw);
    if (reading && !latest.has(reading.cluster_id)) latest.set(reading.cluster_id, reading);
  }
  return latest;
}

export type ReadRainHeldBeachIds = (beachIds: readonly string[], now: Date) => Promise<Set<string> | null>;

/**
 * Beaches a go push must not name: the gauges nearest the beach measured runoff
 * rain in the last 72 hours. Null when that cannot be read. A missing or stale
 * reading holds nothing, like the beach page notice.
 */
export async function readRainHeldBeachIds(
  beachIds: readonly string[],
  now: Date,
  providedClient?: ReadingsClient,
): Promise<Set<string> | null> {
  const held = new Set<string>();
  if (beachIds.length === 0) return held;
  try {
    const client = providedClient ?? (createSupabaseServiceRoleClient() as unknown as ReadingsClient);
    const { data, error } = await client.from("beaches").select("id, lat, lon").in("id", [...new Set(beachIds)]);
    if (error || !Array.isArray(data)) return null;
    const clusterByBeach = new Map<string, string>();
    for (const raw of data as BeachCoords[]) {
      const cluster = pushRainClusterFor(raw.lat, raw.lon);
      if (cluster) clusterByBeach.set(raw.id.toLowerCase(), cluster.id);
    }
    if (clusterByBeach.size === 0) return held;
    const latest = await readLatestReadings(client, now);
    if (latest === null) return null;
    for (const [beachId, clusterId] of clusterByBeach) {
      const reading = latest.get(clusterId);
      if (reading && reading.total_in >= RAIN_RUNOFF_THRESHOLD_IN) held.add(beachId);
    }
    return held;
  } catch (error) {
    console.warn("[rainfall-runoff] push rain gate unavailable", error);
    return null;
  }
}
