/**
 * Catalogue sync jobs run by /api/cron/wave-stations-sync. Writes go only to
 * wave_stations and wave_station_observations (never the forecast tables).
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  buildStationId,
  planDuplicates,
  planRegistryUpsert,
  type DuplicateCandidate,
  type ExistingStation,
} from "./catalogue";
import { hasWaveValue } from "./ndbc/parsers";
import { selectAllPages } from "./paging";
import type {
  SourceObservation,
  StationHistoryFile,
  WaveStationRow,
  WaveStationSourceAdapter,
} from "./types";

/** Untyped until types/database.generated.ts is regenerated with the catalogue tables. */
export type CatalogueClient = SupabaseClient;

const REGISTRY_UPSERT_BATCH = 500;
const MERGE_BATCH = 1000;
const DEACTIVATE_BATCH = 100;
const RETENTION_DAYS = 180;
const PRUNE_LIMIT = 5000;
const SPEC_REFRESH_MS = 50 * 60 * 1000;
/** A station's .spec and .txt checks stay at least this far apart, so they settle ~30 min apart. */
const CROSS_CHECK_GAP_MS = 20 * 60 * 1000;
/** Rows stamped further ahead than this are bad data; storing one would block later rows. */
const MAX_FUTURE_MS = 60 * 60 * 1000;
/** A station list this much smaller than the active catalogue looks like a broken feed. */
const MIN_LIST_RATIO_FOR_DEACTIVATION = 0.8;
const HISTORY_QUEUE_FETCH_LIMIT = 1000;

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

function isFuture(obs: SourceObservation, nowMs: number): boolean {
  return Date.parse(obs.observedAt) > nowMs + MAX_FUTURE_MS;
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
  /** Set when the list was under 80% of the active catalogue, so nothing was deactivated. */
  deactivationSkipped: { activeStored: number; listed: number } | null;
  /** duplicate_of changes across all sources in this run. */
  duplicates: { marked: number; cleared: number };
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

  const activeStored = existing.filter(
    (row) => row.active && row.id.startsWith(`${adapter.source}:`),
  ).length;
  let deactivationSkipped: RegistrySyncResult["deactivationSkipped"] = null;
  let deactivated = 0;
  if (activeStored > 0 && plan.rows.length < activeStored * MIN_LIST_RATIO_FOR_DEACTIVATION) {
    deactivationSkipped = { activeStored, listed: plan.rows.length };
    console.warn(
      `[WaveStations] ${adapter.source} listed ${plan.rows.length} stations vs ${activeStored} active; ` +
        `skipping deactivation of ${plan.deactivateIds.length}`,
    );
  } else {
    for (const ids of chunk(plan.deactivateIds, DEACTIVATE_BATCH)) {
      const { error } = await db.from("wave_stations").update({ active: false }).in("id", ids);
      if (error) throw new Error(`wave_stations deactivate: ${error.message}`);
      deactivated += ids.length;
    }
  }

  const waveStationsByCountry: Record<string, number> = {};
  for (const row of plan.rows) {
    if (!row.has_wave) continue;
    const key = row.country_code ?? "unknown";
    waveStationsByCountry[key] = (waveStationsByCountry[key] ?? 0) + 1;
  }

  const duplicates = await syncDuplicates(db);

  return {
    stationsListed: stations.length,
    withWave: plan.rows.filter((row) => row.has_wave).length,
    withSwellSplit: plan.rows.filter((row) => row.has_swell_split).length,
    waveStationsByCountry,
    upserted,
    deactivated,
    deactivationSkipped,
    duplicates,
  };
}

/**
 * Re-evaluate duplicate_of across every source after a registry run, so the
 * result does not depend on which source ran first (see planDuplicates).
 */
async function syncDuplicates(db: CatalogueClient): Promise<{ marked: number; cleared: number }> {
  const all = await selectAllPages<DuplicateCandidate>((from, to) =>
    db
      .from("wave_stations")
      .select("id, source, name, lat, lon, wmo_id, active, duplicate_of")
      .order("id")
      .range(from, to),
  );
  let marked = 0;
  let cleared = 0;
  for (const change of planDuplicates(all)) {
    const { error } = await db
      .from("wave_stations")
      .update({ duplicate_of: change.duplicate_of })
      .eq("id", change.id);
    if (error) throw new Error(`wave_stations duplicate_of: ${error.message}`);
    if (change.duplicate_of) marked++;
    else cleared++;
  }
  return { marked, cleared };
}

// ---------------------------------------------------------------------------
// Latest observations (every 15 minutes)
// ---------------------------------------------------------------------------

interface LatestSyncResult {
  rowsInFeed: number;
  rowsUnknownStation: number;
  /** Rows for catalogue stations with has_wave = false; not stored (row volume). */
  rowsNonWaveStation: number;
  /** Met-only rows (no wave value) from wave stations; not stored (row volume). */
  rowsWithoutWave: number;
  rowsStale: number;
  /** Rows stamped more than an hour after now; dropped as bad data. */
  rowsFuture: number;
  rowsSent: number;
  rowsWritten: number;
  rowsPruned: number;
}

export async function syncLatestObservations(
  db: CatalogueClient,
  adapter: WaveStationSourceAdapter,
  nowMs: number,
  /** The prune is table-wide, so only one source's run per cron call does it. */
  options: { prune?: boolean } = {},
): Promise<LatestSyncResult> {
  const prune = options.prune ?? true;
  const observations = await adapter.fetchLatestObservations();
  const stations = await selectAllPages<Pick<WaveStationRow, "id" | "last_observed_at" | "has_wave">>(
    (from, to) =>
      db
        .from("wave_stations")
        .select("id, last_observed_at, has_wave")
        .eq("source", adapter.source)
        .order("id")
        .range(from, to),
  );
  const stationById = new Map(stations.map((row) => [row.id, row]));

  let rowsUnknownStation = 0;
  let rowsNonWaveStation = 0;
  let rowsWithoutWave = 0;
  let rowsStale = 0;
  let rowsFuture = 0;
  const payload: ReturnType<typeof toMergePayload>[] = [];
  for (const obs of observations) {
    const stationId = buildStationId(adapter.source, obs.sourceStationId);
    const station = stationById.get(stationId);
    if (!station) {
      rowsUnknownStation++;
      continue;
    }
    if (isFuture(obs, nowMs)) {
      rowsFuture++;
      continue;
    }
    // Row volume: only rows with a wave value are stored (with their met fields).
    // A met-only station's row with a wave value is kept, and the merge sets has_wave.
    if (!hasWaveValue(obs.values)) {
      if (station.has_wave) rowsWithoutWave++;
      else rowsNonWaveStation++;
      continue;
    }
    // Same-time rows still go through: a later file can fill a field the
    // earlier one had as MM. The merge function skips unchanged rows.
    const last = station.last_observed_at;
    if (last && Date.parse(obs.observedAt) < Date.parse(last)) {
      rowsStale++;
      continue;
    }
    payload.push(toMergePayload(stationId, adapter.source, obs));
  }

  const rowsWritten = await mergeObservations(db, payload);

  // Prune once an hour (the first run after :00), in a bounded batch.
  let rowsPruned = 0;
  if (prune && new Date(nowMs).getUTCMinutes() < 15) {
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
    rowsNonWaveStation,
    rowsWithoutWave,
    rowsStale,
    rowsFuture,
    rowsSent: payload.length,
    rowsWritten,
    rowsPruned,
  };
}

// ---------------------------------------------------------------------------
// Station history files, each checked about once an hour with If-Modified-Since:
// - .spec (swell split) for stations with has_swell_split;
// - .txt (WVHT, DPD, APD, MWD + met) for every wave station, because .spec has
//   no dominant period and the latest feed often catches only the met row.
// A station's two checks are kept at least 20 minutes apart, so with hourly
// cadences they settle roughly 30 minutes apart and waves refresh ~2x an hour.
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
  /** Rows stamped more than an hour after now; dropped as bad data. */
  rowsFuture: number;
  errors: string[];
}

type CheckedColumn = "spec_checked_at" | "txt_checked_at";

interface HistoryQueueConfig {
  file: StationHistoryFile;
  checkedAt: CheckedColumn;
  /** The other file's check time; this queue waits until it is 20+ minutes old. */
  otherCheckedAt: CheckedColumn;
  lastModified: "spec_last_modified" | "txt_last_modified";
  lastObservedAt: "spec_last_observed_at" | "txt_last_observed_at";
  /** Extra eligibility filter column (has_swell_split for .spec, has_wave for .txt). */
  eligibility: "has_swell_split" | "has_wave";
}

const SPEC_QUEUE: HistoryQueueConfig = {
  file: "spec",
  checkedAt: "spec_checked_at",
  otherCheckedAt: "txt_checked_at",
  lastModified: "spec_last_modified",
  lastObservedAt: "spec_last_observed_at",
  eligibility: "has_swell_split",
};

const TXT_QUEUE: HistoryQueueConfig = {
  file: "txt",
  checkedAt: "txt_checked_at",
  otherCheckedAt: "spec_checked_at",
  lastModified: "txt_last_modified",
  lastObservedAt: "txt_last_observed_at",
  eligibility: "has_wave",
};

interface HistoryQueueRow {
  id: string;
  sourceStationId: string;
  lastModified: string | null;
  lastObservedAt: string | null;
  otherCheckedAt: string | null;
}

/** Swell split from .spec files, for active stations with has_swell_split. */
export async function syncSwellSplit(
  db: CatalogueClient,
  adapter: WaveStationSourceAdapter,
  nowMs: number,
  options: SwellSplitSyncOptions,
): Promise<SwellSplitSyncResult> {
  return syncHistoryQueue(db, adapter, nowMs, options, SPEC_QUEUE);
}

/** Standard .txt history (waves incl. dominant period, plus met), for every active wave station. */
export async function syncStandardHistory(
  db: CatalogueClient,
  adapter: WaveStationSourceAdapter,
  nowMs: number,
  options: SwellSplitSyncOptions,
): Promise<SwellSplitSyncResult> {
  return syncHistoryQueue(db, adapter, nowMs, options, TXT_QUEUE);
}

async function syncHistoryQueue(
  db: CatalogueClient,
  adapter: WaveStationSourceAdapter,
  nowMs: number,
  options: SwellSplitSyncOptions,
  config: HistoryQueueConfig,
): Promise<SwellSplitSyncResult> {
  const fetchHistory = adapter.fetchStationHistory;
  if (!fetchHistory) throw new Error(`${adapter.source}: no per-station history files`);
  const startedMs = Date.now();
  const dueBefore = new Date(nowMs - SPEC_REFRESH_MS).toISOString();
  const { data, error } = await db
    .from("wave_stations")
    .select(
      `id, source_station_id, ${config.lastModified}, ${config.lastObservedAt}, ${config.otherCheckedAt}`,
    )
    .eq("source", adapter.source)
    .eq("active", true)
    .eq(config.eligibility, true)
    .or(`${config.checkedAt}.is.null,${config.checkedAt}.lt.${dueBefore}`)
    .order(config.checkedAt, { ascending: true, nullsFirst: true })
    .limit(HISTORY_QUEUE_FETCH_LIMIT);
  if (error) throw new Error(`wave_stations ${config.file} queue: ${error.message}`);

  // The due set is a few hundred rows at most, so the cross-check gap is applied here.
  const otherGapBefore = nowMs - CROSS_CHECK_GAP_MS;
  const queue: HistoryQueueRow[] = ((data ?? []) as Array<Record<string, string | null>>)
    .map((row) => ({
      id: String(row.id),
      sourceStationId: String(row.source_station_id),
      lastModified: row[config.lastModified] ?? null,
      lastObservedAt: row[config.lastObservedAt] ?? null,
      otherCheckedAt: row[config.otherCheckedAt] ?? null,
    }))
    .filter((row) => !row.otherCheckedAt || Date.parse(row.otherCheckedAt) < otherGapBefore)
    .slice(0, options.maxStations);

  const result: SwellSplitSyncResult = {
    stationsDue: queue.length,
    fetched: 0,
    notModified: 0,
    notFound: 0,
    backfilled: 0,
    backfillDeferred: 0,
    skippedForTime: 0,
    rowsWritten: 0,
    rowsFuture: 0,
    errors: [],
  };
  let backfillSlots = options.maxBackfills;
  const checkedAt = new Date(nowMs).toISOString();

  const markChecked = async (stationId: string, fields: Partial<WaveStationRow>): Promise<void> => {
    const { error: updateError } = await db
      .from("wave_stations")
      .update({ [config.checkedAt]: checkedAt, ...fields })
      .eq("id", stationId);
    if (updateError) result.errors.push(`${stationId}: state update failed: ${updateError.message}`);
  };

  const processStation = async (station: HistoryQueueRow): Promise<void> => {
    // A possible backfill (no rows stored yet) holds a slot while it runs; the
    // slot is given back unless a 200 body actually wrote the first rows.
    const mayBackfill = !station.lastObservedAt;
    let holdsSlot = false;
    if (mayBackfill) {
      if (backfillSlots <= 0) {
        // Leave the station due; it is picked first next run.
        result.backfillDeferred++;
        return;
      }
      backfillSlots--;
      holdsSlot = true;
    }

    try {
      // Always send the stored Last-Modified: an empty or unchanged file then
      // answers 304 instead of a full re-download every hour.
      const history = await fetchHistory(station.sourceStationId, {
        ifModifiedSince: station.lastModified,
        file: config.file,
      });
      if (history.status === "not_modified") {
        result.notModified++;
        await markChecked(station.id, {});
        return;
      }
      if (history.status === "not_found") {
        result.notFound++;
        // The daily registry sync turns has_swell_split back on if the file returns.
        await markChecked(station.id, config.file === "spec" ? { has_swell_split: false } : {});
        return;
      }

      result.fetched++;
      const sinceMs = station.lastObservedAt ? Date.parse(station.lastObservedAt) : -Infinity;
      const fresh = history.observations.filter((obs) => {
        if (isFuture(obs, nowMs)) {
          result.rowsFuture++;
          return false;
        }
        return Date.parse(obs.observedAt) > sinceMs;
      });
      // Await first: `x += await` reads x before the await and loses other workers' writes.
      const written = await mergeObservations(
        db,
        fresh.map((obs) => toMergePayload(station.id, adapter.source, obs)),
      );
      result.rowsWritten += written;
      if (mayBackfill && fresh.length > 0) {
        result.backfilled++;
        holdsSlot = false;
      }

      const newestMs = fresh.reduce((max, obs) => Math.max(max, Date.parse(obs.observedAt)), sinceMs);
      const newest = Number.isFinite(newestMs) ? new Date(newestMs).toISOString() : station.lastObservedAt;
      await markChecked(station.id, {
        [config.lastModified]: history.lastModified,
        [config.lastObservedAt]: newest,
      });
    } catch (err) {
      result.errors.push(`${station.id}: ${err instanceof Error ? err.message : String(err)}`);
      // Rotate a failing station to the back instead of retrying it every run.
      await markChecked(station.id, {});
    } finally {
      if (holdsSlot) backfillSlots++;
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
