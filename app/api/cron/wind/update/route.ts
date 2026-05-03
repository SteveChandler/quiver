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
import { validateCronRequest, createSuccessResponse, createErrorResponse } from '@/lib/api-utils';
import { fetchHourlyWind } from '@/lib/services/open-meteo-wind-service';
import { withObservedCron } from '@/lib/cron/observability';
import pLimit from 'p-limit';

export const maxDuration = 120;

/** Cardinal direction from degrees (for wind_direction text field) */
function degreesToCardinal(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx];
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
  // Open-Meteo returns 48 hourly points, but enhanced_forecasts only has rows at ~3h intervals
  // so most points won't match → actual DB writes ≈ 273 × 8-10 = ~2,500 (well within 120s timeout)
  const BATCH_SIZE = 10; // Parallel API fetches per batch (avoid rate limiting)
  const DELAY_BETWEEN_BATCHES_MS = 200;
  // Cap total in-flight enhanced_forecasts updates across all beaches in this run.
  // Without this, BATCH_SIZE * ~48 windPoints could fan out to ~480 concurrent
  // PostgREST requests, which is unfriendly to pgBouncer. 80 is well under
  // pgBouncer headroom on a paid Supabase tier and still ~6x faster than serial.
  const dbLimit = pLimit(80);

  for (let i = 0; i < beaches.length; i += BATCH_SIZE) {
    const batch = beaches.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (beach) => {
        if (beach.lat == null || beach.lon == null) {
          return { beach: beach.name, updated: 0, skipped: 0 };
        }
        const windPoints = await fetchHourlyWind(beach.lat, beach.lon);
        if (!windPoints.length) return { beach: beach.name, updated: 0, skipped: 0 };

        // Catch inside each limited callback so a thrown Supabase error folds
        // into the 'error' bucket. If we let it reject, Promise.all short-
        // circuits — the beach task rejects while the remaining queued dbLimit
        // tasks keep running, which under-reports counts on the final batch.
        const updates = await Promise.all(
          windPoints
            .filter((wp) => wp.wind_speed_mph != null)
            .map((wp) =>
              dbLimit(async () => {
                try {
                  const hourStart = wp.ts;
                  const hourEnd = new Date(new Date(wp.ts).getTime() + 3600000).toISOString();
                  const cardinal = wp.wind_direction_deg != null
                    ? degreesToCardinal(wp.wind_direction_deg)
                    : null;

                  // Only update rows where wind_source is NOT a higher-priority source
                  const { data, error } = await supabase
                    .from('enhanced_forecasts')
                    .update({
                      wind_speed: `${wp.wind_speed_mph} mph`,
                      wind_direction: cardinal,
                      wind_direction_deg: wp.wind_direction_deg,
                      wind_source: 'OPEN_METEO_WIND',
                    })
                    .eq('beach_id', beach.id)
                    .gte('forecast_at', hourStart)
                    .lt('forecast_at', hourEnd)
                    .or('wind_source.is.null,wind_source.not.in.(HRRR,NWS)')
                    .select('id');

                  if (error) return { kind: 'error' as const };
                  const rowCount = data?.length ?? 0;
                  return rowCount > 0
                    ? { kind: 'updated' as const, rowCount }
                    : { kind: 'skipped' as const };
                } catch {
                  return { kind: 'error' as const };
                }
              })
            )
        );

        let beachUpdated = 0;
        let beachSkipped = 0;
        for (const u of updates) {
          if (u.kind === 'error') errors++;
          else if (u.kind === 'updated') beachUpdated += u.rowCount;
          else beachSkipped++;
        }

        return { beach: beach.name, updated: beachUpdated, skipped: beachSkipped };
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

  return createSuccessResponse({
    beaches: beaches.length,
    updated,
    skipped,
    errors,
  });
}

export const GET = withObservedCron('/api/cron/wind/update', _GET);
