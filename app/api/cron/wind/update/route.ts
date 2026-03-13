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

export const maxDuration = 120;

/** Cardinal direction from degrees (for wind_direction text field) */
function degreesToCardinal(deg: number): string {
  const dirs = ['N','NNE','NE','ENE','E','ESE','SE','SSE','S','SSW','SW','WSW','W','WNW','NW','NNW'];
  const idx = Math.round(deg / 22.5) % 16;
  return dirs[idx];
}

export async function GET(request: Request) {
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

  for (let i = 0; i < beaches.length; i += BATCH_SIZE) {
    const batch = beaches.slice(i, i + BATCH_SIZE);

    const results = await Promise.allSettled(
      batch.map(async (beach) => {
        const windPoints = await fetchHourlyWind(beach.lat, beach.lon);
        if (!windPoints.length) return { beach: beach.name, updated: 0, skipped: 0 };

        let beachUpdated = 0;
        let beachSkipped = 0;

        // Update each hourly forecast row
        for (const wp of windPoints) {
          if (wp.wind_speed_mph == null) continue;

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

          if (error) {
            errors++;
          } else {
            const rowCount = data?.length ?? 0;
            if (rowCount > 0) beachUpdated += rowCount;
            else beachSkipped++;
          }
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
