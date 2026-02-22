# ML Operations Runbook

> Operational procedures for the Quiver ML bias correction pipeline.

**Last Updated:** February 9, 2026

## Table of Contents

- [Overview](#overview)
- [Daily Operations](#daily-operations)
- [Monitoring](#monitoring)
- [Data Retention Policy](#data-retention-policy)
- [Manual Interventions](#manual-interventions)
- [Troubleshooting](#troubleshooting)
- [Emergency Procedures](#emergency-procedures)
- [Scheduled Maintenance](#scheduled-maintenance)

---

## Overview

The ML pipeline consists of three main components:

| Component | Location | Purpose |
|-----------|----------|---------|
| ML Service | Fly.io (`quiver-ml`) | XGBoost model inference |
| Correction Cron | Vercel | Generate ML predictions |
| Backfill Job | Supabase pg_cron | Match predictions with observations |

### Architecture Diagram

```
                                 +------------------+
                                 |   Fly.io ML      |
                                 |   Service        |
                                 |  /correct/batch  |
                                 +--------+---------+
                                          ^
                                          |
+------------------+            +------------------+
|  NOAA Forecasts  |----------->|  Vercel Cron     |
| enhanced_        |            |  correct-        |
| forecasts        |            |  forecasts       |
+------------------+            +--------+---------+
                                         |
                                         v
+------------------+            +------------------+
|  Buoy Obs        |            | ml_predictions_  |
|  marine_         |<---------->|      log         |
|  forecasts       |            +--------+---------+
+------------------+                     ^
                                         |
                               +------------------+
                               |  pg_cron         |
                               |  backfill_ml_    |
                               |  observations    |
                               +------------------+
```

### Processing Thresholds (Updated Feb 9, 2026)

| Threshold | Value | Purpose |
|-----------|-------|---------|
| Match Window | +/- 4 hours | Time window for matching predictions to observations |
| Sentinel Threshold | **24 hours** | Mark predictions as unmatchable (was 48h) |
| TTL Cleanup | **72 hours** | Delete pending predictions that will never match |
| Batch Size | **10,000** | Predictions processed per pg_cron run (was 5,000) |

---

## Daily Operations

### Morning Health Check (Recommended: 9 AM local time)

Run these queries in Supabase SQL Editor:

```sql
-- 1. Check pipeline health (NEW: includes early warning buckets)
SELECT * FROM get_ml_health_metrics();

-- Expected:
--   match_rate_24h > 20% (IOOS buoys report every 2-6h, ~22-25% is structural ceiling)
--   pending_gt_24h = 0 (indicates threshold working)
--   pending_12_24h < 3000 (early warning)

-- 2. Check pg_cron job status (last 24 hours)
SELECT
  jobname,
  start_time,
  end_time,
  status,
  return_message
FROM cron.job_run_details
WHERE jobname = 'ml-backfill-observations'
  AND start_time > NOW() - INTERVAL '24 hours'
ORDER BY start_time DESC
LIMIT 10;

-- Expected: All status = 'succeeded'

-- 3. Check model performance
SELECT * FROM get_ml_weekly_metrics();

-- Expected: pct_improved > 45%
```

### Health Check Interpretation

| Metric | Healthy | Warning | Critical |
|--------|---------|---------|----------|
| `match_rate_24h` | > 20% | 10-20% | < 10% |
| `pending_observations` | < 5,000 | 5,000-15,000 | > 15,000 |
| `pending_12_24h` | < 3,000 | 3,000-10,000 | > 10,000 |
| `pending_gt_24h` | 0 | 1-100 | > 100 |
| `oldest_pending_age_hours` | < 12h | 12-20h | > 20h |
| `pct_improved` | > 10% | 5-10% | < 5% |

---

## Monitoring

### Key SQL Queries

#### Pipeline Health Dashboard

```sql
-- Comprehensive health check with early warning metrics
SELECT
  h.pending_observations,
  h.pending_12_24h,         -- Early warning: approaching threshold
  h.pending_gt_24h,         -- Should be 0
  h.matched_last_24h,
  h.total_observable_24h,
  h.match_rate_24h,
  h.oldest_pending_age_hours,
  h.sentinel_marked,
  h.observable_beaches_count,
  w.pct_improved,
  w.avg_raw_error_m,
  w.avg_corrected_error_m
FROM get_ml_health_metrics() h
CROSS JOIN get_ml_weekly_metrics() w
WHERE w.model_version = (
  SELECT model_version FROM ml_predictions_log
  WHERE predicted_at > NOW() - INTERVAL '24 hours'
  GROUP BY model_version ORDER BY COUNT(*) DESC LIMIT 1
);
```

#### Recent Predictions by Model Version

```sql
SELECT
  model_version,
  COUNT(*) as total,
  COUNT(observed_m) FILTER (WHERE observed_m > 0) as matched,
  COUNT(observed_m) FILTER (WHERE observed_m = -1) as sentinel_marked,
  ROUND(100.0 * COUNT(observed_m) FILTER (WHERE observed_m > 0) / NULLIF(COUNT(*), 0), 1) as match_rate,
  ROUND(AVG(raw_error_m)::numeric, 3) as avg_raw_error,
  ROUND(AVG(corrected_error_m)::numeric, 3) as avg_corrected_error
FROM ml_predictions_log
WHERE predicted_at > NOW() - INTERVAL '24 hours'
GROUP BY model_version
ORDER BY total DESC;
```

#### pg_cron Job Performance

```sql
-- Job execution history with timing and results
SELECT
  start_time,
  EXTRACT(EPOCH FROM (end_time - start_time)) as duration_seconds,
  status,
  return_message
FROM cron.job_run_details
WHERE jobname = 'ml-backfill-observations'
ORDER BY start_time DESC
LIMIT 20;
```

#### Observation Source Health

```sql
-- Check buoy data freshness
SELECT
  source,
  COUNT(*) as count_24h,
  MAX(ts) as latest_observation
FROM marine_forecasts
WHERE is_observed = true
  AND ts > NOW() - INTERVAL '24 hours'
GROUP BY source;
```

### Alert Thresholds

Configure alerts based on `get_ml_health_metrics()`:

| Condition | Severity | Action |
|-----------|----------|--------|
| `pending_gt_24h > 0` | Warning | Check if backfill job running |
| `pending_gt_24h > 100` | Critical | Sentinel marking may have failed |
| `pending_12_24h > 15000` | Warning | Backlog approaching threshold |
| `match_rate_24h < 20%` | Critical | Investigate observation sources |
| `pending_observations > 15000` | Warning | Consider temporary batch increase |
| `oldest_pending_age_hours > 20` | Warning | Check job execution |

---

## Data Retention Policy

### Current Retention Settings

As of January 2026, forecast data retention was extended to support ML model training:

| Table | Retention | Previous | Changed |
|-------|-----------|----------|---------|
| `marine_forecasts` | 90 days | 7 days | Jan 2026 |
| `tide_forecasts` | 90 days | 7 days | Jan 2026 |
| `enhanced_forecasts` | 14 days | 14 days | No change |

### ML Predictions Log Cleanup (New: Jan 30, 2026)

The `backfill_ml_observations_batch()` function now automatically deletes pending predictions older than 72 hours. This prevents unbounded table growth from predictions that will never match observations.

| Cleanup Type | Threshold | Triggered By |
|--------------|-----------|--------------|
| Sentinel Marking | > 24 hours | `backfill_ml_observations_batch()` |
| TTL Deletion | > 72 hours | `backfill_ml_observations_batch()` |
| Historical Cleanup | > 90 days | Manual (monthly task) |

### Why 90 Days?

The v1 model was trained on only 8 days of data (2,275 samples), which caused:
- Biased predictions that didn't generalize
- Overfitting to a single weather pattern
- Poor performance after weather conditions changed

With 90-day retention:
- Target: 30,000+ training samples by mid-April 2026
- Captures diverse weather conditions (storms, calm periods, seasonal patterns)
- Enables proper model retraining with statistically significant data

### Storage Impact

| Metric | Value |
|--------|-------|
| Current DB size | ~535 MB |
| 90-day forecast estimate | ~1.2 GB |
| Supabase Pro limit | 8 GB |
| Available headroom | ~6.3 GB |

### Monitoring Training Data Accumulation

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

-- Monitor overall storage
SELECT
  relname as table_name,
  pg_size_pretty(pg_total_relation_size(relid)) as total_size,
  n_live_tup as row_count
FROM pg_stat_user_tables
WHERE relname IN ('marine_forecasts', 'tide_forecasts', 'enhanced_forecasts', 'ml_predictions_log')
ORDER BY pg_total_relation_size(relid) DESC;
```

### Retention Job Configuration

The `prune_forecasts_retention` function runs daily at 5am UTC:

```sql
-- Verify retention job configuration
SELECT jobid, jobname, schedule, command
FROM cron.job
WHERE jobname = 'prune_forecasts_retention';

-- Expected:
-- schedule: 0 5 * * *
-- command: SELECT prune_forecasts_retention(90, 14, 25000);
```

### Adjusting Retention (If Needed)

If storage becomes a concern:

```sql
-- Option 1: Temporarily reduce retention (NOT RECOMMENDED for ML)
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'prune_forecasts_retention'),
  command := $$SELECT prune_forecasts_retention(60, 14, 25000);$$
);

-- Option 2: Run manual cleanup for specific tables
DELETE FROM marine_forecasts
WHERE ts < NOW() - INTERVAL '60 days'
  AND is_observed = false;  -- Only delete forecasts, keep observations
```

**Warning**: Reducing retention below 60 days will impact ML model training quality.

---

## Manual Interventions

### Run Backfill Manually

If the pg_cron job is failing or you need to clear a backlog:

```sql
-- Process batch with new function signature (returns 5 columns)
SELECT * FROM backfill_ml_observations_batch(10000);

-- Returns:
-- processed | matched | sentinel_marked | expired_deleted | elapsed_ms
-- ----------+---------+-----------------+-----------------+-----------
--     10000 |    1847 |            8100 |              53 |    1234.56

-- Repeat until backlog is cleared
-- Check progress
SELECT
  COUNT(*) FILTER (WHERE observed_m IS NULL AND predicted_at < NOW() - INTERVAL '4 hours') as pending,
  COUNT(*) FILTER (WHERE observed_m IS NULL AND predicted_at < NOW() - INTERVAL '24 hours') as should_be_zero
FROM ml_predictions_log
WHERE predicted_at > NOW() - INTERVAL '7 days';
```

### Force Refresh Observable Beaches

If beach coverage seems incorrect:

```sql
-- Refresh the materialized view
REFRESH MATERIALIZED VIEW CONCURRENTLY observable_beaches;

-- Verify count
SELECT COUNT(*) FROM observable_beaches;
-- Expected: ~46 beaches (only beaches with ground truth from IOOS buoys)
```

### Check ML Service Health

```bash
# Check if service is running
curl https://quiver-ml.fly.dev/health

# Expected response:
# {"status": "ok", "model_loaded": true, "model_version": "v1"}

# Wake up cold service (if needed)
curl -w "\nTime: %{time_total}s\n" https://quiver-ml.fly.dev/health

# View recent logs
fly logs --app quiver-ml
```

### Modify pg_cron Schedule

If you need to change the backfill frequency:

```sql
-- View current schedule
SELECT jobid, schedule, command FROM cron.job
WHERE jobname = 'ml-backfill-observations';

-- Update schedule (e.g., every 5 minutes during backlog)
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'ml-backfill-observations'),
  schedule := '*/5 * * * *'
);

-- Restore normal schedule
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'ml-backfill-observations'),
  schedule := '*/10 * * * *'
);
```

---

## Troubleshooting

### Problem: Low Match Rate (< 20%)

**Symptoms:** `get_ml_health_metrics()` shows low `match_rate_24h`

**Diagnosis:**

```sql
-- Check observation data freshness
SELECT source, MAX(ts) as latest, COUNT(*) as count_24h
FROM marine_forecasts
WHERE is_observed = true AND ts > NOW() - INTERVAL '24 hours'
GROUP BY source;

-- Check if observations have wave heights
SELECT source,
       COUNT(*) as total,
       COUNT(wave_height_m) as with_wave_height
FROM marine_forecasts
WHERE is_observed = true AND ts > NOW() - INTERVAL '24 hours'
GROUP BY source;
```

**Solutions:**

1. If observations are stale: Check NDBC/CDIP ingestion cron jobs
2. If wave_height_m is NULL: NDBC station may have sensor issues
3. If no observations: Refresh `observable_beaches` view

### Problem: Growing Backlog (> 50,000 pending)

**Symptoms:** `pending_observations` increasing over time

**Diagnosis:**

```sql
-- Check pg_cron job execution
SELECT start_time, status, return_message
FROM cron.job_run_details
WHERE jobname = 'ml-backfill-observations'
ORDER BY start_time DESC
LIMIT 5;

-- Check if job is registered
SELECT * FROM cron.job WHERE jobname = 'ml-backfill-observations';

-- Check batch processing rate
SELECT
  DATE_TRUNC('hour', start_time) as hour,
  COUNT(*) as runs,
  SUM((return_message::json->>'matched')::int) as total_matched,
  SUM((return_message::json->>'sentinel_marked')::int) as total_sentinel
FROM cron.job_run_details
WHERE jobname = 'ml-backfill-observations'
  AND start_time > NOW() - INTERVAL '24 hours'
GROUP BY 1
ORDER BY 1 DESC;
```

**Solutions:**

1. If job not running: Re-register the pg_cron job
2. If job timing out: Reduce batch size
3. Temporary fix: Run manual backfill with larger batch size

### Problem: pending_gt_24h > 0

**Symptoms:** `get_ml_health_metrics()` shows non-zero `pending_gt_24h`

**Diagnosis:**

This should always be 0 after the Jan 30, 2026 optimization. Non-zero values indicate sentinel marking failed.

```sql
-- Check for stuck predictions
SELECT
  COUNT(*) as count,
  MIN(predicted_at) as oldest,
  MAX(predicted_at) as newest
FROM ml_predictions_log
WHERE observed_m IS NULL
  AND predicted_at < NOW() - INTERVAL '24 hours';
```

**Solutions:**

```sql
-- Manual sentinel marking
UPDATE ml_predictions_log
SET observed_m = -1
WHERE observed_m IS NULL
  AND predicted_at < NOW() - INTERVAL '24 hours';
```

### Problem: Model Regression (pct_improved < 40%)

**Symptoms:** `get_ml_weekly_metrics()` shows low improvement rate

**Diagnosis:**

```sql
-- Check by model version
SELECT
  model_version,
  COUNT(*) as predictions,
  ROUND(AVG(raw_error_m - corrected_error_m)::numeric, 3) as avg_improvement,
  ROUND(100.0 * COUNT(*) FILTER (WHERE corrected_error_m < raw_error_m) /
        NULLIF(COUNT(observed_m) FILTER (WHERE observed_m > 0), 0), 1) as pct_improved
FROM ml_predictions_log
WHERE predicted_at > NOW() - INTERVAL '7 days'
  AND observed_m > 0
GROUP BY model_version;
```

**Solutions:**

1. If new model is worse: Roll back to previous version
2. If gradual decline: Retrain model with recent data
3. See postmortem `2026-01-20-ml-model-regression.md` for rollback procedure

### Problem: pg_cron Job Not Running

**Symptoms:** No recent entries in `cron.job_run_details`

**Diagnosis:**

```sql
-- Check if job exists
SELECT jobid, jobname, schedule, active FROM cron.job
WHERE jobname = 'ml-backfill-observations';

-- Check pg_cron extension
SELECT * FROM pg_extension WHERE extname = 'pg_cron';
```

**Solutions:**

If job is missing, recreate it:

```sql
SELECT cron.schedule(
  'ml-backfill-observations',
  '*/10 * * * *',
  $$SELECT * FROM backfill_ml_observations_batch(10000)$$
);
```

If job exists but inactive:

```sql
UPDATE cron.job SET active = true
WHERE jobname = 'ml-backfill-observations';
```

### Problem: Insufficient Training Data

**Symptoms:** Model shows poor generalization, inconsistent predictions

**Diagnosis:**

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

**Solutions:**

1. Wait for data accumulation (target: 90+ days, 30,000+ samples)
2. Do NOT retrain model until sufficient data is available
3. Continue using v1 model (NOAA-only) until data requirements are met

---

## Emergency Procedures

### Model Rollback

If a model is causing forecast degradation:

```bash
# 1. SSH into Fly.io and check current config
fly ssh console --app quiver-ml
cat fly.toml | grep MODEL

# 2. Update fly.toml locally
# Change MODEL_PATH and MODEL_VERSION to previous version

# 3. Deploy
cd ml
fly deploy --app quiver-ml

# 4. Verify
curl https://quiver-ml.fly.dev/health
```

### Disable ML Corrections

If ML predictions are actively harming forecasts:

```sql
-- Option 1: Stop the pg_cron job
UPDATE cron.job SET active = false
WHERE jobname = 'ml-backfill-observations';

-- Option 2: The app falls back to raw forecasts if corrected_forecasts is empty
-- Clear recent bad predictions (use with caution)
DELETE FROM corrected_forecasts
WHERE corrected_at > NOW() - INTERVAL '24 hours';
```

### Re-enable ML Pipeline

```sql
-- Re-enable pg_cron job
UPDATE cron.job SET active = true
WHERE jobname = 'ml-backfill-observations';

-- Verify
SELECT jobname, active FROM cron.job
WHERE jobname = 'ml-backfill-observations';
```

### Rollback Jan 30, 2026 Optimization

If the new thresholds cause issues:

```sql
-- Restore old sentinel threshold (48h instead of 24h)
-- Restore old batch size (5000 instead of 10000)
-- Remove TTL cleanup (72h deletion)
-- See migration file for full rollback SQL:
-- supabase/migrations/20260130071552_optimize_ml_backlog_processing.sql

-- Quick rollback of pg_cron batch size only:
SELECT cron.alter_job(
  job_id := (SELECT jobid FROM cron.job WHERE jobname = 'ml-backfill-observations'),
  command := $$SELECT * FROM backfill_ml_observations_batch(5000)$$
);
```

---

## Scheduled Maintenance

### Weekly Tasks

1. **Review model performance:**
   ```sql
   SELECT * FROM get_ml_weekly_metrics();
   ```

2. **Check observation coverage:**
   ```sql
   SELECT COUNT(*) FROM observable_beaches;
   ```

3. **Review pg_cron job success rate:**
   ```sql
   SELECT
     status,
     COUNT(*) as count
   FROM cron.job_run_details
   WHERE jobname = 'ml-backfill-observations'
     AND start_time > NOW() - INTERVAL '7 days'
   GROUP BY status;
   ```

4. **Monitor training data growth:**
   ```sql
   SELECT
     source,
     COUNT(*) as samples,
     EXTRACT(EPOCH FROM (MAX(ts) - MIN(ts))) / 86400 as days_span
   FROM marine_forecasts
   WHERE is_observed = true AND wave_height_m IS NOT NULL
   GROUP BY source;
   ```

5. **Check early warning metrics:**
   ```sql
   SELECT pending_12_24h, pending_gt_24h FROM get_ml_health_metrics();
   -- pending_gt_24h should always be 0
   ```

### Monthly Tasks

1. **Consider model retraining** if:
   - 90+ days of data accumulated
   - 30,000+ training samples available
   - Improvement rate is declining

2. **Review and clean up old predictions:**
   ```sql
   -- Delete predictions older than 90 days
   DELETE FROM ml_predictions_log
   WHERE predicted_at < NOW() - INTERVAL '90 days';
   ```

3. **Refresh observable beaches view:**
   ```sql
   REFRESH MATERIALIZED VIEW CONCURRENTLY observable_beaches;
   ```

4. **Check storage utilization:**
   ```sql
   SELECT
     relname,
     pg_size_pretty(pg_total_relation_size(relid)) as size
   FROM pg_stat_user_tables
   WHERE relname IN ('marine_forecasts', 'tide_forecasts', 'ml_predictions_log')
   ORDER BY pg_total_relation_size(relid) DESC;
   ```

---

## Reference

### Database Functions

| Function | Purpose | Schedule |
|----------|---------|----------|
| `backfill_ml_observations_batch(batch_size)` | Match predictions, mark sentinels, delete expired | pg_cron: `*/10 * * * *` |
| `get_ml_health_metrics()` | Return pipeline health metrics with early warning | On-demand |
| `get_ml_weekly_metrics()` | Return model performance metrics | On-demand |
| `check_ml_ground_truth_health()` | Legacy health check | On-demand |
| `refresh_observable_beaches()` | Refresh beach coverage view | pg_cron: daily 6am UTC |
| `prune_forecasts_retention(90, 14, 25000)` | Clean up old forecast data | pg_cron: daily 5am UTC |

### Function Signatures (Updated Jan 30, 2026)

#### `backfill_ml_observations_batch(batch_size INT DEFAULT 10000)`

Processes ML predictions with three-step pipeline:
1. **Match**: Join predictions with observations (+-4h window)
2. **Sentinel**: Mark predictions >24h old as unmatchable (`observed_m = -1`)
3. **Cleanup**: Delete pending predictions >72h old (TTL)

**Returns:**
```sql
TABLE(
  processed INT,        -- Total rows affected (matched + sentinel + expired)
  matched INT,          -- Predictions matched with observations
  sentinel_marked INT,  -- Predictions marked as unmatchable
  expired_deleted INT,  -- Predictions deleted (TTL cleanup)
  elapsed_ms NUMERIC    -- Execution time in milliseconds
)
```

**Example:**
```sql
SELECT * FROM backfill_ml_observations_batch(10000);
-- processed | matched | sentinel_marked | expired_deleted | elapsed_ms
-- ----------+---------+-----------------+-----------------+-----------
--     10000 |    1847 |            8100 |              53 |    1234.56
```

#### `get_ml_health_metrics()`

Returns comprehensive pipeline health metrics.

**Returns:**
```sql
TABLE(
  total_predictions BIGINT,
  pending_observations BIGINT,      -- Predictions awaiting ground truth
  pending_12_24h BIGINT,            -- Early warning: predictions 12-24h old
  pending_gt_24h BIGINT,            -- Should be 0 (indicates threshold working)
  sentinel_marked BIGINT,           -- Predictions marked as unmatchable
  matched_last_24h BIGINT,
  total_observable_24h BIGINT,
  match_rate_24h NUMERIC,
  avg_raw_error_24h NUMERIC,
  avg_corrected_error_24h NUMERIC,
  improvement_pct_24h NUMERIC,
  oldest_pending_age_hours NUMERIC,
  observable_beaches_count BIGINT
)
```

### Key Tables

| Table | Purpose |
|-------|---------|
| `ml_predictions_log` | All ML predictions with ground truth |
| `corrected_forecasts` | Latest corrected forecasts for app |
| `marine_forecasts` | Buoy observations (is_observed=true) |
| `observable_beaches` | Materialized view of beaches with observations |

### Sentinel Values

| `observed_m` Value | Meaning |
|--------------------|---------|
| `NULL` | Pending - awaiting observation match |
| `-1` | Sentinel - no observation will ever arrive (>24h old) |
| `> 0` | Matched - ground truth observation recorded |

### Related Documentation

- [ML Architecture](/ml/ARCHITECTURE.md)
- [ML README](/ml/README.md) - Data requirements and training
- [ML Bias Correction Feature](/docs/features/ML_BIAS_CORRECTION.md)
- [Database Schema](/docs/architecture/DATABASE_SCHEMA.md) - Retention policies
- [Postmortem: ML Model Regression](/docs/postmortems/2026-01-20-ml-model-regression.md)
