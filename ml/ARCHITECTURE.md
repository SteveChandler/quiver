# ML Service Architecture

> Python FastAPI service for XGBoost-based wave height bias correction.

**Status:** Production (Fly.io)
**URL:** `https://quiver-ml.fly.dev`
**Current Model:** v3
**Last Updated:** February 2026

## Overview

The ML service provides real-time wave height forecast correction using an XGBoost model trained on historical NOAA forecast errors. The service runs on Fly.io with auto-scaling (0-1 machines).

## Technology Stack

- **Framework:** FastAPI 0.109.0
- **ML Library:** XGBoost 2.0.3
- **Data Processing:** pandas 2.1.4, numpy 1.26.3
- **Server:** Uvicorn 0.27.0
- **Runtime:** Python 3.11

## Directory Structure

```
ml/
+-- api.py                      # FastAPI application and endpoints (v3 routing)
+-- model.py                    # QuiverBiasModel class with v3 guardrails
+-- transformers.py             # v1 feature engineering (FeatureEngineer class)
+-- transformers_v2.py          # v2 feature engineering (preprocess_v2, 11 features)
+-- transformers_v3.py          # v3 feature engineering (recency weighting)
+-- config.py                   # Environment configuration
+-- extract_training_data.py    # v1 extraction (enhanced_forecasts text parsing)
+-- extract_training_data_v2.py # v2 extraction (ml_predictions_log numeric pairs, --since filter)
+-- extract_training_data_v3.py # v3 extraction (recency-weighted samples)
+-- train.py                    # v1 training script
+-- train_v2.py                 # v2 training with monotone constraints and go/no-go gates
+-- train_v3.py                 # v3 training with auto-retrain pipeline
+-- requirements.txt            # Python dependencies
+-- Dockerfile                  # Container configuration
+-- fly.toml                    # Fly.io deployment config (currently v3)
+-- models/                     # Trained model artifacts (gitignored, baked into Docker)
|   +-- bias_model_v1.json      # v1 model (fallback)
|   +-- bias_model_v2.json      # v2 model (fallback)
|   +-- bias_model_v3.json      # v3 model (primary)
+-- data/                       # Training data (gitignored)
|   +-- training_data_v3.csv    # v3 training data (not committed)
+-- ARCHITECTURE.md             # This file
+-- README.md                   # Project README
```

---

## Model Version History

### v3 (Current Production)

The v3 model introduces a rolling auto-retrain pipeline that keeps the model continuously updated with recent observation data. Key architectural changes remove rigidity from v2 while maintaining safety guardrails.

**Key improvements over v2:**
- **Rolling auto-retrain pipeline:** Model automatically retrains weekly or on drift detection
- **Removed monotone constraint:** Allows model to learn complex non-linear relationships
- **Recency weighting:** Recent observations (14 days) weighted 2x, improving adaptation to current conditions
- **Relaxed guardrails:** 75% max correction (vs v2's 50%), 0.5m floor (vs v2's 0.3m)
- **Extended training window:** Uses up to 90 days of data (vs v2's fixed dataset)
- **Post-shoaling data filter:** Training data floored at 2026-02-05 to exclude pre-shoaling bias profile

**v3 Configuration:**
```python
{
    'max_correction_pct': 0.75,      # 75% of forecast (v2: 50%)
    'min_correction_floor': 0.5,     # 0.5m minimum (v2: 0.3m)
    'recency_weight_days': 14,       # 2x weight for last 14 days
    'training_window_days': 90,      # Max training data window
    'monotone_constraints': None,    # Removed (v2: -1 on forecast_height_m)
}
```

### v2 (Fallback)

The v2 model addresses critical shortcomings of v1 by using dramatically more training data, direction-aware corrections, and conservative guardrails.

**Key improvements over v1:**
- 144K matched training pairs (vs v1's ~2K)
- Monotone constraint prevents over-correction of large waves
- Bidirectional bias correction (v1 only added positive bias)
- Guardrailed predictions with physical bounds
- Mean bias reduced from +0.7m to +0.029m

### v1 (Deprecated)

The original model trained on ~8 days of a single weather pattern. It systematically added ~+0.7m to all forecasts regardless of magnitude, because it was trained exclusively on an underestimation period.

**Known v1 issues:**
- Always applied positive bias (no direction awareness)
- Over-corrected large wave forecasts
- Trained on insufficient data (~2K samples from text-parsed enhanced_forecasts)

---

## Auto-Retrain Pipeline

The v3 model introduces an automated retraining pipeline that keeps the model continuously updated with recent observation data.

### Architecture Diagram

```
+------------------+      +-------------------+      +------------------+
|  Scheduled Cron  |      |  Drift Detection  |      |  Model Registry  |
|  (Sundays 6am)   |      |  (Daily check)    |      |  (Supabase)      |
+--------+---------+      +---------+---------+      +--------+---------+
         |                          |                         |
         v                          v                         |
+--------+---------------------------+---------+              |
|           /api/cron/ml/retrain               |              |
|  +-------------------------------------+     |              |
|  | 1. Extract training data (90d,      |     |              |
|  |    floored at SHOALING_CHANGE_DATE) |     |              |
|  | 2. Apply recency weighting          |     |              |
|  | 3. Train new XGBoost model          |     |              |
|  | 4. Validate against holdout         |     |              |
|  | 5. Compare to current production    |     |              |
|  | 6. Promote if gates pass            |     |              |
|  +-------------------------------------+     |              |
+---------------------+------------------------+              |
                      |                                       |
                      v                                       v
            +-------------------+                  +----------+---------+
            |  Fly.io Deploy    |<-----------------| ml_model_registry  |
            |  (new model)      |   promote        | (version history)  |
            +-------------------+                  +--------------------+
```

### Scheduled Retrain

The pipeline runs automatically every Sunday at 6am UTC via Vercel cron:

```typescript
// app/api/cron/ml/retrain/route.ts
export const config = {
  schedule: '0 6 * * 0', // Sundays 6am UTC
};
```

**Retrain Steps:**
1. Extract all matched predictions from last 90 days (floored at `SHOALING_CHANGE_DATE = 2026-02-05T06:00:00Z`)
2. Apply 2x recency weight to observations from last 14 days
3. Train new XGBoost model with v3 hyperparameters
4. Validate on temporal holdout (last 7 days)
5. Compare improvement rate to current production model
6. If gates pass, register new model and deploy to Fly.io

### Post-Shoaling Data Floor

The retrain route enforces a hard floor on the training data cutoff date to exclude data collected before the `BASE_SHOALING` constant was reduced from 1.6 to 1.0 (commit `0317b83`, Feb 4 2026). Pre-shoaling data has a different bias profile that degrades model accuracy.

```typescript
// app/api/cron/ml/retrain/route.ts
const SHOALING_CHANGE_DATE = new Date('2026-02-05T06:00:00Z');

// The rolling 90-day cutoff is raised if it falls before the shoaling change
if (cutoffDate < SHOALING_CHANGE_DATE) {
  cutoffDate.setTime(SHOALING_CHANGE_DATE.getTime());
}
```

This floor will become inert naturally after May 2026 when `now() - 90 days` exceeds `2026-02-05`.

For manual extraction, the same filtering is available via the `--since` CLI argument on `extract_training_data_v2.py`:

```bash
python3 extract_training_data_v2.py --since 2026-02-05T06:00:00+00:00
```

### Emergency Retrain Triggers

The drift detection cron (`/api/cron/ml/check-drift`) runs daily and triggers emergency retrain if:

| Condition | Threshold | Action |
|-----------|-----------|--------|
| Improvement dropped | < 40% (7-day rolling) | Trigger immediate retrain |
| Performance degradation | > 20% worse than baseline | Trigger immediate retrain |
| Model age | > 30 days since last retrain | Trigger retrain |

### Model Registry Table

The `ml_model_registry` table tracks all trained models and their performance:

```sql
CREATE TABLE ml_model_registry (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    version VARCHAR(20) NOT NULL,           -- 'v3.1', 'v3.2', etc.
    trained_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    training_samples INT NOT NULL,
    training_window_days INT NOT NULL,
    holdout_improvement_pct NUMERIC(5,2),
    production_improvement_pct NUMERIC(5,2), -- measured after deployment
    is_active BOOLEAN DEFAULT FALSE,
    promoted_at TIMESTAMPTZ,
    demoted_at TIMESTAMPTZ,
    model_artifact_path TEXT,               -- S3/Fly path
    hyperparameters JSONB,
    feature_importance JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for active model lookup
CREATE INDEX idx_ml_model_registry_active ON ml_model_registry(is_active) WHERE is_active = TRUE;
```

### Drift Detection Function

The `check_ml_drift()` PostgreSQL function monitors model performance:

```sql
CREATE OR REPLACE FUNCTION check_ml_drift()
RETURNS TABLE (
    current_improvement_pct NUMERIC,
    baseline_improvement_pct NUMERIC,
    drift_detected BOOLEAN,
    trigger_retrain BOOLEAN,
    reason TEXT
) AS $$
DECLARE
    v_current_pct NUMERIC;
    v_baseline_pct NUMERIC;
    v_model_age_days INT;
BEGIN
    -- Calculate 7-day rolling improvement
    SELECT
        COALESCE(
            100.0 * SUM(CASE WHEN ABS(corrected_m - observed_m) < ABS(raw_m - observed_m) THEN 1 ELSE 0 END)::NUMERIC
            / NULLIF(COUNT(*), 0),
            0
        )
    INTO v_current_pct
    FROM ml_predictions_log
    WHERE observed_m > 0
      AND predicted_at > NOW() - INTERVAL '7 days';

    -- Get baseline from model registry
    SELECT production_improvement_pct
    INTO v_baseline_pct
    FROM ml_model_registry
    WHERE is_active = TRUE
    LIMIT 1;

    -- Check model age
    SELECT EXTRACT(DAY FROM NOW() - trained_at)::INT
    INTO v_model_age_days
    FROM ml_model_registry
    WHERE is_active = TRUE
    LIMIT 1;

    -- Determine if retrain needed
    RETURN QUERY
    SELECT
        v_current_pct AS current_improvement_pct,
        COALESCE(v_baseline_pct, 50.0) AS baseline_improvement_pct,
        (v_current_pct < 40 OR v_current_pct < v_baseline_pct - 20) AS drift_detected,
        (v_current_pct < 40 OR v_current_pct < v_baseline_pct - 20 OR v_model_age_days > 30) AS trigger_retrain,
        CASE
            WHEN v_current_pct < 40 THEN 'Improvement below 40% threshold'
            WHEN v_current_pct < v_baseline_pct - 20 THEN 'Degradation > 20% from baseline'
            WHEN v_model_age_days > 30 THEN 'Model age exceeds 30 days'
            ELSE 'No drift detected'
        END AS reason;
END;
$$ LANGUAGE plpgsql;
```

---

## v3 Model Architecture

### Removed Monotone Constraint

The v2 model enforced a monotone constraint (`-1`) on `forecast_height_m`, ensuring corrections decreased as forecasts increased. While this prevented over-correction of large waves, it also limited the model's ability to learn complex non-linear patterns.

**v3 removes this constraint** to allow the model to:
- Learn swell-specific correction patterns
- Adapt to seasonal variations in forecast accuracy
- Capture interactions between wave height and other features

The relaxed guardrails (see below) provide sufficient safety bounds without constraining the model's learning capacity.

### Recency Weighting

v3 applies sample weights during training to prioritize recent observations:

```python
def compute_sample_weights(df: pd.DataFrame, recency_days: int = 14) -> np.ndarray:
    """
    Weight recent samples 2x to improve adaptation to current conditions.

    Samples from last `recency_days` get weight=2.0, older samples get weight=1.0.
    """
    now = pd.Timestamp.now(tz='UTC')
    cutoff = now - pd.Timedelta(days=recency_days)

    weights = np.where(
        df['predicted_at'] >= cutoff,
        2.0,  # Recent samples weighted 2x
        1.0   # Older samples weighted 1x
    )
    return weights
```

**Rationale:** Ocean conditions and forecast model accuracy vary seasonally. By weighting recent observations more heavily, the model adapts faster to current patterns while retaining long-term knowledge from older data.

### Relaxed Guardrails

v3 uses relaxed but still physically-constrained guardrails:

```python
# v3 Guardrails (model.py)

# 1. Relative bias clipping: correction limited to +/-75% of forecast (v2: 50%)
max_correction = max(forecast * 0.75, 0.5)  # 0.5m floor (v2: 0.3m)
bias = clip(bias, -max_correction, max_correction)

# 2. Absolute cap: no correction exceeds +/-1.5m (unchanged from v2)
bias = clip(bias, -1.5, 1.5)

# 3. No-correction zone: skip trivial corrections (unchanged)
if abs(bias) < 0.03:
    bias = 0.0

# 4. Physical bounds: corrected height must be realistic (unchanged)
corrected = clip(forecast + bias, 0.01, 15.0)
```

**v3 vs v2 Guardrail Comparison:**

| Guardrail | v2 | v3 | Rationale |
|-----------|----|----|-----------|
| Max correction % | 50% | 75% | Allow larger corrections for systematic biases |
| Correction floor | 0.3m | 0.5m | Prevent over-correction of small waves |
| Absolute cap | +/-1.5m | +/-1.5m | Unchanged |
| No-correction zone | 0.03m | 0.03m | Unchanged |
| Physical bounds | [0.01, 15.0]m | [0.01, 15.0]m | Unchanged |

### v3 Model Parameters

```python
{
    'objective': 'reg:squarederror',
    'n_estimators': 250,           # Increased from 200
    'learning_rate': 0.03,         # Reduced from 0.05 for smoother learning
    'max_depth': 5,                # Increased from 4
    'subsample': 0.8,
    'colsample_bytree': 0.8,
    'reg_alpha': 0.05,             # Reduced regularization
    'min_child_weight': 5,         # Reduced from 10
    'monotone_constraints': None,  # Removed
    'n_jobs': -1
}
```

---

## API Reference

### Authentication

Protected endpoints require `X-Internal-Secret` header:

```bash
curl -H "X-Internal-Secret: your-secret" https://quiver-ml.fly.dev/correct
```

### Endpoints

#### GET /health

Health check (no auth required).

**Response:**
```json
{
  "status": "ok",
  "model_loaded": true,
  "model_version": "v3"
}
```

**Status Values:**
- `ok`: Model loaded and ready
- `degraded`: Service running but model not loaded

#### POST /correct

Correct a single forecast (auth required).

**Request:**
```json
{
  "beach_id": "uuid-string",
  "forecast_ts": "2026-01-14T12:00:00Z",
  "wave_height_m": 1.5,
  "wave_period_s": 10.0,
  "wave_direction_deg": 270.0,
  "wind_speed_ms": 5.0,
  "wind_direction_deg": 180.0
}
```

**Response:**
```json
{
  "beach_id": "uuid-string",
  "forecast_ts": "2026-01-14T12:00:00Z",
  "raw_height_m": 1.5,
  "corrected_height_m": 1.42,
  "bias_applied_m": -0.08,
  "model_version": "v3"
}
```

Note: v3 corrections can be negative (unlike v1 which always added positive bias).

#### POST /correct/batch

Correct multiple forecasts (auth required).

**Request:**
```json
{
  "forecasts": [
    {
      "beach_id": "beach-1",
      "forecast_ts": "2026-01-14T12:00:00Z",
      "wave_height_m": 1.5,
      "wave_period_s": 10.0,
      "wave_direction_deg": 270.0
    },
    {
      "beach_id": "beach-2",
      "forecast_ts": "2026-01-14T12:00:00Z",
      "wave_height_m": 2.0,
      "wave_period_s": 12.0,
      "wave_direction_deg": 290.0
    }
  ]
}
```

**Response:**
```json
{
  "corrections": [
    {
      "beach_id": "beach-1",
      "forecast_ts": "2026-01-14T12:00:00Z",
      "raw_height_m": 1.5,
      "corrected_height_m": 1.42,
      "bias_applied_m": -0.08,
      "model_version": "v3"
    }
  ],
  "model_version": "v3",
  "count": 2
}
```

**Limits:**
- Max batch size: 1000 forecasts
- Typical processing: ~10ms per forecast

### Cron API Routes

#### POST /api/cron/ml/retrain

Orchestrates the model retrain pipeline. Called by scheduled cron (Sundays 6am UTC) or triggered by drift detection.

**Request Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "success": true,
  "model_version": "v3.2",
  "training_samples": 52847,
  "holdout_improvement_pct": 67.3,
  "promoted": true,
  "previous_version": "v3.1"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Holdout improvement 38.2% below threshold (40%)",
  "model_version": "v3.2",
  "promoted": false
}
```

#### GET /api/cron/ml/check-drift

Daily drift detection check. Evaluates model performance and triggers emergency retrain if needed.

**Request Headers:**
```
Authorization: Bearer <CRON_SECRET>
```

**Response:**
```json
{
  "current_improvement_pct": 62.4,
  "baseline_improvement_pct": 65.0,
  "drift_detected": false,
  "retrain_triggered": false,
  "model_age_days": 12
}
```

**Drift Detected Response:**
```json
{
  "current_improvement_pct": 35.2,
  "baseline_improvement_pct": 65.0,
  "drift_detected": true,
  "retrain_triggered": true,
  "reason": "Improvement below 40% threshold"
}
```

### API Routing (v1 vs v2 vs v3)

The `api.py` module branches on the `MODEL_VERSION` environment variable:

- `MODEL_VERSION='v3'`: Uses `preprocess_v3()` from `transformers_v3.py` (11 features + recency weight)
- `MODEL_VERSION='v2'`: Uses `preprocess_v2()` from `transformers_v2.py` (11 features)
- `MODEL_VERSION='v1'` (or unset): Uses `FeatureEngineer` from `transformers.py` (10 features)

The v2 model is always loaded as a fallback regardless of `USE_ENSEMBLE` flag setting.

### Error Responses

| Status | Description |
|--------|-------------|
| 400 | Invalid request (empty batch, exceeds limit) |
| 403 | Missing or invalid API key |
| 500 | Internal server error |
| 503 | Model not loaded |

---

## Ground Truth Matching

Ground truth matching is the process of pairing ML predictions with actual buoy observations to measure model accuracy. This is critical for monitoring model performance and generating training data for future model versions.

### How It Works

1. **Prediction Generation** (`/api/cron/ml/correct-forecasts`)
   - Runs on schedule to generate ML-corrected forecasts
   - Filters to only process beaches with observation sources (96 beaches)
   - Logs predictions to `ml_predictions_log` table with `observed_m = NULL`

2. **Observation Backfill** (pg_cron: `ml-backfill-observations`)
   - Runs every 10 minutes via Supabase pg_cron
   - Processes up to **10,000** predictions per run (increased from 5,000 in Jan 2026)
   - Uses JOIN-based matching for efficiency
   - Three-step pipeline: match, sentinel, cleanup

3. **Matching Window**
   - Predictions are eligible for matching after 2 hours (observation delay)
   - Predictions use +/- 2 hour window for observation matching
   - Predictions older than 7 days are excluded (observation data retention)
   - Observations must have non-null `wave_height_m` to match

### Backfill Function (Updated Jan 30, 2026)

The `backfill_ml_observations_batch(batch_size INT)` function runs directly in PostgreSQL with a three-step pipeline:

```sql
-- Manual execution
SELECT * FROM backfill_ml_observations_batch(10000);

-- Returns:
-- processed | matched | sentinel_marked | expired_deleted | elapsed_ms
-- ----------+---------+-----------------+-----------------+-----------
--     10000 |    1847 |            8100 |              53 |    1234.56
```

**Function behavior (3-step pipeline):**

| Step | Action | Threshold | Description |
|------|--------|-----------|-------------|
| 1 | **Match** | +/- 2 hours | Join predictions with observations, update ground truth |
| 2 | **Sentinel** | > 24 hours | Mark old predictions as unmatchable (`observed_m = -1`) |
| 3 | **Cleanup** | > 72 hours | DELETE pending predictions that will never match (TTL) |

**Key improvements (Jan 30, 2026 optimization):**
- Sentinel threshold reduced: 48h to 24h (IOOS data arrives within hours)
- Added 72h TTL cleanup to prevent unbounded table growth
- Batch size increased: 5,000 to 10,000
- Result: 49% reduction in pending queue, 53% reduction in oldest pending age

**pg_cron Schedule:**

| Job Name | Schedule | Command |
|----------|----------|---------|
| `ml-backfill-observations` | `*/10 * * * *` | `SELECT * FROM backfill_ml_observations_batch(10000)` |

### Observable Beaches View

The `observable_beaches` materialized view tracks beaches that have valid observation sources:

```sql
-- Definition
CREATE MATERIALIZED VIEW observable_beaches AS
SELECT DISTINCT mf.beach_id
FROM marine_forecasts mf
WHERE mf.is_observed = true
  AND mf.wave_height_m IS NOT NULL
  AND mf.source IN ('cdip', 'ndbc')
WITH DATA;
```

**Current Coverage:**
- 96 beaches with CDIP or NDBC observations (of 261 total)
- Only these beaches receive ML predictions
- Reduces wasteful predictions by ~63%

**Refresh Schedule:**
- Daily at 6am UTC via pg_cron
- Manual refresh: `REFRESH MATERIALIZED VIEW CONCURRENTLY observable_beaches`
- Function: `SELECT refresh_observable_beaches();`

### Health Monitoring

#### Primary Health Check: `get_ml_health_metrics()`

Returns ML pipeline health for monitoring and alerting:

```sql
SELECT * FROM get_ml_health_metrics();
```

**Columns returned (Updated Jan 30, 2026):**

| Column | Type | Description |
|--------|------|-------------|
| `total_predictions` | BIGINT | Total predictions in last 30 days |
| `pending_observations` | BIGINT | Predictions awaiting ground truth match |
| `pending_12_24h` | BIGINT | **NEW:** Early warning - predictions 12-24h old |
| `pending_gt_24h` | BIGINT | **NEW:** Should be 0 after optimization |
| `sentinel_marked` | BIGINT | Predictions marked as unmatchable (-1) |
| `matched_last_24h` | BIGINT | Predictions matched in last 24 hours |
| `total_observable_24h` | BIGINT | Total observable predictions in last 24 hours |
| `match_rate_24h` | NUMERIC | Percentage of predictions matched |
| `avg_raw_error_24h` | NUMERIC | Mean raw forecast error |
| `avg_corrected_error_24h` | NUMERIC | Mean corrected forecast error |
| `improvement_pct_24h` | NUMERIC | Percentage improvement from ML |
| `oldest_pending_age_hours` | NUMERIC | Age of oldest pending prediction |
| `observable_beaches_count` | BIGINT | Count of beaches with observations |

**Alert Thresholds:**

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| `match_rate_24h` | > 50% | 20-50% | < 20% |
| `pending_observations` | < 10,000 | 10,000-50,000 | > 50,000 |
| `pending_12_24h` | < 5,000 | 5,000-15,000 | > 15,000 |
| `pending_gt_24h` | 0 | 1-100 | > 100 |
| `oldest_pending_age_hours` | < 12h | 12-20h | > 20h |

#### Legacy Health Check: `check_ml_ground_truth_health()`

More detailed health check with status messages:

```sql
SELECT * FROM check_ml_ground_truth_health();
```

Returns:

| Metric | Description | Thresholds |
|--------|-------------|------------|
| `ground_truth_rate_24h` | % of predictions matched in last 24h | ok: >50%, warning: 20-50%, critical: <20% |
| `backlog_size` | Predictions waiting for matching | ok: <20k, warning: 20-50k, critical: >50k |
| `improvement_rate_7d` | % of forecasts improved by ML | ok: >50%, warning: 40-50%, critical: <40% |
| `observable_beaches` | Count of beaches with observations | informational |

Example output:
```
metric                  | value  | status  | message
------------------------|--------|---------|------------------------------------------
ground_truth_rate_24h   | 72.3   | ok      | Matched 1847 of 2556 predictions (72.3%)
backlog_size            | 15234  | ok      | 15234 predictions waiting for ground truth
improvement_rate_7d     | 63.0   | ok      | ML corrections improved 63.0% of forecasts
observable_beaches      | 96     | ok      | 96 beaches have observation sources
```

### Sentinel Values

| `observed_m` Value | Meaning |
|--------------------|---------|
| `NULL` | Pending - awaiting observation match |
| `-1` | Sentinel - no observation will ever arrive (>24h old) |
| `> 0` | Matched - ground truth observation recorded |

### pg_cron Job Monitoring

Monitor the backfill job execution:

```sql
-- Recent job runs
SELECT
  jobname,
  start_time,
  end_time,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duration_seconds,
  status,
  return_message
FROM cron.job_run_details
WHERE jobname = 'ml-backfill-observations'
ORDER BY start_time DESC
LIMIT 10;

-- Job success rate (last 24 hours)
SELECT
  status,
  COUNT(*) as count
FROM cron.job_run_details
WHERE jobname = 'ml-backfill-observations'
  AND start_time > NOW() - INTERVAL '24 hours'
GROUP BY status;
```

### Troubleshooting

**Low Ground Truth Rate (<50%)**

1. Check observation data freshness:
   ```sql
   SELECT source, MAX(ts) as latest, COUNT(*) as count_24h
   FROM marine_forecasts
   WHERE is_observed = true AND ts > NOW() - INTERVAL '24 hours'
   GROUP BY source;
   ```

2. Verify NDBC stations are returning wave data:
   ```sql
   SELECT source,
          COUNT(*) as total,
          COUNT(wave_height_m) as with_wave_height
   FROM marine_forecasts
   WHERE is_observed = true AND ts > NOW() - INTERVAL '24 hours'
   GROUP BY source;
   ```

3. Check pg_cron job status:
   ```sql
   SELECT * FROM cron.job WHERE jobname = 'ml-backfill-observations';
   ```

**Growing Backlog (>50k)**

1. Check pg_cron job execution history
2. Consider temporarily increasing batch size:
   ```sql
   -- Run larger batch manually
   SELECT * FROM backfill_ml_observations_batch(20000);
   ```

3. Temporarily increase job frequency:
   ```sql
   SELECT cron.alter_job(
     job_id := (SELECT jobid FROM cron.job WHERE jobname = 'ml-backfill-observations'),
     schedule := '*/5 * * * *'
   );
   ```

**Non-zero pending_gt_24h**

This should always be 0 after the Jan 30, 2026 optimization. Non-zero values indicate sentinel marking failed:

```sql
-- Manual sentinel marking
UPDATE ml_predictions_log
SET observed_m = -1
WHERE observed_m IS NULL
  AND predicted_at < NOW() - INTERVAL '24 hours';
```

**NDBC Observations Missing Wave Heights**

The NDBC service filters for:
- Stations with `data: "y"` (realtime data available)
- Observations with valid `WVHT` field (searches up to 20 rows backward)

If NDBC data is missing:
1. Check station is a buoy type (not weather-only)
2. Verify station has wave sensors: `https://www.ndbc.noaa.gov/station_page.php?station=XXXXX`
3. Review recent data: `https://www.ndbc.noaa.gov/data/realtime2/XXXXX.txt`

**Observable Beaches Count Dropping**

Refresh the materialized view:
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY observable_beaches;

-- Verify count
SELECT COUNT(*) FROM observable_beaches;
```

### Key Files

| File | Purpose |
|------|---------|
| `app/api/cron/ml/correct-forecasts/route.ts` | Generate ML predictions (filters to observable beaches) |
| `app/api/cron/ml/refresh-observable-beaches/route.ts` | Refresh observable_beaches view |
| `app/api/cron/ml/retrain/route.ts` | Orchestrates model retrain pipeline |
| `app/api/cron/ml/check-drift/route.ts` | Daily drift detection check |
| `lib/services/ndbc-service.ts` | NDBC station data fetching |
| `app/api/cron/forecasts/refresh/route.ts` | Ingest NDBC/CDIP observations |

---

## Training Pipeline

### v3 Training Pipeline (Current)

#### Data Extraction

v3 training data uses the same source as v2 (`ml_predictions_log`) but extracts a larger window (up to 90 days) and applies recency weighting. The automated pipeline floors the cutoff at `SHOALING_CHANGE_DATE` to exclude pre-shoaling bias data.

```bash
cd ml

# Automated pipeline uses SHOALING_CHANGE_DATE floor automatically

# Manual extraction (recommended: use --since to exclude pre-shoaling data)
SUPABASE_URL=<prod_url> SUPABASE_SERVICE_ROLE_KEY=<key> \
  python3 extract_training_data_v2.py --since 2026-02-05T06:00:00+00:00

# Legacy v3-specific extraction
SUPABASE_URL=<prod_url> SUPABASE_SERVICE_ROLE_KEY=<key> python3 extract_training_data_v3.py
```

**v3 data characteristics:**
- Source: `ml_predictions_log` (pre-matched numeric pairs)
- Window: Up to 90 days of historical data (floored at 2026-02-05 for shoaling change)
- Recency weighting: Last 14 days weighted 2x
- Output: `data/training_data_v3.csv` (gitignored)

#### Model Training

```bash
python3 train_v3.py --data data/training_data_v3.csv --output models/bias_model_v3.json
```

**v3 training features:**
- **Temporal holdout:** Last 7 days held out for validation
- **Recency weighting:** Samples from last 14 days get 2x weight
- **No monotone constraints:** Model learns unconstrained relationships
- **Relaxed hyperparameters:** More trees (250), deeper trees (depth 5), less regularization

#### Go/No-Go Validation Gates

The `train_v3.py` script enforces automatic quality gates on the holdout set before saving the model:

| Gate | Threshold | Description |
|------|-----------|-------------|
| Overall improvement | >40% | Percentage of holdout forecasts improved (relaxed from v2's 50%) |
| Per-bucket improvement | >35% | Each size bucket must independently improve (relaxed from v2's 40%) |
| Max bucket degradation | <0.08m | No bucket's mean error can increase by more than 0.08m (relaxed from v2's 0.05m) |

If any gate fails, the script exits with a non-zero code and the model is NOT saved.

**Bucket definitions:**
- Small waves: <0.5m
- Medium waves: 0.5-1.5m
- Large waves: >1.5m

### v2 Training Pipeline (Fallback)

#### Data Extraction

v2 training data comes from the `ml_predictions_log` table, which contains pre-matched numeric forecast/observation pairs. This eliminates the text-parsing fragility of v1.

```bash
cd ml

# With --since filter (recommended for post-shoaling training)
SUPABASE_URL=<prod_url> SUPABASE_SERVICE_ROLE_KEY=<key> \
  python3 extract_training_data_v2.py --since 2026-02-05T06:00:00+00:00

# Without filter (all available data)
SUPABASE_URL=<prod_url> SUPABASE_SERVICE_ROLE_KEY=<key> python3 extract_training_data_v2.py
```

**v2 data characteristics:**
- Source: `ml_predictions_log` (pre-matched numeric pairs)
- Volume: ~144K matched pairs
- No text parsing required (unlike v1's enhanced_forecasts extraction)
- Output: `data/training_data_v2.csv` (~14MB, gitignored)

#### Model Training

```bash
python3 train_v2.py --data data/training_data_v2.csv --output models/bias_model_v2.json
```

**v2 training features:**
- **Temporal holdout:** Last 2 days held out for validation (not random split), preventing data leakage
- **Monotone constraints:** `forecast_height_m` constrained to `-1` (correction decreases as forecast increases)
- **Conservative hyperparameters:** Lower learning rate (0.05), shallower trees (depth 4), stronger regularization (alpha 0.1, min_child_weight 10)

#### Go/No-Go Validation Gates

The `train_v2.py` script enforces automatic quality gates on the holdout set before saving the model:

| Gate | Threshold | Description |
|------|-----------|-------------|
| Overall improvement | >50% | Percentage of holdout forecasts improved |
| Per-bucket improvement | >40% | Each size bucket must independently improve |
| Max bucket degradation | <0.05m | No bucket's mean error can increase by more than 0.05m |

If any gate fails, the script exits with a non-zero code and the model is NOT saved.

**Bucket definitions:**
- Small waves: <0.5m
- Medium waves: 0.5-1.5m
- Large waves: >1.5m

#### v2 Holdout Results

| Bucket | Improvement Rate | Target |
|--------|-----------------|--------|
| Overall | 63.0% | >50% |
| Small (<0.5m) | 98.3% | >40% |
| Medium (0.5-1.5m) | 62.3% | >40% |
| Large (>1.5m) | 56.1% | >40% |

**Summary statistics:**
- Mean bias: +0.029m (vs v1's +0.7m)
- Top features by importance: `forecast_height_m` (70%), `wave_steepness` (27%), `hour` (3%)

### v1 Training Pipeline (Legacy)

#### Prerequisites

```bash
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_KEY=your-service-key
```

#### Data Extraction

v1 training data was extracted from `enhanced_forecasts` by text-parsing forecast descriptions:

```bash
python extract_training_data.py --output training_data.csv
```

**v1 data characteristics:**
- Source: `enhanced_forecasts` (text parsing) + `marine_forecasts` (observations)
- Volume: ~2K matched pairs
- Time span: ~8 days (January 12-20, 2026)
- Limitation: Captured only one weather pattern (underestimation period)

#### Model Training

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

### Model Versioning

Model files are named with version suffix: `bias_model_v{N}.json`

When deploying a new model:
1. Train and validate (ensure go/no-go gates pass)
2. Update `MODEL_PATH`, `MODEL_VERSION`, and `FALLBACK_MODEL_PATH` in fly.toml
3. Deploy: `fly deploy`
4. Monitor health endpoint for `model_version=v3`
5. After first cron cycle: verify bias is balanced (not all positive)
6. After 24h: check `get_ml_weekly_metrics()` shows `improvement_pct > 40%`

---

## Model Architecture (Feature Reference)

### v3/v2 Input Features (11 features)

| Feature | Type | Description | Importance |
|---------|------|-------------|------------|
| `forecast_height_m` | float | Raw NOAA forecast (m) | 70% |
| `wave_steepness` | float | `height / (period^2 + 0.1)` | 27% |
| `hour` | int | Hour of day (0-23) | 3% |
| `wave_period_sq` | float | Period squared (bathymetry proxy) | <1% |
| `wave_direction_sin` | float | Sin-encoded wave direction | <1% |
| `wave_direction_cos` | float | Cos-encoded wave direction | <1% |
| `wind_speed_ms` | float | Wind speed (m/s) | <1% |
| `wind_direction_sin` | float | Sin-encoded wind direction | <1% |
| `wind_direction_cos` | float | Cos-encoded wind direction | <1% |
| `month` | int | Month (1-12) | <1% |
| `wind_missing` | int | Indicator: wind data absent | <1% |

**Top features:** The model is dominated by `forecast_height_m` (70%) and `wave_steepness` (27%). The new `wave_steepness` feature captures the relationship between wave height and period, encoding whether waves are steep wind-chop or long-period groundswell.

### v1 Input Features (10 features)

| Feature | Type | Description |
|---------|------|-------------|
| `wave_height_model` | float | Raw NOAA forecast (m) |
| `wave_period` | float | Wave period (seconds) |
| `wave_period_sq` | float | Period squared |
| `wave_direction_sin` | float | Sin-encoded direction |
| `wave_direction_cos` | float | Cos-encoded direction |
| `wind_speed` | float | Wind speed (m/s) |
| `wind_direction_sin` | float | Sin-encoded wind direction |
| `wind_direction_cos` | float | Cos-encoded wind direction |
| `hour` | int | Hour of day (0-23) |
| `month` | int | Month (1-12) |

### Feature Engineering

**v3/v2 Feature Engineering (`transformers_v2.py`, `transformers_v3.py`):**

The `preprocess_v2()` and `preprocess_v3()` functions generate 11 features from raw forecast inputs. Key addition is `wave_steepness`:

```python
wave_steepness = forecast_height_m / (wave_period_s ** 2 + 0.1)
```

This captures wave geometry: steep waves (high steepness) behave differently than gentle swells (low steepness) and exhibit different forecast biases.

**Cyclical Direction Encoding (shared by all versions):**

Wave and wind directions are circular (0-360), so raw values create artificial distances (359 vs 1 = 358, not 2):

```python
sin_feature = sin(2 * pi * direction / 360)
cos_feature = cos(2 * pi * direction / 360)
```

**Temporal Features:**
- `hour`: Captures diurnal patterns (morning glass, afternoon wind)
- `month`: Captures seasonal patterns

---

## Deployment

### Fly.io Configuration

**File:** `fly.toml` (current v3 configuration)

```toml
app = 'quiver-ml'
primary_region = 'lax'

[build]
  dockerfile = 'Dockerfile'

[env]
  MODEL_PATH = 'models/bias_model_v3.json'
  MODEL_VERSION = 'v3'
  FALLBACK_MODEL_PATH = 'models/bias_model_v2.json'
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

**Key deployment notes:**
- Model JSON files are gitignored but baked into the Docker image at deploy time
- Training data CSV is never committed to the repository
- The v2 model is always available as fallback via `FALLBACK_MODEL_PATH`

### Docker Configuration

**File:** `Dockerfile`

```dockerfile
FROM python:3.11-slim
WORKDIR /app

# Install dependencies (cached layer)
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application
COPY . .
RUN mkdir -p models

# Security: non-root user
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')" || exit 1

CMD ["uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8080"]
```

### Deployment Commands

```bash
# Deploy to Fly.io
fly deploy

# Set secret (one-time)
fly secrets set INTERNAL_SECRET=your-secret-value

# View logs
fly logs --app quiver-ml

# SSH into container
fly ssh console

# Check app status
fly status
```

### Environment Variables (Secrets)

| Variable | Description | Set Via |
|----------|-------------|---------|
| `INTERNAL_SECRET` | API authentication key | `fly secrets set` |
| `MODEL_PATH` | Path to primary model (default: `models/bias_model_v3.json`) | `fly.toml [env]` |
| `MODEL_VERSION` | Version string for tracking (default: `v3`) | `fly.toml [env]` |
| `FALLBACK_MODEL_PATH` | Path to fallback model (`models/bias_model_v2.json`) | `fly.toml [env]` |

---

## Monitoring

### Health Check

```bash
curl https://quiver-ml.fly.dev/health
```

Expected response:
```json
{"status": "ok", "model_loaded": true, "model_version": "v3"}
```

### Post-Deployment Verification

| Timeframe | Check | Expected |
|-----------|-------|----------|
| Immediately | `/health` response | `model_version: "v3"` |
| After first cron | Bias distribution | Balanced (positive and negative corrections) |
| After 24h | `get_ml_weekly_metrics()` | `improvement_pct > 40%` |

### Rollback Triggers

Rollback to v2 if any of the following occur:
- `improvement_rate < 35%` after 24h of production data
- `avg_bias > +0.5m` (model reverting to v1-like behavior)
- Sustained `model_loaded: false` on health endpoint

To rollback: update `fly.toml` to set `MODEL_PATH=models/bias_model_v2.json` and `MODEL_VERSION=v2`, then `fly deploy`.

### Performance Metrics

Query PostgreSQL for model performance:

```sql
SELECT * FROM get_ml_weekly_metrics();
```

Returns:
| Column | Description |
|--------|-------------|
| `model_version` | Version identifier |
| `predictions` | Total predictions this week |
| `with_ground_truth` | Predictions matched with observations |
| `avg_raw_error_m` | Mean absolute error (uncorrected) |
| `avg_corrected_error_m` | Mean absolute error (corrected) |
| `pct_improved` | % of forecasts improved by ML |

### Logs

```bash
# Real-time logs
fly logs --app quiver-ml

# Filter for errors
fly logs --app quiver-ml | grep -i error
```

---

## Physical Constraints

### v3 Guardrails (Current)

The v3 model enforces relaxed but still physically-constrained guardrails in `model.py`:

```python
# 1. Relative clipping: bias limited to +/-75% of forecast (0.5m floor)
max_correction = max(forecast * 0.75, 0.5)
bias = clip(bias, -max_correction, max_correction)

# 2. Absolute cap: +/-1.5m maximum correction
bias = clip(bias, -1.5, 1.5)

# 3. No-correction zone: skip corrections below 0.03m
if abs(bias) < 0.03:
    bias = 0.0

# 4. Physical bounds: corrected height in [0.01, 15.0]m
corrected = clip(forecast + bias, 0.01, 15.0)
```

### v2 Guardrails (Fallback)

```python
# 1. Relative clipping: bias limited to +/-50% of forecast (0.3m floor)
max_correction = max(forecast * 0.5, 0.3)
bias = clip(bias, -max_correction, max_correction)

# 2. Absolute cap: +/-1.5m maximum correction
bias = clip(bias, -1.5, 1.5)

# 3. No-correction zone: skip corrections below 0.03m
if abs(bias) < 0.03:
    bias = 0.0

# 4. Physical bounds: corrected height in [0.01, 15.0]m
corrected = clip(forecast + bias, 0.01, 15.0)
```

### v1 Guardrails (Deprecated)

```python
# v1 only enforced minimum height
corrected_forecast = corrected_forecast.apply(lambda x: max(0.01, x))
```

---

## Related Documentation

- [ML Bias Correction Feature](/docs/features/ML_BIAS_CORRECTION.md)
- [ML Operations Runbook](/docs/guides/ML_OPERATIONS_RUNBOOK.md)
- [TypeScript ML Module](/lib/ml/ARCHITECTURE.md)
- [Cron Jobs](/app/api/cron/ml/ARCHITECTURE.md)
- [Postmortem: ML Model Regression](/docs/postmortems/2026-01-20-ml-model-regression.md)

---

**Last Updated:** February 2026
