import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  fetchCCCLocations,
  upsertCCCLocations,
  matchCCCToBeaches,
} from "@/lib/services/ccc";
import type { FetchResult, UpsertResult, MatchResult } from "@/lib/services/ccc";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel hard limit (5min)

type SyncPhase = "import" | "match";
type PhaseResolution =
  | { kind: "run"; phase: SyncPhase; inferred: boolean }
  | { kind: "skip"; reason: string };

const SYNC_PHASES: readonly SyncPhase[] = ["import", "match"];

interface ImportSyncResult {
  phase: "import";
  fetch: FetchResult;
  upsert: UpsertResult;
  duration_ms: number;
  inferred_phase?: boolean;
}

interface MatchSyncResult {
  phase: "match";
  match: MatchResult;
  duration_ms: number;
  inferred_phase?: boolean;
}

interface SkippedSyncResult {
  phase: "skipped";
  reason: string;
  accepted_phases: readonly SyncPhase[];
  duration_ms: number;
}

/**
 * GET /api/cron/ccc-sync
 *
 * Cron job: syncs California Coastal Commission public access location data
 * in two phases:
 *
 * 1. Import phase (monthly, 1st at 06:00 UTC):
 *    - Fetches all CCC access locations from the public API
 *    - Normalizes dirty amenity flag strings to booleans
 *    - Upserts into ccc_access_locations table (ON CONFLICT ccc_id)
 *    - Uses ETag/If-None-Match for conditional fetching
 *
 * 2. Match phase (monthly, 1st at 07:00 UTC):
 *    - Fetches all CA beaches and CCC locations from the database
 *    - Computes Haversine distances to find matches within 1500m
 *    - Upserts match records into beach_amenity_sources
 *    - Refreshes the mv_beach_amenities materialized view
 *
 * Query params:
 * - phase: "import" | "match" (required)
 * - radiusM: Match radius in meters (default: 1500, match phase only)
 *
 * Auth:
 * - Authorization: Bearer <CRON_SECRET>
 */
async function _GET(request: Request): Promise<Response> {
  const startTime = Date.now();

  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse(
        "Unauthorized",
        "Invalid cron authentication",
        401
      );
    }

    const url = new URL(request.url);
    const phaseResolution = resolvePhase(url.searchParams, new Date());

    if (phaseResolution.kind === "skip") {
      const result: SkippedSyncResult = {
        phase: "skipped",
        reason: phaseResolution.reason,
        accepted_phases: SYNC_PHASES,
        duration_ms: Date.now() - startTime,
      };
      console.log("[CCC] Skipping CCC sync:", result.reason);
      return createSuccessResponse(result);
    }

    const { phase, inferred } = phaseResolution;
    console.log(`[CCC] Starting CCC sync (phase=${phase})...`);

    if (phase === "import") {
      const result = {
        ...(await withCronOutcome(
          {
            job: "/api/cron/ccc-sync?phase=import",
            unit: "ccc_locations_written",
            expectedMin: 1,
            getProduced: (value) => value.upsert.upserted,
            legitimatelyZero: (value) =>
              value.fetch.notModified
                ? { reason: "CCC feed ETag has not changed since the last import" }
                : undefined,
          },
          () => runImportPhase(startTime),
        )),
        inferred_phase: inferred,
      };
      console.log("[CCC] Import phase complete:", JSON.stringify(result, null, 2));
      return createSuccessResponse(result);
    } else {
      const radiusM = parseInt(url.searchParams.get("radiusM") || "1500", 10);
      const result = {
        ...(await withCronOutcome(
          {
            job: "/api/cron/ccc-sync?phase=match",
            unit: "beach_matches_written",
            expectedMin: 1,
            getProduced: (value) => value.match.matchesUpserted,
          },
          () => runMatchPhase(startTime, radiusM),
        )),
        inferred_phase: inferred,
      };
      console.log("[CCC] Match phase complete:", JSON.stringify(result, null, 2));
      return createSuccessResponse(result);
    }
  } catch (error) {
    console.error("[CCC] Sync cron error:", error);
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/ccc-sync", _GET);

function isSyncPhase(value: string): value is SyncPhase {
  return (SYNC_PHASES as readonly string[]).includes(value);
}

function resolvePhase(
  searchParams: URLSearchParams,
  now: Date
): PhaseResolution {
  const rawPhase = searchParams.get("phase");

  if (rawPhase !== null) {
    const normalizedPhase = rawPhase.trim().toLowerCase();

    if (isSyncPhase(normalizedPhase)) {
      return { kind: "run", phase: normalizedPhase, inferred: false };
    }

    return {
      kind: "skip",
      reason:
        normalizedPhase.length === 0
          ? 'Ignoring blank query param "phase" from authenticated probe (raw phase="")'
          : `Ignoring invalid query param "phase" from authenticated probe (raw phase="${rawPhase}"). Accepted phases: import, match`,
    };
  }

  const utcDay = now.getUTCDate();
  const utcHour = now.getUTCHours();

  if (utcDay === 1 && utcHour === 6) {
    return { kind: "run", phase: "import", inferred: true };
  }

  if (utcDay === 1 && utcHour === 7) {
    return { kind: "run", phase: "match", inferred: true };
  }

  return {
    kind: "skip",
    reason:
      'Missing query param "phase"; only the scheduled 06:00/07:00 UTC monthly windows are inferred automatically',
  };
}

/**
 * Import Phase
 *
 * Fetches CCC locations from the public API and upserts into the database.
 */
async function runImportPhase(startTime: number): Promise<ImportSyncResult> {
  // Fetch from CCC API
  const fetchResult = await fetchCCCLocations();

  // If data unchanged (304 Not Modified), skip upsert
  if (fetchResult.notModified) {
    return {
      phase: "import",
      fetch: fetchResult,
      upsert: { upserted: 0, batches: 0, errors: [] },
      duration_ms: Date.now() - startTime,
    };
  }

  // Upsert into database
  const supabase = createSupabaseServiceRoleClient();
  const upsertResult = await upsertCCCLocations(supabase, fetchResult.locations);

  return {
    phase: "import",
    fetch: fetchResult,
    upsert: upsertResult,
    duration_ms: Date.now() - startTime,
  };
}

/**
 * Match Phase
 *
 * Matches CCC locations to California beaches by proximity and refreshes
 * the aggregated amenities materialized view.
 */
async function runMatchPhase(
  startTime: number,
  radiusM: number
): Promise<MatchSyncResult> {
  const supabase = createSupabaseServiceRoleClient();
  const matchResult = await matchCCCToBeaches(supabase, radiusM);

  return {
    phase: "match",
    match: matchResult,
    duration_ms: Date.now() - startTime,
  };
}
