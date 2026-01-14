# ML Bias Correction Pipeline

> XGBoost-powered wave height forecast correction system for Quiver.

**Status:** Production Ready
**Last Updated:** January 2026

## Overview

The ML Bias Correction Pipeline improves NOAA wave height forecast accuracy by learning systematic prediction errors (bias) from historical observation data and applying corrections in real-time.

**Key Metrics:**
- Model: XGBoost regressor trained on residuals (Observed - Model)
- Correction Cadence: Every 3 hours via Vercel cron
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
                         +------------------+
                         | Backfill Ground  |
                         | Truth Hourly     |
                         | ml_predictions_  |
                         |      log         |
                         +------------------+
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

### `get_ml_weekly_metrics()`

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

### Cron Jobs

**Correction Job:** `app/api/cron/ml/correct-forecasts/route.ts`
- Schedule: Every 3 hours (`0 */3 * * *`)
- Timeout: 60 seconds (cold start + processing)
- Processes up to 500 forecasts per run

**Backfill Job:** `app/api/cron/ml/backfill-observations/route.ts`
- Schedule: Every hour at :30 (`30 * * * *`)
- Matches predictions with ground truth from `marine_forecasts`
- 2-hour delay ensures observations are available

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
    },
    {
      "path": "/api/cron/ml/backfill-observations",
      "schedule": "30 * * * *"
    }
  ]
}
```

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
-- Recent prediction stats
SELECT * FROM get_ml_weekly_metrics();

-- Pending backfills
SELECT COUNT(*) FROM ml_predictions_log WHERE observed_m IS NULL;

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
- [ ] Database migrations applied (3 migration files)
- [ ] Cron jobs configured in `vercel.json`
- [ ] Health endpoint accessible: `https://quiver-ml.fly.dev/health`

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

## Related Documentation

- [ML Service Architecture](/ml/ARCHITECTURE.md)
- [TypeScript ML Module](/lib/ml/ARCHITECTURE.md)
- [Cron Jobs Architecture](/app/api/cron/ml/ARCHITECTURE.md)
- [Forecast Architecture](/docs/architecture/FORECAST_SCORING.md)

---

**Last Updated:** January 2026
