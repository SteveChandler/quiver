import {
  createErrorResponse,
  createSuccessResponse,
  handleApiError,
  validateCronRequest,
} from "@/lib/middleware/api-wrappers";
import { createSupabaseServiceRoleClient } from "@/lib/supabase/server";
import { withObservedCron } from "@/lib/cron/observability";
import { withCronOutcome } from "@/lib/cron/outcome";
import { SOURCE_ADAPTERS } from "@/lib/services/wave-stations/adapters";
import { ndbcAdapter } from "@/lib/services/wave-stations/ndbc/adapter";
import {
  failedSources,
  isLatestDue,
  runPerSource,
  sumOk,
  type SourceRun,
} from "@/lib/services/wave-stations/run-sources";
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

// Each wave station gets a .spec check (if it has one) and a .txt check about
// once an hour, at least 20 minutes apart (see sync.ts). 4 runs an hour:
// ~250 .spec stations / 70 per run, ~300 wave stations / 80 per run.
// Budgets (130 s + 110 s + one in-flight request) stay inside maxDuration 300.
const SPEC_OPTIONS = {
  maxStations: 70,
  maxBackfills: 10,
  concurrency: 6,
  budgetMs: 130_000,
};

const TXT_OPTIONS = {
  maxStations: 80,
  maxBackfills: 8,
  concurrency: 6,
  budgetMs: 110_000,
};

/**
 * GET /api/cron/wave-stations-sync?phase=registry|latest|spec
 *
 * Public wave-station catalogue (wave_stations, wave_station_observations).
 * Separate from ndbc-direct-sync / ioos-sync, which feed the forecast.
 * - registry: daily station list from every source (NDBC activestations.xml,
 *   then the non-US sources), then the cross-source duplicate pass
 * - latest: every 15 min; one bulk request per due source (NDBC every quarter,
 *   others at their own update rate, see isLatestDue)
 * - spec: every 15 min, NDBC only: a staggered batch of realtime2 .spec files
 *   (swell split), then .txt files (waves with dominant period, plus met)
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

    // Each source runs on its own: one failing source is reported in the
    // outcome (failureReason) without stopping the others.
    if (phase === "registry") {
      const result = await withCronOutcome(
        {
          job,
          unit: "stations_upserted",
          expectedMin: 1,
          getProduced: (runs) => sumOk(runs, (value) => value.upserted),
          failureReason: (runs) => failedSources(runs),
        },
        // Sequential: the duplicate pass at the end of each run then sees every source written so far.
        async () => {
          const runs: Array<SourceRun<Awaited<ReturnType<typeof syncRegistry>>>> = [];
          for (const adapter of SOURCE_ADAPTERS) {
            runs.push(...(await runPerSource([adapter], (one) => syncRegistry(db, one, nowMs))));
          }
          return runs;
        },
      );
      return createSuccessResponse({ sources: result });
    }

    if (phase === "latest") {
      const due = SOURCE_ADAPTERS.filter((adapter) => isLatestDue(adapter, nowMs));
      const result = await withCronOutcome(
        {
          job,
          unit: "rows_sent",
          expectedMin: 1,
          getProduced: (runs) => sumOk(runs, (value) => value.rowsSent),
          failureReason: (runs) => failedSources(runs),
        },
        () =>
          runPerSource(due, (adapter) =>
            // The prune is table-wide; NDBC runs every quarter, so it carries it.
            syncLatestObservations(db, adapter, nowMs, { prune: adapter.source === "ndbc" }),
          ),
      );
      return createSuccessResponse({ sources: result });
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
