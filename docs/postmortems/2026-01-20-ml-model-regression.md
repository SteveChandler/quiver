# Postmortem: ML Model Regression (combined_v1)

**Date:** 2026-01-20
**Severity:** Critical
**Duration:** ~3 days (Jan 17-20, 2026)
**Author:** Claude Code

## Summary

The `combined_v1` ML model deployed on January 17-18, 2026 caused severe forecast degradation, making wave height predictions 2.5x worse than raw NOAA forecasts instead of improving them.

## Impact

| Metric | Expected | Actual |
|--------|----------|--------|
| Improvement Rate | >55% | 16.5% |
| Avg Improvement | >0.05m | **-0.59m** (degradation) |
| Avg Raw Error | - | 0.40m |
| Avg Corrected Error | <0.40m | **0.99m** |

**User Impact:** Users received ML-corrected forecasts that were significantly less accurate than the original NOAA forecasts for approximately 3 days.

**Data Impact:** 171,109 predictions made with combined_v1 model during this period.

## Timeline

| Time | Event |
|------|-------|
| Jan 14-17 | combined_v1 model deployed to Fly.io ML service |
| Jan 17 18:00 UTC | Last successful ground truth backfill |
| Jan 17-20 | Backfill cron job stops matching predictions |
| Jan 20 12:00 UTC | Issue discovered during ML pipeline review |
| Jan 20 12:30 UTC | Manual backfill reveals model regression |
| Jan 20 13:00 UTC | Rollback to v1 model initiated |

## Root Cause Analysis

### Primary Issue: Model Regression

The `combined_v1` model systematically over-predicted wave heights with large positive biases (0.5m - 2.0m). Sample predictions:

```
raw=0.61m → corrected=2.70m (bias +2.09m) → observed=1.00m
  Result: Made forecast 4x worse

raw=0.30m → corrected=0.85m (bias +0.55m) → observed=0.37m
  Result: Made forecast 7x worse

raw=0.61m → corrected=2.45m (bias +1.84m) → observed=1.59m
  Result: Made forecast slightly worse
```

**Suspected causes:**

1. **Training Data Contamination**: The combined_v1 model was trained with ERA5 pseudo-observations (reanalysis data) mixed with real buoy observations. The ERA5 data may have introduced systematic biases.

2. **Feature Engineering Issues**: The ensemble model uses 35 features including Open-Meteo data. There may be a mismatch between training-time and inference-time feature availability.

3. **Overfitting**: The model may have overfit to training data patterns that don't generalize to real-world conditions.

### Secondary Issue: Backfill Cron Not Running

The `backfill-observations` Vercel cron job stopped executing around January 17-18, preventing ground truth validation that would have caught this regression earlier.

**Evidence:**
- Last ground truth match: Jan 17, 18:00 UTC
- 75,430 predictions pending backfill
- combined_v1 had 0 ground truth matches until manual intervention

**Suspected cause:** The backfill job may have been failing silently or timing out. The Vercel cron configuration appears correct (`30 * * * *`).

## Resolution

### Immediate Fix: Model Rollback

Changed `ml/fly.toml` to disable combined_v1 and revert to v1:

```diff
[env]
-  MODEL_PATH = 'models/bias_model_combined_v1.json'
-  MODEL_VERSION = 'combined_v1'
-  FALLBACK_MODEL_PATH = 'models/bias_model_v1.json'
-  USE_ENSEMBLE = 'true'
+  # ROLLBACK: Disabled combined_v1 model due to severe performance regression
+  MODEL_PATH = 'models/bias_model_v1.json'
+  MODEL_VERSION = 'v1'
+  FALLBACK_MODEL_PATH = 'models/bias_model_v1.json'
+  USE_ENSEMBLE = 'false'
```

### Deployment Steps

```bash
cd ml
fly deploy --app quiver-ml
```

### v1 Model Performance (Baseline)

| Metric | v1 Performance |
|--------|----------------|
| Predictions | 291,352 |
| Ground Truth Matches | 15,570 |
| Improvement Rate | 49.0% |
| Avg Raw Error | 0.583m |
| Avg Corrected Error | 0.569m |
| Avg Improvement | 0.013m |

While v1 doesn't meet the 55% improvement target, it reliably makes forecasts slightly better (not worse).

## Lessons Learned

### What Went Well

1. Manual backfill process worked correctly, allowing quick validation
2. Observable beaches materialized view enabled efficient ground truth matching
3. ML predictions log table captured all data needed for analysis

### What Went Wrong

1. **No automated model validation before deployment**: The combined_v1 model was deployed without sufficient production validation
2. **Silent cron failure**: Backfill job stopped without alerting
3. **Delayed detection**: Took ~3 days to discover the regression

## Action Items

### Immediate (P0)

- [x] Roll back to v1 model
- [ ] Deploy rollback to Fly.io: `fly deploy --app quiver-ml`
- [ ] Verify v1 model is active: check `/health` endpoint

### Short-term (P1)

- [ ] Investigate Vercel cron execution for backfill-observations
- [ ] Add alerting for ground truth match rate dropping below threshold
- [ ] Clear backfill backlog (75,430 pending predictions)

### Medium-term (P2)

- [ ] Implement automated model validation pipeline
  - Run on holdout dataset before deployment
  - Require >50% improvement rate to pass
  - Require positive avg improvement
- [ ] Add canary deployment for ML models (shadow mode)
- [ ] Root cause the combined_v1 training issues:
  - Audit ERA5 augmentation weights
  - Validate Open-Meteo feature availability at inference time
  - Check for data leakage in time series split

### Long-term (P3)

- [ ] Implement A/B testing framework for ML models
- [ ] Add real-time model performance monitoring dashboard
- [ ] Consider separate model per region (Hawaii, East Coast, etc.)

## Metrics to Monitor

After rollback, track these metrics to confirm recovery:

```sql
-- Check model version distribution
SELECT model_version, COUNT(*)
FROM ml_predictions_log
WHERE predicted_at > NOW() - INTERVAL '24 hours'
GROUP BY model_version;

-- Check improvement rate (after backfill catches up)
SELECT * FROM get_ml_weekly_metrics();

-- Monitor ground truth match rate
SELECT
  COUNT(*) FILTER (WHERE observed_m IS NOT NULL) as matched,
  COUNT(*) as total,
  ROUND(100.0 * COUNT(*) FILTER (WHERE observed_m IS NOT NULL) / COUNT(*), 1) as match_rate
FROM ml_predictions_log
WHERE predicted_at > NOW() - INTERVAL '24 hours';
```

## References

- ML Pipeline Architecture: `/docs/ARCHITECTURE.md` → ML section
- Model Training: `/ml/train_augmented.py`
- Fly.io Config: `/ml/fly.toml`
- Cron Jobs: `/vercel.json`
- Backfill Job: `/app/api/cron/ml/backfill-observations/route.ts`
