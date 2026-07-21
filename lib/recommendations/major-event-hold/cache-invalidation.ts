import "server-only";

import { revalidatePath as nextRevalidatePath } from "next/cache";
import { z } from "zod";

import { SURF_INTENTS } from "@/lib/constants/surf-intents";
import { FORECAST_REGIONS } from "@/lib/data/forecast-regions";
import { getDbStateCandidatesForStateSlug } from "@/lib/geo/state-routing";
import { COLLISION_CITY_MAP } from "@/lib/seo/city-collision-list";
import { buildCitySlug } from "@/lib/seo/city-slug-utils";
import { buildBeachUrl, stateToSlug } from "@/lib/utils/beach-url-utils";

import { MAJOR_EVENT_HOLD_TRANSITIONS } from "./types";
import type { MajorEventHoldTransition } from "./types";

const UUID_SCHEMA = z
  .string()
  .uuid()
  .transform((value) => value.toLowerCase());
const REGION_KEY_SCHEMA = z.enum(
  Object.keys(FORECAST_REGIONS) as [string, ...string[]],
);
const BEACH_QUERY_CHUNK_SIZE = 100;

const uniqueValues = (values: readonly string[]): boolean =>
  new Set(values).size === values.length;

const cacheScopeSchema = z
  .object({
    recordId: UUID_SCHEMA,
    holdId: UUID_SCHEMA,
    transition: z.enum(MAJOR_EVENT_HOLD_TRANSITIONS),
    regionKeys: z.array(REGION_KEY_SCHEMA).max(64).refine(uniqueValues),
    scopeBeachIds: z.array(UUID_SCHEMA).min(1).max(2000).refine(uniqueValues),
    supersedesRecordId: UUID_SCHEMA.nullable(),
  })
  .passthrough()
  .superRefine((record, context) => {
    const isActivation = record.transition === "activation";
    if (isActivation !== (record.supersedesRecordId === null)) {
      context.addIssue({ code: "custom", message: "invalid transition chain" });
    }
  });

const storedHoldScopeSchema = z
  .object({
    record_id: UUID_SCHEMA,
    hold_id: UUID_SCHEMA,
    region_keys: z.array(REGION_KEY_SCHEMA).max(64).refine(uniqueValues),
    scope_beach_ids: z.array(UUID_SCHEMA).min(1).max(2000).refine(uniqueValues),
  })
  .strict();

const beachMetadataSchema = z
  .object({
    id: UUID_SCHEMA,
    slug: z
      .string()
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/)
      .max(160),
    city: z.string().trim().min(1).max(160),
    state: z.string().trim().min(1).max(160),
    country: z.string().trim().min(1).max(160).nullable(),
    lat: z.number().finite().min(-90).max(90),
    deleted_at: z.null(),
  })
  .strict();

type BeachMetadata = z.infer<typeof beachMetadataSchema>;

export interface MajorEventHoldCacheScope {
  recordId: string;
  holdId: string;
  transition: MajorEventHoldTransition;
  regionKeys: string[];
  scopeBeachIds: string[];
  supersedesRecordId: string | null;
}

export interface MajorEventHoldCacheInvalidationStore {
  loadBeachMetadata(beachIds: readonly string[]): Promise<unknown>;
  loadHoldScopeByRecordId(recordId: string): Promise<unknown>;
}

export interface MajorEventHoldCacheInvalidationOptions {
  store: MajorEventHoldCacheInvalidationStore;
  revalidatePath?: (path: string) => void | Promise<void>;
}

export class MajorEventHoldCacheInvalidationError extends Error {
  readonly code = "cache_invalidation_failed";

  constructor() {
    super("cache_invalidation_failed");
    this.name = "MajorEventHoldCacheInvalidationError";
  }
}

function cacheInvalidationError(): MajorEventHoldCacheInvalidationError {
  return new MajorEventHoldCacheInvalidationError();
}

function matchesRegion(beach: BeachMetadata, regionKey: string): boolean {
  const region = FORECAST_REGIONS[regionKey];
  if (!region) return false;

  const normalizedState = beach.state.toLowerCase();
  const stateMatches = region.states.some((state) =>
    getDbStateCandidatesForStateSlug(state).some(
      (candidate) => candidate.toLowerCase() === normalizedState,
    ),
  );
  if (!stateMatches) return false;

  if (
    region.cities?.length &&
    !region.cities.some(
      (city) => city.toLowerCase() === beach.city.toLowerCase(),
    )
  ) {
    return false;
  }
  if (region.latBounds?.min !== undefined && beach.lat < region.latBounds.min) {
    return false;
  }
  if (
    region.latBounds?.max !== undefined &&
    beach.lat >= region.latBounds.max
  ) {
    return false;
  }
  return true;
}

function parseCompleteBeachMetadata(
  value: unknown,
  expectedIds: readonly string[],
): BeachMetadata[] {
  const parsed = z.array(beachMetadataSchema).safeParse(value);
  if (!parsed.success) throw cacheInvalidationError();

  const expected = new Set(expectedIds);
  const actual = new Set(parsed.data.map((beach) => beach.id));
  if (
    actual.size !== parsed.data.length ||
    actual.size !== expected.size ||
    [...actual].some((id) => !expected.has(id))
  ) {
    throw cacheInvalidationError();
  }
  return parsed.data.sort((left, right) => left.id.localeCompare(right.id));
}

async function collectScope(
  records: readonly MajorEventHoldCacheScope[],
  store: MajorEventHoldCacheInvalidationStore,
): Promise<{ beachIds: string[]; regionKeys: string[] }> {
  const beachIds = new Set<string>();
  const regionKeys = new Set<string>();

  for (const input of records) {
    const parsed = cacheScopeSchema.safeParse(input);
    if (!parsed.success) throw cacheInvalidationError();
    const record = parsed.data;
    record.scopeBeachIds.forEach((id) => beachIds.add(id));
    record.regionKeys.forEach((key) => regionKeys.add(key));

    if (record.transition !== "replacement") continue;
    const stored = storedHoldScopeSchema.safeParse(
      await store.loadHoldScopeByRecordId(record.supersedesRecordId as string),
    );
    if (
      !stored.success ||
      stored.data.record_id !== record.supersedesRecordId ||
      stored.data.hold_id !== record.holdId
    ) {
      throw cacheInvalidationError();
    }
    stored.data.scope_beach_ids.forEach((id) => beachIds.add(id));
    stored.data.region_keys.forEach((key) => regionKeys.add(key));
  }

  return {
    beachIds: [...beachIds].sort(),
    regionKeys: [...regionKeys].sort(),
  };
}

async function buildInvalidationPaths(
  records: readonly MajorEventHoldCacheScope[],
  store: MajorEventHoldCacheInvalidationStore,
): Promise<string[]> {
  if (records.length === 0) return [];

  const scope = await collectScope(records, store);
  const beaches = parseCompleteBeachMetadata(
    await store.loadBeachMetadata(scope.beachIds),
    scope.beachIds,
  );
  const paths = new Set<string>();
  const intentSlugs = Object.keys(SURF_INTENTS).sort();

  for (const beach of beaches) {
    const stateSlug = stateToSlug(beach.state);
    const citySlug = buildCitySlug(beach.city, stateSlug, COLLISION_CITY_MAP);
    if (!citySlug || !stateSlug) throw cacheInvalidationError();

    paths.add(buildBeachUrl(beach));
    paths.add(`/beach/${beach.slug}`);
    paths.add(`/best-time-to-surf/${citySlug}`);
    for (const intent of intentSlugs) {
      paths.add(`/${intent}/${citySlug}`);
      paths.add(`/${intent}/${stateSlug}`);
    }
    for (const regionKey of Object.keys(FORECAST_REGIONS)) {
      if (matchesRegion(beach, regionKey)) {
        paths.add(`/forecast/${regionKey}`);
      }
    }
  }
  for (const regionKey of scope.regionKeys) {
    paths.add(`/forecast/${regionKey}`);
  }
  return [...paths].sort();
}

export async function invalidateMajorEventHoldTransitions(
  records: readonly MajorEventHoldCacheScope[],
  options: MajorEventHoldCacheInvalidationOptions,
): Promise<string[]> {
  try {
    const paths = await buildInvalidationPaths(records, options.store);
    const revalidatePath = options.revalidatePath ?? nextRevalidatePath;
    for (const path of paths) {
      await revalidatePath(path);
    }
    return paths;
  } catch {
    throw cacheInvalidationError();
  }
}

interface QueryResult {
  data: unknown;
  error?: unknown;
}

interface QueryBuilder extends PromiseLike<QueryResult> {
  select(columns: string): QueryBuilder;
  eq(column: string, value: string): QueryBuilder;
  in(column: string, values: string[]): QueryBuilder;
  is(column: string, value: null): QueryBuilder;
  order(column: string, options: { ascending: boolean }): QueryBuilder;
  limit(count: number): QueryBuilder;
}

interface SupabaseCacheInvalidationClient {
  from: unknown;
}

function table(
  client: SupabaseCacheInvalidationClient,
  name: string,
): QueryBuilder {
  const from = client.from as (tableName: string) => QueryBuilder;
  return from.call(client, name);
}

function rowsFromResult(result: QueryResult): unknown[] {
  if (result.error || !Array.isArray(result.data)) {
    throw cacheInvalidationError();
  }
  return result.data;
}

export function createSupabaseMajorEventHoldCacheInvalidationStore(
  client: SupabaseCacheInvalidationClient,
): MajorEventHoldCacheInvalidationStore {
  return {
    async loadBeachMetadata(beachIds) {
      const rows: unknown[] = [];
      for (
        let start = 0;
        start < beachIds.length;
        start += BEACH_QUERY_CHUNK_SIZE
      ) {
        const ids = beachIds.slice(start, start + BEACH_QUERY_CHUNK_SIZE);
        const result = await table(client, "beaches")
          .select("id,slug,city,state,country,lat,deleted_at")
          .in("id", [...ids])
          .is("deleted_at", null)
          .order("id", { ascending: true })
          .limit(ids.length + 1);
        rows.push(...rowsFromResult(result));
      }
      return rows;
    },

    async loadHoldScopeByRecordId(recordId) {
      const result = await table(client, "regional_recommendation_holds")
        .select("record_id,hold_id,region_keys,scope_beach_ids")
        .eq("record_id", recordId)
        .limit(2);
      const rows = rowsFromResult(result);
      if (rows.length > 1) throw cacheInvalidationError();
      return rows[0] ?? null;
    },
  };
}
