import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  RAIN_READING_MAX_AGE_MS,
  applyRainAdvisoryNotice,
  applyRainfallNotice,
  rainGaugeClusterFor,
  type RainRunoffMetadata,
  type RainfallReading,
} from "./rainfall-runoff";
import { RAIN_ADVISORY_EVENTS_TABLE, rainAdvisoryEventSchema, rainEventRegion, type RainAdvisoryEvent } from "./rain-advisory-events";

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
 * Display-path overlay for beach pages and discovery. The same stored events
 * hold recommendations (resolveWaterQualityHolds), so a held beach carries the
 * notice. Rain pushes go only through processRainAdvisoryPushes behind
 * RAIN_ADVISORY_PUSH_ENABLED.
 */
export async function withRainfallNotice<T extends { beach_id: string; status: string; status_reason?: string | null; county_advisory_status?: string }>(
  rows: readonly T[],
  beaches: readonly BeachCoords[],
  providedClient?: ReadingsClient,
  now: Date = new Date(),
): Promise<Array<T & { rain_runoff?: RainRunoffMetadata }>> {
  const clusterByBeach = new Map<string, string>();
  for (const beach of beaches) {
    const cluster = rainGaugeClusterFor(beach.lat, beach.lon);
    if (cluster) clusterByBeach.set(beach.id, cluster.id);
  }
  if (!rows.some((row) => clusterByBeach.has(row.beach_id))) return [...rows];
  try {
    const client = providedClient ?? (createSupabaseServiceRoleClient() as unknown as ReadingsClient);
    const events = await readActiveEvents(client);
    if (events !== null) {
      return rows.map((row) => {
        const cluster = clusterByBeach.get(row.beach_id);
        return cluster ? applyRainAdvisoryNotice(row, events.get(rainEventRegion(cluster))) : row;
      });
    }
    const { data, error } = await client.from(RAINFALL_READINGS_TABLE)
      .select("cluster_id, window_end, total_in, station_totals")
      .gte("window_end", new Date(now.getTime() - RAIN_READING_MAX_AGE_MS).toISOString())
      .order("window_end", { ascending: false });
    if (error || !Array.isArray(data)) {
      console.warn("[rainfall-runoff] readings unavailable", error);
      return [...rows];
    }
    const latest = new Map<string, RainfallReading>();
    for (const raw of data) {
      const reading = parseReading(raw);
      if (reading && !latest.has(reading.cluster_id)) latest.set(reading.cluster_id, reading);
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
