import { setTimeout as sleep } from "node:timers/promises";
/**
 * Hourly wind update cron.
 *
 * Fetches wind from Open-Meteo Weather API for all beaches and updates
 * enhanced_forecasts wind columns. Only overwrites wind when the existing
 * wind_source is lower priority than OPEN_METEO_WIND.
 *
 * Priority: HRRR > NWS > OPEN_METEO_WIND > everything else
 *
 * Scheduled: Every hour at :45 via Vercel cron
 */
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { validateCronRequest, createSuccessResponse, createErrorResponse } from '@/lib/middleware/api-wrappers';
import { fetchHourlyWindOrThrow, isOpenMeteoUpstreamError } from '@/lib/services/open-meteo-wind-service';
import { withObservedCron } from '@/lib/cron/observability';
import { withCronOutcome } from '@/lib/cron/outcome';
import { withErrorNoStore } from "@/lib/middleware/api-wrappers/error-cache-wrapper";

export const maxDuration = 120;

// Stop before the 120 s kill so the run records its own outcome. A batch that
// starts just under this limit can take ~10 s (fetch timeout) plus its RPCs.
const RUN_DEADLINE_MS = 90_000;
// Batches in a row where every attempted fetch got no HTTP response.
const UPSTREAM_DOWN_BATCH_LIMIT = 2;
const JOB = '/api/cron/wind/update';

type StoppedReason = 'upstream_unavailable' | 'deadline_exceeded';

type OpenMeteoWindUpdateResult = {
  updated_count?: number;
  skipped_count?: number;
};

type OpenMeteoWindRpcPoint = {
  ts: string;
  wind_speed_mph: number;
  wind_direction_deg: number | null;
};

function parseRpcCount(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

async function _GET(request: Request): Promise<Response> {
  const startedAt = Date.now();
  if (!validateCronRequest(request)) {
    return createErrorResponse('Unauthorized', null, 401);
  }

  const supabase = createSupabaseServiceRoleClient();

  // Fetch all beaches with coordinates
  const { data: beaches, error: beachError } = await supabase
    .from('beaches')
    .select('id, lat, lon, name')
    .not('lat', 'is', null)
    .not('lon', 'is', null);

  if (beachError || !beaches?.length) {
    return createErrorResponse('Failed to fetch beaches');
  }

  console.log(`[Wind] Updating wind for ${beaches.length} beaches`);

  let updated = 0;
  let skipped = 0;
  let errors = 0;
  let fetchErrors = 0;
  let upstreamFetchErrors = 0;
  let attemptedBeaches = 0;
  let upstreamDownBatches = 0;
  let stoppedReason: StoppedReason | null = null;
  let stopDetail = '';
  const upstreamErrorNames = new Set<string>();
  const sampleErrors: string[] = [];
  const BATCH_SIZE = 10; // Parallel API fetches per batch (avoid rate limiting)
  const DELAY_BETWEEN_BATCHES_MS = 200;

  for (let i = 0; i < beaches.length; i += BATCH_SIZE) {
    const elapsedMs = Date.now() - startedAt;
    if (elapsedMs > RUN_DEADLINE_MS) {
      stoppedReason = 'deadline_exceeded';
      stopDetail = `Open-Meteo wind run passed ${RUN_DEADLINE_MS / 1000} s after ${i} of ${beaches.length} beaches`;
      break;
    }

    const batch = beaches.slice(i, i + BATCH_SIZE);
    let batchAttempted = 0;
    let batchUpstreamFailures = 0;

    const results = await Promise.allSettled(
      batch.map(async (beach) => {
        if (beach.lat == null || beach.lon == null) {
          return { beach: beach.name, updated: 0, skipped: 0 };
        }
        let windPoints: Awaited<ReturnType<typeof fetchHourlyWindOrThrow>>;
        batchAttempted++;
        try {
          windPoints = await fetchHourlyWindOrThrow(beach.lat, beach.lon);
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          const message = `${beach.name}: ${reason}`;
          fetchErrors++;
          if (isOpenMeteoUpstreamError(err)) {
            batchUpstreamFailures++;
            const causeCode = ((err as Error).cause as { code?: unknown } | undefined)?.code;
            upstreamErrorNames.add(typeof causeCode === 'string' ? `${(err as Error).name}/${causeCode}` : (err as Error).name);
          }
          if (sampleErrors.length < 5 && !sampleErrors.includes(message)) {
            sampleErrors.push(message);
          }
          return { beach: beach.name, updated: 0, skipped: 0 };
        }

        const rpcPoints: OpenMeteoWindRpcPoint[] = windPoints
          .filter((wp): wp is typeof wp & { wind_speed_mph: number } => wp.wind_speed_mph != null)
          .map((wp) => ({
            ts: wp.ts,
            wind_speed_mph: wp.wind_speed_mph,
            wind_direction_deg: wp.wind_direction_deg,
          }));
        if (!rpcPoints.length) return { beach: beach.name, updated: 0, skipped: 0 };

        try {
          const { data, error } = await supabase.rpc('update_open_meteo_wind_for_beach' as never, {
            p_beach_id: beach.id,
            p_points: rpcPoints,
          } as never);

          if (error) {
            const message = `${error.message}${error.code ? ` (code=${error.code})` : ''}`;
            errors++;
            if (sampleErrors.length < 5 && !sampleErrors.includes(message)) {
              sampleErrors.push(message);
            }
            return { beach: beach.name, updated: 0, skipped: 0 };
          }

          const result = (data ?? {}) as OpenMeteoWindUpdateResult;
          return {
            beach: beach.name,
            updated: parseRpcCount(result.updated_count),
            skipped: parseRpcCount(result.skipped_count),
          };
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          errors++;
          if (sampleErrors.length < 5 && !sampleErrors.includes(message)) {
            sampleErrors.push(message);
          }
          return { beach: beach.name, updated: 0, skipped: 0 };
        }
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') {
        updated += r.value.updated;
        skipped += r.value.skipped;
      } else {
        errors++;
      }
    }

    attemptedBeaches += batchAttempted;
    upstreamFetchErrors += batchUpstreamFailures;
    upstreamDownBatches = batchAttempted > 0 && batchUpstreamFailures === batchAttempted
      ? upstreamDownBatches + 1
      : 0;
    if (upstreamDownBatches >= UPSTREAM_DOWN_BATCH_LIMIT) {
      stoppedReason = 'upstream_unavailable';
      stopDetail = `Open-Meteo wind gave no HTTP response in ${upstreamDownBatches} consecutive batches `
        + `(${[...upstreamErrorNames].sort().join(', ')}); stopped after ${attemptedBeaches} of ${beaches.length} beaches`;
      break;
    }

    // Brief pause between batches to be a good API citizen
    if (i + BATCH_SIZE < beaches.length) {
      await sleep(DELAY_BETWEEN_BATCHES_MS);
    }
  }

  console.log(`[Wind] Done: ${updated} rows updated, ${skipped} skipped (protected), ${errors} errors`);

  const summary = {
    beaches: beaches.length,
    updated,
    skipped,
    errors,
    fetchErrors,
    upstreamFetchErrors,
    attemptedBeaches,
    stoppedReason,
    sampleErrors,
  };

  const stopMessage = stoppedReason ? `${stoppedReason}: ${stopDetail}` : null;
  const recorded = await withCronOutcome(
    {
      job: JOB,
      unit: 'wind_rows_updated',
      expectedMin: 1,
      getProduced: (value) => value.updated,
      failureReason: () => stopMessage,
    },
    async () => summary,
  );

  if (stopMessage) {
    console.warn(`[Wind] Stopped early: ${stopMessage}`);
    return createErrorResponse(stopMessage, recorded, 503);
  }
  if (errors > 0) {
    return createErrorResponse('Wind update completed with row errors', recorded);
  }
  return createSuccessResponse(recorded);
}

const handleGet = withObservedCron(JOB, _GET);

export const GET = withErrorNoStore(handleGet, "/api/cron/wind/update");
