import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { cache } from "react";
import { isPublicBeachRowCacheEnabled, isPublicReadSharingEnabled } from "@/lib/config/public-read-sharing";
import {
  canCachePublicBeachRows,
  runWithPublicBeachRowCache,
  tryReadCachedPublicBeachRows,
} from "@/lib/data/server/public-beach-row-cache";

/**
 * Request-scoped memo for water-quality hold reads.
 *
 * One surf call resolves holds at several layers (candidate pool, discovery
 * ranking, canonical decision), each re-reading the same hold tables. A scope
 * lets those layers share one read per table. It caches rows, never decisions:
 * every caller still validates rows and checks staleness against its own clock.
 *
 * Outside an active scope every read goes straight to the database.
 * Failed reads are never shared: a caller that sees a failure retries on its
 * own, exactly as it would without the scope.
 */

export interface WaterQualityReadResult {
  data: unknown;
  error: unknown;
}

interface BeachRowsEntry {
  beachIds: ReadonlySet<string>;
  result: Promise<WaterQualityReadResult>;
}

interface WaterQualityReadScope {
  reads: WeakMap<object, Map<string, Promise<WaterQualityReadResult>>>;
  beachRows: WeakMap<object, Map<string, BeachRowsEntry[]>>;
  shareLatestCountyRun: boolean;
  publicRead: boolean;
}

interface CachedRead {
  isValid: (data: unknown) => boolean;
  ttl?: number;
  key?: string;
  cacheRead?: (load: Load) => PromiseLike<WaterQualityReadResult>;
}

type Load = () => PromiseLike<WaterQualityReadResult>;

const WATER_QUALITY_TTL_SECONDS = 300;
const POSTGREST_MAX_ROWS = 1_000;

const storage = new AsyncLocalStorage<WaterQualityReadScope>();

function createReadScope(
  shareLatestCountyRun: boolean,
  publicRead = false,
): WaterQualityReadScope {
  return { reads: new WeakMap(), beachRows: new WeakMap(), shareLatestCountyRun, publicRead };
}

export function runWithWaterQualityReadScope<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run(createReadScope(false), fn);
}

// Metadata and the page body can run in separate async contexts in one render.
const getPublicReadScope = cache(createReadScope);

export function runWithPublicWaterQualityReadScope<T>(
  fn: () => Promise<T>,
  shareLatestCountyRun = true,
): Promise<T> {
  const share = isPublicReadSharingEnabled();
  if (!share && !isPublicBeachRowCacheEnabled()) return fn();
  const scope = share
    ? getPublicReadScope(shareLatestCountyRun, true)
    : createReadScope(false, true);
  return runWithPublicBeachRowCache(() => storage.run(scope, fn));
}

export function canCacheWaterQualityReads(client: object): boolean {
  const scope = storage.getStore();
  return scope?.publicRead !== false && canCachePublicBeachRows(client);
}

export function canShareLatestCountyRun(): boolean {
  return storage.getStore()?.shareLatestCountyRun ?? false;
}

function succeeded(result: WaterQualityReadResult): boolean {
  return (result.error === null || result.error === undefined) && Array.isArray(result.data);
}

function retryOnFailure(
  shared: Promise<WaterQualityReadResult>,
  load: () => PromiseLike<WaterQualityReadResult>,
  project: (result: WaterQualityReadResult) => WaterQualityReadResult,
): Promise<WaterQualityReadResult> {
  return shared.then(
    (result) => (succeeded(result) ? project(result) : load()),
    () => load(),
  );
}

/** Starts the read synchronously so callers can still issue reads in parallel. */
function start(
  load: () => PromiseLike<WaterQualityReadResult>,
): Promise<WaterQualityReadResult> {
  try {
    return Promise.resolve(load());
  } catch (error) {
    return Promise.reject(error);
  }
}

function settle(
  load: () => PromiseLike<WaterQualityReadResult>,
  onFailure: () => void,
): Promise<WaterQualityReadResult> {
  return start(load)
    .then(
      (result) => {
        if (!succeeded(result)) onFailure();
        return result;
      },
      (error: unknown) => {
        onFailure();
        throw error;
      },
    );
}

function copyRows(result: WaterQualityReadResult): WaterQualityReadResult {
  return { data: [...(result.data as unknown[])], error: null };
}

/** Shares one successful read per client and key within the active scope. */
export function memoizedWaterQualityRead(
  client: object,
  key: string,
  load: Load,
  options?: CachedRead,
): Promise<WaterQualityReadResult> {
  const scope = storage.getStore();
  const read: Load = options && canCacheWaterQualityReads(client)
    ? async () => {
        if (options.cacheRead) return options.cacheRead(load);
        const rows = await tryReadCachedPublicBeachRows(
          client, options.key ?? key, options.ttl ?? WATER_QUALITY_TTL_SECONDS, load, options.isValid,
        );
        return rows === undefined ? load() : { data: rows, error: null };
      }
    : load;
  if (!scope || (scope.publicRead && !isPublicReadSharingEnabled())) return start(read);

  let reads = scope.reads.get(client);
  if (!reads) {
    reads = new Map();
    scope.reads.set(client, reads);
  }
  const cached = reads.get(key);
  if (cached) return retryOnFailure(cached, load, copyRows);

  const scopedReads = reads;
  const pending = settle(read, () => {
    if (scopedReads.get(key) === pending) scopedReads.delete(key);
  });
  scopedReads.set(key, pending);
  return pending.then((result) => (succeeded(result) ? copyRows(result) : result));
}

function beachIdOf(row: unknown): string | null {
  if (typeof row !== "object" || row === null) return null;
  const value = (row as { beach_id?: unknown }).beach_id;
  return typeof value === "string" ? value.toLowerCase() : null;
}

/**
 * Serves a `beach_id IN (...)` read from an earlier read of the same table and
 * columns when that read covered every requested beach.
 *
 * A row is dropped only when it belongs to another beach the earlier read asked
 * for. Anything unexpected (a non-string id, an id nobody asked for, a
 * duplicate) passes through, so the caller's row validation fails closed
 * exactly as it would on a direct read.
 */
function rowsForBeachIds(
  result: WaterQualityReadResult,
  readBeachIds: ReadonlySet<string>,
  requestedBeachIds: ReadonlySet<string>,
): WaterQualityReadResult {
  const rows = (result.data as unknown[]).filter((row) => {
    const beachId = beachIdOf(row);
    return beachId === null || !readBeachIds.has(beachId) || requestedBeachIds.has(beachId);
  });
  return { data: rows, error: null };
}

/** Cache membership independent of the caller's beach list. */
export async function tryReadWholeBeachTable<T>(
  client: object,
  tableAndColumns: string,
  beachIds: readonly string[],
  load: () => PromiseLike<{ data: T[] | null; error: unknown }>,
  isValid: (data: unknown) => boolean,
): Promise<T[] | undefined> {
  if (!canCacheWaterQualityReads(client)) return undefined;
  const rows = await tryReadCachedPublicBeachRows(
    client, tableAndColumns, WATER_QUALITY_TTL_SECONDS, load, (data) => {
      if (!Array.isArray(data) || data.length >= POSTGREST_MAX_ROWS || !isValid(data)) return false;
      const ids = new Set(data.map(beachIdOf));
      return !ids.has(null) && ids.size === data.length;
    },
  );
  if (rows == null) return undefined;
  const requested = new Set(beachIds.map((id) => id.toLowerCase()));
  const allIds = new Set(rows.map((row) => beachIdOf(row)!));
  return rowsForBeachIds({ data: rows, error: null }, allIds, requested).data as T[];
}

/** Shares `beach_id IN (...)` reads, including subsets of an earlier read. */
export function memoizedBeachRowsRead(
  client: object,
  tableAndColumns: string,
  beachIds: readonly string[],
  load: Load,
  wholeTable?: {
    load: Load;
    isValid: (data: unknown) => boolean;
  },
): Promise<WaterQualityReadResult> {
  const scope = storage.getStore();
  const read: Load = wholeTable && canCacheWaterQualityReads(client)
    ? async () => {
        const rows = await tryReadWholeBeachTable(
          client, tableAndColumns, beachIds,
          async () => {
            const { data, error } = await wholeTable.load();
            return { data: Array.isArray(data) ? data : null, error };
          },
          wholeTable.isValid,
        );
        return rows === undefined ? load() : { data: rows, error: null };
      }
    : load;
  if (!scope || (scope.publicRead && !isPublicReadSharingEnabled())) return start(read);

  const requested = new Set(beachIds.map((beachId) => beachId.toLowerCase()));
  let tables = scope.beachRows.get(client);
  if (!tables) {
    tables = new Map();
    scope.beachRows.set(client, tables);
  }
  const entries = tables.get(tableAndColumns) ?? [];
  tables.set(tableAndColumns, entries);

  const covering = entries.find((entry) =>
    [...requested].every((beachId) => entry.beachIds.has(beachId)),
  );
  if (covering) {
    return retryOnFailure(covering.result, load, (result) =>
      rowsForBeachIds(result, covering.beachIds, requested),
    );
  }

  const entry: BeachRowsEntry = {
    beachIds: requested,
    result: settle(read, () => {
      const index = entries.indexOf(entry);
      if (index !== -1) entries.splice(index, 1);
    }),
  };
  entries.push(entry);
  return entry.result.then((result) => (succeeded(result) ? copyRows(result) : result));
}
