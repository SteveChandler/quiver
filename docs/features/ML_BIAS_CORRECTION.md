# ML Bias Correction Pipeline

> XGBoost-powered wave height forecast correction system for Quiver.

**Status:** Production Ready
**Last Updated:** January 2026

## Overview

The ML Bias Correction Pipeline improves NOAA wave height forecast accuracy by learning systematic prediction errors (bias) from historical observation data and applying corrections in real-time.

**Key Metrics:**
- Model: XGBoost regressor trained on residuals (Observed - Model)
- Correction Cadence: Every 3 hours via Vercel cron
- Backfill Cadence: Every 10 minutes via Supabase pg_cron
- Service URL: `https://quiver-ml.fly.dev`

## Architecture

```
+------------------+     +------------------+     +------------------+
|   NOAA Forecast  | --> | Vercel Cron Job  | --> |  Fly.io ML API   |
| enhanced_forecasts|    | correct-forecasts|    |  quiver-ml       |
+------------------+     +------------------+     +------------------+
         |                       |                       |
         |                       |                       |
         v                       v                       v
+------------------+     +------------------+     +------------------+
| Parse Wave Height| --> | Batch Correction | --> | Store Corrected  |
| parse-wave-height|     | POST /correct/   |     | corrected_       |
|                  |     |      batch       |     | forecasts        |
+------------------+     +------------------+     +------------------+
                                                         |
                                                         v
+------------------+     +------------------+     +------------------+
| Buoy Observations| --> | pg_cron Backfill | --> | ml_predictions_  |
| marine_forecasts |     | backfill_ml_     |     |      log         |
|                  |     | observations     |     | (ground truth)   |
+------------------+     +------------------+     +------------------+
```

## Data Requirements

Effective ML model training requires sufficient historical data to capture diverse weather patterns.

### Training Data Retention Policy

As of January 2026, forecast data retention was extended to support proper model training:

| Table | Retention | Notes |
|-------|-----------|-------|
| `marine_forecasts` | 90 days | Buoy observations for training |
| `tide_forecasts` | 90 days | Aligned with marine data |
| `enhanced_forecasts` | 14 days | User-facing forecasts (unchanged) |

### Minimum Training Requirements

| Requirement | Minimum | Target | Rationale |
|-------------|---------|--------|-----------|
| **Time span** | 60 days | 90+ days | Seasonal variation |
| **Sample count** | 10,000 | 30,000+ | Statistical significance |
| **Weather diversity** | Multiple patterns | All seasons | Prevents overfitting |
| **Beach coverage** | 50+ beaches | 96 beaches | Geographic generalization |

### Why Extended Retention?

The v1 model was trained on only 8 days of data (2,275 samples) during an unusual weather period. This caused:

1. **Biased predictions**: Model learned patterns from one weather system
2. **Poor generalization**: Couldn't predict well when conditions changed
3. **Overfitting**: Memorized specific conditions vs. learning general bias

With 90-day retention, we expect 30,000+ samples by mid-April 2026, covering diverse conditions.

### Storage Impact

| Metric | Value |
|--------|-------|
| Current DB size | ~535 MB |
| 90-day forecast estimate | ~1.2 GB |
| Supabase Pro limit | 8 GB |
| Available headroom | ~6.3 GB |

### Monitoring Training Data

```sql
-- Check training data availability
SELECT
  source,
  COUNT(*) as total_samples,
  MIN(ts) as earliest,
  MAX(ts) as latest,
  EXTRACT(EPOCH FROM (MAX(ts) - MIN(ts))) / 86400 as days_span
FROM marine_forecasts
WHERE is_observed = true
  AND wave_height_m IS NOT NULL
GROUP BY source;
```

## Database Schema

### `ml_predictions_log`

Stores all ML predictions for monitoring and ground truth matching.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `beach_id` | UUID | FK to beaches |
| `predicted_at` | TIMESTAMPTZ | Forecast timestamp |
| `raw_forecast_m` | NUMERIC(4,2) | Original NOAA height (m) |
| `corrected_forecast_m` | NUMERIC(4,2) | ML-corrected height (m) |
| `bias_applied_m` | NUMERIC(4,2) | Correction amount |
| `model_version` | TEXT | e.g., "v1" |
| `observed_m` | NUMERIC(4,2) | Ground truth (backfilled) |
| `raw_error_m` | NUMERIC(4,2) | \|raw - observed\| |
| `corrected_error_m` | NUMERIC(4,2) | \|corrected - observed\| |

**Migration:** `supabase/migrations/20260113200100_create_ml_predictions_log.sql`

### `corrected_forecasts`

Stores latest corrected forecasts for fast app reads.

| Column | Type | Description |
|--------|------|-------------|
| `beach_id` | UUID | FK to beaches |
| `forecast_ts` | TIMESTAMPTZ | Forecast timestamp |
| `raw_height_m` | NUMERIC(4,2) | Original NOAA height |
| `corrected_height_m` | NUMERIC(4,2) | ML-corrected height |
| `bias_applied_m` | NUMERIC(4,2) | Correction applied |
| `model_version` | TEXT | Model version |

**Migration:** `supabase/migrations/20260113200200_create_corrected_forecasts.sql`

### Database Functions

#### `backfill_ml_observations(batch_size INT)`

Processes ML predictions and matches them with ground truth observations. Called by pg_cron every 10 minutes.

```sql
SELECT * FROM backfill_ml_observations(1000);

-- Returns:
-- processed | matched | no_match | elapsed_ms
-- ----------+---------+----------+-----------
--      1000 |     847 |      153 |       1234
```

#### `get_ml_health_metrics()`

Returns ML pipeline health for monitoring and alerting.

```sql
SELECT * FROM get_ml_health_metrics();

-- Returns:
-- pending_count | matched_last_24h | total_last_24h | match_rate_24h | current_model_version | needs_alert
-- --------------+------------------+----------------+----------------+-----------------------+------------
--          1234 |             2847 |           3456 |          82.37 | v1                    | false
```

#### `get_ml_weekly_metrics()`

PostgreSQL function for monitoring model performance.

```sql
SELECT * FROM get_ml_weekly_metrics();
-- Returns: model_version, predictions, with_ground_truth,
--          avg_raw_error_m, avg_corrected_error_m, pct_improved
```

**Migration:** `supabase/migrations/20260113200300_create_ml_metrics_function.sql`

## Integration Points

### TypeScript Parsers

**Location:** `lib/ml/parse-wave-height.ts`

```typescript
import { parseWaveHeight, parseWindSpeed } from '@/lib/ml/parse-wave-height';

// "3-4ft" -> 1.07m (midpoint converted to meters)
const heightM = parseWaveHeight('3-4ft');

// "10 mph" -> 4.47 m/s
const windMS = parseWindSpeed('10 mph');
```

**Formats Supported:**
- Range: `"3-4ft"`, `"3 to 4 ft"`, `"3-4 ft plus"`
- Single: `"3ft"`, `"3 ft"`
- Flat: `"Flat"`, `"flat"` (returns 0.15m)
- Wind: mph, knots, m/s

### Scheduled Jobs

#### Correction Job (Vercel Cron)

**File:** `app/api/cron/ml/correct-forecasts/route.ts`
- Schedule: Every 3 hours (`0 */3 * * *`)
- Timeout: 60 seconds (cold start + processing)
- Processes up to 500 forecasts per run

#### Backfill Job (Supabase pg_cron)

**Function:** `backfill_ml_observations(batch_size INT)`
- Schedule: Every 10 minutes (`*/10 * * * *`)
- Batch size: 1000 predictions per run
- Matches predictions with observations from `marine_forecasts`
- Runs directly in PostgreSQL for improved reliability

**pg_cron Configuration:**

| Job Name | Schedule | Command |
|----------|----------|---------|
| `ml-backfill-observations` | `*/10 * * * *` | `SELECT * FROM backfill_ml_observations(1000)` |

**Monitor job execution:**
```sql
SELECT jobname, start_time, end_time, status, return_message
FROM cron.job_run_details
WHERE jobname = 'ml-backfill-observations'
ORDER BY start_time DESC
LIMIT 10;
```

### ML Service API

**Base URL:** `https://quiver-ml.fly.dev`

**Authentication:** `X-Internal-Secret` header required for `/correct` endpoints.

**Endpoints:**

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | None | Health check (wake-up) |
| POST | `/correct` | Required | Single forecast correction |
| POST | `/correct/batch` | Required | Batch correction (max 1000) |

## Configuration

### Environment Variables

**Vercel (Cron Jobs):**
```env
ML_SERVICE_URL=https://quiver-ml.fly.dev
ML_INTERNAL_SECRET=<shared-secret>
CRON_SECRET=<vercel-cron-secret>
```

**Fly.io (ML Service):**
```env
MODEL_PATH=models/bias_model_v1.json
MODEL_VERSION=v1
INTERNAL_SECRET=<shared-secret>
```

### Vercel Cron Configuration

**File:** `vercel.json`

```json
{
  "crons": [
    {
      "path": "/api/cron/ml/correct-forecasts",
      "schedule": "0 */3 * * *"
    }
  ]
}
```

Note: The backfill job has been migrated from Vercel cron to Supabase pg_cron for improved reliability.

## Testing

### Unit Tests

**Location:** `__tests__/lib/ml/parse-wave-height.test.ts`

```bash
yarn test __tests__/lib/ml/parse-wave-height.test.ts
```

**Coverage:**
- Range parsing: `"3-4ft"` -> 1.07m
- Single value: `"3ft"` -> 0.91m
- Flat handling: `"Flat"` -> 0.15m
- Wind parsing: mph, knots, null handling

### ML Service Local Testing

```bash
cd ml

# Install dependencies
pip install -r requirements.txt

# Run locally
uvicorn api:app --reload --port 8080

# Test health
curl http://localhost:8080/health

# Test correction (requires INTERNAL_SECRET)
curl -X POST http://localhost:8080/correct/batch \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: your-secret" \
  -d '{"forecasts": [{"beach_id": "test", "forecast_ts": "2026-01-14T12:00:00Z", "wave_height_m": 1.5, "wave_period_s": 10, "wave_direction_deg": 270}]}'
```

### Monitoring Queries

```sql
-- Pipeline health check
SELECT * FROM get_ml_health_metrics();

-- Recent prediction stats
SELECT * FROM get_ml_weekly_metrics();

-- Pending backfills
SELECT COUNT(*) FROM ml_predictions_log WHERE observed_m IS NULL;

-- pg_cron job status
SELECT jobname, start_time, status, return_message
FROM cron.job_run_details
WHERE jobname = 'ml-backfill-observations'
ORDER BY start_time DESC
LIMIT 5;

-- Latest corrections
SELECT beach_id, corrected_height_m, raw_height_m, bias_applied_m
FROM corrected_forecasts
ORDER BY corrected_at DESC
LIMIT 10;
```

## Deployment

### Fly.io Deployment

```bash
cd ml

# Deploy (uses fly.toml config)
fly deploy

# View logs
fly logs

# Check status
fly status
```

### Deployment Checklist

- [ ] `INTERNAL_SECRET` set in Fly.io secrets and Vercel env vars
- [ ] Model file exists at `ml/models/bias_model_v1.json`
- [ ] Database migrations applied
- [ ] Vercel cron configured for `correct-forecasts`
- [ ] pg_cron job registered for `ml-backfill-observations`
- [ ] Health endpoint accessible: `https://quiver-ml.fly.dev/health`
- [ ] Sufficient training data (90+ days) before retraining

## Operational Notes

### Cold Start Handling

The ML service uses Fly.io's auto-stop/start feature (`min_machines_running = 0`). The cron job handles cold starts by:

1. Pinging `/health` endpoint first (15s timeout)
2. Retrying wake-up if initial ping fails
3. Using exponential backoff for correction requests

### Batch Processing

- Max batch size: 1000 forecasts
- Typical batch: 500 forecasts (24h lookahead)
- Processing time: ~5-10 seconds per batch

### Error Recovery

If corrections fail:
- Forecasts remain uncorrected (raw values still available)
- Next cron run will attempt correction again
- No data loss; graceful degradation

### Manual Backfill

If you need to manually run backfill (e.g., to clear a backlog):

```sql
-- Run a single batch
SELECT * FROM backfill_ml_observations(1000);

-- Run larger batch to clear backlog faster
SELECT * FROM backfill_ml_observations(5000);

-- Check remaining backlog
SELECT COUNT(*) as pending
FROM ml_predictions_log
WHERE observed_m IS NULL
  AND predicted_at < NOW() - INTERVAL '2 hours';
```

## Related Documentation

- [ML Service Architecture](/ml/ARCHITECTURE.md)
- [ML README](/ml/README.md) - Training data requirements
- [ML Operations Runbook](/docs/guides/ML_OPERATIONS_RUNBOOK.md)
- [TypeScript ML Module](/lib/ml/ARCHITECTURE.md)
- [Cron Jobs Architecture](/app/api/cron/ml/ARCHITECTURE.md)
- [Database Schema](/docs/architecture/DATABASE_SCHEMA.md) - Retention policies
- [Forecast Architecture](/docs/architecture/FORECAST_SCORING.md)
- [Postmortem: ML Model Regression](/docs/postmortems/2026-01-20-ml-model-regression.md)

---

**Last Updated:** January 2026
