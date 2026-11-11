/**
 * Catalogue sync jobs run by /api/cron/wave-stations-sync. Writes go only to
 * wave_stations and wave_station_observations (never the forecast tables).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import { buildStationId, planRegistryUpsert, type ExistingStation } from "./catalogue";
import type {
  SourceObservation,
  WaveStationRow,
  WaveStationSourceAdapter,
} from "./types";

/** Untyped until types/database.generated.ts is regenerated with the catalogue tables. */
export type CatalogueClient = SupabaseClient;

const PAGE_SIZE = 1000;
const REGISTRY_UPSERT_BATCH = 500;
const MERGE_BATCH = 1000;
const DEACTIVATE_BATCH = 100;
const RETENTION_DAYS = 180;
const PRUNE_LIMIT = 5000;
const SPEC_REFRESH_MS = 50 * 60 * 1000;

interface PageResult<T> {
  data: T[] | null;
  error: { message: string } | null;
}

export async function selectAllPages<T>(
  page: (from: number, to: number) => PromiseLike<PageResult<T>>,
): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await page(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) return rows;
  }
}

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function toMergePayload(stationId: string, source: string, obs: SourceObservation) {
  return { station_id: stationId, observed_at: obs.observedAt, source, ...obs.values };
}

async function mergeObservations(
  db: CatalogueClient,
  rows: ReturnType<typeof toMergePayload>[],
): Promise<number> {
  let written = 0;
  for (const batch of chunk(rows, MERGE_BATCH)) {
    const { data, error } = await db.rpc("merge_wave_station_observations", { p_rows: batch });
    if (error) throw new Error(`merge_wave_station_observations: ${error.message}`);
    written += typeof data === "number" ? data : 0;
  }
  return written;
}

// ---------------------------------------------------------------------------
// Registry (daily)
// ---------------------------------------------------------------------------

interface RegistrySyncResult {
  stationsListed: number;
  withWave: number;
  withSwellSplit: number;
  waveStationsByCountry: Record<string, number>;
  upserted: number;
  deactivated: number;
}

export async function syncRegistry(
  db: CatalogueClient,
  adapter: WaveStationSourceAdapter,
  nowMs: number,
): Promise<RegistrySyncResult> {
  const stations = await adapter.fetchStations();
  if (stations.length === 0) throw new Error(`${adapter.source}: station list is empty`);

  const existing = await selectAllPages<ExistingStation>((from, to) =>
    db
      .from("wave_stations")
      .select("id, slug, active, last_wave_observed_at")
      .order("id")
      .range(from, to),
  );

  const plan = planRegistryUpsert(adapter.source, stations, existing, nowMs);

  let upserted = 0;
  for (const batch of chunk(plan.rows, REGISTRY_UPSERT_BATCH)) {
    const { error } = await db.from("wave_stations").upsert(batch, { onConflict: "id" });
    if (error) throw new Error(`wave_stations upsert: ${error.message}`);
    upserted += batch.length;
  }

  let deactivated = 0;
  for (const ids of chunk(plan.deactivateIds, DEACTIVATE_BATCH)) {
    const { error } = await db.from("wave_stations").update({ active: false }).in("id", ids);
    if (error) throw new Error(`wave_stations deactivate: ${error.message}`);
    deactivated += ids.length;
  }

  const waveStationsByCountry: Record<string, number> = {};
  for (const row of plan.rows) {
    if (!row.has_wave) continue;
    const key = row.country_code ?? "unknown";
    waveStationsByCountry[key] = (waveStationsByCountry[key] ?? 0) + 1;
  }

  return {
    stationsListed: stations.length,
    withWave: plan.rows.filter((row) => row.has_wave).length,
    withSwellSplit: plan.rows.filter((row) => row.has_swell_split).length,
    waveStationsByCountry,
    upserted,
    deactivated,
  };
}

// ---------------------------------------------------------------------------
// Latest observations (every 15 minutes)
// ---------------------------------------------------------------------------

interface LatestSyncResult {
  rowsInFeed: number;
  rowsUnknownStation: number;
  rowsStale: number;
  rowsSent: number;
  rowsWritten: number;
  rowsPruned: number;
}

export async function syncLatestObservations(
  db: CatalogueClient,
  adapter: WaveStationSourceAdapter,
  nowMs: number,
): Promise<LatestSyncResult> {
  const observations = await adapter.fetchLatestObservations();
  const stations = await selectAllPages<Pick<WaveStationRow, "id" | "last_observed_at">>(
    (from, to) =>
      db
        .from("wave_stations")
        .select("id, last_observed_at")
        .eq("source", adapter.source)
        .order("id")
        .range(from, to),
  );
  const lastObservedById = new Map(stations.map((row) => [row.id, row.last_observed_at]));

  let rowsUnknownStation = 0;
  let rowsStale = 0;
  const payload: ReturnType<typeof toMergePayload>[] = [];
  for (const obs of observations) {
    const stationId = buildStationId(adapter.source, obs.sourceStationId);
    if (!lastObservedById.has(stationId)) {
      rowsUnknownStation++;
      continue;
    }
    // Same-time rows still go through: a later file can fill a field the
    // earlier one had as MM. The merge function skips unchanged rows.
    const last = lastObservedById.get(stationId);
    if (last && Date.parse(obs.observedAt) < Date.parse(last)) {
      rowsStale++;
      continue;
    }
    payload.push(toMergePayload(stationId, adapter.source, obs));
  }

  const rowsWritten = await mergeObservations(db, payload);

  // Prune once an hour (the first run after :00), in a bounded batch.
  let rowsPruned = 0;
  if (new Date(nowMs).getUTCMinutes() < 15) {
    const cutoff = new Date(nowMs - RETENTION_DAYS * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db.rpc("prune_wave_station_observations", {
      p_before: cutoff,
      p_limit: PRUNE_LIMIT,
    });
    if (error) throw new Error(`prune_wave_station_observations: ${error.message}`);
    rowsPruned = typeof data === "number" ? data : 0;
  }

  return {
    rowsInFeed: observations.length,
    rowsUnknownStation,
    rowsStale,
    rowsSent: payload.length,
    rowsWritten,
    rowsPruned,
  };
}

// ---------------------------------------------------------------------------
// Swell split (.spec), staggered so each station is fetched about once an hour
// ---------------------------------------------------------------------------

interface SwellSplitSyncOptions {
  maxStations: number;
  maxBackfills: number;
  concurrency: number;
  budgetMs: number;
}

interface SwellSplitSyncResult {
  stationsDue: number;
  fetched: number;
  notModified: number;
  notFound: number;
  backfilled: number;
  backfillDeferred: number;
  skippedForTime: number;
  rowsWritten: number;
  errors: string[];
}

type SpecQueueRow = Pick<
  WaveStationRow,
  "id" | "source_station_id" | "spec_last_modified" | "spec_last_observed_at"
>;

export async function syncSwellSplit(
  db: CatalogueClient,
  adapter: WaveStationSourceAdapter,
  nowMs: number,
  options: SwellSplitSyncOptions,
): Promise<SwellSplitSyncResult> {
  const startedMs = Date.now();
  const dueBefore = new Date(nowMs - SPEC_REFRESH_MS).toISOString();
  const { data, error } = await db
    .from("wave_stations")
    .select("id, source_station_id, spec_last_modified, spec_last_observed_at")
    .eq("source", adapter.source)
    .eq("active", true)
    .eq("has_swell_split", true)
    .or(`spec_checked_at.is.null,spec_checked_at.lt.${dueBefore}`)
    .order("spec_checked_at", { ascending: true, nullsFirst: true })
    .limit(options.maxStations);
  if (error) throw new Error(`wave_stations spec queue: ${error.message}`);

  const queue = (data ?? []) as SpecQueueRow[];
  const result: SwellSplitSyncResult = {
    stationsDue: queue.length,
    fetched: 0,
    notModified: 0,
    notFound: 0,
    backfilled: 0,
    backfillDeferred: 0,
    skippedForTime: 0,
    rowsWritten: 0,
    errors: [],
  };
  let backfillSlots = options.maxBackfills;
  const checkedAt = new Date(nowMs).toISOString();

  const markChecked = async (stationId: string, fields: Partial<WaveStationRow>): Promise<void> => {
    const { error: updateError } = await db
      .from("wave_stations")
      .update({ spec_checked_at: checkedAt, ...fields })
      .eq("id", stationId);
    if (updateError) result.errors.push(`${stationId}: state update failed: ${updateError.message}`);
  };

  const processStation = async (station: SpecQueueRow): Promise<void> => {
    const needsBackfill = !station.spec_last_observed_at;
    if (needsBackfill) {
      // Leave the station due; it is picked first next run.
      if (backfillSlots <= 0) {
        result.backfillDeferred++;
        return;
      }
      backfillSlots--;
    }

    try {
      const history = await adapter.fetchStationHistory(station.source_station_id, {
        ifModifiedSince: needsBackfill ? null : station.spec_last_modified,
      });
      if (history.status === "not_modified") {
        result.notModified++;
        await markChecked(station.id, {});
        return;
      }
      if (history.status === "not_found") {
        result.notFound++;
        // The daily registry sync turns this back on if the file returns.
        await markChecked(station.id, { has_swell_split: false });
        return;
      }

      result.fetched++;
      const sinceMs = station.spec_last_observed_at ? Date.parse(station.spec_last_observed_at) : -Infinity;
      const fresh = history.observations.filter((obs) => Date.parse(obs.observedAt) > sinceMs);
      // Await first: `x += await` reads x before the await and loses other workers' writes.
      const written = await mergeObservations(
        db,
        fresh.map((obs) => toMergePayload(station.id, adapter.source, obs)),
      );
      result.rowsWritten += written;
      if (needsBackfill && fresh.length > 0) result.backfilled++;

      const newestMs = fresh.reduce((max, obs) => Math.max(max, Date.parse(obs.observedAt)), sinceMs);
      const newest = Number.isFinite(newestMs)
        ? new Date(newestMs).toISOString()
        : station.spec_last_observed_at;
      await markChecked(station.id, {
        spec_last_modified: history.lastModified,
        spec_last_observed_at: newest,
      });
    } catch (err) {
      result.errors.push(`${station.id}: ${err instanceof Error ? err.message : String(err)}`);
      // Rotate a failing station to the back instead of retrying it every run.
      await markChecked(station.id, {});
    }
  };

  let next = 0;
  const worker = async (): Promise<void> => {
    while (next < queue.length) {
      if (Date.now() - startedMs > options.budgetMs) {
        result.skippedForTime = queue.length - next;
        next = queue.length;
        return;
      }
      const station = queue[next++];
      await processStation(station);
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, options.concurrency) }, worker));

  return result;
}
