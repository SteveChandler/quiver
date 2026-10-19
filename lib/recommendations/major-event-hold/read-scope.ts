import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

/**
 * Request-scoped memo for water-quality hold reads.
 *
 * One surf call resolves holds at several layers (candidate pool, discovery
 * ranking, canonical decision), each re-reading the same hold tables. A scope
 * lets those layers share one read per table. It caches rows, never decisions:
 * every caller still validates rows and checks staleness against its own clock.
 *
 * There is no module-level store. Outside `runWithWaterQualityReadScope` every
 * read goes straight to the database, so nothing is shared across requests.
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
}

const storage = new AsyncLocalStorage<WaterQualityReadScope>();

export function runWithWaterQualityReadScope<T>(fn: () => Promise<T>): Promise<T> {
  return storage.run({ reads: new WeakMap(), beachRows: new WeakMap() }, fn);
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
  load: () => PromiseLike<WaterQualityReadResult>,
): Promise<WaterQualityReadResult> {
  const scope = storage.getStore();
  if (!scope) return start(load);

  let reads = scope.reads.get(client);
  if (!reads) {
    reads = new Map();
    scope.reads.set(client, reads);
  }
  const cached = reads.get(key);
  if (cached) return retryOnFailure(cached, load, copyRows);

  const scopedReads = reads;
  const pending = settle(load, () => {
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

/** Shares `beach_id IN (...)` reads, including subsets of an earlier read. */
export function memoizedBeachRowsRead(
  client: object,
  tableAndColumns: string,
  beachIds: readonly string[],
  load: () => PromiseLike<WaterQualityReadResult>,
): Promise<WaterQualityReadResult> {
  const scope = storage.getStore();
  if (!scope) return start(load);

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
    result: settle(load, () => {
      const index = entries.indexOf(entry);
      if (index !== -1) entries.splice(index, 1);
    }),
  };
  entries.push(entry);
  return entry.result.then((result) => (succeeded(result) ? copyRows(result) : result));
}
