import { createClient } from '@supabase/supabase-js';
import { parseWaveHeight, parseWindSpeed } from '@/lib/ml/parse-wave-height';
import { fetchWithRetry, wakeUpService } from '@/lib/ml/ml-service-client';

// Allow up to 120 seconds for cold start + processing all beaches
export const maxDuration = 120;

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ML_SERVICE_URL = process.env.ML_SERVICE_URL;
  const ML_INTERNAL_SECRET = process.env.ML_INTERNAL_SECRET;
  if (!ML_SERVICE_URL || !ML_INTERNAL_SECRET) {
    return Response.json(
      { error: 'ML_SERVICE_URL or ML_INTERNAL_SECRET not configured' },
      { status: 500 }
    );
  }

  // Wake up the ML service (handles cold start)
  console.log('Waking up ML service...');
  const isAwake = await wakeUpService();
  if (!isAwake) {
    // Retry wake-up once
    await new Promise((resolve) => setTimeout(resolve, 2000));
    const retryAwake = await wakeUpService();
    if (!retryAwake) {
      return Response.json(
        { error: 'ML service unavailable after wake-up attempts' },
        { status: 503 }
      );
    }
  }
  console.log('ML service is awake');

  // Auto-repair candidate model for shadow scoring
  // The candidate may fail to load on Fly.io machine restarts; this ensures
  // shadow scoring works on every correction cycle
  try {
    const healthResponse = await fetch(`${ML_SERVICE_URL}/health`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (healthResponse.ok) {
      const health = await healthResponse.json();

      if (health.candidate_loaded) {
        console.log(`[correct-forecasts] Candidate model loaded: ${health.candidate_version}`);
      } else {
        // Attempt reload — endpoint returns quickly if no CANDIDATE_PATH env var is set
        const reloadResponse = await fetch(`${ML_SERVICE_URL}/reload-candidate`, {
          method: 'POST',
          headers: { 'X-Internal-Secret': ML_INTERNAL_SECRET },
          signal: AbortSignal.timeout(30000),
        });

        if (reloadResponse.ok) {
          const reloadResult = await reloadResponse.json();
          if (reloadResult.success) {
            console.log(`[correct-forecasts] Candidate model reloaded: ${reloadResult.version}`);
          }
          // Don't log "No candidate path configured" — that's normal between retrains
        }
      }
    }
  } catch (candidateError) {
    // Never block primary correction pipeline for candidate repair
    console.warn('[correct-forecasts] Candidate health check failed (non-fatal):', candidateError instanceof Error ? candidateError.message : candidateError);
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Get ALL forecasts needing correction using pagination
  // This ensures every beach gets ML corrections, not just the first 500
  const today = new Date().toISOString().split('T')[0];
  const BATCH_SIZE = 1000;
  let allForecasts: any[] = [];
  let offset = 0;
  let hasMore = true;

  while (hasMore) {
    // Note: HRRR wind data (3km resolution) may have enriched the wind_speed
    // and wind_direction columns for CONUS beaches via the extract-hrrr-wind
    // cron (runs at :15 each hour). The ML model benefits from this
    // higher-resolution wind data automatically through the existing pipeline.
    const { data: batch, error } = await supabase
      .from('enhanced_forecasts')
      .select(
        'beach_id, forecast_at, forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_speed, wind_direction'
      )
      .eq('data_source', 'NOAA_NWS')
      .gte('forecast_at', `${today}T00:00:00Z`)
      .order('beach_id')
      .order('forecast_at')
      .range(offset, offset + BATCH_SIZE - 1);

    if (error) {
      console.error('Error fetching forecasts:', error);
      return Response.json({ error: error.message }, { status: 500 });
    }

    if (batch && batch.length > 0) {
      allForecasts = allForecasts.concat(batch);
      offset += BATCH_SIZE;
      hasMore = batch.length === BATCH_SIZE;
    } else {
      hasMore = false;
    }
  }

  const forecasts = allForecasts;

  if (!forecasts?.length) {
    return Response.json({ message: 'No forecasts to correct', corrected: 0 });
  }

  // Filter to only beaches that have observation sources (can be validated with ground truth)
  const { data: observableBeaches, error: observableError } = await supabase
    .from('observable_beaches')
    .select('beach_id');

  if (observableError) {
    console.error('Error fetching observable beaches:', observableError);
    // Continue without filtering if the view doesn't exist yet
  }

  const observableBeachIds = new Set(
    (observableBeaches || []).map((b) => b.beach_id)
  );

  // Filter forecasts to only process those with observations
  const forecastsToProcess = observableBeachIds.size > 0
    ? forecasts.filter((f: any) => observableBeachIds.has(f.beach_id))
    : forecasts;

  const totalBeaches = new Set(forecasts.map((f: any) => f.beach_id)).size;
  const filteredBeaches = new Set(forecastsToProcess.map((f: any) => f.beach_id)).size;

  console.log(
    `Filtered to ${filteredBeaches}/${totalBeaches} observable beaches ` +
    `(${forecastsToProcess.length}/${forecasts.length} forecasts)`
  );

  if (!forecastsToProcess.length) {
    return Response.json({
      message: 'No forecasts for observable beaches',
      corrected: 0,
      total_forecasts: forecasts.length,
      observable_beaches: observableBeachIds.size,
    });
  }

  // Parse and prepare for ML service
  const parsed = forecastsToProcess
    .map((f) => ({
      beach_id: f.beach_id,
      forecast_ts: f.forecast_at,
      wave_height_m: parseWaveHeight(f.wave_height),
      wave_period_s: parseFloat(f.wave_period) || 10,
      wave_direction_deg: parseFloat(f.wave_direction) || 270,
      wind_speed_ms: parseWindSpeed(f.wind_speed),
      wind_direction_deg: parseFloat(f.wind_direction) || 270,
    }))
    .filter((f) => f.wave_height_m !== null);

  if (parsed.length === 0) {
    return Response.json({
      message: 'No parseable forecasts',
      corrected: 0,
    });
  }

  console.log(`Sending ${parsed.length} forecasts to ML service`);

  // Process in chunks to avoid overwhelming the ML service
  const ML_BATCH_SIZE = 500;
  const allCorrections: any[] = [];
  let modelVersion = 'unknown';

  for (let i = 0; i < parsed.length; i += ML_BATCH_SIZE) {
    const chunk = parsed.slice(i, i + ML_BATCH_SIZE);
    console.log(`Processing ML batch ${Math.floor(i / ML_BATCH_SIZE) + 1}/${Math.ceil(parsed.length / ML_BATCH_SIZE)} (${chunk.length} forecasts)`);

    let response: Response;
    try {
      response = await fetchWithRetry(`${ML_SERVICE_URL}/correct/batch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Internal-Secret': ML_INTERNAL_SECRET,
        },
        body: JSON.stringify({ forecasts: chunk }),
      });
    } catch (err) {
      console.error(`ML service request failed for batch ${i}:`, err);
      continue; // Skip this batch but continue with others
    }

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`ML service error for batch ${i}:`, errorText);
      continue; // Skip this batch but continue with others
    }

    const { corrections, model_version } = await response.json();
    allCorrections.push(...corrections);
    modelVersion = model_version;
  }

  if (allCorrections.length === 0) {
    return Response.json(
      { error: 'ML service failed to process any forecasts' },
      { status: 502 }
    );
  }

  const corrections = allCorrections;
  console.log(`Received ${corrections.length} total corrections`);

  // Upsert corrected forecasts
  const { error: upsertError } = await supabase.from('corrected_forecasts').upsert(
    corrections.map((c: any) => ({
      beach_id: c.beach_id,
      forecast_ts: c.forecast_ts,
      valid_time_utc: c.forecast_ts,
      raw_height_m: c.raw_height_m,
      corrected_height_m: c.corrected_height_m,
      bias_applied_m: c.bias_applied_m,
      model_version: c.model_version,
    })),
    { onConflict: 'beach_id,forecast_ts' }
  );

  if (upsertError) {
    console.error('Error upserting corrections:', upsertError);
  }

  // Build lookup from parsed input data to enrich log with input features
  const parsedLookup = new Map<string, typeof parsed[0]>();
  for (const p of parsed) {
    parsedLookup.set(`${p.beach_id}:${p.forecast_ts}`, p);
  }

  // Also log for monitoring (includes input features for training data quality
  // and candidate shadow scoring fields for model promotion pipeline)
  const { error: logError } = await supabase.from('ml_predictions_log').upsert(
    corrections.map((c: any) => {
      const input = parsedLookup.get(`${c.beach_id}:${c.forecast_ts}`);
      return {
        beach_id: c.beach_id,
        predicted_at: c.forecast_ts,
        raw_forecast_m: c.raw_height_m,
        corrected_forecast_m: c.corrected_height_m,
        bias_applied_m: c.bias_applied_m,
        model_version: c.model_version,
        // Input features for training data quality (F4 fix)
        wave_period_s: input?.wave_period_s ?? null,
        wind_speed_ms: input?.wind_speed_ms ?? null,
        wind_direction_deg: input?.wind_direction_deg ?? null,
        // Shadow scoring fields for candidate promotion pipeline (F2 fix)
        candidate_corrected_m: c.candidate_corrected_m ?? null,
        candidate_model_version: c.candidate_model_version ?? null,
      };
    }),
    { onConflict: 'beach_id,predicted_at' }
  );

  if (logError) {
    console.error('Error logging predictions:', logError);
  }

  const correctedBeaches = new Set(corrections.map((c: any) => c.beach_id)).size;
  return Response.json({
    corrected: corrections.length,
    beaches: correctedBeaches,
    model_version: modelVersion,
  });
}
