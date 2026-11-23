import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";
import { unstable_cache } from "next/cache";
import { isPublicBeachRowCacheEnabled } from "@/lib/config/public-read-sharing";
import { publicReadClientRole } from "@/lib/supabase";

const publicCacheActive = new AsyncLocalStorage<boolean>();
const pending = new Map<string, Promise<unknown>>();
const warnedKeys = new Set<string>();
const TAG = "public-beach-rows";

export type PublicBeachCacheRejectReason =
  | "invalid-rows"
  | "row-cap"
  | "empty"
  | "duplicate-id"
  | "not-completed";

export type PublicBeachRowsCacheResult<T> =
  | { kind: "hit"; rows: T }
  | { kind: "invalid"; reason: PublicBeachCacheRejectReason }
  | { kind: "error"; result: { data: unknown; error: unknown } }
  | { kind: "bypass" };

class UncacheableRead extends Error {
  constructor(
    readonly outcome:
      | { kind: "invalid"; reason: PublicBeachCacheRejectReason }
      | { kind: "error"; result: { data: unknown; error: unknown } },
  ) {
    super(outcome.kind === "invalid" ? outcome.reason : "database read failed");
  }
}

export function publicBeachRowCacheWindow(key: string, ttlMs: number, nowMs: number = Date.now()): number {
  let hash = 2_166_136_261;
  for (let index = 0; index < key.length; index++) {
    hash = Math.imul(hash ^ key.charCodeAt(index), 16_777_619);
  }
  const offset = (hash >>> 0) % ttlMs;
  return Math.floor((nowMs + offset) / ttlMs);
}

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
  invalidReason?: (data: T) => PublicBeachCacheRejectReason,
): Promise<PublicBeachRowsCacheResult<T>> {
  if (publicCacheActive.getStore() !== true) return { kind: "bypass" };
  const role = publicReadClientRole(client);
  if (!role) return { kind: "bypass" };

  const ttlMs = Math.max(1, ttl * 1_000);
  // A new window misses even if Next would otherwise serve stale on a failed
  // revalidation. The clock-based decisions still run outside this cache.
  const parts = [TAG, role, key, String(publicBeachRowCacheWindow(key, ttlMs))];
  const cacheKey = JSON.stringify(parts);

  async function read(): Promise<{ rows: T }> {
    const { data, error } = await load();
    if (error != null) {
      throw new UncacheableRead({ kind: "error", result: { data, error } });
    }
    if (!isValid(data)) {
      throw new UncacheableRead({ kind: "invalid", reason: invalidReason?.(data) ?? "invalid-rows" });
    }
    return { rows: data };
  }

  try {
    let request = pending.get(cacheKey) as Promise<{ rows: T }> | undefined;
    if (!request) {
      request = unstable_cache(read, parts, { revalidate: ttl, tags: [TAG] })()
        .finally(() => pending.delete(cacheKey));
      pending.set(cacheKey, request);
    }
    return { kind: "hit", rows: structuredClone((await request).rows) };
  } catch (error) {
    if (!(error instanceof UncacheableRead)) throw error;
    if (error.outcome.kind === "invalid" && !warnedKeys.has(cacheKey)) {
      warnedKeys.add(cacheKey);
      console.warn("[public-beach-row-cache] not cached", { key, reason: error.outcome.reason });
    }
    return error.outcome as PublicBeachRowsCacheResult<T>;
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
  const cached = await tryReadCachedPublicBeachRows(client, key, ttl, load, isValid);
  if (cached.kind === "hit") return { data: cached.rows, error: null };
  if (cached.kind === "error") return cached.result as { data: T; error: E | null };
  return load();
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

  const rejectReason = (data: unknown): PublicBeachCacheRejectReason | undefined => {
    if (!Array.isArray(data)) return "invalid-rows";
    if (data.length < minRows) return "empty";
    if (data.length >= 1_000) return "row-cap";
    if (!isValid(data)) return "invalid-rows";
    const rowIds = data.map(idOf);
    if (rowIds.some((id) => id === null)) return "invalid-rows";
    if (new Set(rowIds.map((id) => id!.toLowerCase())).size !== rowIds.length) return "duplicate-id";
    return undefined;
  };
  const cached = await tryReadCachedPublicBeachRows(client, key, ttl, async () => {
    return loadAll();
  }, (data) => rejectReason(data) === undefined, (data) => rejectReason(data) ?? "invalid-rows");
  if (cached.kind === "error") return cached.result as { data: T[] | null; error: E | null };
  if (cached.kind !== "hit") return loadFiltered();

  const requestedIds = new Set(ids.map((id) => id.toLowerCase()));
  const rows = cached.rows as T[];
  return {
    data: rows.filter((row) => {
      const id = idOf(row);
      return id !== null && requestedIds.has(id.toLowerCase());
    }),
    error: null,
  };
}
