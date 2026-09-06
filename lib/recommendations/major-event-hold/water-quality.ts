import "server-only";

import { createHash } from "node:crypto";
import { z } from "zod";
import { currentWaterQuality } from "@/lib/services/water-quality/current-status";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  COUNTY_ADVISORY_TYPES,
  COUNTY_MAX_FUTURE_SKEW_MS,
  COUNTY_FEED_SOURCE_IDENTIFIER,
  COUNTY_MAX_STALENESS_MS,
} from "@/lib/services/county-beach-advisories/types";

import type { MajorEventHoldCandidate } from "./types";

/** Seed manifest only. Runtime truth is water_quality_held_beaches. */
export const CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS = [
  "9e94759c-d531-4e5c-9bc2-d022acea9dcd", // Imperial Beach
  "d9f93c82-7f4b-440a-865a-55cdbb821f74", // Imperial Beach Pier
  "94f1010b-c71f-4025-bda1-c26ed9467c85", // Silver Strand State Beach
  "b29821f9-c91a-486f-981b-7085c6d86b68", // Coronado North Jetty
  "84d3468b-c1ec-46ad-8621-d8507e5f167a", // Hotel Del Coronado
] as const;

/** Leave room for the owner-curated hold set before ranking truncates results. */
export const WATER_QUALITY_HOLD_PREFETCH_BUFFER =
  CHRONICALLY_IMPACTED_WATER_QUALITY_BEACH_IDS.length;

export const WATER_QUALITY_STATUSES = [
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
    column: "beach_id",
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

function supportsCountyRunQuery(value: unknown): value is WaterQualityQuery {
  if (typeof value !== "object" || value === null) return false;
  const query = value as Partial<WaterQualityQuery>;
  return (
    typeof query.eq === "function" &&
    typeof query.order === "function" &&
    typeof query.limit === "function" &&
    typeof query.then === "function"
  );
}

function supportsCountyAdvisoryQuery(value: unknown): value is WaterQualityQuery {
  if (typeof value !== "object" || value === null) return false;
  const query = value as Partial<WaterQualityQuery>;
  return typeof query.eq === "function" && typeof query.then === "function";
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
      | "county_beach_advisories",
  ): {
    select(columns: string): WaterQualityQuery;
  };
}

export interface WaterQualityEvidence {
  source: "sample" | "county" | "hold";
  sampleDate?: string;
}

export interface WaterQualityHoldResolution {
  waterQualityEvidenceByBeachId?: Record<string, WaterQualityEvidence>;
  state: "resolved" | "unresolved";
  heldBeachIds: string[];
  waterQualityStatusByBeachId: Record<string, WaterQualityHoldStatus>;
  epoch: string;
}

export interface ResolveWaterQualityHoldsOptions {
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
    .select("id, fetched_at, status, source_identifier");
  if (!supportsCountyRunQuery(runQuery)) {
    return emptyCountyResolution("resolved", "county-live:client-unavailable");
  }
  const { data: runData, error: runError } = await runQuery
    .eq("source_identifier", COUNTY_FEED_SOURCE_IDENTIFIER)
    .eq("status", "completed")
    .order("fetched_at", { ascending: false })
    .limit(1);
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
    .select("beach_id, advisory_type, source_site_identifier") as WaterQualityQuery;
  if (!supportsCountyAdvisoryQuery(advisoryQuery)) {
    return emptyCountyResolution("resolved", "county-live:client-unavailable");
  }
  const { data: advisoryData, error: advisoryError } = await advisoryQuery.eq(
    "run_id",
    (run as { id: string }).id,
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
      const normalizedBeachId = value.beach_id.toLowerCase();
      if (requested.has(normalizedBeachId)) {
        heldBeachIds.push(normalizedBeachId);
        waterQualityStatusByBeachId[normalizedBeachId] =
          moreSevereWaterQualityStatus(
            waterQualityStatusByBeachId[normalizedBeachId],
            value.advisory_type === "closure" ? "closure" : "advisory",
          );
      }
    }
  }

  return {
    state: "resolved",
    heldBeachIds: [...new Set(heldBeachIds)],
    waterQualityStatusByBeachId,
    snapshot: [
      `county-live:fresh:${(run as { fetched_at: string }).fetched_at}`,
      `county-live:held:${[...new Set(heldBeachIds)].sort().join(",")}`,
    ],
  };
}

/**
 * Resolves owner-directed holds and current sampled advisory/closure status.
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

    const heldQuery = client
      .from("water_quality_held_beaches")
      .select("beach_id")
      .in("beach_id", requestedBeachIds);
    const qualityQuery = client
      .from("beach_water_quality")
      .select(WATER_QUALITY_SELECT)
      .in("beach_id", requestedBeachIds);
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

    const effectiveRows = await currentWaterQuality([...rowsByBeachId.values()], client, now);
    const countyHeld = new Set(effectiveRows
      .filter((row) => row.county_advisory_status === "advisory" || row.county_advisory_status === "closure")
      .map((row) => row.beach_id));
    for (const row of effectiveRows) rowsByBeachId.set(row.beach_id, row);

    const evidence: Record<string, WaterQualityEvidence> = {};
    const heldBeachIds: string[] = [];
    const waterQualityStatusByBeachId: Record<
      string,
      WaterQualityHoldStatus
    > = {};
    const snapshot: string[] = [];
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

      const hasRealData =
        row !== undefined &&
        (row.total_samples_30d > 0 || countyHeld.has(beachId)) &&
        row.status !== "unknown";
      if (!hasRealData) {
        snapshot.push(`${beachId}:fallback:allow`);
        continue;
      }

      if (row.status === "advisory" || row.status === "closure") {
        evidence[beachId] = countyHeld.has(beachId) ? { source: "county" }
          : { source: "sample", ...(typeof row.latest_sample_date === "string" ? { sampleDate: row.latest_sample_date } : {}) };
        heldBeachIds.push(beachId);
        waterQualityStatusByBeachId[beachId] = row.status;
      }
      snapshot.push(`${beachId}:real:${row.status}`);
    }

    const liveResolution = await resolveCountyLiveHolds(
      client,
      requestedBeachIds,
      now,
    );
    if (liveResolution.state === "resolved") {
      heldBeachIds.push(...liveResolution.heldBeachIds);
      for (const [beachId, status] of Object.entries(
        liveResolution.waterQualityStatusByBeachId,
      )) {
        if (status === "closure" || waterQualityStatusByBeachId[beachId] !== "closure") {
          evidence[beachId] = { source: "county" };
        }
        waterQualityStatusByBeachId[beachId] =
          moreSevereWaterQualityStatus(
            waterQualityStatusByBeachId[beachId],
            status,
          );
      }
      snapshot.push(...liveResolution.snapshot);
    } else {
      unresolved = true;
      snapshot.push(...liveResolution.snapshot);
    }

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
    return { ...resolution, waterQualityEvidenceByBeachId: evidence };
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
