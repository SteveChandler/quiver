import { createClient } from '@supabase/supabase-js';

export const maxDuration = 60;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

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

  // First, get beaches that actually have observation data
  const { data: beachesWithObs } = await supabase
    .from('marine_forecasts')
    .select('beach_id')
    .eq('is_observed', true)
    .not('wave_height_m', 'is', null);

  if (!beachesWithObs?.length) {
    return Response.json({
      updated: 0,
      message: 'No beaches with observation data',
    });
  }

  // Get unique beach IDs
  const beachIdsWithObs = Array.from(
    new Set(beachesWithObs.map((b) => b.beach_id))
  );

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
  const PARALLEL_BATCH = 50;

  // Process prediction matching and update
  async function processPrediction(pred: NonNullable<typeof pending>[number]): Promise<boolean> {
    try {
      // Find nearest observation within 1 hour window
      const predTime = new Date(pred.predicted_at);
      const windowStart = new Date(predTime.getTime() - 3600000).toISOString();
      const windowEnd = new Date(predTime.getTime() + 3600000).toISOString();

      const { data: obs, error: obsError } = await supabase
        .from('marine_forecasts')
        .select('wave_height_m, ts')
        .eq('beach_id', pred.beach_id)
        .eq('is_observed', true)
        .not('wave_height_m', 'is', null)
        .gte('ts', windowStart)
        .lte('ts', windowEnd)
        .order('ts', { ascending: true })
        .limit(1)
        .maybeSingle();

      if (obsError) {
        console.error(`Error fetching observation for prediction ${pred.id}:`, obsError);
        return false;
      }

      if (obs?.wave_height_m) {
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
          return false;
        }

        return true;
      }
      return false;
    } catch (error) {
      console.error(`Unexpected error processing prediction ${pred.id}:`, error);
      return false;
    }
  }

  // Process in parallel batches of PARALLEL_BATCH
  for (let i = 0; i < pending.length; i += PARALLEL_BATCH) {
    const batch = pending.slice(i, i + PARALLEL_BATCH);
    const results = await Promise.all(batch.map(processPrediction));
    updated += results.filter(Boolean).length;
  }

  console.log(
    `Updated ${updated}/${pending.length} predictions with ground truth`
  );

  return Response.json({
    updated,
    processed: pending.length,
    match_rate: pending.length > 0 ? (updated / pending.length) * 100 : 0,
    beaches_with_observations: beachIdsWithObs.length,
  });
}
