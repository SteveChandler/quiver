import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import {
  syncWQStations,
  syncWQSamples,
  evaluateWaterQuality,
} from "@/lib/services/water-quality";
import type {
  StationSyncResult,
  SampleSyncResult,
  EvaluationResult,
} from "@/lib/services/water-quality";
import { withCronOutcome } from "@/lib/cron/outcome";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300; // Vercel hard limit (5min)

type SyncPhase = "stations" | "samples" | "evaluate";

interface StationPhaseResult {
  phase: "stations";
  result: StationSyncResult;
}

interface SamplePhaseResult {
  phase: "samples";
  result: SampleSyncResult;
}

interface EvaluatePhaseResult {
  phase: "evaluate";
  result: EvaluationResult;
}

/**
 * GET /api/cron/water-quality-sync
 *
 * Cron job: syncs water quality data from CEDEN (California) and PacIOOS
 * ERDDAP (Hawaii) in three phases:
 *
 * 1. Stations phase (monthly, 1st at 08:00 UTC):
 *    - Fetches coastal monitoring stations from CEDEN + PacIOOS for CA + HI
 *    - Matches each station to the nearest beach (within 5km)
 *    - Upserts into wq_monitoring_stations
 *
 * 2. Samples phase (bi-weekly, Tue/Fri at 12:00 UTC):
 *    - Fetches last 90 days of Enterococcus and Fecal Coliform results
 *    - Matches samples to known station IDs
 *    - Upserts into wq_samples
 *
 * 3. Evaluate phase (bi-weekly, Tue/Fri at 12:30 UTC):
 *    - Applies EPA recreational water quality criteria per beach
 *    - Computes geometric means, STV exceedances
 *    - Determines status: good / advisory / closure / unknown
 *    - Upserts into beach_water_quality
 *
 * Query params:
 * - phase: "stations" | "samples" | "evaluate" (required)
 *
 * Auth:
 * - Authorization: Bearer <CRON_SECRET>
 */
async function _GET(request: Request): Promise<Response> {
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

    if (!phase || !["stations", "samples", "evaluate"].includes(phase)) {
      return createErrorResponse(
        "Invalid phase",
        'Query param "phase" must be "stations", "samples", or "evaluate"',
        400
      );
    }

    console.log(`[WQ] Starting water quality sync (phase=${phase})...`);

    const supabase = createSupabaseServiceRoleClient();

    if (phase === "stations") {
      const syncResult = await withCronOutcome(
        {
          job: "/api/cron/water-quality-sync?phase=stations",
          unit: "stations_synced",
          expectedMin: 1,
          getProduced: (result) => result.stationsUpserted,
        },
        () => syncWQStations(supabase),
      );
      const response: StationPhaseResult = {
        phase: "stations",
        result: syncResult,
      };
      console.log(
        "[WQ] Stations phase complete:",
        JSON.stringify(response, null, 2)
      );
      return createSuccessResponse(response);
    }

    if (phase === "samples") {
      const syncResult = await withCronOutcome(
        {
          job: "/api/cron/water-quality-sync?phase=samples",
          unit: "samples_stored",
          expectedMin: 1,
          getProduced: (result) => result.samplesUpserted,
        },
        () => syncWQSamples(supabase),
      );
      const response: SamplePhaseResult = {
        phase: "samples",
        result: syncResult,
      };
      console.log(
        "[WQ] Samples phase complete:",
        JSON.stringify(response, null, 2)
      );
      return createSuccessResponse(response);
    }

    // phase === "evaluate"
    const evalResult = await withCronOutcome(
      {
        job: "/api/cron/water-quality-sync?phase=evaluate",
        unit: "beaches_evaluated",
        expectedMin: 1,
        getProduced: (result) => result.beachesEvaluated,
      },
      () => evaluateWaterQuality(supabase),
    );
    const response: EvaluatePhaseResult = {
      phase: "evaluate",
      result: evalResult,
    };
    console.log(
      "[WQ] Evaluate phase complete:",
      JSON.stringify(response, null, 2)
    );
    return createSuccessResponse(response);
  } catch (error) {
    console.error("[WQ] Water quality sync cron error:", error);
    return handleApiError(error);
  }
}

export const GET = _GET;
