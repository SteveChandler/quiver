import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/api-utils";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  fetchCCCLocations,
  upsertCCCLocations,
  matchCCCToBeaches,
} from "@/lib/services/ccc";
import type { FetchResult, UpsertResult, MatchResult } from "@/lib/services/ccc";
import { withObservedCron } from "@/lib/cron/observability";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel hard limit (5min)

type SyncPhase = "import" | "match";

interface ImportSyncResult {
  phase: "import";
  fetch: FetchResult;
  upsert: UpsertResult;
  duration_ms: number;
}

interface MatchSyncResult {
  phase: "match";
  match: MatchResult;
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
 * - Vercel Cron header (`x-vercel-cron`)
 * - OR Authorization: Bearer <CRON_SECRET>
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
    const phase = url.searchParams.get("phase") as SyncPhase | null;

    if (!phase || !["import", "match"].includes(phase)) {
      return createErrorResponse(
        "Invalid phase",
        'Query param "phase" must be "import" or "match"',
        400
      );
    }

    console.log(`[CCC] Starting CCC sync (phase=${phase})...`);

    if (phase === "import") {
      const result = await runImportPhase(startTime);
      console.log("[CCC] Import phase complete:", JSON.stringify(result, null, 2));
      return createSuccessResponse(result);
    } else {
      const radiusM = parseInt(url.searchParams.get("radiusM") || "1500", 10);
      const result = await runMatchPhase(startTime, radiusM);
      console.log("[CCC] Match phase complete:", JSON.stringify(result, null, 2));
      return createSuccessResponse(result);
    }
  } catch (error) {
    console.error("[CCC] Sync cron error:", error);
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/ccc-sync", _GET);

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
