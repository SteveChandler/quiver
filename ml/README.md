# Quiver ML Bias Correction System

This directory contains the ML pipeline for correcting wave height forecasts. The system uses XGBoost to learn systematic biases in NOAA NWS forecasts by comparing them against actual buoy observations (CDIP/NDBC).

**Current version:** v2
**Production URL:** `https://quiver-ml.fly.dev`

## Table of Contents

- [Quick Start (v2)](#quick-start-v2)
- [Pipeline Overview](#pipeline-overview)
- [Architecture](#architecture)
- [v1 to v2 Migration Summary](#v1-to-v2-migration-summary)
- [Data Requirements](#data-requirements)
- [Model Training](#model-training)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Validation and Monitoring](#validation-and-monitoring)
- [Troubleshooting](#troubleshooting)

---

## Quick Start (v2)

```bash
# 1. Extract training data from ml_predictions_log
cd ml
SUPABASE_URL=<prod_url> SUPABASE_SERVICE_ROLE_KEY=<key> python3 extract_training_data_v2.py

# 2. Train v2 model (exits non-zero if go/no-go gates fail)
python3 train_v2.py --data data/training_data_v2.csv --output models/bias_model_v2.json

# 3. Deploy (only if exit code 0 = GO)
fly deploy

# 4. Verify deployment
curl https://quiver-ml.fly.dev/health
# Expected: {"status": "ok", "model_loaded": true, "model_version": "v2"}
```

---

## Pipeline Overview

```
+------------------+     +------------------+     +------------------+
|  Data Source      |     |   Training (v2)  |     |   Inference      |
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| ml_predictions   |---->| extract_training |     | Cron Job         |
| _log             |     | _data_v2.py      |     | (Next.js)        |
| (144K matched    |     |       |          |     |       |          |
|  pairs)          |     |       v          |     |       v          |
|                  |     | train_v2.py      |     | ML Service       |
+------------------+     | (monotone        |     | (Fly.io)         |
                          |  constraints,    |     |       |          |
                          |  go/no-go gates) |     |       v          |
                          |       |          |     | preprocess_v2()  |
                          |       v          |     | (11 features)    |
                          | bias_model_      |---->|       |          |
                          | v2.json          |     |       v          |
                          +------------------+     | corrected_       |
                                                   | forecasts table  |
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

1. **Training Phase**: Pre-matched forecast/observation pairs are extracted from `ml_predictions_log`
2. **Model Training**: XGBoost learns the residual (observed - forecast) with monotone constraints and go/no-go validation
3. **Inference Phase**: Cron job fetches current NOAA forecasts and sends them to the ML service
4. **Feature Engineering**: `api.py` routes to `preprocess_v2()` when `MODEL_VERSION=v2`, generating 11 features including `wave_steepness`
5. **Correction**: The model predicts the bias and applies guardrailed corrections: `corrected = forecast + clipped_bias`
6. **Storage**: Corrected forecasts are stored in `corrected_forecasts` table for the application to use
7. **Validation**: pg_cron job matches predictions with ground truth observations for monitoring

---

## Architecture

### Models

| Model | File | Features | Status |
|-------|------|----------|--------|
| **Primary (v2)** | `models/bias_model_v2.json` | 11 features (preprocess_v2) | Production |
| **Fallback (v1)** | `models/bias_model_v1.json` | 10 features (FeatureEngineer) | Fallback only |

### Key Components

| File | Purpose |
|------|---------|
| `api.py` | FastAPI service; routes to v2 features when `MODEL_VERSION=v2` |
| `model.py` | QuiverBiasModel with v2 guardrails in `predict()` |
| `transformers.py` | v1 feature engineering (FeatureEngineer class, 10 features) |
| `transformers_v2.py` | v2 feature engineering (preprocess_v2 function, 11 features) |
| `extract_training_data.py` | v1 extraction (enhanced_forecasts text parsing) |
| `extract_training_data_v2.py` | v2 extraction (ml_predictions_log numeric pairs) |
| `train.py` | v1 training script |
| `train_v2.py` | v2 training with monotone constraints and go/no-go gates |
| `config.py` | Environment configuration and model paths |

### Database Tables

| Table | Purpose |
|-------|---------|
| `enhanced_forecasts` | Source NOAA NWS forecasts |
| `marine_forecasts` | Buoy observations (is_observed=true) |
| `corrected_forecasts` | ML-corrected wave heights |
| `ml_predictions_log` | Prediction audit log; also v2 training data source |

### Database Functions

| Function | Purpose | Schedule |
|----------|---------|----------|
| `backfill_ml_observations(batch_size)` | Match predictions with observations | pg_cron: `*/10 * * * *` |
| `get_ml_health_metrics()` | Pipeline health for alerting | On-demand |
| `get_ml_weekly_metrics()` | Model performance metrics | On-demand |

---

## v1 to v2 Migration Summary

### Problem with v1

The v1 XGBoost model systematically added ~+0.7m to ALL forecasts regardless of wave magnitude. This occurred because:
- Trained on only ~8 days of a single weather pattern (underestimation period)
- Only ~2K training samples extracted via fragile text parsing from `enhanced_forecasts`
- No direction-aware correction (bias was always positive)
- No guardrails on correction magnitude

### What v2 Changes

| Aspect | v1 | v2 |
|--------|----|----|
| Training data | ~2K pairs (text-parsed) | 144K pairs (numeric, pre-matched) |
| Data source | `enhanced_forecasts` (text parsing) | `ml_predictions_log` (numeric) |
| Features | 10 (FeatureEngineer) | 11 (preprocess_v2, adds wave_steepness) |
| Trees | 100, depth 5, lr 0.1 | 200, depth 4, lr 0.05 |
| Regularization | None | alpha=0.1, min_child_weight=10 |
| Constraints | None | Monotone on forecast_height_m (-1) |
| Validation split | Random | Temporal holdout (last 2 days) |
| Quality gates | None | Go/no-go (overall >50%, per-bucket >40%) |
| Bias clipping | None | +/-50% of forecast, abs cap +/-1.5m |
| No-correction zone | None | Skip corrections <0.03m |
| Physical bounds | min 0.01m | [0.01, 15.0]m |
| Mean bias | +0.7m | +0.029m |
| Improvement rate | ~45% | 63.0% |

### v2 Results (Holdout)

| Bucket | Improvement Rate |
|--------|-----------------|
| Overall | 63.0% |
| Small waves (<0.5m) | 98.3% |
| Medium waves (0.5-1.5m) | 62.3% |
| Large waves (>1.5m) | 56.1% |

### v2 Feature List (11 features)

```
forecast_height_m, wave_period_sq, wave_steepness, wave_direction_sin,
wave_direction_cos, wind_speed_ms, wind_direction_sin, wind_direction_cos,
hour, month, wind_missing
```

Top features by importance: `forecast_height_m` (70%), `wave_steepness` (27%), `hour` (3%)

---

## Data Requirements

### v2 Training Data

v2 training data comes directly from `ml_predictions_log`, which stores pre-matched numeric forecast/observation pairs. This table is populated by the ground truth backfill pg_cron job.

**Extraction:**
```bash
SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> python3 extract_training_data_v2.py
```

**Characteristics:**
- ~144K matched pairs (and growing as the pipeline runs)
- Pre-matched numeric values (no text parsing)
- Output: `data/training_data_v2.csv` (~14MB, gitignored)

### Training Data Retention Policy

| Data Type | Retention | Rationale |
|-----------|-----------|-----------|
| `marine_forecasts` | 90 days | Observation data for ground truth matching |
| `ml_predictions_log` | Indefinite | Training data source for v2+ models |
| `enhanced_forecasts` | 14 days | User-facing forecasts (v1 training source, now legacy) |

### Minimum Training Data Requirements

| Requirement | Minimum | Target | Rationale |
|-------------|---------|--------|-----------|
| **Sample count** | 50,000 | 100,000+ | Statistical significance across all wave sizes |
| **Time span** | 30 days | 90+ days | Captures seasonal and weather variation |
| **Weather diversity** | Multiple patterns | All seasons | Prevents overfitting to specific conditions |
| **Beach coverage** | 50+ beaches | 96 beaches | Geographic generalization |

### Monitoring Training Data

```sql
-- Check ml_predictions_log volume (v2 training data source)
SELECT
  COUNT(*) as total_matched,
  COUNT(*) FILTER (WHERE observed_m IS NOT NULL) as with_observations,
  MIN(forecast_ts) as earliest,
  MAX(forecast_ts) as latest
FROM ml_predictions_log;

-- Check by wave size bucket
SELECT
  CASE
    WHEN raw_height_m < 0.5 THEN 'small (<0.5m)'
    WHEN raw_height_m < 1.5 THEN 'medium (0.5-1.5m)'
    ELSE 'large (>1.5m)'
  END as bucket,
  COUNT(*) as count
FROM ml_predictions_log
WHERE observed_m IS NOT NULL
GROUP BY 1;
```

---

## Model Training

### v2 Training (Current)

#### Step 1: Extract Training Data

```bash
cd ml
SUPABASE_URL=<prod_url> SUPABASE_SERVICE_ROLE_KEY=<key> python3 extract_training_data_v2.py
```

This pulls pre-matched numeric pairs from `ml_predictions_log`. No text parsing is involved.

#### Step 2: Train Model

```bash
python3 train_v2.py --data data/training_data_v2.csv --output models/bias_model_v2.json
```

**Training configuration:**
- **Hyperparameters:** n_estimators=200, lr=0.05, max_depth=4, reg_alpha=0.1, min_child_weight=10
- **Monotone constraints:** `forecast_height_m` has constraint `-1` (as forecast increases, correction decreases)
- **Validation:** Temporal holdout (last 2 days of data, not random split)
- **Feature engineering:** `preprocess_v2()` generates 11 features including `wave_steepness = height / (period^2 + 0.1)`

#### Step 3: Go/No-Go Gates

The training script automatically validates on the holdout set:

| Gate | Threshold | Action on Failure |
|------|-----------|-------------------|
| Overall improvement | >50% | Exit non-zero, model NOT saved |
| Per-bucket improvement | >40% per bucket | Exit non-zero, model NOT saved |
| Max bucket degradation | <0.05m increase | Exit non-zero, model NOT saved |

If all gates pass (exit code 0), the model is saved and ready for deployment.

#### Step 4: Deploy

```bash
# Only deploy if train_v2.py exited with code 0
fly deploy
```

### v1 Training (Legacy)

The v1 pipeline is preserved for reference but should not be used for new models.

**Data extraction:**
```bash
python extract_training_data.py --output training_data.csv
# Parses text from enhanced_forecasts, matches with marine_forecasts observations
```

**Training:**
```python
from model import QuiverBiasModel
from transformers import FeatureEngineer

df = pd.read_csv('training_data.csv')
fe = FeatureEngineer()
X = fe.preprocess(df)
y = df['wave_height_observed'] - df['wave_height_model']

model = QuiverBiasModel()
metrics = model.train(X, y, n_splits=5)
model.save('models/bias_model_v1.json')
```

### Training Data Checklist

Before training a new model version, verify:

- [ ] `ml_predictions_log` has sufficient matched pairs (target: 100K+)
- [ ] Data spans diverse weather conditions (check date range)
- [ ] All three size buckets have adequate representation
- [ ] Observable beaches view is up to date: `SELECT COUNT(*) FROM observable_beaches;`
- [ ] No data quality issues: `SELECT * FROM get_ml_health_metrics();`
- [ ] Previous model's go/no-go gates are documented for comparison

---

## Deployment

### Fly.io Configuration

The ML service runs on Fly.io at `quiver-ml.fly.dev`.

**fly.toml** (current v2 configuration):
```toml
app = 'quiver-ml'
primary_region = 'lax'

[env]
  MODEL_PATH = 'models/bias_model_v2.json'
  MODEL_VERSION = 'v2'
  FALLBACK_MODEL_PATH = 'models/bias_model_v1.json'
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

**Key notes:**
- Model JSON is gitignored but baked into the Docker image at deploy time
- Training data CSV (~14MB) is never committed
- v1 model always available as fallback via `FALLBACK_MODEL_PATH`

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INTERNAL_SECRET` | Yes | API authentication secret |
| `MODEL_PATH` | No | Path to primary model (default: `models/bias_model_v2.json`) |
| `MODEL_VERSION` | No | Version string for logging (default: `v2`) |
| `FALLBACK_MODEL_PATH` | No | Path to fallback model (`models/bias_model_v1.json`) |

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
  "model_version": "v2"
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
      "forecast_ts": "2026-01-22T12:00:00Z",
      "wave_height_m": 1.5,
      "wave_period_s": 10.0,
      "wave_direction_deg": 270.0,
      "wind_speed_ms": 5.0,
      "wind_direction_deg": 180.0
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
      "forecast_ts": "2026-01-22T12:00:00Z",
      "raw_height_m": 1.5,
      "corrected_height_m": 1.42,
      "bias_applied_m": -0.08,
      "model_version": "v2"
    }
  ],
  "model_version": "v2",
  "count": 1
}
```

Note: v2 corrections can be negative (reducing forecasts that overestimate), unlike v1 which always added positive bias.

### POST /train

Train a new bias correction model. Requires `X-Internal-Secret` header. Called by the automated retrain pipeline at `/api/cron/ml/retrain`.

**Request**:
```json
{
  "version": "v3.20260203",
  "training_data": [
    {
      "beach_id": "uuid-here",
      "predicted_at": "2026-01-22T12:00:00Z",
      "raw_forecast_m": 1.5,
      "observed_m": 1.42,
      "wave_period_s": 10.0,
      "wave_direction_deg": 270.0,
      "wind_speed_ms": 5.0,
      "wind_direction_deg": 180.0
    }
  ],
  "config": {
    "recency_weight_days": 14,
    "recency_weight_multiplier": 2.0,
    "holdout_days": 2,
    "max_bias_pct": 0.75,
    "bias_floor_m": 0.5
  }
}
```

**Response (Success)**:
```json
{
  "success": true,
  "version": "v3.20260203",
  "metrics": {
    "training_window_days": 30,
    "training_samples": 5000,
    "holdout_improvement_pct": 55.2,
    "holdout_raw_mae": 0.35,
    "holdout_corrected_mae": 0.28
  },
  "model_url": "/models/bias_model_v3.20260203.json"
}
```

**Response (Validation Failure)**:
```json
{
  "success": false,
  "version": "v3.20260203",
  "metrics": {
    "training_window_days": 30,
    "training_samples": 5000,
    "holdout_improvement_pct": 48.5,
    "holdout_raw_mae": 0.35,
    "holdout_corrected_mae": 0.30
  },
  "error": "Overall improvement 48.5% <= 50%"
}
```

**Go/No-Go Validation Gates**:
- Overall improvement > 50%
- Each bucket (<0.5m, 0.5-1.5m, >1.5m) improvement > 40%
- No bucket degradation > 0.05m
- Mean bias < 0.4m (not too one-directional)

**Training Configuration**:
- `recency_weight_days`: Number of recent days to apply higher weight (default: 14)
- `recency_weight_multiplier`: Weight multiplier for recent data (default: 2.0)
- `holdout_days`: Number of days to hold out for validation (default: 2)
- `max_bias_pct`: Maximum bias as percentage of raw forecast (default: 0.75)
- `bias_floor_m`: Minimum absolute bias allowed (default: 0.5m)

**Field Validation**:
- `wave_height_m`: 0.0 - 30.0 meters
- `wave_period_s`: 1.0 - 30.0 seconds
- `wave_direction_deg`: 0.0 - 360.0 degrees
- `wind_speed_ms`: 0.0 - 100.0 m/s (optional)

**Batch Limits**:
- Maximum batch size: 1000 forecasts

### API Routing

`api.py` branches on `MODEL_VERSION`:
- `v2`: Uses `preprocess_v2()` from `transformers_v2.py`
- `v1` (or unset): Uses `FeatureEngineer` from `transformers.py`

---

## Validation and Monitoring

### Post-Deployment Checklist

| Timeframe | Action | Expected Result |
|-----------|--------|-----------------|
| Immediately | `curl /health` | `model_version: "v2"` |
| After first cron | Check bias distribution | Balanced (positive AND negative corrections) |
| After 24h | `get_ml_weekly_metrics()` | `improvement_pct > 45%` |

### Rollback Triggers

Rollback to v1 if:
- `improvement_rate < 40%` after 24h of production data
- `avg_bias > +0.4m` (model reverting to v1-like all-positive behavior)
- Sustained `model_loaded: false` on health endpoint

**Rollback procedure:**
```bash
# Update fly.toml: MODEL_PATH=models/bias_model_v1.json, MODEL_VERSION=v1
fly deploy
```

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
| Improvement Rate | > 50% | Percentage of forecasts where correction reduces error |
| Mean Bias | < +/-0.1m | Average signed correction (should be near zero) |
| Match Rate (24h) | > 50% | Ground truth match rate |
| Pending Backlog | < 10,000 | Predictions awaiting ground truth |

### Cron Jobs

**Correction job** (`/app/api/cron/ml/correct-forecasts/route.ts`):
- Triggered by Vercel Cron
- Fetches all NOAA forecasts for today and future
- Filters to beaches with buoy coverage (observable_beaches view)
- Processes in batches of 500
- Stores results in `corrected_forecasts` table
- Logs to `ml_predictions_log` for validation and future training

**Backfill job** (Supabase pg_cron):
- Job: `ml-backfill-observations`
- Schedule: `*/10 * * * *` (every 10 minutes)
- Processes 1000 predictions per run
- Updates ground truth and error metrics

---

## Troubleshooting

### Common Issues

#### 1. Feature Mismatch Error

**Symptom**: Model prediction fails with feature count mismatch.

**Cause**: `MODEL_VERSION` does not match the loaded model's expected features.

**Solution**:
```bash
# Check which version is configured
fly ssh console
echo $MODEL_VERSION

# Verify model's expected features
python -c "
import xgboost as xgb
model = xgb.XGBRegressor()
model.load_model('models/bias_model_v2.json')
print(f'Feature count: {model.n_features_in_}')
print(f'Feature names: {model.feature_names_in_}')
"
```

Ensure `MODEL_VERSION` matches the model file (`v2` uses `transformers_v2.py` with 11 features, `v1` uses `transformers.py` with 10 features).

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

#### 5. All Corrections Are Positive (v1-like behavior)

**Symptom**: After deploying v2, all `bias_applied_m` values are positive.

**Diagnosis**: This may indicate the v1 model is being loaded instead of v2.

**Solution**:
```bash
# Verify MODEL_VERSION and MODEL_PATH in fly.toml
# Check /health response for model_version field
curl https://quiver-ml.fly.dev/health

# Verify the v2 model file is present in the Docker image
fly ssh console
ls -la /app/models/bias_model_v2.json
```

#### 6. Go/No-Go Gates Failing During Training

**Symptom**: `train_v2.py` exits with non-zero code.

**Diagnosis**: The holdout validation gates are not met. Check the output for which gate failed:
- Overall improvement <50%: Insufficient training data diversity
- Per-bucket <40%: One wave size bucket has inadequate data
- Bucket degradation >0.05m: Model is making some wave sizes worse

**Solution**: Accumulate more training data and retrain. Check `ml_predictions_log` for data volume per bucket.

#### 7. Low Ground Truth Match Rate

**Symptom**: `get_ml_health_metrics()` shows low `match_rate_24h`

**Solution**: See ML Operations Runbook for detailed troubleshooting steps.

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
  -d '{"forecasts": [{"beach_id": "test", "forecast_ts": "2026-01-22T12:00:00Z", "wave_height_m": 1.5, "wave_period_s": 10, "wave_direction_deg": 270}]}'
```

---

## File Reference

```
ml/
├── api.py                      # FastAPI service (v2 routing on MODEL_VERSION)
├── model.py                    # QuiverBiasModel with v2 guardrails
├── transformers.py             # v1 feature engineering (FeatureEngineer, 10 features)
├── transformers_v2.py          # v2 feature engineering (preprocess_v2, 11 features)
├── extract_training_data.py    # v1 extraction (enhanced_forecasts text parsing)
├── extract_training_data_v2.py # v2 extraction (ml_predictions_log numeric pairs)
├── train.py                    # v1 training script
├── train_v2.py                 # v2 training (monotone constraints, go/no-go gates)
├── config.py                   # Configuration
├── Dockerfile                  # Container definition
├── fly.toml                    # Fly.io deployment config (currently v2)
├── requirements.txt            # Python dependencies
├── models/
│   ├── bias_model_v1.json      # v1 model (fallback)
│   └── bias_model_v2.json      # v2 model (primary, gitignored)
├── data/
│   └── training_data_v2.csv    # v2 training data (~14MB, gitignored)
├── ARCHITECTURE.md             # Detailed architecture docs
└── README.md                   # This file
```

## Related Documentation

- [ML Architecture](/ml/ARCHITECTURE.md) - Detailed technical architecture
- [ML Operations Runbook](/docs/guides/ML_OPERATIONS_RUNBOOK.md) - Operational procedures
- [ML Bias Correction Feature](/docs/features/ML_BIAS_CORRECTION.md) - Feature documentation
- [Database Schema](/docs/architecture/DATABASE_SCHEMA.md) - Retention policies and data flow
- [Postmortem: ML Model Regression](/docs/postmortems/2026-01-20-ml-model-regression.md) - v1 regression details
