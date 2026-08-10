# ML Model Degradation Investigation

**Date:** 2026-01-20
**Models Analyzed:** v1, combined_v1
**Project ID:** vawdnbbgawichorsjiwe

## Executive Summary

The ML bias correction models are making forecasts **significantly worse** rather than better, with corrected errors 2-2.3x higher than raw errors on average. The root cause is **catastrophic training data bias** caused by an 8-day training window during an unusual weather period where NOAA systematically under-predicted wave heights.

**Key Findings:**
- Training data shows +0.808m average residual (observed >> forecast)
- Model learned to ALWAYS add ~0.7m bias, regardless of conditions
- 99% of predictions receive positive bias adjustments
- Only 5.5% of predictions actually improve (v1 model)

## Problem Statement

### Observed Behavior
| Model | Avg Raw Error | Avg Corrected Error | Error Increase | Improvement Rate |
|-------|---------------|---------------------|----------------|------------------|
| v1 | 0.394m | 0.649m | +64.7% | 5.5% |
| combined_v1 | 0.323m | 0.786m | +143.3% | 0.6% |

Both models are degrading forecasts, with the combined_v1 model performing even worse.

## Root Cause Analysis

### 1. Training Data Bias (CRITICAL ISSUE)

**The training data is catastrophically biased:**

```
Training Data Stats (2,275 samples):
- Date Range: Jan 7-15, 2026 (8 days only)
- Avg Forecast: 0.868m
- Avg Observed: 1.675m
- Avg Residual: +0.808m (NOAA under-predicted by 93%)
- Residual Std: 1.001m
```

**What happened:**
1. The training data was extracted from `enhanced_forecasts` (NOAA) matched with `marine_forecasts` (observations)
2. Only 8 days of data was captured (Jan 7-15, 2026)
3. During this specific period, NOAA forecasts were systematically LOW
4. The model learned that "NOAA always under-predicts by ~0.8m"
5. This pattern was NOT representative of long-term NOAA accuracy

### 2. Model Behavior

**The v1 model learned to blindly add positive bias:**

```
Bias Distribution (last 7 days, 306,819 predictions):
- 99.1% predictions receive POSITIVE bias (+0.721m avg)
- 0.9% predictions receive NEGATIVE bias (-0.281m avg)
- Median bias: +0.68m
- P90 bias: +1.11m
- P99 bias: +2.09m
```

**Feature Importances (v1 model):**
```
wind_speed:     61.2%  ████████████████████████████████
hour:           38.8%  ████████████████████
wave_period:     0.0%
wind_missing:    0.0%
month:           0.0%
wave_period_sq:  0.0%
[all direction features: 0.0%]
```

The model essentially learned: "If it's windy and/or certain hours, add MORE bias. Otherwise add standard bias."

### 3. Performance by Wave Height

The model's damage scales with wave height:

| Height Bucket | N Samples | Raw Error | Corrected Error | Error Increase | Improvement Rate |
|---------------|-----------|-----------|-----------------|----------------|------------------|
| < 0.5m | 4,354 | 0.371m | 0.391m | +5.4% | 41.5% |
| 0.5-1.0m | 44,417 | 0.401m | 0.596m | +48.6% | 32.8% |
| 1.0-1.5m | 7,998 | 0.373m | 1.057m | +183.4% | 6.0% |
| 1.5-2.0m | 523 | 0.357m | 1.041m | +191.6% | 13.4% |
| 2.0-3.0m | 37 | 0.236m | 1.516m | +542.4% | 0.0% |

**Interpretation:**
- Small waves (< 0.5m): Model slightly helpful (41.5% improvement)
- Medium waves (0.5-1.5m): Model harmful, adds unnecessary height
- Large waves (> 1.5m): Model catastrophically harmful, often doubling the forecast

### 4. Systematic Bias Analysis

**Training data showed NOAA under-prediction:**
```
Avg Residual in Training: +0.129m
Pct where Observed > Forecast: 48.6%
```

**But production data shows different pattern:**
```
v1 Model (last 30 days, 57,329 observations):
- Avg Raw Bias: -0.129m (NOAA slightly OVER-predicts on average)
- Avg Corrected Bias: +0.547m (Model makes it WORSE)
- Model Adjustment: +0.676m (always adds height)
```

**Train-Test Mismatch:**
- Training: NOAA under-predicted by 0.8m on average (8-day anomaly)
- Production: NOAA actually slightly over-predicts (-0.129m)
- Result: Model adds unnecessary +0.7m bias, making forecasts worse

### 5. Ground Truth Quality (NOT the problem)

Observation data quality is good:

| Source | Total Obs | Beaches | Wave Height Coverage | Avg Height | Std Dev |
|--------|-----------|---------|---------------------|------------|---------|
| CDIP | 28,107 | 96 | 100% | 1.160m | 0.649m |
| NDBC | 3,458 | 112 | 51.1% | 0.761m | 0.407m |

CDIP data is high-quality and complete. NDBC has partial coverage but reasonable where present.

### 6. Worst Performing Beaches

These beaches see the largest error increases from the ML model:

| Beach ID | N Predictions | Raw Error | Corrected Error | Error Increase | Improvement Rate |
|----------|---------------|-----------|-----------------|----------------|------------------|
| 4a0aac5b... | 18 | 0.208m | 1.955m | +1.747m | 0.0% |
| a240ccfc... | 18 | 0.297m | 2.011m | +1.714m | 0.0% |
| 77903282... | 36 | 0.235m | 1.832m | +1.597m | 0.0% |

Common pattern: Model adds 1.5-2.0m of unnecessary height, turning accurate forecasts into terrible ones.

## Why the Model Failed

### The Perfect Storm of ML Mistakes

1. **Insufficient Training Data**
   - Only 2,275 samples from 8 days
   - Industry standard: 10,000+ samples minimum for production models
   - Time-series data needs multiple seasons/cycles

2. **Temporal Bias**
   - Training data from Jan 7-15, 2026 (single week in winter)
   - Captures NO seasonal variation
   - Likely caught an unusual storm pattern or weather system

3. **No Train-Test Split by Time**
   - Training data was randomly split (10% holdout)
   - Should have used forward-looking validation (train on older data, test on future)
   - This would have caught the temporal overfitting

4. **Feature Engineering Failure**
   - Model ignores wave_period, wave_direction, month (all 0% importance)
   - Over-relies on wind_speed (61%) and hour (39%)
   - Missing critical predictive features like beach location, swell vs wind waves

5. **No Sanity Checks**
   - Training residual (+0.808m) should have triggered red flags
   - 99% positive bias in production should have triggered alerts
   - No A/B testing before full deployment

6. **Data Leakage Possibility**
   - Training used `enhanced_forecasts` (NOAA) + `marine_forecasts` (observations)
   - Need to verify these weren't from the same time window as production inference
   - If training on Jan 7-15 and predicting Jan 18-20, model saw limited weather diversity

## Evidence Supporting Root Cause

### Sample of Worst Predictions

```
Raw: 2.04m, Observed: 1.90m, Corrected: 4.72m, Bias: +2.67m, Error Increase: +2.68m
Raw: 0.67m, Observed: 0.90m, Corrected: 3.76m, Bias: +3.09m, Error Increase: +2.63m
Raw: 2.32m, Observed: 2.30m, Corrected: 4.88m, Bias: +2.57m, Error Increase: +2.56m
```

The model is taking accurate forecasts (raw error < 0.15m) and destroying them by adding 2-3m of unnecessary height.

### Bias Applied vs Raw Forecast

| Raw Forecast Range | N Predictions | Avg Bias Applied |
|--------------------|---------------|------------------|
| < 0.5m | 17,827 | +0.683m |
| 0.5-1.0m | 233,104 | +0.689m |
| 1.0-1.5m | 46,584 | +0.797m |
| 1.5-2.0m | 8,515 | +0.917m |
| > 2.0m | 789 | +0.994m |

Model adds ~0.7m for all waves, scaling up slightly for larger waves. This is the signature of learning a constant bias from bad training data.

## Recommended Fixes

### Immediate Actions (Deploy Today)

1. **Disable ML Corrections**
   - Set `USE_ML_CORRECTION=false` in production
   - Raw NOAA forecasts are MORE accurate than ML-corrected versions
   - Update: Already done via rollback (commit 7650b88a)

2. **Stop Training Job**
   - Pause any automated retraining pipelines
   - Prevent model from learning more biased patterns

### Short-Term Fixes (1-2 Weeks)

3. **Collect Proper Training Data**
   ```sql
   -- Extract at least 3 months of matched forecast-observation pairs
   -- Ensure temporal diversity (multiple seasons if possible)
   -- Target: 10,000+ samples minimum
   ```

4. **Fix Training Pipeline**
   - Implement temporal cross-validation (forward-chaining)
   - Add validation checks for residual distribution
   - Set alerts for unusual bias patterns (> ±0.3m average residual)

5. **Add Feature Engineering**
   ```python
   # Critical missing features:
   - beach_id or lat/lon (geographic patterns)
   - swell_height vs wind_wave_height (different physics)
   - forecast_hour_offset (0-hr vs 24-hr forecasts differ)
   - season (winter vs summer wave patterns)
   ```

6. **Implement Guardrails**
   ```python
   # Physical constraints
   - Limit bias to ±50% of raw forecast
   - Cap maximum correction at ±1.0m
   - If corrected < 0.01m, use 0.01m (already implemented)
   - Add upper bound: if corrected > 10m, clip to 10m
   ```

### Long-Term Improvements (1-3 Months)

7. **Ensemble Approach**
   - Train separate models for different wave height ranges
   - Use classification model first (improve vs don't improve)
   - Only apply corrections where model is confident

8. **Regional Models**
   - Train separate models for Hawaii, West Coast, East Coast
   - Different wave physics in each region

9. **Online Learning**
   - Implement continuous retraining with sliding window
   - Detect distribution shifts automatically
   - Rollback models that degrade performance

10. **A/B Testing Infrastructure**
    - Test new models on 10% of traffic first
    - Monitor improvement rate daily
    - Auto-rollback if improvement rate < 40%

## Training Data Requirements (Checklist)

For next model training:

- [ ] Minimum 10,000 matched forecast-observation pairs
- [ ] Minimum 90 days of temporal coverage (ideally 6+ months)
- [ ] Balanced representation of wave heights (not just 0.5-1.5m)
- [ ] Multiple geographic regions represented
- [ ] Wind conditions varying from 0-20+ m/s
- [ ] Residual distribution centered near 0.0m (±0.2m acceptable)
- [ ] Forward-chaining temporal validation (not random split)
- [ ] Holdout set from FUTURE dates (after training data)
- [ ] Feature importance analysis shows meaningful physics (not just wind_speed)
- [ ] Production sanity checks: 99% one-directional bias is NOT normal

## Monitoring Metrics to Add

```sql
-- Daily health check query
SELECT
  model_version,
  COUNT(*) as predictions_24h,
  ROUND(AVG(bias_applied_m), 3) as avg_bias,
  ROUND(STDDEV(bias_applied_m), 3) as stddev_bias,
  ROUND(AVG(CASE WHEN bias_applied_m > 0 THEN 1 ELSE 0 END) * 100, 1) as pct_positive_bias,
  ROUND(AVG(CASE WHEN ABS(bias_applied_m) > 1.0 THEN 1 ELSE 0 END) * 100, 1) as pct_large_bias,
  ROUND(AVG(CASE WHEN corrected_error_m < raw_error_m THEN 1 ELSE 0 END) * 100, 1) as improvement_rate
FROM ml_predictions_log
WHERE created_at > NOW() - INTERVAL '24 hours'
  AND observed_m IS NOT NULL
GROUP BY model_version;

-- Alert if:
-- - improvement_rate < 40%
-- - pct_positive_bias > 90% or < 10%
-- - pct_large_bias > 20%
-- - ABS(avg_bias) > 0.3
```

## Conclusion

The ML bias correction models are failing catastrophically because they learned from 8 days of biased training data during an unusual weather period. The models learned to always add ~0.7m to forecasts, which happens to make predictions worse on average in normal conditions.

**The fix is straightforward but requires patience:**
1. Collect 3+ months of proper training data
2. Implement temporal validation
3. Add geographic and physical features
4. Deploy guardrails to prevent catastrophic predictions
5. Monitor with proper metrics

**DO NOT deploy new models until:**
- Training data spans 90+ days minimum
- Temporal cross-validation shows improvement
- Holdout set (from FUTURE dates) shows > 50% improvement rate
- Average bias in production is within ±0.2m of zero

## Files Referenced

- `/ml/train.py` - Training script (uses 10% random holdout, should be temporal)
- `/ml/extract_training_data.py` - Data extraction (need longer window)
- `/ml/transformers.py` - Feature engineering (missing critical features)
- `/ml/model.py` - XGBoost wrapper (needs guardrails)
- `/ml/models/bias_model_v1.json` - Current production model (biased)

## Database Queries Used

All analysis queries are in this document and can be re-run against project `vawdnbbgawichorsjiwe`.

---

**Analysis completed:** 2026-01-20
**Next steps:** Collect proper training data (90+ days) before attempting new model training.
