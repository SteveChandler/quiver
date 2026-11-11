import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import { ndbcAdapter } from "@/lib/services/wave-stations/ndbc/adapter";
import {
  syncLatestObservations,
  syncRegistry,
  syncStandardHistory,
  syncSwellSplit,
  type CatalogueClient,
} from "@/lib/services/wave-stations/sync";

export const revalidate = 0;
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

type SyncPhase = "registry" | "latest" | "spec";
const PHASES: readonly SyncPhase[] = ["registry", "latest", "spec"];

// ~250 NDBC .spec stations / 70 per run x 4 runs an hour = each about hourly.
const SPEC_OPTIONS = {
  maxStations: 70,
  maxBackfills: 10,
  concurrency: 6,
  budgetMs: 160_000,
};

// ~45 wave stations without a .spec / 15 per run x 4 runs an hour = each about hourly.
const TXT_OPTIONS = {
  maxStations: 15,
  maxBackfills: 3,
  concurrency: 3,
  budgetMs: 60_000,
};

/**
 * GET /api/cron/wave-stations-sync?phase=registry|latest|spec
 *
 * Public wave-station catalogue (wave_stations, wave_station_observations).
 * Separate from ndbc-direct-sync / ioos-sync, which feed the forecast.
 * - registry: daily station list from activestations.xml
 * - latest: every 15 min, one latest_obs.txt request for all stations
 * - spec: every 15 min, a staggered batch of realtime2 .spec files (swell split),
 *   then .txt files for wave stations that have no .spec
 */
async function _GET(request: Request): Promise<Response> {
  try {
    if (!validateCronRequest(request)) {
      return createErrorResponse("Unauthorized", "Invalid cron authentication", 401);
    }

    const phase = new URL(request.url).searchParams.get("phase") as SyncPhase | null;
    if (!phase || !PHASES.includes(phase)) {
      return createErrorResponse(
        "Invalid phase",
        'Query param "phase" must be "registry", "latest" or "spec"',
        400,
      );
    }

    const db = createSupabaseServiceRoleClient() as unknown as CatalogueClient;
    const nowMs = Date.now();
    const job = `/api/cron/wave-stations-sync?phase=${phase}`;

    if (phase === "registry") {
      const result = await withCronOutcome(
        { job, unit: "stations_upserted", expectedMin: 1, getProduced: (value) => value.upserted },
        () => syncRegistry(db, ndbcAdapter, nowMs),
      );
      return createSuccessResponse(result);
    }

    if (phase === "latest") {
      const result = await withCronOutcome(
        { job, unit: "rows_sent", expectedMin: 1, getProduced: (value) => value.rowsSent },
        () => syncLatestObservations(db, ndbcAdapter, nowMs),
      );
      return createSuccessResponse(result);
    }

    const result = await withCronOutcome(
      {
        job,
        unit: "stations_checked",
        expectedMin: 1,
        getProduced: (value) =>
          value.swellSplit.fetched + value.swellSplit.notModified
          + value.standard.fetched + value.standard.notModified,
        legitimatelyZero: (value) =>
          value.swellSplit.stationsDue + value.standard.stationsDue === 0
            ? { reason: "no station due for a .spec or .txt check" }
            : undefined,
      },
      async () => ({
        swellSplit: await syncSwellSplit(db, ndbcAdapter, nowMs, SPEC_OPTIONS),
        standard: await syncStandardHistory(db, ndbcAdapter, nowMs, TXT_OPTIONS),
      }),
    );
    return createSuccessResponse(result);
  } catch (error) {
    console.error("[WaveStations] Cron error:", error);
    return handleApiError(error);
  }
}

export const GET = withObservedCron("/api/cron/wave-stations-sync", _GET);
