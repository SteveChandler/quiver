import { createClient } from '@supabase/supabase-js';
import { fetchWithRetry, wakeUpService } from '@/lib/ml/ml-service-client';

// Allow up to 120 seconds for HRRR data fetch + processing
export const maxDuration = 120;

/** Single wind extraction result from the ML service */
interface HRRRWindResult {
  beach_id: string;
  wind_speed_ms: number;
  wind_direction_deg: number;
  wind_gust_ms: number | null;
  forecast_hour: number;
  model_run: string;
  valid_time: string;
}

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
  console.log('[HRRR] Waking up ML service...');
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
  console.log('[HRRR] ML service is awake');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // Fetch all beaches with coordinates
  const { data: beaches, error: beachError } = await supabase
    .from('beaches')
    .select('id, center_lat, center_lng')
    .not('center_lat', 'is', null)
    .not('center_lng', 'is', null);

  if (beachError) {
    console.error('[HRRR] Error fetching beaches:', beachError);
    return Response.json({ error: beachError.message }, { status: 500 });
  }

  if (!beaches?.length) {
    return Response.json({ message: 'No beaches found', extracted: 0 });
  }

  // Filter to beaches within HRRR CONUS coverage (lat 32-49, lon -126 to -117).
  // Intentionally restricted to the US West Coast (CA, OR, WA, northern Baja)
  // matching the BBOX in ml/hrrr_wind_service.py. To expand to full CONUS,
  // update both this filter and the Python BBOX.
  // center_lng is the DB column name (legacy); lon is used for local variable
  // naming per coordinate conventions.
  const conusBeaches = beaches.filter((b) => {
    const lat = b.center_lat;
    const lon = b.center_lng;
    return lat >= 32 && lat <= 49 && lon >= -126 && lon <= -117;
  });

  console.log(
    `[HRRR] ${conusBeaches.length}/${beaches.length} beaches in HRRR coverage`
  );

  if (!conusBeaches.length) {
    return Response.json({ message: 'No CONUS beaches for HRRR', extracted: 0 });
  }

  // Request HRRR wind extraction from ML service.
  // Forecast hours 1-6 covers the most critical near-term period.
  const beachCoords = conusBeaches.map((b) => ({
    id: b.id,
    lat: b.center_lat,
    lon: b.center_lng,
  }));

  let response: Response;
  try {
    response = await fetchWithRetry(`${ML_SERVICE_URL}/extract-hrrr-wind`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Secret': ML_INTERNAL_SECRET,
      },
      body: JSON.stringify({
        beaches: beachCoords,
        forecast_hours: [1, 2, 3, 4, 5, 6],
      }),
      signal: AbortSignal.timeout(90000), // 90s timeout for HRRR download + extraction
    });
  } catch (err) {
    console.error('[HRRR] ML service request failed:', err);
    return Response.json(
      { error: 'HRRR extraction request failed' },
      { status: 502 }
    );
  }

  if (!response.ok) {
    const errorText = await response.text();
    console.error('[HRRR] ML service error:', errorText);
    return Response.json(
      { error: `ML service returned ${response.status}` },
      { status: 502 }
    );
  }

  const { results, count } = await response.json();
  console.log(`[HRRR] Received ${count} wind extractions`);

  if (!results?.length) {
    return Response.json({ message: 'No HRRR data available', extracted: 0 });
  }

  // Update all enhanced_forecasts rows with HRRR wind data.
  // HRRR is the highest-priority wind source and overwrites any existing wind values
  // regardless of data_source. wind_source='HRRR' is stamped so lower-priority sources
  // (NWS, OPEN_METEO_WIND) won't overwrite it later.
  //
  // wind_speed is stored as text (e.g. "5 mph") matching the NWS format that
  // parseWindSpeed() in correct-forecasts/route.ts expects.
  // wind_direction is stored as a numeric string in degrees, parsed with parseFloat().
  let updated = 0;
  let errors = 0;
  const PARALLEL_BATCH = 20;

  for (let i = 0; i < results.length; i += PARALLEL_BATCH) {
    const batch = results.slice(i, i + PARALLEL_BATCH);

    const promises = batch.map(async (r: HRRRWindResult) => {
      // Round valid_time to the nearest hour for matching against forecast_at
      const validDate = new Date(r.valid_time);
      validDate.setMinutes(0, 0, 0);
      const hourStart = validDate.toISOString();
      const hourEnd = new Date(validDate.getTime() + 3600000).toISOString();

      // Convert m/s to mph to match existing NWS text format
      const windSpeedMph = Math.round(r.wind_speed_ms * 2.237);
      const windDirectionDeg = Math.round(r.wind_direction_deg);

      const { data, error } = await supabase
        .from('enhanced_forecasts')
        .update({
          wind_speed: `${windSpeedMph} mph`,
          wind_direction: String(windDirectionDeg),
          wind_direction_deg: windDirectionDeg,
          wind_source: 'HRRR',
        })
        .eq('beach_id', r.beach_id)
        .gte('forecast_at', hourStart)
        .lt('forecast_at', hourEnd)
        .select('id');

      return { data, error, beach_id: r.beach_id };
    });

    const batchResults = await Promise.all(promises);
    for (const br of batchResults) {
      if (br.error) {
        errors++;
        if (errors <= 5) {
          console.error(
            `[HRRR] Update error for beach ${br.beach_id}:`,
            br.error.message
          );
        }
      } else {
        updated += br.data?.length ?? 0;
      }
    }
  }

  console.log(`[HRRR] Updated ${updated} forecast rows, ${errors} errors`);

  return Response.json({
    extracted: count,
    updated,
    errors,
    beaches_in_coverage: conusBeaches.length,
  });
}
