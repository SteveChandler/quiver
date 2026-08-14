import "server-only";

import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";

import {
  COUNTY_FEED_SOURCE_IDENTIFIER,
  type CountyAdvisoryRecord,
  type CountyAdvisoryRepository,
  type CountyBeachCandidate,
  type CountyIngestRun,
  type CountyIngestState,
  type CountyMatchSummary,
} from "./types";

type CountyTableName =
  | "county_beach_advisory_ingest_state"
  | "county_beach_advisory_runs"
  | "county_beach_advisories";

interface CountyQuery {
  select(columns: string): CountyQuery;
  eq(column: string, value: string): CountyQuery;
  order(column: string, options?: { ascending?: boolean }): CountyQuery;
  limit(count: number): CountyQuery;
  insert(values: unknown | unknown[]): CountyQuery;
  upsert(values: unknown | unknown[], options?: { onConflict?: string }): CountyQuery;
  update(values: unknown): CountyQuery;
  in(column: string, values: readonly string[]): CountyQuery;
  then<TResult1 = { data: unknown; error: unknown }, TResult2 = never>(
    onfulfilled?:
      | ((value: { data: unknown; error: unknown }) => TResult1 | PromiseLike<TResult1>)
      | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

interface CountyDatabaseClient {
  from(table: CountyTableName): CountyQuery;
}

function assertNoError(error: unknown, operation: string): void {
  if (error !== null && error !== undefined) {
    throw new Error(
      `${operation}: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

function parseState(row: unknown): CountyIngestState | null {
  if (!row || typeof row !== "object") return null;
  const value = row as Partial<CountyIngestState>;
  if (typeof value.source_identifier !== "string") return null;
  return {
    source_identifier: value.source_identifier,
    accepted_version_token:
      typeof value.accepted_version_token === "string" ? value.accepted_version_token : null,
    accepted_version_sequence:
      typeof value.accepted_version_sequence === "number" ? value.accepted_version_sequence : null,
    observed_version_token:
      typeof value.observed_version_token === "string" ? value.observed_version_token : null,
    observed_version_sequence:
      typeof value.observed_version_sequence === "number" ? value.observed_version_sequence : null,
    consecutive_failures:
      typeof value.consecutive_failures === "number" ? value.consecutive_failures : 0,
    circuit_open: value.circuit_open === true,
    next_attempt_at: typeof value.next_attempt_at === "string" ? value.next_attempt_at : null,
    last_request_at: typeof value.last_request_at === "string" ? value.last_request_at : null,
    last_success_at: typeof value.last_success_at === "string" ? value.last_success_at : null,
    last_failure_at: typeof value.last_failure_at === "string" ? value.last_failure_at : null,
    last_error: typeof value.last_error === "string" ? value.last_error : null,
    updated_at: typeof value.updated_at === "string" ? value.updated_at : null,
  };
}

export function createCountyAdvisoryRepository(
  client: ReturnType<typeof createSupabaseServiceRoleClient> = createSupabaseServiceRoleClient(),
): CountyAdvisoryRepository {
  const db = client as unknown as CountyDatabaseClient;
  return {
    async getState(): Promise<CountyIngestState | null> {
      const { data, error } = await db
        .from("county_beach_advisory_ingest_state")
        .select("*")
        .eq("source_identifier", COUNTY_FEED_SOURCE_IDENTIFIER)
        .limit(1);
      assertNoError(error, "county state read failed");
      return parseState(Array.isArray(data) ? data[0] : data);
    },

    async saveState(state: CountyIngestState): Promise<void> {
      const { error } = await db
        .from("county_beach_advisory_ingest_state")
        .upsert(state, { onConflict: "source_identifier" });
      assertNoError(error, "county state write failed");
    },

    async createRun(run: CountyIngestRun): Promise<void> {
      const { error } = await db.from("county_beach_advisory_runs").insert(run);
      assertNoError(error, "county run create failed");
    },

    async insertAdvisories(records: CountyAdvisoryRecord[], runId: string): Promise<void> {
      if (records.length === 0) return;
      const rows = records.map((record) => ({
        run_id: runId,
        source_identifier: record.sourceIdentifier,
        source_name: record.sourceName,
        source_url: record.sourceUrl,
        source_site_identifier: record.sourceSiteIdentifier,
        advisory_type: record.advisoryType,
        beach_id: record.beachId,
        county_latitude: record.countyLatitude,
        county_longitude: record.countyLongitude,
        match_distance_meters: record.matchDistanceMeters,
        valid_from: record.validFrom,
        valid_until: record.validUntil,
        raw_payload: record.rawPayload,
        raw_payload_hash: record.rawPayloadHash,
        fetched_at: record.fetchedAt,
      }));
      const { error } = await db
        .from("county_beach_advisories")
        .upsert(rows, {
          onConflict: "run_id,source_site_identifier,advisory_type",
        });
      assertNoError(error, "county advisory insert failed");
    },

    async completeRun(
      runId: string,
      summary: Pick<CountyMatchSummary, "countsByType" | "unmatchedSites" | "matchRate"> & {
        recordCount: number;
        completedAt: string;
      },
    ): Promise<void> {
      const { error } = await db
        .from("county_beach_advisory_runs")
        .update({
          status: "completed",
          completed_at: summary.completedAt,
          advisory_count: summary.countsByType.advisory,
          closure_count: summary.countsByType.closure,
          warning_count: summary.countsByType.warning,
          unmatched_site_count: summary.unmatchedSites,
          match_rate: summary.matchRate,
          error_kind: null,
          error_message: null,
        })
        .eq("id", runId);
      assertNoError(error, "county run completion failed");
    },

    async failRun(runId: string, errorKind: string, errorMessage: string): Promise<void> {
      const { error } = await db
        .from("county_beach_advisory_runs")
        .update({ status: "failed", error_kind: errorKind, error_message: errorMessage })
        .eq("id", runId);
      assertNoError(error, "county run failure update failed");
    },

    async listBeaches(): Promise<CountyBeachCandidate[]> {
      const { data, error } = await (db as unknown as {
        from(table: "beaches"): CountyQuery;
      })
        .from("beaches")
        .select("id, name, lat, lon");
      assertNoError(error, "County beach match query failed");
      if (!Array.isArray(data)) return [];
      return data.flatMap((row) => {
        if (!row || typeof row !== "object") return [];
        const value = row as Partial<CountyBeachCandidate>;
        if (typeof value.id !== "string" || typeof value.name !== "string") return [];
        return [
          {
            id: value.id,
            name: value.name,
            lat: typeof value.lat === "number" ? value.lat : null,
            lon: typeof value.lon === "number" ? value.lon : null,
          },
        ];
      });
    },
  };
}
