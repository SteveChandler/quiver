import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.generated";
import type { Beach } from "@/types/database";
import {
  SWELL_EVENT_BASELINE_LOOKBACK_HOURS,
  SWELL_EVENT_KEY_REUSE_DAYS,
  SWELL_EVENT_THRESHOLDS,
  detectBeachSwellEvents,
  detectSwellCrossing,
  isSwellEventCurrent,
  loadRecentSwellSnapshots,
  loadSwellForecastRows,
  resolveEventKeys,
  toSwellEventBeach,
  toSwellEventSnapshotRow,
  upsertSwellEventSnapshots,
  type SwellEventForecastRow,
  type SwellEventSnapshot,
  type SwellEventSnapshotRow,
} from "@/lib/alerts/swell-events";
import { readAllPages } from "@/lib/alerts/swell-events/paging";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { getStalenessDetails } from "@/lib/utils/forecast-service-utils";
import { resolveBeachTimezone } from "@/lib/utils/timezone-utils";

const DAY_MS = 24 * 60 * 60 * 1000;
const BEACH_CHUNK = 10;
const CHUNK_CONCURRENCY = 4;
const FRESHNESS_CHUNK = 500;
// The detector's baseline starts 48 h back; one extra day covers the whole
// local day that point falls in, whatever the beach timezone.
const FORECAST_LOOKBACK_MS = (SWELL_EVENT_BASELINE_LOOKBACK_HOURS + 24) * 60 * 60 * 1000;

const BEACH_COLUMNS = [
  "id",
  "name",
  "slug",
  "timezone",
  "swell_window_center_deg",
  "swell_window_halfwidth_deg",
  "swell_access_factors",
  "terrain_enabled",
  "shoaling_factors",
  "deepwater_decay_factor",
].join(",");


export type SnapshotBeach = Pick<
  Beach,
  | "id"
  | "name"
  | "slug"
  | "timezone"
  | "swell_window_center_deg"
  | "swell_window_halfwidth_deg"
  | "swell_access_factors"
  | "terrain_enabled"
  | "shoaling_factors"
  | "deepwater_decay_factor"
>;

export interface SwellEventSnapshotRunDependencies {
  loadBeaches: () => Promise<SnapshotBeach[]>;
  loadLatestForecastUpdates: (
    beachIds: string[],
  ) => Promise<Map<string, { updatedAt: string; dataSource: string | null }>>;
  loadForecasts: (
    beachIds: string[],
    from: Date,
    to: Date,
  ) => Promise<Map<string, SwellEventForecastRow[]>>;
  loadSnapshots: (beachIds: string[], since: Date) => Promise<SwellEventSnapshot[]>;
  writeSnapshots: (rows: SwellEventSnapshotRow[]) => Promise<number>;
  isStale?: (updatedAt: string, dataSource: string | null) => boolean;
}

interface SwellEventSnapshotRunSummary {
  runDate: string;
  beachesWithWindow: number;
  beachesEvaluated: number;
  beachesSkippedStale: number;
  beachesWithoutForecasts: number;
  beachesFailed: number;
  chunksFailed: number;
  forecastRowsRead: number;
  eventsDetected: number;
  snapshotsWritten: number;
  durationMs: number;
}

function defaultDependencies(client: SupabaseClient<Database>): SwellEventSnapshotRunDependencies {
  return {
    loadBeaches: () => readAllPages(async (offset, limit) => {
      const { data, error } = await client
        .from("beaches")
        .select(BEACH_COLUMNS)
        .eq("is_private", false)
        .not("swell_window_center_deg", "is", null)
        .not("swell_window_halfwidth_deg", "is", null)
        .order("id", { ascending: true })
        .range(offset, offset + limit - 1);
      if (error) throw new Error(`Failed to load swell-window beaches: ${error.message}`);
      return (data ?? []) as unknown as SnapshotBeach[];
    }),
    loadLatestForecastUpdates: async (beachIds) => {
      const latest = new Map<string, { updatedAt: string; dataSource: string | null }>();
      for (let offset = 0; offset < beachIds.length; offset += FRESHNESS_CHUNK) {
        const { data, error } = await client
          .from("v_enhanced_forecast_latest")
          .select("beach_id, updated_at, data_source")
          .in("beach_id", beachIds.slice(offset, offset + FRESHNESS_CHUNK));
        if (error) throw new Error(`Failed to load forecast freshness: ${error.message}`);
        for (const row of data ?? []) {
          if (row.beach_id && row.updated_at) {
            latest.set(row.beach_id, { updatedAt: row.updated_at, dataSource: row.data_source ?? null });
          }
        }
      }
      return latest;
    },
    loadForecasts: (beachIds, from, to) => loadSwellForecastRows(client, beachIds, from, to),
    loadSnapshots: (beachIds, since) => loadRecentSwellSnapshots(client, beachIds, since),
    writeSnapshots: (rows) => upsertSwellEventSnapshots(client, rows),
  };
}

function isStaleByDefault(updatedAt: string, dataSource: string | null): boolean {
  return getStalenessDetails(updatedAt, dataSource ?? "FALLBACK").isStale;
}

/**
 * Daily snapshot of detected swell events for every public beach with a
 * swell window. Stale forecasts are skipped: re-snapshotting an unchanged
 * forecast would make an event look stable run to run when it is not.
 */
export async function runSwellEventSnapshotCron(args: {
  now: Date;
  dependencies?: SwellEventSnapshotRunDependencies;
}): Promise<SwellEventSnapshotRunSummary> {
  const started = Date.now();
  const deps = args.dependencies ?? defaultDependencies(createSupabaseServiceRoleClient());
  const isStale = deps.isStale ?? isStaleByDefault;
  const summary: SwellEventSnapshotRunSummary = {
    runDate: args.now.toISOString().slice(0, 10),
    beachesWithWindow: 0,
    beachesEvaluated: 0,
    beachesSkippedStale: 0,
    beachesWithoutForecasts: 0,
    beachesFailed: 0,
    chunksFailed: 0,
    forecastRowsRead: 0,
    eventsDetected: 0,
    snapshotsWritten: 0,
    durationMs: 0,
  };

  const beaches = await deps.loadBeaches();
  summary.beachesWithWindow = beaches.length;
  const latest = await deps.loadLatestForecastUpdates(beaches.map((beach) => beach.id));
  const eligible = beaches.filter((beach) => {
    const update = latest.get(beach.id);
    if (!update) {
      summary.beachesWithoutForecasts += 1;
      return false;
    }
    if (isStale(update.updatedAt, update.dataSource)) {
      summary.beachesSkippedStale += 1;
      return false;
    }
    return true;
  });

  const from = new Date(args.now.getTime() - FORECAST_LOOKBACK_MS);
  const to = new Date(args.now.getTime() + (SWELL_EVENT_THRESHOLDS.maxHorizonDays + 1) * DAY_MS);
  const since = new Date(args.now.getTime() - SWELL_EVENT_KEY_REUSE_DAYS * DAY_MS);

  const processChunk = async (chunk: SnapshotBeach[]): Promise<void> => {
    const ids = chunk.map((beach) => beach.id);
    try {
      // Key reuse needs the earlier snapshots; without them, writing fresh
      // natural keys would fork an event's identity, so the chunk is skipped.
      const [forecasts, snapshots] = await Promise.all([
        deps.loadForecasts(ids, from, to),
        deps.loadSnapshots(ids, since),
      ]);
      const rows: SwellEventSnapshotRow[] = [];
      for (const beach of chunk) {
        const beachForecasts = forecasts.get(beach.id) ?? [];
        summary.forecastRowsRead += beachForecasts.length;
        if (beachForecasts.length === 0) {
          summary.beachesWithoutForecasts += 1;
          continue;
        }
        try {
          const swellBeach = toSwellEventBeach(beach);
          const timezone = resolveBeachTimezone(beach.timezone);
          const detected = detectBeachSwellEvents({
            beach: swellBeach,
            forecasts: beachForecasts,
            now: args.now,
            timezone,
          });
          const resolved = resolveEventKeys(
            detected,
            snapshots.filter((snapshot) => snapshot.beachId === beach.id),
          ).filter((event) => isSwellEventCurrent(event, args.now));
          summary.beachesEvaluated += 1;
          summary.eventsDetected += resolved.length;
          rows.push(...resolved.map((event) => toSwellEventSnapshotRow(
            event,
            args.now,
            detectSwellCrossing({ beach: swellBeach, forecasts: beachForecasts, main: event, timezone }),
          )));
        } catch (error) {
          summary.beachesFailed += 1;
          console.warn("[swell-event-snapshots] beach failed", {
            beachId: beach.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }
      summary.snapshotsWritten += await deps.writeSnapshots(rows);
    } catch (error) {
      summary.chunksFailed += 1;
      console.warn("[swell-event-snapshots] chunk failed", {
        beachIds: ids,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  const chunks: SnapshotBeach[][] = [];
  for (let offset = 0; offset < eligible.length; offset += BEACH_CHUNK) {
    chunks.push(eligible.slice(offset, offset + BEACH_CHUNK));
  }
  // A few batches at a time keeps the run short without flooding the database.
  let nextChunk = 0;
  await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, chunks.length) }, async () => {
    while (nextChunk < chunks.length) {
      const chunk = chunks[nextChunk];
      nextChunk += 1;
      await processChunk(chunk);
    }
  }));

  summary.durationMs = Date.now() - started;
  return summary;
}
