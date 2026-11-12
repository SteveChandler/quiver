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
  syncDuplicates,
  syncRegistry,
  syncStandardHistory,
  syncSwellSplit,
  type CatalogueClient,
} from "@/lib/services/wave-stations/sync";
import type { WaveStationSourceAdapter } from "@/lib/services/wave-stations/types";
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

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

// Copernicus, once an hour in the latest phase: one file per station (~85 KB,
// one UTC day of readings), downloaded only when it changed. A first run
// backfills at most that day, so backfills need no separate cap. The other
// latest sources finish in seconds, so 200 s stays inside maxDuration 300.
const FILE_LATEST_OPTIONS = {
  maxStations: 600,
  maxBackfills: 600,
  concurrency: 6,
  budgetMs: 200_000,
};

type LatestRun =
  | Awaited<ReturnType<typeof syncLatestObservations>>
  | (Awaited<ReturnType<typeof syncStandardHistory>> & { rowsSent: number });

/** One due source's latest run: its bulk feed, or its per-station files (latestVia "history"). */
async function runLatest(db: CatalogueClient, adapter: WaveStationSourceAdapter, nowMs: number): Promise<LatestRun> {
  if (adapter.latestVia === "history") {
    const result = await syncStandardHistory(db, adapter, nowMs, FILE_LATEST_OPTIONS);
    return { ...result, rowsSent: result.rowsWritten };
  }
  // The prune is table-wide; NDBC runs every quarter, so it carries it.
  return syncLatestObservations(db, adapter, nowMs, { prune: adapter.source === "ndbc" });
}

/**
 * GET /api/cron/wave-stations-sync?phase=registry|latest|spec
 *
 * Public wave-station catalogue (wave_stations, wave_station_observations).
 * Separate from ndbc-direct-sync / ioos-sync, which feed the forecast.
 * - registry: daily station list from every source (NDBC activestations.xml,
 *   then the non-US sources), then the cross-source duplicate pass
 * - latest: every 15 min; one bulk request per due source (NDBC every quarter,
 *   others at their own update rate, see isLatestDue); Copernicus reads its
 *   changed per-station files instead, once an hour
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
          getProduced: (value) => sumOk(value.sources, (run) => run.upserted),
          failureReason: (value) =>
            [failedSources(value.sources), value.duplicates.error ? `duplicates: ${value.duplicates.error}` : null]
              .filter(Boolean)
              .join("; ") || null,
        },
        // Sources one after another (gentle on shared storage), then one duplicate pass over all of them.
        async () => {
          const sources: Array<SourceRun<Awaited<ReturnType<typeof syncRegistry>>>> = [];
          for (const adapter of SOURCE_ADAPTERS) {
            sources.push(...(await runPerSource([adapter], (one) => syncRegistry(db, one, nowMs))));
          }
          let duplicates: { marked: number; cleared: number; error?: string };
          try {
            duplicates = await syncDuplicates(db);
          } catch (error) {
            duplicates = { marked: 0, cleared: 0, error: error instanceof Error ? error.message : String(error) };
          }
          return { sources, duplicates };
        },
      );
      return createSuccessResponse(result);
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
        () => runPerSource(due, (adapter) => runLatest(db, adapter, nowMs)),
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

const handleGet = withObservedCron("/api/cron/wave-stations-sync", _GET);

export const GET = withErrorNoStore(handleGet);
