import { createClient } from '@supabase/supabase-js';

export const maxDuration = 30;

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

  const { data: pending, error: fetchError } = await supabase
    .from('ml_predictions_log')
    .select('id, beach_id, predicted_at, raw_forecast_m, corrected_forecast_m')
    .is('observed_m', null)
    .lt('predicted_at', cutoff)
    .limit(200);

  if (fetchError) {
    console.error('Error fetching pending predictions:', fetchError);
    return Response.json({ error: fetchError.message }, { status: 500 });
  }

  if (!pending?.length) {
    return Response.json({ updated: 0, message: 'No pending predictions' });
  }

  console.log(`Found ${pending.length} predictions to backfill`);

  let updated = 0;

  for (const pred of pending) {
    // Find nearest observation within 1 hour window
    const predTime = new Date(pred.predicted_at);
    const windowStart = new Date(predTime.getTime() - 3600000).toISOString();
    const windowEnd = new Date(predTime.getTime() + 3600000).toISOString();

    const { data: obs } = await supabase
      .from('marine_forecasts')
      .select('wave_height_m, ts')
      .eq('beach_id', pred.beach_id)
      .eq('is_observed', true)
      .gte('ts', windowStart)
      .lte('ts', windowEnd)
      .order('ts', { ascending: true })
      .limit(1)
      .maybeSingle();

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

      if (!updateError) {
        updated++;
      }
    }
  }

  console.log(`Updated ${updated} predictions with ground truth`);

  return Response.json({ updated, total_pending: pending.length });
}
