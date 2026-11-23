import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { unstable_cache } from "next/cache";
import { isPublicBeachRowCacheEnabled } from "@/lib/config/public-read-sharing";
import { publicReadClientRole } from "@/lib/supabase";

const publicCacheActive = new AsyncLocalStorage<boolean>();
const pending = new Map<string, Promise<unknown>>();
const TAG = "public-beach-rows";

class UncacheableRead extends Error {}

export function runWithPublicBeachRowCache<T>(
  load: () => Promise<T>,
): Promise<T> {
  return isPublicBeachRowCacheEnabled() ? publicCacheActive.run(true, load) : load();
}

export function canCachePublicBeachRows(client: object): boolean {
  return publicCacheActive.getStore() === true && publicReadClientRole(client) !== undefined;
}

export async function tryReadCachedPublicBeachRows<T>(
  client: object,
  key: string,
  ttl: number,
  load: () => PromiseLike<{ data: T; error: unknown }>,
  isValid: (data: T) => boolean,
): Promise<T | undefined> {
  if (publicCacheActive.getStore() !== true) return undefined;
  const role = publicReadClientRole(client);
  if (!role) return undefined;

  const ttlMs = ttl * 1_000;
  // A new window misses even if Next would otherwise serve stale on a failed
  // revalidation. The clock-based decisions still run outside this cache.
  const parts = [TAG, role, key, String(Math.floor(Date.now() / ttlMs))];
  const cacheKey = JSON.stringify(parts);

  async function read(): Promise<{ rows: T }> {
    const { data, error } = await load();
    if (error != null || !isValid(data)) throw new UncacheableRead();
    return { rows: data };
  }

  try {
    let request = pending.get(cacheKey) as Promise<{ rows: T }> | undefined;
    if (!request) {
      request = unstable_cache(read, parts, { revalidate: ttl, tags: [TAG] })()
        .finally(() => pending.delete(cacheKey));
      pending.set(cacheKey, request);
    }
    return structuredClone((await request).rows);
  } catch (error) {
    if (!(error instanceof UncacheableRead)) throw error;
    return undefined;
  }
}

export async function readPublicBeachRows<T, E>(
  client: object,
  key: string,
  ttl: number,
  load: () => PromiseLike<{ data: T; error: E | null }>,
  isValid: (data: T) => boolean,
): Promise<{ data: T; error: E | null }> {
  if (!canCachePublicBeachRows(client)) return load();
  const data = await tryReadCachedPublicBeachRows(client, key, ttl, load, isValid);
  return data === undefined ? load() : { data, error: null };
}

export async function readPublicBeachRowsForIds<T, E>(
  client: object,
  key: string,
  ttl: number,
  ids: readonly string[],
  idOf: (row: T) => string | null,
  loadAll: () => PromiseLike<{ data: T[] | null; error: E | null }>,
  loadFiltered: () => PromiseLike<{ data: T[] | null; error: E | null }>,
  isValid: (rows: unknown) => boolean,
  minRows: number = 0,
): Promise<{ data: T[] | null; error: E | null }> {
  if (!canCachePublicBeachRows(client)) {
    return loadFiltered();
  }

  const rows = await tryReadCachedPublicBeachRows(client, key, ttl, async () => {
    return loadAll();
  }, (data) => {
    if (!Array.isArray(data) || data.length < minRows || data.length >= 1_000 || !isValid(data)) return false;
    const rowIds = data.map(idOf);
    return rowIds.every((id): id is string => id !== null) &&
      new Set(rowIds.map((id) => id.toLowerCase())).size === rowIds.length;
  });
  if (rows == null) {
    return loadFiltered();
  }

  const requestedIds = new Set(ids.map((id) => id.toLowerCase()));
  return {
    data: rows.filter((row) => {
      const id = idOf(row);
      return id !== null && requestedIds.has(id.toLowerCase());
    }),
    error: null,
  };
}
