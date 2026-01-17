import { createClient } from '@supabase/supabase-js';
import { parseWaveHeight, parseWindSpeed } from '@/lib/ml/parse-wave-height';

// Allow up to 120 seconds for cold start + processing all beaches
export const maxDuration = 120;

const ML_SERVICE_URL = process.env.ML_SERVICE_URL!;
const ML_INTERNAL_SECRET = process.env.ML_INTERNAL_SECRET!;

// ----- Helper: Retry with backoff -----
async function fetchWithRetry(
  url: string,
  options: RequestInit,
  maxRetries = 3
): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok || response.status < 500) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}`);
    } catch (err) {
      lastError = err as Error;
    }

    // Exponential backoff: 1s, 2s, 4s
    if (attempt < maxRetries - 1) {
      await new Promise((resolve) =>
        setTimeout(resolve, 1000 * Math.pow(2, attempt))
      );
    }
  }

  throw lastError;
}

// ----- Helper: Wake up the service -----
async function wakeUpService(): Promise<boolean> {
  try {
    const response = await fetch(`${ML_SERVICE_URL}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(15000), // 15s timeout for cold start
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function GET(request: Request) {
  // Verify cron secret
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check required env vars
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
    const { data: batch, error } = await supabase
      .from('enhanced_forecasts')
      .select(
        'beach_id, forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_speed, wind_direction'
      )
      .eq('data_source', 'NOAA_NWS')
      .gte('forecast_date', today)
      .order('beach_id')
      .order('forecast_date')
      .order('forecast_time')
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
      forecast_ts: `${f.forecast_date}T${f.forecast_time}`,
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

  // Also log for monitoring
  const { error: logError } = await supabase.from('ml_predictions_log').insert(
    corrections.map((c: any) => ({
      beach_id: c.beach_id,
      predicted_at: c.forecast_ts,
      raw_forecast_m: c.raw_height_m,
      corrected_forecast_m: c.corrected_height_m,
      bias_applied_m: c.bias_applied_m,
      model_version: c.model_version,
    }))
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
