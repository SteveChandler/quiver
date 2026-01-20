# Quiver ML Bias Correction System

This directory contains the ML pipeline for correcting wave height forecasts. The system uses XGBoost to learn systematic biases in NOAA NWS forecasts by comparing them against actual buoy observations (CDIP/NDBC) and ERA5 reanalysis data.

## Table of Contents

- [Pipeline Overview](#pipeline-overview)
- [Architecture](#architecture)
- [Data Requirements](#data-requirements)
- [Model Training](#model-training)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Validation and Monitoring](#validation-and-monitoring)
- [Troubleshooting](#troubleshooting)

---

## Pipeline Overview

```
+------------------+     +------------------+     +------------------+
|  Data Sources    |     |   Training       |     |   Inference      |
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| NOAA NWS         |---->| augment_training |     | Cron Job         |
| (forecasts)      |     | _data.py         |     | (Next.js)        |
|                  |     |                  |     |       |          |
| CDIP/NDBC Buoys  |---->| train_augmented  |     |       v          |
| (observations)   |     | .py              |     | ML Service       |
|                  |     |       |          |     | (Fly.io)         |
| ERA5 Reanalysis  |---->|       v          |     |       |          |
| (pseudo-obs)     |     | XGBoost Model    |---->| /correct/batch   |
|                  |     | (.json)          |     |       |          |
| Open-Meteo       |     +------------------+     |       v          |
| (ensemble)       |------------------------>     | corrected_       |
+------------------+                              | forecasts table  |
                                                  +------------------+
                                                          |
                                                          v
                                                  +------------------+
                                                  | pg_cron Backfill |
                                                  | backfill_ml_     |
                                                  | observations()   |
                                                  +------------------+
```

### Data Flow

1. **Training Phase**: Historical NOAA forecasts are matched with buoy observations and ERA5 reanalysis data to create training pairs
2. **Model Training**: XGBoost learns the residual (observed - forecast) to predict systematic bias
3. **Inference Phase**: Cron job fetches current NOAA forecasts and sends them to the ML service
4. **Correction**: The model predicts the bias and applies it: `corrected = forecast + predicted_bias`
5. **Storage**: Corrected forecasts are stored in `corrected_forecasts` table for the application to use
6. **Validation**: pg_cron job matches predictions with ground truth observations for monitoring

---

## Architecture

### Models

| Model | File | Features | Use Case |
|-------|------|----------|----------|
| **Primary** | `models/bias_model_v1.json` | NOAA-only (14 features) | Default model |
| **Fallback** | `models/bias_model_v1.json` | NOAA-only (14 features) | Same as primary |

Note: The combined_v1 model with Open-Meteo features was rolled back due to regression issues. See postmortem for details.

### Key Components

| File | Purpose |
|------|---------|
| `api.py` | FastAPI service exposing `/health` and `/correct/batch` endpoints |
| `model.py` | XGBoost model wrapper with train/predict/save/load methods |
| `transformers.py` | Feature engineering for NOAA-only model |
| `transformers_ensemble.py` | Feature engineering for combined model (NOAA + Open-Meteo) |
| `open_meteo_service.py` | Async client for Open-Meteo Marine API |
| `train_augmented.py` | Training script with sample weights |
| `augment_training_data.py` | Data augmentation with ERA5 pseudo-observations |
| `config.py` | Environment configuration and model paths |

### Database Tables

| Table | Purpose |
|-------|---------|
| `enhanced_forecasts` | Source NOAA NWS forecasts |
| `marine_forecasts` | Buoy observations (is_observed=true) |
| `corrected_forecasts` | ML-corrected wave heights |
| `ml_predictions_log` | Prediction audit log for validation |

### Database Functions

| Function | Purpose | Schedule |
|----------|---------|----------|
| `backfill_ml_observations(batch_size)` | Match predictions with observations | pg_cron: `*/10 * * * *` |
| `get_ml_health_metrics()` | Pipeline health for alerting | On-demand |
| `get_ml_weekly_metrics()` | Model performance metrics | On-demand |

---

## Data Requirements

### Training Data Retention Policy

Effective ML model training requires sufficient historical data to capture diverse weather patterns. The forecast data retention policy was extended in January 2026 to support proper ML training.

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| `marine_forecasts` | 90 days | Provides 3 months of observation data for training |
| `tide_forecasts` | 90 days | Aligned with marine_forecasts |
| `enhanced_forecasts` | 14 days | User-facing forecasts (unchanged) |

### Minimum Training Data Requirements

| Requirement | Minimum | Target | Rationale |
|-------------|---------|--------|-----------|
| **Time span** | 60 days | 90+ days | Captures seasonal variation |
| **Sample count** | 10,000 | 30,000+ | Statistical significance |
| **Weather diversity** | Multiple patterns | All seasons | Prevents overfitting |
| **Beach coverage** | 50+ beaches | 96 beaches | Geographic generalization |

### Why 90 Days?

The v1 model was trained on only 8 days of data (2,275 samples) during an unusual weather period (January 12-20, 2026). This caused several issues:

1. **Insufficient samples**: 2,275 samples is too few for reliable XGBoost training
2. **Biased patterns**: Data captured only one weather pattern (winter storm followed by calm)
3. **No seasonal variation**: Missing spring/summer/fall conditions
4. **Overfitting risk**: Model memorized specific conditions rather than learning general bias patterns

With 90-day retention, we expect:
- **30,000+ samples** by mid-April 2026
- **Diverse conditions**: Winter storms, spring swells, calm periods
- **Better generalization**: Model learns true systematic bias, not anomalies

### Storage Impact

| Metric | Value |
|--------|-------|
| Current DB size | ~535 MB |
| 90-day marine_forecasts estimate | ~1.2 GB |
| Supabase Pro limit | 8 GB |
| Available headroom | ~6.3 GB |

### Monitoring Training Data

```sql
-- Check current training data availability
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

-- Monitor storage growth
SELECT
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size
FROM pg_stat_user_tables
WHERE relname IN ('marine_forecasts', 'tide_forecasts', 'enhanced_forecasts')
ORDER BY pg_total_relation_size(relid) DESC;
```

---

## Model Training

### Data Sources

1. **NOAA NWS Forecasts** (`enhanced_forecasts` table)
   - Wave height, period, direction
   - Wind speed, direction
   - Source: `data_source = 'NOAA_NWS'`

2. **Buoy Observations** (`marine_forecasts` table)
   - CDIP and NDBC buoy measurements
   - Filter: `is_observed = true AND source IN ('cdip', 'ndbc')`
   - Weight: `1.0` (highest quality)

3. **ERA5 Reanalysis** (via `era5_service.py`)
   - ECMWF ERA5-Ocean pseudo-observations
   - Weight: `0.6` (validated) or `0.3` (unvalidated)
   - Used to augment training data for beaches without buoys

4. **Open-Meteo Marine API** (inference only)
   - Real-time wave forecasts from alternative model
   - Provides swell decomposition features
   - Used as ensemble input at inference time

### Feature Engineering

**NOAA-Only Features** (14 total):
- `wave_height_model`, `wave_period`, `wave_period_sq`
- `wave_direction_sin`, `wave_direction_cos`
- `wind_speed`, `wind_direction_sin`, `wind_direction_cos`
- `wind_missing` (indicator)
- `hour`, `month`

**Combined Model Features** (35 total):
- All NOAA features above
- Open-Meteo: `wave_height_om`, `wave_period_om`, `swell_height_om`, `swell_period_om`, `wind_wave_height_om`
- Derived: `delta_noaa_om`, `height_ratio_noaa_om`, `models_agree`, `swell_dominance_om`, `direction_agreement`
- Cyclical encoding for all directions

### Training Process

```bash
# 1. Generate augmented training data
cd ml
python augment_training_data.py --output data/augmented_training_data.csv --lookback-days 365

# 2. Train the combined model
python train_augmented.py \
  --data data/augmented_training_data.csv \
  --output models/bias_model_combined_v1.json \
  --compare-baseline

# 3. Verify model was created
ls -la models/
```

**Sample Weights**: The training script uses weighted samples to prioritize real buoy observations over ERA5 pseudo-observations:
- Buoy observations: weight = `1.0`
- ERA5 validated: weight = `0.6`
- ERA5 unvalidated: weight = `0.3`

### Cross-Validation

The model uses TimeSeriesSplit with 5 folds to prevent data leakage from future observations. Expected CV RMSE is typically 0.15-0.25 meters.

### Training Data Checklist

Before training a new model version, verify:

- [ ] At least 60 days of observation data available
- [ ] At least 10,000 matched forecast-observation pairs
- [ ] Data includes diverse weather conditions (not just one pattern)
- [ ] Observable beaches view is up to date: `SELECT COUNT(*) FROM observable_beaches;`
- [ ] No data quality issues: `SELECT * FROM get_ml_health_metrics();`

---

## Deployment

### Fly.io Configuration

The ML service runs on Fly.io at `quiver-ml.fly.dev`.

**fly.toml**:
```toml
app = 'quiver-ml'
primary_region = 'lax'

[env]
  MODEL_PATH = 'models/bias_model_v1.json'
  MODEL_VERSION = 'v1'
  FALLBACK_MODEL_PATH = 'models/bias_model_v1.json'
  USE_ENSEMBLE = 'false'
  PORT = '8080'

[http_service]
  internal_port = 8080
  force_https = true
  auto_stop_machines = 'stop'
  auto_start_machines = true
  min_machines_running = 0

[[vm]]
  memory = '512mb'
  cpu_kind = 'shared'
  cpus = 1
```

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `INTERNAL_SECRET` | Yes | API authentication secret |
| `MODEL_PATH` | No | Path to primary model (default: `models/bias_model_v1.json`) |
| `MODEL_VERSION` | No | Version string for logging (default: `v1`) |
| `FALLBACK_MODEL_PATH` | No | Path to fallback model |
| `USE_ENSEMBLE` | No | Enable Open-Meteo ensemble features (default: `false`) |
| `OPEN_METEO_TIMEOUT_MS` | No | Timeout for Open-Meteo API calls (default: `2000`) |

### Deployment Commands

```bash
# Deploy to Fly.io
cd ml
fly deploy

# Check service status
fly status

# View logs
fly logs

# SSH into running machine
fly ssh console
```

### Docker Build

```bash
# Build locally
docker build -t quiver-ml .

# Run locally
docker run -p 8080:8080 \
  -e SUPABASE_URL=$SUPABASE_URL \
  -e SUPABASE_SERVICE_KEY=$SUPABASE_SERVICE_KEY \
  -e INTERNAL_SECRET=$ML_INTERNAL_SECRET \
  quiver-ml
```

---

## API Reference

### GET /health

Health check endpoint (no authentication required).

**Response**:
```json
{
  "status": "ok",
  "model_loaded": true,
  "model_version": "v1"
}
```

### POST /correct/batch

Correct multiple forecasts in a single request. Requires `X-Internal-Secret` header.

**Request**:
```json
{
  "forecasts": [
    {
      "beach_id": "uuid-here",
      "forecast_ts": "2026-01-18T12:00:00Z",
      "wave_height_m": 1.5,
      "wave_period_s": 10.0,
      "wave_direction_deg": 270.0,
      "wind_speed_ms": 5.0,
      "wind_direction_deg": 180.0,
      "latitude": 33.1581,
      "longitude": -117.3506
    }
  ]
}
```

**Response**:
```json
{
  "corrections": [
    {
      "beach_id": "uuid-here",
      "forecast_ts": "2026-01-18T12:00:00Z",
      "raw_height_m": 1.5,
      "corrected_height_m": 1.62,
      "bias_applied_m": 0.12,
      "model_version": "v1",
      "ensemble_used": false
    }
  ],
  "model_version": "v1",
  "count": 1
}
```

**Field Validation**:
- `wave_height_m`: 0.0 - 30.0 meters
- `wave_period_s`: 1.0 - 30.0 seconds
- `wave_direction_deg`: 0.0 - 360.0 degrees
- `wind_speed_ms`: 0.0 - 100.0 m/s (optional)
- `latitude`: -90.0 - 90.0 (optional, enables ensemble)
- `longitude`: -180.0 - 180.0 (optional, enables ensemble)

**Batch Limits**:
- Maximum batch size: 1000 forecasts
- Maximum concurrent Open-Meteo requests: 10

---

## Validation and Monitoring

### Pipeline Health Check

```sql
-- Quick health check
SELECT * FROM get_ml_health_metrics();

-- Detailed model performance
SELECT * FROM get_ml_weekly_metrics();
```

### pg_cron Job Monitoring

```sql
-- Check recent job runs
SELECT jobname, start_time, end_time, status, return_message
FROM cron.job_run_details
WHERE jobname = 'ml-backfill-observations'
ORDER BY start_time DESC
LIMIT 10;
```

### Key Metrics to Monitor

| Metric | Target | Description |
|--------|--------|-------------|
| Improvement Rate | > 45% | Percentage of forecasts where correction reduces error |
| Avg Improvement | > 0.01m | Mean error reduction in meters |
| Match Rate (24h) | > 50% | Ground truth match rate |
| Pending Backlog | < 10,000 | Predictions awaiting ground truth |

### Cron Job

The correction job runs via `/app/api/cron/ml/correct-forecasts/route.ts`:
- Triggered by Vercel Cron
- Fetches all NOAA forecasts for today and future
- Filters to beaches with buoy coverage (observable_beaches view)
- Processes in batches of 500
- Stores results in `corrected_forecasts` table
- Logs to `ml_predictions_log` for validation

The backfill job runs via Supabase pg_cron:
- Job: `ml-backfill-observations`
- Schedule: `*/10 * * * *` (every 10 minutes)
- Processes 1000 predictions per run
- Updates ground truth and error metrics

---

## Troubleshooting

### Common Issues

#### 1. Feature Mismatch Error

**Symptom**: Model prediction fails with feature count mismatch.

**Cause**: The model was trained with different features than what the API is providing.

**Solution**:
```bash
# Check model's expected features
python -c "
import xgboost as xgb
model = xgb.XGBRegressor()
model.load_model('models/bias_model_v1.json')
print(f'Feature count: {model.n_features_in_}')
print(f'Feature names: {model.feature_names_in_}')
"
```

Ensure `transformers.py:get_feature_columns()` matches the model's expected features.

#### 2. Service Cold Start

**Symptom**: First request after idle period times out.

**Cause**: Fly.io scales to zero machines when idle.

**Solution**: The cron job includes wake-up logic with retry. For manual testing:
```bash
curl https://quiver-ml.fly.dev/health
# Wait 5-10 seconds for cold start
curl https://quiver-ml.fly.dev/health
```

#### 3. No Predictions Generated

**Symptom**: `ml_predictions_log` table is empty.

**Checks**:
1. Verify cron job is configured in `vercel.json`
2. Check `ML_SERVICE_URL` and `ML_INTERNAL_SECRET` are set
3. Verify `enhanced_forecasts` has data for today
4. Check `observable_beaches` view returns results

#### 4. Model Not Loading

**Symptom**: `/health` returns `model_loaded: false`.

**Solution**:
```bash
# Check if model file exists in container
fly ssh console
ls -la /app/models/

# Check logs for load errors
fly logs | grep -i "model"
```

#### 5. Low Ground Truth Match Rate

**Symptom**: `get_ml_health_metrics()` shows low `match_rate_24h`

**Solution**: See ML Operations Runbook for detailed troubleshooting steps.

#### 6. Insufficient Training Data

**Symptom**: Model shows poor generalization or inconsistent predictions.

**Diagnosis**:
```sql
-- Check training data volume
SELECT
  COUNT(*) as total_obs,
  MIN(ts) as earliest,
  MAX(ts) as latest,
  EXTRACT(EPOCH FROM (MAX(ts) - MIN(ts))) / 86400 as days_span
FROM marine_forecasts
WHERE is_observed = true AND wave_height_m IS NOT NULL;
```

**Solution**: Wait for more data accumulation (target: 90+ days) before retraining.

### Local Development

```bash
# Install dependencies
cd ml
pip install -r requirements.txt

# Run tests
pytest

# Start local server
uvicorn api:app --reload --port 8080

# Test health endpoint
curl http://localhost:8080/health

# Test correction (requires auth)
curl -X POST http://localhost:8080/correct/batch \
  -H "Content-Type: application/json" \
  -H "X-Internal-Secret: your-secret" \
  -d '{"forecasts": [{"beach_id": "test", "forecast_ts": "2026-01-18T12:00:00Z", "wave_height_m": 1.5, "wave_period_s": 10, "wave_direction_deg": 270}]}'
```

---

## File Reference

```
ml/
├── api.py                    # FastAPI service
├── model.py                  # XGBoost model wrapper
├── transformers.py           # NOAA-only feature engineering
├── transformers_ensemble.py  # Combined model feature engineering
├── open_meteo_service.py     # Open-Meteo API client
├── config.py                 # Configuration
├── train_augmented.py        # Training script
├── augment_training_data.py  # Data augmentation
├── era5_service.py           # ERA5 reanalysis client
├── parsing.py                # Wave height/wind parsing utilities
├── Dockerfile                # Container definition
├── fly.toml                  # Fly.io deployment config
├── requirements.txt          # Python dependencies
├── models/
│   ├── bias_model_combined_v1.json  # Combined model (disabled)
│   └── bias_model_v1.json           # Primary model (NOAA-only)
├── data/
│   └── augmented_training_data.csv  # Training data (git-ignored)
├── ARCHITECTURE.md           # Detailed architecture docs
└── README.md                 # This file
```

## Related Documentation

- [ML Architecture](/ml/ARCHITECTURE.md) - Detailed technical architecture
- [ML Operations Runbook](/docs/guides/ML_OPERATIONS_RUNBOOK.md) - Operational procedures
- [ML Bias Correction Feature](/docs/features/ML_BIAS_CORRECTION.md) - Feature documentation
- [Database Schema](/docs/architecture/DATABASE_SCHEMA.md) - Retention policies and data flow
- [Postmortem: ML Model Regression](/docs/postmortems/2026-01-20-ml-model-regression.md) - Incident details
