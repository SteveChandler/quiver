# ML Cron Jobs Architecture

> Vercel cron jobs for ML bias correction, ground truth backfill, and automated retraining.

**Location:** `app/api/cron/ml/`
**Last Updated:** February 2026

## Overview

Three cron jobs power the ML bias correction pipeline:

1. **correct-forecasts**: Runs every 3 hours, processes uncorrected NOAA forecasts
2. **backfill-observations**: Runs hourly, matches predictions with ground truth
3. **retrain**: Runs weekly (Sundays 6am UTC), retrains v3 model with terrain factors

## Directory Structure

```
app/api/cron/ml/
+-- correct-forecasts/
|   +-- route.ts         # Batch correction job
+-- backfill-observations/
|   +-- route.ts         # Ground truth matching job
+-- retrain/
|   +-- route.ts         # Weekly model retraining job
+-- ARCHITECTURE.md      # This file
```

## Job Configurations

### Vercel Cron Schedule

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/ml/correct-forecasts",
      "schedule": "0 */3 * * *"
    },
    {
      "path": "/api/cron/ml/backfill-observations",
      "schedule": "30 * * * *"
    }
  ]
}
```

| Job | Schedule | Frequency | Description |
|-----|----------|-----------|-------------|
| correct-forecasts | `0 */3 * * *` | Every 3 hours at :00 | Process new forecasts |
| backfill-observations | `30 * * * *` | Every hour at :30 | Match with ground truth |
| retrain | `0 6 * * 0` | Sundays 6am UTC | Retrain v3 model with terrain factors |

## correct-forecasts

**File:** `correct-forecasts/route.ts`

### Purpose

Fetches uncorrected NOAA forecasts from `enhanced_forecasts`, sends them to the ML service for bias correction, and stores results in `corrected_forecasts` and `ml_predictions_log`.

### Flow

```
1. Verify CRON_SECRET header
2. Wake up ML service (cold start handling)
3. Query enhanced_forecasts (next 24h, NOAA_NWS source)
4. Parse wave/wind text to numeric values
5. POST to /correct/batch on ML service
6. Upsert corrections to corrected_forecasts
7. Insert predictions to ml_predictions_log
```

### Configuration

```typescript
export const maxDuration = 60;  // 60 second timeout

const ML_SERVICE_URL = process.env.ML_SERVICE_URL!;
const ML_INTERNAL_SECRET = process.env.ML_INTERNAL_SECRET!;
```

### Cold Start Handling

The ML service on Fly.io may be stopped (`min_machines_running = 0`). The job handles this:

```typescript
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

// In route handler:
const isAwake = await wakeUpService();
if (!isAwake) {
  // Retry wake-up once after 2s delay
  await new Promise((resolve) => setTimeout(resolve, 2000));
  const retryAwake = await wakeUpService();
  if (!retryAwake) {
    return Response.json(
      { error: 'ML service unavailable after wake-up attempts' },
      { status: 503 }
    );
  }
}
```

### Retry Logic

ML service calls use exponential backoff:

```typescript
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
```

### Forecast Selection

```typescript
const { data: forecasts, error } = await supabase
  .from('enhanced_forecasts')
  .select(
    'beach_id, forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_speed, wind_direction'
  )
  .eq('data_source', 'NOAA_NWS')
  .gte('forecast_date', today)
  .limit(500);
```

### Response

```json
{
  "corrected": 487,
  "model_version": "v1"
}
```

## backfill-observations

**File:** `backfill-observations/route.ts`

### Purpose

Matches ML predictions with actual observations to calculate forecast errors, enabling model performance monitoring.

### Flow

```
1. Verify CRON_SECRET header
2. Query ml_predictions_log where observed_m IS NULL and older than 2 hours
3. For each prediction, find nearest observation (within 1 hour window)
4. Calculate raw_error_m and corrected_error_m
5. Update ml_predictions_log with ground truth
```

### Configuration

```typescript
export const maxDuration = 30;  // 30 second timeout
```

### Observation Matching

```typescript
// Find predictions without ground truth (older than 2 hours)
const cutoff = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

const { data: pending } = await supabase
  .from('ml_predictions_log')
  .select('id, beach_id, predicted_at, raw_forecast_m, corrected_forecast_m')
  .is('observed_m', null)
  .lt('predicted_at', cutoff)
  .limit(200);

// For each prediction, find nearest observation
const windowStart = new Date(predTime.getTime() - 3600000).toISOString(); // -1 hour
const windowEnd = new Date(predTime.getTime() + 3600000).toISOString();   // +1 hour

const { data: obs } = await supabase
  .from('marine_forecasts')
  .select('wave_height_m, ts')
  .eq('beach_id', pred.beach_id)
  .eq('is_observed', true)
  .gte('ts', windowStart)
  .lte('ts', windowEnd)
  .order('ts', { ascending: true })
  .limit(1)
  .single();
```

### Error Calculation

```typescript
if (obs?.wave_height_m) {
  const rawError = Math.abs(pred.raw_forecast_m - obs.wave_height_m);
  const correctedError = Math.abs(pred.corrected_forecast_m - obs.wave_height_m);

  await supabase
    .from('ml_predictions_log')
    .update({
      observed_m: obs.wave_height_m,
      raw_error_m: rawError,
      corrected_error_m: correctedError,
    })
    .eq('id', pred.id);
}
```

### Response

```json
{
  "updated": 45,
  "total_pending": 200
}
```

## retrain

**File:** `retrain/route.ts`

### Purpose

Orchestrates weekly model retraining with terrain-aware features (v3 pipeline). Extracts training data, sends to ML service, validates results, and deploys to Fly.io.

### Flow

```
1. Verify CRON_SECRET header
2. Calculate training data cutoff (90 days, floored at SHOALING_CHANGE_DATE)
3. Extract training data from ml_predictions_log (max 50K samples)
4. Fetch terrain factors (swell_access_factors, wind_exposure_factors) per beach
5. Create ml_model_registry entry with status='training'
6. POST training data to ML service /train endpoint
7. ML service runs validation gates on holdout set (2-day holdout)
8. If PASS: Upload model to Supabase Storage, deploy to Fly.io
9. If FAIL: Log failure, keep current model
10. Update registry with final status and metrics
```

### Configuration

```typescript
export const maxDuration = 300;  // 5 minute timeout for full pipeline

// Training constraints (2GB Fly.io instance)
const MAX_TRAINING_SAMPLES = 50000;
const maxDaysBack = 90;

// Post-shoaling data floor (see below)
const SHOALING_CHANGE_DATE = new Date('2026-02-05T06:00:00Z');
```

### Post-Shoaling Data Floor

The retrain route enforces a hard floor on the training data cutoff date to exclude data collected before the `BASE_SHOALING` constant was reduced from 1.6 to 1.0 (commit `0317b83`, Feb 4 2026). Pre-shoaling data has a systematically different bias profile because the wave height transformation pipeline produced different values, which makes it incompatible with post-shoaling ground truth.

```typescript
// Enforce shoaling change date floor
if (cutoffDate < SHOALING_CHANGE_DATE) {
  cutoffDate.setTime(SHOALING_CHANGE_DATE.getTime());
  console.log(`[ML Retrain] Cutoff raised to shoaling change date: ${cutoffDate.toISOString()}`);
}
```

The floor is applied as `max(now - 90d, SHOALING_CHANGE_DATE)`. It will become inert naturally after May 2026 when the 90-day window no longer reaches back to Feb 5. Post-shoaling data has 106K+ matched samples as of Feb 2026, well above the 5K minimum required for training.

### Terrain Factors Integration

The v3 model incorporates beach-specific terrain factors:

```typescript
// 72 directional bins (5-degree resolution)
interface TerrainFactors {
  swell_access_factors: number[] | null;   // Swell wrap/access per direction
  wind_exposure_factors: number[] | null;  // Wind shelter per direction
}

// Joined from beaches table during data extraction
const trainingPayload = {
  version: modelVersion,
  training_data: mappedData,  // Includes terrain factors per sample
  config: {
    recency_weight_half_life_days: 14,
    holdout_days: 2,
    max_bias_pct: 0.75,
    bias_floor_m: 0.5,
  },
};
```

### Validation Gates

Model must pass these thresholds before deployment:

| Gate | Threshold | Description |
|------|-----------|-------------|
| Holdout improvement | >0% | Corrected MAE must be better than raw |
| Sample count | >=1000 | Minimum training samples required |
| Max bias | <=75% | Maximum correction as percentage of raw |
| Bias floor | >=0.5m | Minimum correction magnitude |

### Deployment Process

```
1. Download/decode model artifact from ML service (prefers inline base64)
2. Upload to Supabase Storage (ml-artifacts bucket)
3. Set Fly.io secrets (MODEL_VERSION, MODEL_PATH) via GraphQL API
4. Secrets trigger automatic rolling redeployment
5. Poll /health endpoint until new version confirmed (90s timeout)
```

### Response

**Success:**
```json
{
  "message": "Model retrain and deployment successful",
  "model_version": "v3.20260202.0600",
  "status": "deployed",
  "training_samples": 45000,
  "training_window_days": 87,
  "metrics": {
    "holdout_improvement_pct": 12.5,
    "holdout_raw_mae": 0.45,
    "holdout_corrected_mae": 0.39
  }
}
```

**Validation Failure:**
```json
{
  "message": "Model training failed validation gates",
  "model_version": "v3.20260202.0600",
  "status": "failed",
  "reason": "Holdout improvement below threshold"
}
```

### Database Dependencies

| Table | Operation | Columns Used |
|-------|-----------|--------------|
| `ml_predictions_log` | SELECT | beach_id, predicted_at, raw_forecast_m, observed_m, wave_period_s, wave_direction_deg, wind_speed_ms, wind_direction_deg |
| `beaches` | SELECT | id, swell_access_factors, wind_exposure_factors |
| `ml_model_registry` | INSERT/UPDATE | version, training_window_days, training_samples, status, holdout_improvement_pct, holdout_raw_mae, holdout_corrected_mae, notes |

---

## Authentication

All jobs require the Vercel cron secret:

```typescript
const authHeader = request.headers.get('authorization');
if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
  return Response.json({ error: 'Unauthorized' }, { status: 401 });
}
```

## Environment Variables

| Variable | Used By | Description |
|----------|---------|-------------|
| `CRON_SECRET` | All | Vercel cron authentication |
| `ML_SERVICE_URL` | correct-forecasts, retrain | ML service base URL |
| `ML_INTERNAL_SECRET` | correct-forecasts, retrain | ML service API key |
| `NEXT_PUBLIC_SUPABASE_URL` | All | Supabase project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | All | Supabase admin access |
| `FLY_API_TOKEN` | retrain | Fly.io API token for deployment |
| `FLY_APP_NAME` | retrain | Fly.io app name (default: quiver-ml) |

## Database Dependencies

### Tables Read

| Table | Job | Columns Used |
|-------|-----|--------------|
| `enhanced_forecasts` | correct-forecasts | beach_id, forecast_date, forecast_time, wave_height, wave_period, wave_direction, wind_speed, wind_direction |
| `ml_predictions_log` | backfill-observations | id, beach_id, predicted_at, raw_forecast_m, corrected_forecast_m |
| `marine_forecasts` | backfill-observations | wave_height_m, ts, is_observed |

### Tables Written

| Table | Job | Operation |
|-------|-----|-----------|
| `corrected_forecasts` | correct-forecasts | UPSERT |
| `ml_predictions_log` | correct-forecasts | INSERT |
| `ml_predictions_log` | backfill-observations | UPDATE |

## Error Handling

### correct-forecasts

| Error | Response | Recovery |
|-------|----------|----------|
| Missing env vars | 500 | Check Vercel config |
| ML service unavailable | 503 | Retry next cron run |
| ML service error | 502 | Logged, retry next run |
| DB upsert error | 200 (partial) | Logged, corrections still stored |
| No forecasts to process | 200 | Normal operation |

### backfill-observations

| Error | Response | Recovery |
|-------|----------|----------|
| DB fetch error | 500 | Retry next cron run |
| No pending predictions | 200 | Normal operation |
| Update error | Skipped | Individual record skipped |

## Monitoring

### Check Correction Status

```sql
-- Recent corrections
SELECT COUNT(*), model_version
FROM corrected_forecasts
WHERE corrected_at > now() - interval '3 hours'
GROUP BY model_version;

-- Latest correction timestamp
SELECT MAX(corrected_at) FROM corrected_forecasts;
```

### Check Backfill Status

```sql
-- Pending backfills
SELECT COUNT(*) FROM ml_predictions_log WHERE observed_m IS NULL;

-- Recent backfills
SELECT COUNT(*)
FROM ml_predictions_log
WHERE observed_m IS NOT NULL
  AND created_at > now() - interval '1 hour';

-- Model performance
SELECT * FROM get_ml_weekly_metrics();
```

### Vercel Logs

View cron execution logs in Vercel dashboard:
- Project -> Logs -> Filter by `/api/cron/ml`

## Testing

### Manual Trigger (Local)

```bash
# correct-forecasts
curl -X GET "http://localhost:3000/api/cron/ml/correct-forecasts" \
  -H "Authorization: Bearer $CRON_SECRET"

# backfill-observations
curl -X GET "http://localhost:3000/api/cron/ml/backfill-observations" \
  -H "Authorization: Bearer $CRON_SECRET"
```

### Manual Trigger (Production)

Use Vercel CLI or dashboard to manually trigger cron jobs:

```bash
vercel cron trigger /api/cron/ml/correct-forecasts
```

## Operational Notes

### Timing Considerations

- **correct-forecasts** runs every 3 hours to balance freshness vs. API load
- **backfill-observations** runs hourly with 2-hour delay to ensure observations are available
- Both jobs are designed to be idempotent (safe to re-run)

### Performance Limits

| Job | Timeout | Batch Size | Typical Duration |
|-----|---------|------------|------------------|
| correct-forecasts | 60s | 500 forecasts | 10-20s |
| backfill-observations | 30s | 200 predictions | 5-15s |
| retrain | 300s | 50K samples max | 2-4 min |

### Scaling

If more forecasts need processing:
1. Increase `limit` in correct-forecasts query
2. Consider sharding by beach_id (similar to enhanced-forecast-sync)
3. Monitor Vercel function duration limits

## Related Documentation

- [ML Bias Correction Feature](/docs/features/ML_BIAS_CORRECTION.md)
- [Python ML Service](/ml/ARCHITECTURE.md)
- [TypeScript ML Module](/lib/ml/ARCHITECTURE.md)
- [Vercel Cron Documentation](https://vercel.com/docs/cron-jobs)

---

**Last Updated:** February 2026
