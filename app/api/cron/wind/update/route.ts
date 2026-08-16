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
import { fetchHourlyWind } from '@/lib/services/open-meteo-wind-service';
import { withObservedCron } from '@/lib/cron/observability';
import { withCronOutcome } from '@/lib/cron/outcome';

export const maxDuration = 120;

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
  const sampleErrors: string[] = [];
  const BATCH_SIZE = 10; // Parallel API fetches per batch (avoid rate limiting)
  const DELAY_BETWEEN_BATCHES_MS = 200;

  for (let i = 0; i < beaches.length; i += BATCH_SIZE) {
    const batch = beaches.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (beach) => {
        if (beach.lat == null || beach.lon == null) {
          return { beach: beach.name, updated: 0, skipped: 0 };
        }
        let windPoints: Awaited<ReturnType<typeof fetchHourlyWind>>;
        try {
          windPoints = await fetchHourlyWind(beach.lat, beach.lon);
        } catch (err) {
          const reason = err instanceof Error ? err.message : String(err);
          const message = `${beach.name}: ${reason}`;
          fetchErrors++;
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

    // Brief pause between batches to be a good API citizen
    if (i + BATCH_SIZE < beaches.length) {
      await new Promise((r) => setTimeout(r, DELAY_BETWEEN_BATCHES_MS));
    }
  }

  console.log(`[Wind] Done: ${updated} rows updated, ${skipped} skipped (protected), ${errors} errors`);

  const summary = {
    beaches: beaches.length,
    updated,
    skipped,
    errors,
    fetchErrors,
    sampleErrors,
  };

  if (errors > 0) {
    return createErrorResponse('Wind update completed with row errors', await withCronOutcome(
      {
        job: '/api/cron/wind/update',
        unit: 'wind_rows_updated',
        expectedMin: 1,
        getProduced: (value) => value.updated,
      },
      async () => summary,
    ));
  }

  return createSuccessResponse(await withCronOutcome(
    {
      job: '/api/cron/wind/update',
      unit: 'wind_rows_updated',
      expectedMin: 1,
      getProduced: (value) => value.updated,
    },
    async () => summary,
  ));
}

export const GET = withObservedCron('/api/cron/wind/update', _GET);
