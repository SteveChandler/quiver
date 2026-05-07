/**
 * One-off verification script for the OBP "Good match" scoring fix.
 * Pulls the current Ocean Beach Pier forecast rows and runs the new
 * scoring snapshot + composite to confirm short-period W days no longer
 * land in the "good" matchQuality band.
 *
 * Run: npx tsx scripts/check-obp-scoring.ts
 */
import { createClient } from '@supabase/supabase-js';
import {
  createDiscoveryScoringEngine,
  forecastToSnapshot,
  scoreBeachWithEngine,
} from '../lib/domains/scoring';
import { getDirectionalRelevance } from '../lib/domains/scoring/scorers/directional-relevance';
import { getBatchFreshForecastsFromCache } from '../lib/utils/forecast-service-utils';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
const supabase = createClient(url, key);

async function main() {
  const { data: beaches, error: beachErr } = await supabase
    .from('beaches')
    .select('*')
    .or('name.ilike.%ocean beach pier%,slug.ilike.%ocean-beach-pier%')
    .limit(5);
  if (beachErr) throw beachErr;
  if (!beaches?.length) {
    console.error('No OBP beach found');
    process.exit(1);
  }

  for (const beach of beaches) {
    console.log(`\n=== ${beach.name} (${beach.city}, ${(beach as any).state ?? '?'}) — slug=${beach.slug} ===`);
    console.log(`  swell window: min=${beach.swell_window_min_deg} max=${beach.swell_window_max_deg}`);
    console.log(`  wind offshore: ${beach.wind_offshore_deg}° ±${beach.wind_offshore_tol_deg ?? 45}°`);
    console.log(`  tide pref: ${beach.preferred_tide_ft_min ?? '?'}–${beach.preferred_tide_ft_max ?? '?'} ft`);

    console.log(`  beach.id=${beach.id}`);
    // Probe the latest-forecast view + raw enhanced_forecasts to see what's there
    const { data: latestProbe } = await supabase
      .from('v_enhanced_forecast_latest')
      .select('beach_id, updated_at, data_source, forecast_at')
      .eq('beach_id', beach.id)
      .limit(3);
    console.log(`  v_enhanced_forecast_latest rows: ${latestProbe?.length ?? 0}  ->`, latestProbe);

    const { data: rawProbe } = await supabase
      .from('enhanced_forecasts')
      .select('forecast_at, wave_height, wave_period, wave_direction, swell_1_period, swell_1_direction, wind_speed, wind_direction, tide_height')
      .eq('beach_id', beach.id)
      .order('forecast_at', { ascending: false })
      .limit(3);
    console.log(`  enhanced_forecasts (most recent 3):`, rawProbe);

    const cacheMap = await getBatchFreshForecastsFromCache([beach.id], 24, true);
    const cacheEntry = cacheMap.get(beach.id);
    const forecasts = cacheEntry?.forecasts ?? [];
    console.log(`  cache: cached=${cacheEntry?.metadata.cached} stale=${cacheEntry?.metadata.stale} missing=${cacheEntry?.metadata.missing} reason=${cacheEntry?.metadata.reason ?? '-'}`);
    if (!forecasts.length) {
      console.log('  no forecast rows; skipping scoring loop');
      continue;
    }

    const engine = createDiscoveryScoringEngine();
    for (const fc of forecasts) {
      const snapshot = forecastToSnapshot(fc as any);
      const detailed = scoreBeachWithEngine(engine, beach as any, fc as any);
      const local = new Date(fc.forecast_at).toLocaleString('en-US', {
        timeZone: 'America/Los_Angeles',
        hour: 'numeric', day: '2-digit', month: '2-digit',
      });
      const period = snapshot.primarySwell?.periodS ?? null;
      const relevance = getDirectionalRelevance(period);
      const flag = ['good', 'excellent', 'perfect'].includes(detailed.matchQuality) && period != null && period < 8 ? ' <-- !!' : '';
      console.log(
        `  ${local}  Hs=${snapshot.waveHeight.toFixed(1)}ft  T=${snapshot.wavePeriod}s  ` +
        `dir=${snapshot.waveDirection ?? '?'}  primary=${snapshot.primarySwell ? `${snapshot.primarySwell.heightFt.toFixed(1)}ft/${snapshot.primarySwell.periodS}s/${snapshot.primarySwell.directionDeg}°` : 'null'}  ` +
        `rel=${relevance.toFixed(2)}  total=${detailed.total}  matchQuality=${detailed.matchQuality}${flag}`
      );
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
