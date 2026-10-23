import { isCurrentWaterQualitySample } from "@/lib/constants/water-quality";
import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { currentWaterQuality } from "@/lib/services/water-quality/current-status";
import { resolveCountyGeneralAdvisory } from "@/lib/services/county-beach-advisories/general-streak";
import { insideCountyFeed, readBeachPoints } from "@/lib/services/water-quality/county-coverage";
import {
  RAIN_ADVISORY_EVENTS_TABLE,
  rainAdvisoryEventSchema,
  rainEventRegion,
  type RainAdvisoryEvent,
} from "@/lib/services/water-quality/rain-advisory-events";
import { rainGaugeClusterFor } from "@/lib/services/water-quality/rainfall-runoff";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  COUNTY_ADVISORY_TYPES,
  COUNTY_MAX_FUTURE_SKEW_MS,
  COUNTY_FEED_SOURCE_IDENTIFIER,
  COUNTY_MAX_STALENESS_MS,
} from "@/lib/services/county-beach-advisories/types";

import {
  memoizedBeachRowsRead,
  memoizedWaterQualityRead,
  type WaterQualityReadResult,
} from "./read-scope";
import type { MajorEventHoldCandidate } from "./types";

/** Seed manifest only. Runtime truth is water_quality_held_beaches. */
export const CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS = [
  "9e94759c-d531-4e5c-9bc2-d022acea9dcd", // Imperial Beach
  "d9f93c82-7f4b-440a-865a-55cdbb821f74", // Imperial Beach Pier
  "94f1010b-c71f-4025-bda1-c26ed9467c85", // Silver Strand State Beach
  "b29821f9-c91a-486f-981b-7085c6d86b68", // Coronado North Jetty
  "84d3468b-c1ec-46ad-8621-d8507e5f167a", // Hotel Del Coronado
] as const;

/**
 * Beaches whose current County projection may hold them in recommendations.
 * Display surfaces show County notices on every covered beach; holds keep this
 * pre-2026-10 scope until Steven decides whether held beaches should be warned
 * rather than hidden. Live County holds (ingest-matched sites) are unaffected.
 */
const COUNTY_PROJECTION_HOLD_BEACH_IDS = [
  "d291411d-d331-4bf1-ad1a-302da3c69de0", // La Jolla Shores
] as const;

/** Leave room for the owner-curated hold set before ranking truncates results. */
export const WATER_QUALITY_HOLD_PREFETCH_BUFFER =
  CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS.length;

const WATER_QUALITY_STATUSES = [
  "good",
  "advisory",
  "closure",
  "unknown",
] as const;
export type WaterQualityStatus = (typeof WATER_QUALITY_STATUSES)[number];
export type WaterQualityHoldStatus = Extract<
  WaterQualityStatus,
  "advisory" | "closure"
>;

const WATER_QUALITY_SELECT = [
  "beach_id",
  "status",
  "latest_enterococcus",
  "latest_fecal_coliform",
  "latest_sample_date",
  "exceedance_count_30d",
  "total_samples_30d",
  "monitoring_station_id",
  "status_reason",
].join(", ");
const MISSING_TABLE_ERROR_CODE = "42P01";
const COUNTY_LIVE_RUN_SELECT = "id, fetched_at, status, source_identifier, advisory_count";
// Same columns as the current-status projection so one request reads a run's
// notices once; this resolver validates only the fields it uses.
const COUNTY_ADVISORY_SELECT =
  "beach_id, source_site_identifier, advisory_type, county_latitude, county_longitude";

const waterQualityRowSchema = z
  .object({
    beach_id: z.string().uuid().transform((value) => value.toLowerCase()),
    status: z.enum(WATER_QUALITY_STATUSES),
    total_samples_30d: z.number().int().nonnegative(),
  })
  .passthrough();

const waterQualityHeldRowSchema = z.object({
  beach_id: z.string().uuid().transform((value) => value.toLowerCase()),
});

interface WaterQualityQuery {
  in(
    column: "beach_id" | "id",
    values: readonly string[],
  ): PromiseLike<{ data: unknown; error: unknown }>;
  eq: (column: string, value: string) => WaterQualityQuery;
  order: (
    column: string,
    options?: { ascending?: boolean },
  ) => WaterQualityQuery;
  limit: (count: number) => WaterQualityQuery;
  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

export function supportsCountyRunQuery(value: unknown): value is WaterQualityQuery {
  if (typeof value !== "object" || value === null) return false;
  const query = value as Partial<WaterQualityQuery>;
  return (
    typeof query.eq === "function" &&
    typeof query.order === "function" &&
    typeof query.limit === "function" &&
    typeof query.then === "function"
  );
}

interface CountyStreakQuery extends WaterQualityQuery {
  eq: (column: string, value: string) => CountyStreakQuery;
  lt: (column: string, value: string | number) => CountyStreakQuery;
  gt: (column: string, value: string) => CountyStreakQuery;
  order: (column: string, options?: { ascending?: boolean }) => CountyStreakQuery;
  limit: (count: number) => CountyStreakQuery;
}

export function supportsCountyStreakQuery(value: unknown): value is CountyStreakQuery {
  if (!supportsCountyRunQuery(value)) return false;
  const query = value as Partial<CountyStreakQuery>;
  return typeof query.lt === "function" && typeof query.gt === "function";
}

export function supportsCountyAdvisoryQuery(value: unknown): value is WaterQualityQuery {
  if (typeof value !== "object" || value === null) return false;
  const query = value as Partial<WaterQualityQuery>;
  return typeof query.eq === "function" && typeof query.then === "function";
}

interface CountyRainQuery extends WaterQualityQuery {
  eq: (column: string, value: string) => CountyRainQuery;
  gte: (column: string, value: string) => CountyRainQuery;
  order: (column: string, options?: { ascending?: boolean }) => CountyRainQuery;
  limit: (count: number) => CountyRainQuery;
}

export function supportsCountyRainQuery(value: unknown): value is CountyRainQuery {
  if (!supportsCountyRunQuery(value)) return false;
  return typeof (value as Partial<CountyRainQuery>).gte === "function";
}

function hasErrorCode(error: unknown, code: string): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === code
  );
}

export interface WaterQualityHoldClient {
  from(
    table:
      | "beach_water_quality"
      | "water_quality_held_beaches"
      | "county_beach_advisory_runs"
      | "county_beach_advisories"
      | "rainfall_runoff_readings"
      | "rain_advisory_events"
      | "beaches",
  ): {
    select(columns: string): WaterQualityQuery;
  };
}

export interface WaterQualityEvidence {
  source: "sample" | "county" | "hold" | "rain";
  sampleDate?: string;
  countyKind?: "general" | "site";
  checkedAt?: string;
  rainAdvisory?: { startedAt: string; lastRainAt: string | null; expiresAt: string };
}

export interface WaterQualityHoldResolution {
  waterQualityEvidenceByBeachId?: Record<string, WaterQualityEvidence>;
  state: "resolved" | "unresolved";
  heldBeachIds: string[];
  waterQualityStatusByBeachId: Record<string, WaterQualityHoldStatus>;
  /**
   * Beaches whose water quality cannot be confirmed right now (the County feed
   * that covers them is stale). They are withheld per candidate, never labeled.
   */
  unverifiedBeachIds?: string[];
  /**
   * Holds that lift on their own: runoff after rain clears 72 hours after the
   * rain stops, so a window starting then is not held.
   */
  heldUntilByBeachId?: Record<string, string>;
  /**
   * Rain advisories (our gauge runoff events and the County's general rain
   * advisory). They carry a notice but never hold a call; a beach held by any
   * other source is not listed here.
   */
  waterQualityNoticeByBeachId?: Record<string, WaterQualityEvidence>;
  epoch: string;
}

interface ResolveWaterQualityHoldsOptions {
  client?: WaterQualityHoldClient;
  now?: Date;
}

function hashSnapshot(snapshot: string): string {
  return createHash("sha256").update(snapshot).digest("hex");
}

function unresolvedResolution(
  heldBeachIds: readonly string[] = [],
  snapshot: readonly string[] = [],
  waterQualityStatusByBeachId: Readonly<
    Record<string, WaterQualityHoldStatus>
  > = {},
): WaterQualityHoldResolution {
  return {
    state: "unresolved",
    heldBeachIds: [...new Set(heldBeachIds)].sort(),
    waterQualityStatusByBeachId: { ...waterQualityStatusByBeachId },
    epoch: hashSnapshot(
      `water-quality:v2|unresolved|${[...snapshot].sort().join("|")}`,
    ),
  };
}

function resolvedResolution(
  heldBeachIds: readonly string[],
  snapshot: readonly string[],
  waterQualityStatusByBeachId: Readonly<
    Record<string, WaterQualityHoldStatus>
  > = {},
): WaterQualityHoldResolution {
  return {
    state: "resolved",
    heldBeachIds: [...new Set(heldBeachIds)].sort(),
    waterQualityStatusByBeachId: { ...waterQualityStatusByBeachId },
    epoch: hashSnapshot(`water-quality:v2|${[...snapshot].sort().join("|")}`),
  };
}

interface CountyLiveHoldResolution {
  state: "resolved" | "unresolved";
  heldBeachIds: string[];
  waterQualityStatusByBeachId: Record<string, WaterQualityHoldStatus>;
  evidence: Record<string, WaterQualityEvidence>;
  notices: Record<string, WaterQualityEvidence>;
  snapshot: string[];
}

function emptyCountyResolution(
  state: CountyLiveHoldResolution["state"],
  snapshot: string,
): CountyLiveHoldResolution {
  return {
    state,
    heldBeachIds: [],
    waterQualityStatusByBeachId: {},
    evidence: {},
    notices: {},
    snapshot: [snapshot],
  };
}

function moreSevereWaterQualityStatus(
  left: WaterQualityHoldStatus | undefined,
  right: WaterQualityHoldStatus,
): WaterQualityHoldStatus {
  // Sources can lag or update independently; use the more severe state so a
  // County closure can never be softened to an advisory by another source.
  if (left === "closure" || right === "closure") return "closure";
  return "advisory";
}

async function resolveCountyLiveHolds(
  client: WaterQualityHoldClient,
  requestedBeachIds: readonly string[],
  now: Date,
): Promise<CountyLiveHoldResolution> {
  const runQuery = client
    .from("county_beach_advisory_runs")
    .select(COUNTY_LIVE_RUN_SELECT);
  if (!supportsCountyRunQuery(runQuery)) {
    return emptyCountyResolution("resolved", "county-live:client-unavailable");
  }
  const { data: runData, error: runError } = await memoizedWaterQualityRead(
    client,
    `county_beach_advisory_runs|${COUNTY_LIVE_RUN_SELECT}|completed|${COUNTY_FEED_SOURCE_IDENTIFIER}`,
    () => runQuery
      .eq("source_identifier", COUNTY_FEED_SOURCE_IDENTIFIER)
      .eq("status", "completed")
      .order("fetched_at", { ascending: false })
      .limit(1),
  );
  if (runError !== null && runError !== undefined) {
    return emptyCountyResolution("unresolved", "county-live:run-query-error");
  }
  if (!Array.isArray(runData) || runData.length !== 1) {
    return emptyCountyResolution("unresolved", "county-live:no-completed-run");
  }

  const run = runData[0];
  if (
    typeof run !== "object" ||
    run === null ||
    typeof (run as { id?: unknown }).id !== "string" ||
    typeof (run as { fetched_at?: unknown }).fetched_at !== "string"
  ) {
    return emptyCountyResolution("unresolved", "county-live:invalid-run");
  }
  const fetchedAtMs = Date.parse((run as { fetched_at: string }).fetched_at);
  if (
    !Number.isFinite(fetchedAtMs) ||
    fetchedAtMs > now.getTime() + COUNTY_MAX_FUTURE_SKEW_MS ||
    now.getTime() - fetchedAtMs >= COUNTY_MAX_STALENESS_MS
  ) {
    return emptyCountyResolution("unresolved", "county-live:stale");
  }

  const advisoryQuery = client
    .from("county_beach_advisories")
    .select(COUNTY_ADVISORY_SELECT) as WaterQualityQuery;
  if (!supportsCountyAdvisoryQuery(advisoryQuery)) {
    return emptyCountyResolution("resolved", "county-live:client-unavailable");
  }
  const runId = (run as { id: string }).id;
  const generalAdvisory = await resolveCountyGeneralAdvisory(client, run as {
    id: string; fetched_at: string; advisory_count: number;
  }, now);
  const { data: advisoryData, error: advisoryError } = await memoizedWaterQualityRead(
    client,
    `county_beach_advisories|${COUNTY_ADVISORY_SELECT}|${runId}`,
    () => advisoryQuery.eq("run_id", runId),
  );
  if (advisoryError !== null && advisoryError !== undefined) {
    return emptyCountyResolution(
      "unresolved",
      "county-live:advisory-query-error",
    );
  }
  if (!Array.isArray(advisoryData)) {
    return emptyCountyResolution(
      "unresolved",
      "county-live:invalid-advisory-list",
    );
  }

  const requested = new Set(requestedBeachIds);
  const heldBeachIds: string[] = [];
  const waterQualityStatusByBeachId: Record<
    string,
    WaterQualityHoldStatus
  > = {};
  const evidence: Record<string, WaterQualityEvidence> = {};
  const notices: Record<string, WaterQualityEvidence> = {};
  for (const row of advisoryData) {
    if (typeof row !== "object" || row === null) {
      return emptyCountyResolution(
        "unresolved",
        "county-live:invalid-advisory-row",
      );
    }
    const value = row as {
      beach_id?: unknown;
      advisory_type?: unknown;
      source_site_identifier?: unknown;
    };
    if (
      (value.beach_id !== null && typeof value.beach_id !== "string") ||
      typeof value.advisory_type !== "string" ||
      !(COUNTY_ADVISORY_TYPES as readonly string[]).includes(value.advisory_type) ||
      typeof value.source_site_identifier !== "string"
    ) {
      return emptyCountyResolution(
        "unresolved",
        "county-live:invalid-advisory-row",
      );
    }
    if (typeof value.beach_id === "string") {
      const siteAdvisory = value.advisory_type === "advisory"
        && generalAdvisory.siteIdentifiers?.has(value.source_site_identifier) === true;
      if (generalAdvisory.expired && value.advisory_type !== "closure" && !siteAdvisory) continue;
      const normalizedBeachId = value.beach_id.toLowerCase();
      if (requested.has(normalizedBeachId)) {
        const countyKind = value.advisory_type === "closure" || siteAdvisory || !generalAdvisory.general
          ? "site" as const : "general" as const;
        const checkedAt = (run as { fetched_at: string }).fetched_at;
        // The general rain advisory informs; only closures and site advisories hold.
        if (countyKind === "general") {
          const event = generalAdvisory.event?.status === "active" ? generalAdvisory.event : null;
          notices[normalizedBeachId] = { source: "county", countyKind, checkedAt,
            ...(event ? { rainAdvisory: { startedAt: event.startedAt, lastRainAt: event.lastRainAt,
              expiresAt: event.expiresAt } } : {}) };
          continue;
        }
        heldBeachIds.push(normalizedBeachId);
        if (value.advisory_type === "closure" || evidence[normalizedBeachId]?.countyKind !== "site") {
          evidence[normalizedBeachId] = { source: "county", countyKind, checkedAt };
        }
        waterQualityStatusByBeachId[normalizedBeachId] =
          moreSevereWaterQualityStatus(
            waterQualityStatusByBeachId[normalizedBeachId],
            value.advisory_type === "closure" ? "closure" : "advisory",
          );
      }
    }
  }

  const generalSnapshot = !generalAdvisory.general ? "county-general:dormant"
    : generalAdvisory.streakStartedAt === null ? "county-general:unknown"
      : `county-general:${generalAdvisory.expired ? "expired" : "active"}:${generalAdvisory.streakStartedAt}:rain-${generalAdvisory.rainState ?? "null"}:event-${generalAdvisory.event?.id ?? "null"}-${generalAdvisory.event?.status ?? "null"}`;
  for (const beachId of heldBeachIds) delete notices[beachId];
  return {
    state: "resolved",
    heldBeachIds: [...new Set(heldBeachIds)],
    waterQualityStatusByBeachId,
    evidence,
    notices,
    snapshot: [
      `county-live:fresh:${(run as { fetched_at: string }).fetched_at}`,
      generalSnapshot,
      `county-live:held:${[...new Set(heldBeachIds)].sort().join(",")}`,
    ],
  };
}

interface RainHoldResolution {
  held: Map<string, RainAdvisoryEvent>;
  unverifiedBeachIds: string[];
  snapshot: string[];
}

/**
 * Runoff after measured rain, from the stored gauge events the beach page
 * notice reads. San Diego beaches read their own gauges rather than waiting for
 * the County; a County status for the beach is resolved separately and wins.
 */
async function resolveRainHolds(
  client: WaterQualityHoldClient,
  beachIds: readonly string[],
  now: Date,
): Promise<RainHoldResolution> {
  const held = new Map<string, RainAdvisoryEvent>();
  const query: unknown = client.from(RAIN_ADVISORY_EVENTS_TABLE).select("*");
  if (!supportsCountyRunQuery(query)) {
    return { held, unverifiedBeachIds: [], snapshot: [] };
  }
  const { data, error } = await memoizedWaterQualityRead(
    client,
    `${RAIN_ADVISORY_EVENTS_TABLE}|*|active|metar_runoff`,
    () => query.eq("status", "active").eq("source", "metar_runoff"),
  );
  if (hasErrorCode(error, MISSING_TABLE_ERROR_CODE)) {
    return { held, unverifiedBeachIds: [], snapshot: [] };
  }
  let events: Map<string, RainAdvisoryEvent> | null = null;
  if ((error === null || error === undefined) && Array.isArray(data)) {
    events = new Map();
    for (const raw of data) {
      const parsed = rainAdvisoryEventSchema.safeParse(raw);
      if (!parsed.success) {
        events = null;
        break;
      }
      const event = parsed.data;
      if (event.source !== "metar_runoff" || event.status !== "active") continue;
      if (Date.parse(event.expires_at) <= now.getTime()) continue;
      events.set(event.region, event);
    }
  }
  // No rain anywhere leaves the epoch as it was before rain holds existed.
  if (events !== null && events.size === 0) return { held, unverifiedBeachIds: [], snapshot: [] };

  const points = await readBeachPoints(client, beachIds, "[water-quality-hold:rain-coverage-error]");
  // Without coordinates no beach is known to be near the rain, and withholding
  // every beach in the state for one failed read would be worse than a missed
  // precautionary hold. readBeachPoints has already logged the failure.
  if (points === null) return { held, unverifiedBeachIds: [], snapshot: ["rain:coverage-unavailable"] };
  const unverifiedBeachIds: string[] = [];
  const snapshot: string[] = [];
  for (const beachId of beachIds) {
    const point = points.get(beachId);
    const cluster = rainGaugeClusterFor(point?.lat, point?.lon);
    if (!cluster) continue;
    if (events === null) {
      unverifiedBeachIds.push(beachId);
      continue;
    }
    const event = events.get(rainEventRegion(cluster.id));
    if (!event) continue;
    held.set(beachId, event);
    snapshot.push(`${beachId}:rain:${event.id}:${event.expires_at}`);
  }
  if (events === null) {
    console.error("[water-quality-hold:rain-events-unavailable]", { beachCount: beachIds.length });
    snapshot.push(`rain:unverified:${unverifiedBeachIds.join(",")}`);
  }
  return { held, unverifiedBeachIds, snapshot };
}

function readQualityRows(
  client: WaterQualityHoldClient,
  table: "water_quality_held_beaches" | "beach_water_quality",
  columns: string,
  beachIds: readonly string[],
): Promise<WaterQualityReadResult> {
  return memoizedBeachRowsRead(client, `${table}|${columns}`, beachIds, async () => {
    const rows: unknown[] = [];
    // Catalog-wide filters overflow response headers when the upstream echoes the URL.
    for (let offset = 0; offset < beachIds.length; offset += 100) {
      const result = await client.from(table).select(columns)
        .in("beach_id", beachIds.slice(offset, offset + 100));
      // Never turn a partial hazard read into a successful result.
      if ((result.error !== null && result.error !== undefined) || !Array.isArray(result.data)) return result;
      rows.push(...result.data);
    }
    return { data: rows, error: null };
  });
}

/**
 * Beaches the County feed covers, among those requested. A beach without
 * coordinates counts as covered so it fails closed. Null when the read fails.
 */
async function countyCoveredBeachIds(
  client: WaterQualityHoldClient,
  beachIds: readonly string[],
): Promise<string[] | null> {
  const points = await readBeachPoints(client, beachIds, "[water-quality-hold:county-coverage-error]");
  if (points === null) return null;
  return beachIds.filter((beachId) => insideCountyFeed(points.get(beachId)));
}

/**
 * Resolves owner-directed holds, current sampled advisory/closure status, and
 * runoff after measured rain.
 * This is called only by recommendation/discovery surfaces.
 */
export async function resolveWaterQualityHolds(
  candidates: readonly MajorEventHoldCandidate[],
  options: ResolveWaterQualityHoldsOptions = {},
): Promise<WaterQualityHoldResolution> {
  if (candidates.length === 0) {
    return resolvedResolution([], ["empty"]);
  }

  const requestedBeachIds = [
    ...new Set(candidates.map(({ beachId }) => beachId.toLowerCase())),
  ].sort();

  try {
    const now = options.now ?? new Date();
    const client = (options.client ??
      (await createSupabaseServiceRoleClient())) as WaterQualityHoldClient;

    const knownHeldBeachIds: string[] = [];
    const resolutionSnapshot: string[] = [];
    let unresolved = false;

    const heldQuery = readQualityRows(client, "water_quality_held_beaches", "beach_id", requestedBeachIds);
    const qualityQuery = readQualityRows(client, "beach_water_quality", WATER_QUALITY_SELECT, requestedBeachIds);
    const qualityResultPromise = Promise.resolve(qualityQuery);
    void qualityResultPromise.catch(() => undefined);
    const { data: heldData, error: heldError } = await heldQuery;

    if (heldError !== null && heldError !== undefined) {
      if (hasErrorCode(heldError, MISSING_TABLE_ERROR_CODE)) {
        console.warn(
          "[water-quality-hold:table-missing] recommendation holds are not rolled out",
        );
        return resolvedResolution([], ["held-table:missing"]);
      } else {
        console.error("[water-quality-hold:query-error]", {
          beachCount: requestedBeachIds.length,
          table: "water_quality_held_beaches",
          error:
            typeof heldError === "object" &&
            heldError !== null &&
            "message" in heldError &&
            typeof heldError.message === "string"
              ? heldError.message
              : String(heldError),
        });
        return unresolvedResolution();
      }
    }
    const { data, error } = await qualityResultPromise;
    if (!unresolved && !Array.isArray(heldData)) {
      console.error("[water-quality-hold:invalid-response-shape]", {
        beachCount: requestedBeachIds.length,
        table: "water_quality_held_beaches",
      });
      return unresolvedResolution();
    }

    const ownerHeldBeachIds = new Set<string>();
    for (const row of Array.isArray(heldData) ? heldData : []) {
      const parsed = waterQualityHeldRowSchema.safeParse(row);
      if (!parsed.success || !requestedBeachIds.includes(parsed.data.beach_id)) {
        console.error("[water-quality-hold:invalid-row]", {
          beachCount: requestedBeachIds.length,
          table: "water_quality_held_beaches",
        });
        return unresolvedResolution();
      }
      if (ownerHeldBeachIds.has(parsed.data.beach_id)) {
        console.error("[water-quality-hold:duplicate-row]", {
          beachId: parsed.data.beach_id,
          table: "water_quality_held_beaches",
        });
        return unresolvedResolution();
      }
      ownerHeldBeachIds.add(parsed.data.beach_id);
      knownHeldBeachIds.push(parsed.data.beach_id);
      resolutionSnapshot.push(`${parsed.data.beach_id}:owner-hold`);
    }

    if (error !== null && error !== undefined) {
      console.error("[water-quality-hold:query-error]", {
        beachCount: requestedBeachIds.length,
        error:
          typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof error.message === "string"
            ? error.message
            : String(error),
      });
      return unresolvedResolution(knownHeldBeachIds, resolutionSnapshot);
    }
    if (!Array.isArray(data)) {
      console.error("[water-quality-hold:invalid-response-shape]", {
        beachCount: requestedBeachIds.length,
      });
      return unresolvedResolution(knownHeldBeachIds, resolutionSnapshot);
    }

    const rowsByBeachId = new Map<
      string,
      z.infer<typeof waterQualityRowSchema>
    >();
    for (const row of data) {
      const parsed = waterQualityRowSchema.safeParse(row);
      if (!parsed.success || !requestedBeachIds.includes(parsed.data.beach_id)) {
        console.error("[water-quality-hold:invalid-row]", {
          beachCount: requestedBeachIds.length,
        });
        return unresolvedResolution(knownHeldBeachIds, resolutionSnapshot);
      }
      if (rowsByBeachId.has(parsed.data.beach_id)) {
        console.error("[water-quality-hold:duplicate-row]", {
          beachId: parsed.data.beach_id,
        });
        return unresolvedResolution();
      }
      rowsByBeachId.set(parsed.data.beach_id, parsed.data);
    }

    const [effectiveRows, liveResolution, rainResolution] = await Promise.all([
      currentWaterQuality([...rowsByBeachId.values()], client, now, { onlyBeachIds: COUNTY_PROJECTION_HOLD_BEACH_IDS }),
      resolveCountyLiveHolds(client, requestedBeachIds, now),
      resolveRainHolds(client, requestedBeachIds, now),
    ]);
    const countyHeld = new Set(effectiveRows
      .filter((row) => row.county_advisory_status === "advisory" || row.county_advisory_status === "closure")
      .map((row) => row.beach_id));
    // The County projection overwrites status, so keep each beach's own current sampled result.
    const sampledRows = new Map([...rowsByBeachId.values()]
      .filter((row) => (row.status === "advisory" || row.status === "closure") && row.total_samples_30d > 0
        && isCurrentWaterQualitySample(row.latest_sample_date, now.getTime()))
      .map((row) => [row.beach_id, row]));
    for (const row of effectiveRows) rowsByBeachId.set(row.beach_id, row);

    const evidence: Record<string, WaterQualityEvidence> = {};
    const heldBeachIds: string[] = [];
    const waterQualityStatusByBeachId: Record<
      string,
      WaterQualityHoldStatus
    > = {};
    const notices: Record<string, WaterQualityEvidence> = {};
    const snapshot: string[] = [];
    const unverifiedBeachIds: string[] = [];
    for (const beachId of requestedBeachIds) {
      const row = rowsByBeachId.get(beachId);
      if (ownerHeldBeachIds.has(beachId)) {
        evidence[beachId] = { source: "hold" };
        heldBeachIds.push(beachId);
        if (row?.status === "advisory" || row?.status === "closure") {
          waterQualityStatusByBeachId[beachId] = row.status;
        }
        snapshot.push(`${beachId}:owner-hold`);
        continue;
      }

      if (row && (row.status === "advisory" || row.status === "closure")
        && !countyHeld.has(beachId)
        && !isCurrentWaterQualitySample(row.latest_sample_date, now.getTime())) {
        evidence[beachId] = { source: "sample", ...(typeof row.latest_sample_date === "string" ? { sampleDate: row.latest_sample_date } : {}) };
        snapshot.push(`${beachId}:sample-unconfirmed:${row.latest_sample_date ?? "undated"}`);
        continue;
      }

      const hasRealData =
        row !== undefined &&
        ((row.total_samples_30d > 0 && isCurrentWaterQualitySample(row.latest_sample_date, now.getTime())) || countyHeld.has(beachId)) &&
        row.status !== "unknown";
      if (!hasRealData) {
        snapshot.push(`${beachId}:fallback:allow`);
        continue;
      }

      const sampled = sampledRows.get(beachId);
      if (countyHeld.has(beachId) && row.county_advisory_kind === "general" && sampled) {
        evidence[beachId] = { source: "sample", ...(typeof sampled.latest_sample_date === "string" ? { sampleDate: sampled.latest_sample_date } : {}) };
        heldBeachIds.push(beachId);
        waterQualityStatusByBeachId[beachId] = sampled.status as WaterQualityHoldStatus;
        snapshot.push(`${beachId}:real:sample-${sampled.status}`);
        continue;
      }

      if (countyHeld.has(beachId) && row.status === "advisory"
        && row.county_advisory_status === "advisory" && row.county_advisory_kind === "general") {
        const countyRain = row.county_rain_advisory as { started_at: string; last_rain_at: string | null; expires_at: string } | undefined;
        notices[beachId] = { source: "county", countyKind: "general",
          ...(countyRain ? { rainAdvisory: { startedAt: countyRain.started_at,
            lastRainAt: countyRain.last_rain_at, expiresAt: countyRain.expires_at } } : {}),
          ...(typeof row.county_checked_at === "string" ? { checkedAt: row.county_checked_at } : {}) };
        snapshot.push(`${beachId}:notice:county-general`);
        continue;
      }

      if (row.status === "advisory" || row.status === "closure") {
        const countyRain = row.county_rain_advisory as { started_at: string; last_rain_at: string | null; expires_at: string } | undefined;
        evidence[beachId] = countyHeld.has(beachId) ? { source: "county",
          ...(row.county_advisory_kind === "site" || row.county_advisory_kind === "general"
            ? { countyKind: row.county_advisory_kind } : {}),
          ...(row.county_advisory_kind === "general" && countyRain
            ? { rainAdvisory: { startedAt: countyRain.started_at,
              lastRainAt: countyRain.last_rain_at,
              expiresAt: countyRain.expires_at } } : {}),
          ...(typeof row.county_checked_at === "string" ? { checkedAt: row.county_checked_at } : {}) }
          : { source: "sample", ...(typeof row.latest_sample_date === "string" ? { sampleDate: row.latest_sample_date } : {}) };
        heldBeachIds.push(beachId);
        waterQualityStatusByBeachId[beachId] = row.status;
      }
      snapshot.push(`${beachId}:real:${row.status}`);
    }

    if (liveResolution.state === "resolved") {
      heldBeachIds.push(...liveResolution.heldBeachIds);
      for (const [beachId, status] of Object.entries(
        liveResolution.waterQualityStatusByBeachId,
      )) {
        if (status === "closure" || waterQualityStatusByBeachId[beachId] !== "closure") {
          evidence[beachId] = liveResolution.evidence[beachId];
        }
        waterQualityStatusByBeachId[beachId] =
          moreSevereWaterQualityStatus(
            waterQualityStatusByBeachId[beachId],
            status,
          );
      }
      for (const [beachId, notice] of Object.entries(liveResolution.notices)) notices[beachId] = notice;
      snapshot.push(...liveResolution.snapshot);
    } else {
      snapshot.push(...liveResolution.snapshot);
      // A stale County feed says nothing about beaches it does not sample, so
      // only its own beaches lose their status instead of every candidate.
      const covered = await countyCoveredBeachIds(client, requestedBeachIds);
      if (covered === null) {
        unresolved = true;
      } else {
        const held = new Set(heldBeachIds);
        unverifiedBeachIds.push(...covered.filter((beachId) => !held.has(beachId)));
        snapshot.push(`county-live:unverified:${[...unverifiedBeachIds].sort().join(",")}`);
      }
    }

    // Rain never holds a call (Steven, 2026-10-23): it is a notice, and a County
    // notice or any held status for the beach wins over it.
    const heldBySource = new Set(heldBeachIds);
    for (const [beachId, event] of rainResolution.held) {
      if (notices[beachId]) continue;
      notices[beachId] = { source: "rain", rainAdvisory: { startedAt: event.started_at,
        lastRainAt: event.last_rain_at, expiresAt: event.expires_at } };
    }
    for (const beachId of heldBySource) delete notices[beachId];
    snapshot.push(...rainResolution.snapshot);

    const resolution = unresolved
      ? unresolvedResolution(
          heldBeachIds,
          [...resolutionSnapshot, ...snapshot],
          waterQualityStatusByBeachId,
        )
      : resolvedResolution(
          heldBeachIds,
          [...resolutionSnapshot, ...snapshot],
          waterQualityStatusByBeachId,
        );
    return {
      ...resolution,
      ...(unverifiedBeachIds.length > 0 ? { unverifiedBeachIds: [...new Set(unverifiedBeachIds)].sort() } : {}),
      ...(Object.keys(notices).length > 0 ? { waterQualityNoticeByBeachId: notices } : {}),
      waterQualityEvidenceByBeachId: evidence,
    };
  } catch (error) {
    console.error("[water-quality-hold:resolution-threw]", {
      beachCount: requestedBeachIds.length,
      error: error instanceof Error ? error.message : String(error),
    });
    return unresolvedResolution();
  }
}

export function waterQualityHoldId(beachId: string): string {
  return `water-quality:${beachId.toLowerCase()}`;
}
