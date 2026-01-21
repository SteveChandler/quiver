# ML Bias Correction - Action Plan to Fix

**Date:** 2026-01-20
**Status:** CRITICAL - Models Currently Disabled
**Estimated Time to Fix:** 3-4 weeks (data collection bottleneck)

## The Problem in One Sentence

The ML model learned from only 8 days of biased training data and now blindly adds ~0.7m to every forecast, making predictions 2x worse instead of better.

## The Numbers

```
BEFORE ML (Raw NOAA):     0.394m average error  ✓ BETTER
AFTER ML (v1):            0.649m average error  ✗ WORSE (+65%)
AFTER ML (combined_v1):   0.786m average error  ✗ WORSE (+99%)

Improvement Rate: 5.5% (should be > 50%)
Training Data: 2,275 samples over 8 days (need 10,000+ over 90+ days)
```

## Root Cause

1. Training data from Jan 7-15, 2026 (8 days only)
2. During those 8 days, NOAA under-predicted by 0.8m on average (weather anomaly)
3. Model learned: "Always add 0.7m to NOAA forecasts"
4. In normal conditions, NOAA is actually accurate or slightly over-predicts
5. Result: Model makes forecasts worse 94.5% of the time

## Action Plan

### Phase 1: Data Collection (14 days) - CRITICAL BLOCKER

**Goal:** Collect 90+ days of matched forecast-observation pairs

**Tasks:**
1. Wait for time to pass (cannot speed this up)
2. Ensure `ml_predictions_log` backfill job is running
3. Verify observation sources are healthy (CDIP/NDBC)

**Acceptance Criteria:**
```sql
-- Should return at least 10,000 rows
SELECT COUNT(*)
FROM ml_predictions_log
WHERE observed_m IS NOT NULL
  AND created_at BETWEEN (NOW() - INTERVAL '90 days') AND NOW();
```

**Timeline:**
- Day 0-7: Accumulate first week of data (~3,000 samples)
- Day 8-14: Second week (~6,000 total samples)
- Day 15-30: Third/fourth weeks (~12,000 total samples) ← MIN VIABLE
- Day 31-90: Continue to 30,000+ samples ← IDEAL

### Phase 2: Fix Training Pipeline (2-3 days)

**Goal:** Prevent future training on biased data

**Tasks:**

1. **Update `extract_training_data.py`:**
   ```python
   # Add minimum data requirements
   MIN_SAMPLES = 10000
   MIN_DATE_RANGE_DAYS = 90
   MAX_AVG_RESIDUAL = 0.3  # Alert if training data is biased

   # Add validation before training
   def validate_training_data(df):
       if len(df) < MIN_SAMPLES:
           raise ValueError(f"Insufficient data: {len(df)} < {MIN_SAMPLES}")

       date_range = (df['forecast_ts_utc'].max() - df['forecast_ts_utc'].min()).days
       if date_range < MIN_DATE_RANGE_DAYS:
           raise ValueError(f"Insufficient date range: {date_range} < {MIN_DATE_RANGE_DAYS} days")

       avg_residual = df['residual_m'].mean()
       if abs(avg_residual) > MAX_AVG_RESIDUAL:
           raise ValueError(f"Biased training data: avg residual = {avg_residual:.3f}m")

       return True
   ```

2. **Update `train.py`:**
   ```python
   # Replace random 10% holdout with temporal split
   # OLD (WRONG):
   # holdout_size = int(len(X) * 0.1)
   # X_train = X.iloc[:-holdout_size]

   # NEW (CORRECT):
   # Use last 14 days as holdout (future data)
   df['date'] = pd.to_datetime(df['forecast_ts_utc'])
   holdout_cutoff = df['date'].max() - pd.Timedelta(days=14)
   train_mask = df['date'] <= holdout_cutoff

   X_train = X[train_mask]
   X_holdout = X[~train_mask]
   ```

3. **Add Feature Engineering:**
   ```python
   # In transformers.py, add:

   # Geographic features
   df['lat'] = beach_lat_lookup[df['beach_id']]
   df['lon'] = beach_lon_lookup[df['beach_id']]

   # Swell vs wind waves (if available from Open-Meteo)
   df['swell_dominant'] = df['swell_height'] > df['wind_wave_height']

   # Forecast horizon
   df['forecast_hours_ahead'] = (df['forecast_ts'] - df['issued_ts']).dt.total_seconds() / 3600

   # Season
   df['season'] = df['timestamp'].dt.month.map({
       12: 'winter', 1: 'winter', 2: 'winter',
       3: 'spring', 4: 'spring', 5: 'spring',
       6: 'summer', 7: 'summer', 8: 'summer',
       9: 'fall', 10: 'fall', 11: 'fall'
   })
   ```

4. **Add Guardrails in `model.py`:**
   ```python
   def predict(self, X: pd.DataFrame, physics_forecast: pd.Series) -> pd.Series:
       if self.model is None:
           raise ValueError("Model has not been trained yet.")

       predicted_bias = self.model.predict(X)

       # GUARDRAIL 1: Limit bias to ±50% of raw forecast
       max_bias = physics_forecast * 0.5
       predicted_bias = np.clip(predicted_bias, -max_bias, max_bias)

       # GUARDRAIL 2: Absolute limit on bias (prevents catastrophic errors)
       predicted_bias = np.clip(predicted_bias, -1.0, 1.0)

       corrected_forecast = physics_forecast + predicted_bias

       # GUARDRAIL 3: Physical constraints
       corrected_forecast = np.clip(corrected_forecast, 0.01, 10.0)

       return pd.Series(corrected_forecast, index=physics_forecast.index)
   ```

### Phase 3: Retrain Model (1 day)

**Goal:** Train new model on proper data

**Tasks:**

1. Extract training data:
   ```bash
   cd /Users/stevenchandler/Desktop/quiver/ml
   python extract_training_data.py --output data/training_data_v2.csv
   ```

2. Validate data quality:
   ```bash
   python -c "
   import pandas as pd
   df = pd.read_csv('data/training_data_v2.csv')
   print(f'Samples: {len(df)}')
   print(f'Date range: {(pd.to_datetime(df.forecast_ts_utc).max() - pd.to_datetime(df.forecast_ts_utc).min()).days} days')
   print(f'Avg residual: {df.residual_m.mean():.3f}m')
   print(f'Residual std: {df.residual_m.std():.3f}m')
   "
   ```

3. Train model:
   ```bash
   python train.py
   ```

4. Validate holdout performance:
   ```
   Expected metrics:
   - Improvement rate: > 50%
   - Avg corrected error: < avg raw error
   - CV RMSE: < 0.5m
   - Feature importances: NOT 99% wind_speed/hour
   ```

### Phase 4: Staged Deployment (3-5 days)

**Goal:** Deploy safely with rollback capability

**Tasks:**

1. **Deploy to staging:**
   ```bash
   # Copy new model
   cp models/bias_model_v2.json models/staging/

   # Update fly.toml for staging
   fly deploy --config fly.staging.toml
   ```

2. **A/B test on 10% traffic:**
   ```typescript
   // In app/api/cron/ml/correct-forecasts/route.ts
   const useNewModel = Math.random() < 0.1;
   const modelVersion = useNewModel ? 'v2' : 'disabled';
   ```

3. **Monitor for 48 hours:**
   ```sql
   -- Check v2 performance daily
   SELECT
     model_version,
     COUNT(*) as predictions,
     ROUND(AVG(raw_error_m), 3) as raw_error,
     ROUND(AVG(corrected_error_m), 3) as corrected_error,
     ROUND(AVG(CASE WHEN corrected_error_m < raw_error_m THEN 1 ELSE 0 END) * 100, 1) as improvement_rate
   FROM ml_predictions_log
   WHERE created_at > NOW() - INTERVAL '24 hours'
     AND observed_m IS NOT NULL
   GROUP BY model_version;
   ```

4. **Decision criteria:**
   - ✓ If improvement_rate > 50% → Deploy to 100%
   - ✗ If improvement_rate < 40% → Rollback and investigate
   - ⚠️ If 40-50% → Extend testing period

5. **Full deployment:**
   ```bash
   # Update production config
   export MODEL_VERSION=v2
   export MODEL_PATH=models/bias_model_v2.json

   # Deploy to production
   cd /Users/stevenchandler/Desktop/quiver/ml
   fly deploy
   ```

### Phase 5: Ongoing Monitoring (Continuous)

**Goal:** Detect and prevent future regressions

**Tasks:**

1. **Create monitoring dashboard:**
   ```typescript
   // Add to Vercel dashboard or Supabase
   // Show:
   // - Daily improvement rate (target: > 50%)
   // - Average bias applied (target: -0.2 to +0.2m)
   // - Prediction volume
   // - Ground truth coverage rate
   ```

2. **Set up automated alerts:**
   ```sql
   -- Run daily via pg_cron
   CREATE OR REPLACE FUNCTION check_ml_model_health()
   RETURNS TABLE (alert_type TEXT, message TEXT, severity TEXT) AS $$
   BEGIN
     -- Alert 1: Low improvement rate
     RETURN QUERY
     SELECT
       'LOW_IMPROVEMENT_RATE'::TEXT,
       'ML improvement rate is ' || ROUND(improvement_rate, 1) || '% (expected > 50%)'::TEXT,
       CASE WHEN improvement_rate < 30 THEN 'CRITICAL' ELSE 'WARNING' END::TEXT
     FROM (
       SELECT AVG(CASE WHEN corrected_error_m < raw_error_m THEN 100.0 ELSE 0.0 END) as improvement_rate
       FROM ml_predictions_log
       WHERE created_at > NOW() - INTERVAL '24 hours'
         AND observed_m IS NOT NULL
     ) sub
     WHERE improvement_rate < 50;

     -- Alert 2: Biased predictions
     RETURN QUERY
     SELECT
       'BIASED_PREDICTIONS'::TEXT,
       'ML average bias is ' || ROUND(avg_bias, 2) || 'm (expected -0.2 to +0.2m)'::TEXT,
       'WARNING'::TEXT
     FROM (
       SELECT AVG(bias_applied_m) as avg_bias
       FROM ml_predictions_log
       WHERE created_at > NOW() - INTERVAL '24 hours'
     ) sub
     WHERE ABS(avg_bias) > 0.3;

     -- Alert 3: One-directional bias
     RETURN QUERY
     SELECT
       'ONE_DIRECTIONAL_BIAS'::TEXT,
       'ML predictions are ' || ROUND(pct_positive, 1) || '% positive (expected 30-70%)'::TEXT,
       'CRITICAL'::TEXT
     FROM (
       SELECT AVG(CASE WHEN bias_applied_m > 0 THEN 100.0 ELSE 0.0 END) as pct_positive
       FROM ml_predictions_log
       WHERE created_at > NOW() - INTERVAL '24 hours'
     ) sub
     WHERE pct_positive > 90 OR pct_positive < 10;
   END;
   $$ LANGUAGE plpgsql;
   ```

3. **Schedule retraining:**
   ```
   Frequency: Monthly (or when 10k+ new observations accumulated)
   Process:
   1. Extract last 90 days of data
   2. Validate data quality (residual distribution)
   3. Train new model with temporal CV
   4. Compare against current production model on holdout set
   5. Deploy only if improvement_rate > current_model + 5%
   ```

## Success Criteria

### Model Training Success
- [ ] Training data: 10,000+ samples over 90+ days
- [ ] Average residual: -0.2m to +0.2m
- [ ] Temporal CV shows consistent improvement across folds
- [ ] Feature importances include geographic and physical features
- [ ] Holdout set (future dates) shows > 50% improvement rate

### Deployment Success
- [ ] A/B test on 10% traffic for 48 hours
- [ ] Production improvement rate > 50%
- [ ] Average error reduction > 20%
- [ ] No catastrophic predictions (error increase > 2m)
- [ ] Monitoring dashboard shows healthy metrics

### Ongoing Success
- [ ] Weekly improvement rate consistently > 50%
- [ ] Average bias stays within ±0.2m
- [ ] Positive bias percentage: 30-70% (balanced)
- [ ] Automated alerts catch regressions within 24 hours

## Risk Mitigation

### Risk: Not Enough Data After 90 Days
**Mitigation:**
- Start with California beaches only (highest CDIP coverage)
- Train beach-specific models for high-traffic locations
- Use transfer learning from larger models

### Risk: New Model Still Performs Poorly
**Mitigation:**
- Keep ML disabled, use raw NOAA forecasts
- Investigate if NOAA itself has seasonal bias
- Consider alternative observation sources (Surfline, Coastwatch)

### Risk: Model Works in Testing, Fails in Production
**Mitigation:**
- Extend A/B testing to 7 days instead of 2
- Increase test traffic gradually (10% → 25% → 50% → 100%)
- Keep automatic rollback threshold at 40% improvement rate

## Timeline Summary

| Phase | Duration | Start | End | Blocker |
|-------|----------|-------|-----|---------|
| Data Collection | 14-90 days | Day 0 | Day 90 | Time |
| Fix Pipeline | 3 days | Day 90 | Day 93 | None |
| Train Model | 1 day | Day 93 | Day 94 | None |
| A/B Testing | 2-7 days | Day 94 | Day 101 | Model quality |
| Full Deploy | 1 day | Day 101 | Day 102 | A/B results |

**Earliest possible deployment: ~95 days from now (late March 2026)**

**Recommended deployment: ~105 days from now (early April 2026)**

## Resources Needed

- **Engineering Time:** 1 engineer, 3-5 days of work (spread over 90+ days)
- **Infrastructure:** No changes (existing ML service on Fly.io)
- **Data Storage:** ~50MB additional (10k+ training samples)
- **Monitoring:** Add queries to existing health check system

## Open Questions

1. Should we train separate models by region (Hawaii, West Coast, East Coast)?
   - Pro: Better regional accuracy
   - Con: Need 10k+ samples PER REGION (3x longer to collect data)

2. Should we use Open-Meteo ensemble features?
   - Pro: Already extracted, may improve accuracy
   - Con: Adds API dependency and complexity

3. Should we implement confidence-based corrections?
   - Pro: Only correct when model is confident
   - Con: Requires classification model first

## Contact

**Questions:** Tag @data-researcher or @ml-engineer in Slack
**Emergency Rollback:** Run `/ml disable` or set `USE_ML_CORRECTION=false`

---

**Document Version:** 1.0
**Last Updated:** 2026-01-20
**Next Review:** When 10k+ samples collected (check weekly)
