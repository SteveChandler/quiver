import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startTime = Date.now();
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Find predictions without ground truth (older than 2 hours)
  const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  // Only look at predictions within observation data range (last 7 days)
  const observationWindowStart = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000
  ).toISOString();

  // Use the observable_beaches materialized view (fast: ~0.1ms vs 5400ms)
  // This view is refreshed daily and contains beaches with observation sources
  const { data: beachesWithObs, error: beachesError } = await supabase
    .from('observable_beaches')
    .select('beach_id');

  if (beachesError) {
    console.error('Error fetching observable beaches:', beachesError);
    return Response.json({ error: beachesError.message }, { status: 500 });
  }

  if (!beachesWithObs?.length) {
    return Response.json({
      updated: 0,
      message: 'No beaches in observable_beaches view',
    });
  }

  // Get unique beach IDs (already unique from the view, but defensive)
  const beachIdsWithObs = beachesWithObs.map((b) => b.beach_id);
  console.log(`Found ${beachIdsWithObs.length} observable beaches`);

  const { data: pending, error: fetchError } = await supabase
    .from('ml_predictions_log')
    .select('id, beach_id, predicted_at, raw_forecast_m, corrected_forecast_m')
    .is('observed_m', null)
    .lt('predicted_at', cutoff)
    .gt('predicted_at', observationWindowStart)
    .in('beach_id', beachIdsWithObs)
    .order('predicted_at', { ascending: true })
    .limit(1000);

  if (fetchError) {
    console.error('Error fetching pending predictions:', fetchError);
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (!pending?.length) {
    return Response.json({ updated: 0, message: 'No pending predictions' });
  }

  console.log(`Found ${pending.length} predictions to backfill`);

  let updated = 0;
  let errors = 0;
  let noMatch = 0;
  const PARALLEL_BATCH = 25; // Reduced from 50 to avoid connection pool exhaustion

  // Process prediction matching and update
  // Returns: 'matched' | 'no_match' | 'error'
  async function processPrediction(
    pred: NonNullable<typeof pending>[number]
  ): Promise<'matched' | 'no_match' | 'error'> {
    try {
      // Find nearest observation within 1 hour window
      const predTime = new Date(pred.predicted_at);
      const windowStart = new Date(predTime.getTime() - 3600000).toISOString();
      const windowEnd = new Date(predTime.getTime() + 3600000).toISOString();

      // Query unified_wave_observations which includes IOOS data
      // (primary observation source - marine_forecasts doesn't have IOOS)
      const { data: obs, error: obsError } = await supabase
        .from('unified_wave_observations')
        .select('wave_height_m, observed_at')
        .eq('nearest_beach_id', pred.beach_id)
        .not('wave_height_m', 'is', null)
        .gte('observed_at', windowStart)
        .lte('observed_at', windowEnd)
        .order('observed_at', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (obsError) {
        console.error(
          `Error fetching observation for prediction ${pred.id}:`,
          obsError
        );
        return 'error';
      }

      if (!obs?.wave_height_m) {
        return 'no_match';
      }

      const rawError = Math.abs(pred.raw_forecast_m - obs.wave_height_m);
      const correctedError = Math.abs(
        pred.corrected_forecast_m - obs.wave_height_m
      );

      const { error: updateError } = await supabase
        .from('ml_predictions_log')
        .update({
          observed_m: obs.wave_height_m,
          raw_error_m: rawError,
          corrected_error_m: correctedError,
        })
        .eq('id', pred.id);

      if (updateError) {
        console.error(`Error updating prediction ${pred.id}:`, updateError);
        return 'error';
      }

      return 'matched';
    } catch (error) {
      console.error(
        `Unexpected error processing prediction ${pred.id}:`,
        error
      );
      return 'error';
    }
  }

  // Process in parallel batches
  for (let i = 0; i < pending.length; i += PARALLEL_BATCH) {
    const batch = pending.slice(i, i + PARALLEL_BATCH);
    const results = await Promise.all(batch.map(processPrediction));

    for (const result of results) {
      if (result === 'matched') updated++;
      else if (result === 'no_match') noMatch++;
      else errors++;
    }

    // Log progress every 200 predictions
    if ((i + PARALLEL_BATCH) % 200 === 0 || i + PARALLEL_BATCH >= pending.length) {
      console.log(
        `Progress: ${Math.min(i + PARALLEL_BATCH, pending.length)}/${pending.length} - ` +
          `matched=${updated}, no_match=${noMatch}, errors=${errors}`
      );
    }
  }

  const elapsedMs = Date.now() - startTime;
  console.log(
    `Completed in ${elapsedMs}ms: ${updated}/${pending.length} matched, ` +
      `${noMatch} no observation, ${errors} errors`
  );

  return Response.json({
    updated,
    processed: pending.length,
    no_match: noMatch,
    errors,
    match_rate: pending.length > 0 ? (updated / pending.length) * 100 : 0,
    beaches_with_observations: beachIdsWithObs.length,
    elapsed_ms: elapsedMs,
  });
}
