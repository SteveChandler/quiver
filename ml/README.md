# Quiver ML Bias Correction System

This directory contains the ML pipeline for correcting wave height forecasts. The system uses XGBoost to learn systematic biases in NOAA NWS forecasts by comparing them against actual buoy observations (CDIP/NDBC).

**Current version:** v3 (automated retraining pipeline)
**Production URL:** `https://quiver-ml.fly.dev`
**Retrain Schedule:** Sundays at 6am UTC (via Vercel cron)

## Table of Contents

- [Quick Start (v3)](#quick-start-v3)
- [Pipeline Overview](#pipeline-overview)
- [Architecture](#architecture)
- [v2 to v3 Migration Summary](#v2-to-v3-migration-summary)
- [v1 to v2 Migration Summary](#v1-to-v2-migration-summary)
- [Data Requirements](#data-requirements)
- [Model Training](#model-training)
- [Automated Retraining](#automated-retraining)
- [Deployment](#deployment)
- [API Reference](#api-reference)
- [Validation and Monitoring](#validation-and-monitoring)
- [Troubleshooting](#troubleshooting)

---

## Quick Start (v3)

v3 uses an automated retraining pipeline. Manual training is still supported for development:

```bash
# Option 1: Trigger automated retrain (production)
curl -X POST https://quiver.vercel.app/api/cron/ml/retrain \
  -H "Authorization: Bearer ${CRON_SECRET_TOKEN}"

# Option 2: Manual training (development)
cd ml

# 1. Extract training data from ml_predictions_log
#    Use --since to exclude pre-shoaling data (recommended)
SUPABASE_URL=<prod_url> SUPABASE_SERVICE_ROLE_KEY=<key> \
  python3 extract_training_data_v2.py --since 2026-02-05T06:00:00+00:00

# 2. Train model (exits non-zero if go/no-go gates fail)
python3 train_v2.py --data data/training_data_v2.csv --output models/bias_model_v3.json

# 3. Deploy (only if exit code 0 = GO)
fly deploy

# 4. Verify deployment
curl https://quiver-ml.fly.dev/health
# Expected: {"status": "ok", "model_loaded": true, "model_version": "v3.YYYYMMDD"}
```

---

## Pipeline Overview

```
+------------------+     +------------------+     +------------------+
|  Data Source      |     |   Training (v3)  |     |   Inference      |
+------------------+     +------------------+     +------------------+
|                  |     |                  |     |                  |
| ml_predictions   |---->| /api/cron/ml/    |     | Cron Job         |
| _log             |     | retrain          |     | (Next.js)        |
| (matched pairs   |     |       |          |     |       |          |
|  with terrain    |     |       v          |     |       v          |
|  factors)        |     | ML Service       |     | ML Service       |
|                  |     | POST /train      |     | (Fly.io)         |
+------------------+     | (13 features,    |     |       |          |
                         |  recency weights,|     |       v          |
                         |  go/no-go gates) |     | preprocess_v2()  |
                         |       |          |     | (13 features)    |
                         |       v          |     |       |          |
                         | Deploy to Fly.io |---->|       v          |
                         | (via Machines    |     | corrected_       |
                         |  API)            |     | forecasts table  |
                         +------------------+     +------------------+
                                                          |
                                                          v
                                                  +------------------+
                                                  | pg_cron Backfill |
                                                  | backfill_ml_     |
                                                  | observations()   |
                                                  +------------------+
```

### Data Flow

1. **Training Phase**: Predictions with ground truth are extracted from `ml_predictions_log` with terrain factors from `beaches` table
2. **Model Training**: XGBoost learns the residual (observed - forecast) with recency weighting and go/no-go validation
3. **Deployment**: Trained model is uploaded to Supabase Storage and deployed to Fly.io via Machines API
4. **Inference Phase**: Cron job fetches current NOAA forecasts and sends them to the ML service
5. **Feature Engineering**: `api.py` uses `preprocess_v2()` generating 13 features including terrain factors
6. **Correction**: The model predicts the bias and applies guardrailed corrections: `corrected = forecast + clipped_bias`
7. **Storage**: Corrected forecasts are stored in `corrected_forecasts` table for the application to use
8. **Validation**: pg_cron job matches predictions with ground truth observations for monitoring

---

## Architecture

### Models

| Model | File | Features | Status |
|-------|------|----------|--------|
| **Primary (v3)** | `models/bias_model_v3.YYYYMMDD.json` | 13 features (preprocess_v2 + terrain) | Production |
| **Fallback (v2)** | `models/bias_model_v2.json` | 13 features (preprocess_v2) | Fallback |
| **Legacy (v1)** | `models/bias_model_v1.json` | 10 features (FeatureEngineer) | Deprecated |

### Key Components

| File | Purpose |
|------|---------|
| `api.py` | FastAPI service with `/correct`, `/correct/batch`, `/train`, and `/health` endpoints |
| `model.py` | QuiverBiasModel with guardrails in `predict()` |
| `transformers.py` | v1 feature engineering (FeatureEngineer class, 10 features) |
| `transformers_v2.py` | v2/v3 feature engineering (preprocess_v2 function, 13 features with terrain) |
| `extract_training_data.py` | v1 extraction (enhanced_forecasts text parsing) |
| `extract_training_data_v2.py` | v2/v3 extraction (ml_predictions_log numeric pairs, supports `--since` filter) |
| `train.py` | v1 training script |
| `train_v2.py` | v2/v3 training with go/no-go gates |
| `config.py` | Environment configuration, model paths, and taper thresholds |

### Database Tables

| Table | Purpose |
|-------|---------|
| `enhanced_forecasts` | Source NOAA NWS forecasts |
| `marine_forecasts` | Buoy observations (is_observed=true) |
| `corrected_forecasts` | ML-corrected wave heights |
| `ml_predictions_log` | Prediction audit log; training data source with tide_state, tide_height_m, forecast_horizon_hours |
| `ml_model_registry` | Model lifecycle tracking (version, metrics, status, deployment info) |
| `beach_ml_performance_baseline` | Per-beach ML performance metrics (materialized view, refreshed daily) |

### Database Functions

| Function | Purpose | Schedule |
|----------|---------|----------|
| `backfill_ml_observations(batch_size)` | Match predictions with observations | pg_cron: `*/10 * * * *` |
| `get_ml_health_metrics()` | Pipeline health for alerting | On-demand |
| `get_ml_weekly_metrics()` | Model performance metrics | On-demand |
| `check_ml_drift()` | Detect model performance degradation | On-demand |
| `get_current_production_model()` | Returns currently deployed model | On-demand |
| `refresh_beach_ml_baseline()` | Refresh per-beach performance view | pg_cron: `0 7 * * *` |
| `get_beach_ml_performance(beach_id)` | Get ML performance for specific beach | On-demand |
| `get_worst_performing_beaches(limit)` | Find beaches with lowest improvement rates | On-demand |

---

## v2 to v3 Migration Summary

### Problem with v2

v2 had monotone constraints that forced correction direction, which caused incorrect adjustments for larger swells. The large swell taper was too aggressive (1.5m-2.5m), resulting in 0% correction for waves >2.5m.

### What v3 Changes

| Aspect | v2 | v3 |
|--------|----|----|
| Monotone constraints | `forecast_height_m` has constraint `-1` | **No constraints** - model learns freely |
| Large swell taper start | 1.5m | **2.0m** |
| Large swell taper end | 2.5m | **4.0m** |
| Guardrails (max bias %) | 50% | **75%** |
| Guardrails (bias floor) | 0.3m | **0.5m** |
| Training | Manual | **Automated** (Vercel cron + ML service API) |
| Deployment | Manual `fly deploy` | **Automated** (Fly.io Machines API) |
| Features | 11 | **13** (added terrain factors) |
| Model storage | Git (baked into Docker) | **Supabase Storage** (ml-artifacts bucket) |
| Retrain schedule | Manual | **Weekly** (Sundays 6am UTC) |

### v3 Features (13 total)

```
forecast_height_m, wave_period_sq, wave_steepness, wave_direction_sin,
wave_direction_cos, wind_speed_ms, wind_direction_sin, wind_direction_cos,
hour, month, wind_missing, swell_access_factor, wind_exposure_factor
```

New terrain features:
- `swell_access_factor`: Extracted from 72-element directional array based on wave direction (0.0-1.0)
- `wind_exposure_factor`: Extracted from 72-element directional array based on wind direction (0.0-1.0)

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

---

## Data Requirements

### v3 Training Data

v3 training data comes from `ml_predictions_log` joined with `beaches` table for terrain factors. The automated pipeline extracts data with pagination (5000 rows per page) to handle large datasets.

**Post-Shoaling Data Filter (Feb 2026):**

The automated retrain pipeline enforces a hard floor on the training data cutoff date (`SHOALING_CHANGE_DATE = 2026-02-05T06:00:00Z`). This prevents the model from training on data collected before the `BASE_SHOALING` constant was reduced from 1.6 to 1.0 (commit `0317b83`, Feb 4 2026). Pre-shoaling data has a different bias profile that degrades model accuracy. The floor is applied as `max(rolling_90d_cutoff, SHOALING_CHANGE_DATE)` and will become inert naturally after May 2026 when the 90-day window no longer reaches back that far.

**Automatic Extraction (in retrain pipeline):**
```sql
SELECT
  p.*,
  b.swell_access_factors,
  b.wind_exposure_factors
FROM ml_predictions_log p
JOIN beaches b ON p.beach_id = b.id
WHERE p.observed_m IS NOT NULL
  AND p.predicted_at >= '2026-02-05T06:00:00Z'  -- shoaling change date floor
  AND p.predicted_at > now() - interval '90 days'
```

**Manual Extraction:**
```bash
# Recommended: exclude pre-shoaling data
SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> \
  python3 extract_training_data_v2.py --since 2026-02-05T06:00:00+00:00

# Without filter (all available data -- not recommended for training)
SUPABASE_URL=<url> SUPABASE_SERVICE_ROLE_KEY=<key> \
  python3 extract_training_data_v2.py
```

The `--since` argument accepts any ISO 8601 date string and applies a `.gte('predicted_at', since)` filter to the Supabase query. Input is validated via `datetime.fromisoformat()` at both the CLI argument parser and the function entry point.

### Minimum Training Data Requirements

| Requirement | Minimum | Target | Rationale |
|-------------|---------|--------|-----------|
| **Sample count** | 50,000 | 100,000+ | Statistical significance across all wave sizes |
| **Time span** | 30 days | 90+ days | Captures seasonal and weather variation |
| **Weather diversity** | Multiple patterns | All seasons | Prevents overfitting to specific conditions |
| **Beach coverage** | 50+ beaches | 96 beaches | Geographic generalization |

---

## Model Training

### Automated Training (v3 - Recommended)

The retrain pipeline at `/api/cron/ml/retrain` handles the full training and deployment cycle:

1. **Extract Data**: Fetches up to 90 days of matched predictions with terrain factors (floored at shoaling change date)
2. **Create Registry Entry**: Tracks training in `ml_model_registry`
3. **Train Model**: Calls ML service `/train` endpoint with:
   - Recency weighting (last 14 days get 2x weight)
   - Temporal holdout (last 2 days)
   - v3 XGBoost params (no monotone constraints)
4. **Validate**: Go/no-go gates on holdout set
5. **Deploy**: Upload to Supabase Storage, update Fly.io machines
6. **Update Registry**: Record deployment status and metrics

**Schedule**: Sundays at 6am UTC (configured in `vercel.json`)

### Manual Training

For development or emergency retraining:

```bash
cd ml
python3 train_v2.py --data data/training_data_v2.csv --output models/bias_model_v3.json
```

### Go/No-Go Gates

The training validates on the holdout set:

| Gate | Threshold | Action on Failure |
|------|-----------|-------------------|
| Overall improvement | >50% | Exit non-zero, model NOT saved |
| Per-bucket improvement | >40% per bucket (<0.5m, 0.5-1.5m, >1.5m) | Exit non-zero, model NOT saved |
| Max bucket degradation | <0.05m increase | Exit non-zero, model NOT saved |
| Mean bias | <0.4m (not too one-directional) | Exit non-zero, model NOT saved |

---

## Automated Retraining

### Configuration

The retrain cron is configured in `vercel.json`:

```json
{
  "path": "/api/cron/ml/retrain",
  "schedule": "0 6 * * 0"
}
```

This runs every Sunday at 6am UTC.

### Required Environment Variables

```bash
# ML Service
ML_SERVICE_URL=https://quiver-ml.fly.dev
ML_INTERNAL_SECRET=<your-secret>

# Fly.io Deployment
FLY_API_TOKEN=<your-fly-token>
FLY_APP_NAME=quiver-ml

# Supabase (for model storage)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=<your-service-role-key>
```

### Pipeline Steps

1. **Extract Training Data** (paginated, 1000 rows/page, max 50K samples, floored at `SHOALING_CHANGE_DATE`)
2. **Create Registry Entry** (status: 'training')
3. **Call ML Service /train** (4.5-minute timeout)
4. **Deploy to Fly.io**:
   - Upload model to Supabase Storage (`ml-artifacts` bucket)
   - Set Fly.io secrets (`MODEL_VERSION`, `MODEL_PATH`) via GraphQL API
   - Secrets trigger automatic rolling redeployment
   - Poll health endpoint for confirmation
5. **Update Registry** (status: 'deployed' or 'failed')

### Post-Shoaling Data Floor

The pipeline enforces a hard floor on the training data cutoff:

```typescript
const SHOALING_CHANGE_DATE = new Date('2026-02-05T06:00:00Z');

// In data extraction:
if (cutoffDate < SHOALING_CHANGE_DATE) {
  cutoffDate.setTime(SHOALING_CHANGE_DATE.getTime());
}
```

This ensures the automated Sunday retrain never uses pre-shoaling data, even when the 90-day rolling window would otherwise include it. The floor will become inert after May 2026 when `now() - 90 days` naturally exceeds `2026-02-05`.

### Security

- **SSRF Protection**: Model URLs validated against allowlist (`quiver-ml.fly.dev`, `localhost:8080`, `ML_SERVICE_URL`)
- **Authentication**: `X-Internal-Secret` header required for all ML service endpoints
- **Storage Security**: `ml-artifacts` bucket has public read (ML service needs access) but service-role-only write

See [docs/ML_DEPLOYMENT_SETUP.md](/docs/ML_DEPLOYMENT_SETUP.md) for complete setup guide.

---

## Deployment

### Fly.io Configuration

The ML service runs on Fly.io at `quiver-ml.fly.dev`.

**fly.toml** (current configuration):
```toml
app = 'quiver-ml'
primary_region = 'lax'

[env]
  MODEL_PATH = 'models/bias_model_v2.json'  # Updated dynamically by retrain pipeline
  MODEL_VERSION = 'v2'                       # Updated dynamically by retrain pipeline
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

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `INTERNAL_SECRET` | Yes | API authentication secret |
| `MODEL_PATH` | No | Path to primary model (updated by retrain pipeline) |
| `MODEL_VERSION` | No | Version string for logging (updated by retrain pipeline) |
| `FALLBACK_MODEL_PATH` | No | Path to fallback model (`models/bias_model_v1.json`) |
| `LARGE_SWELL_TAPER_START` | No | Start of large swell taper (default: 2.0m) |
| `LARGE_SWELL_TAPER_END` | No | End of large swell taper (default: 4.0m) |

---

## API Reference

### GET /health

Health check endpoint (no authentication required).

**Response**:
```json
{
  "status": "ok",
  "model_loaded": true,
  "model_version": "v3.20260203"
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
      "model_version": "v3.20260203"
    }
  ],
  "model_version": "v3.20260203",
  "count": 1
}
```

### POST /train

Train a new bias correction model. Requires `X-Internal-Secret` header. Called by the automated retrain pipeline.

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
      "wind_direction_deg": 180.0,
      "swell_access_factors": [0.8, 0.9, ...],
      "wind_exposure_factors": [0.5, 0.6, ...]
    }
  ],
  "config": {
    "recency_weight_half_life_days": 14,
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
  "model_url": "https://quiver-ml.fly.dev/models/bias_model_v3.20260203.json"
}
```

**Response (Validation Failure)**:
```json
{
  "success": false,
  "version": "v3.20260203",
  "metrics": { ... },
  "error": "Overall improvement 48.5% <= 50%"
}
```

### Static Model Files

Trained models are served as static files at `/models/{filename}`:

```bash
curl https://quiver-ml.fly.dev/models/bias_model_v3.20260203.json
```

---

## Validation and Monitoring

### Post-Deployment Checklist

| Timeframe | Action | Expected Result |
|-----------|--------|-----------------|
| Immediately | `curl /health` | `model_version: "v3.YYYYMMDD"` |
| After first cron | Check bias distribution | Balanced (positive AND negative corrections) |
| After 24h | `get_ml_weekly_metrics()` | `improvement_pct > 45%` |

### Key Metrics to Monitor

| Metric | Target | Description |
|--------|--------|-------------|
| Improvement Rate | > 50% | Percentage of forecasts where correction reduces error |
| Mean Bias | < +/-0.1m | Average signed correction (should be near zero) |
| Match Rate (24h) | > 50% | Ground truth match rate |
| Pending Backlog | < 10,000 | Predictions awaiting ground truth |

### Per-Beach Monitoring

```sql
-- Get worst performing beaches
SELECT * FROM get_worst_performing_beaches(10);

-- Get specific beach performance
SELECT * FROM get_beach_ml_performance('beach-uuid-here');

-- View all beach performance metrics
SELECT * FROM beach_ml_performance_baseline ORDER BY improvement_rate_pct DESC;
```

### Drift Detection

```sql
-- Check if model needs retraining
SELECT check_ml_drift();
-- Returns TRUE if:
-- - Current week improvement < 40%
-- - Current week MAE degraded by >20% vs previous week
```

### Rollback

If a deployment causes issues:

```bash
# Option 1: Fly.io secrets (immediate)
fly secrets set MODEL_VERSION="v3.20260127" -a quiver-ml
fly secrets set MODEL_PATH="https://..." -a quiver-ml
fly machine restart -a quiver-ml

# Option 2: Database rollback tracking
UPDATE ml_model_registry
SET status = 'rolled_back', notes = 'Rolled back due to regression'
WHERE version = 'v3.20260203';
```

---

## Troubleshooting

### Common Issues

#### 1. Feature Mismatch Error

**Symptom**: Model prediction fails with feature count mismatch.

**Cause**: Model trained with different feature count than current `preprocess_v2()`.

**Solution**: Verify model was trained with 13 features (v3) or 11 features (v2). Check `V2_FEATURE_COLUMNS` in `transformers_v2.py`.

#### 2. Go/No-Go Gates Failing

**Symptom**: Training completes but validation fails.

**Diagnosis**: Check which gate failed in the response:
- Overall improvement <50%: Need more diverse training data
- Per-bucket <40%: One wave size category has insufficient data
- Mean bias >0.4m: Model is one-directional

**Solution**: Accumulate more training data across all wave sizes.

#### 3. Deployment Failed

**Symptom**: Training passed but deployment to Fly.io failed.

**Check**:
1. `FLY_API_TOKEN` is valid and not expired
2. `ml-artifacts` bucket exists in Supabase Storage
3. Fly.io app `quiver-ml` exists and is accessible

**Solution**: See [docs/ML_DEPLOYMENT_SETUP.md](/docs/ML_DEPLOYMENT_SETUP.md) for setup instructions.

#### 4. Health Check Not Confirming New Version

**Symptom**: Deployment times out waiting for health check.

**Check**:
```bash
fly logs -a quiver-ml | grep -i "model"
```

**Solution**: Verify model file is valid JSON and can be loaded by XGBoost.

#### 5. Terrain Factors Not Working

**Symptom**: Predictions don't improve for beaches with complex coastlines.

**Check**: Verify `beaches.swell_access_factors` and `beaches.wind_exposure_factors` are populated for the beach.

**Solution**: Run terrain analysis to populate missing factors.

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
```

---

## File Reference

```
ml/
├── api.py                      # FastAPI service with /train, /correct, /health
├── model.py                    # QuiverBiasModel with guardrails
├── transformers.py             # v1 feature engineering (10 features)
├── transformers_v2.py          # v2/v3 feature engineering (13 features)
├── extract_training_data.py    # v1 extraction
├── extract_training_data_v2.py # v2/v3 extraction (supports --since filter)
├── train.py                    # v1 training script
├── train_v2.py                 # v2/v3 training with go/no-go gates
├── config.py                   # Configuration (taper thresholds, model paths)
├── Dockerfile                  # Container definition
├── fly.toml                    # Fly.io deployment config
├── requirements.txt            # Python dependencies
├── models/
│   ├── bias_model_v1.json      # v1 model (deprecated)
│   └── bias_model_v2.json      # v2 model (fallback)
├── data/
│   └── training_data_v2.csv    # Training data (gitignored)
├── TERRAIN_FACTORS.md          # Terrain factor documentation
├── TERRAIN_IMPLEMENTATION_SUMMARY.md
├── ARCHITECTURE.md             # Detailed architecture docs
└── README.md                   # This file
```

## Related Documentation

- [ML Deployment Setup](/docs/ML_DEPLOYMENT_SETUP.md) - Automated deployment configuration
- [ML Architecture](/ml/ARCHITECTURE.md) - Detailed technical architecture
- [Terrain Factors](/ml/TERRAIN_FACTORS.md) - Terrain-aware feature documentation
- [ML Operations Runbook](/docs/guides/ML_OPERATIONS_RUNBOOK.md) - Operational procedures
- [ML Bias Correction Feature](/docs/features/ML_BIAS_CORRECTION.md) - Feature documentation
- [Database Schema](/docs/architecture/DATABASE_SCHEMA.md) - Retention policies and data flow
