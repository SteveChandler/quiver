# ML Accuracy Improvement Plan — Feb 16, 2026

**Goal**: Reduce corrected MAE from 0.727m to <0.5m and increase accuracy card visibility from 23 to 50+ beaches.

**Based on**: [ML Accuracy Analysis](../research/ML_ACCURACY_ANALYSIS_2026-02-16.md)

**Approach**: Two phases. Phase 1 is a quick guardrail fix (1-2 days). Phase 2 adds beach identity to the model (1-2 weeks).

**Validated by**: Web research (Feb 16, 2026) — see [External Research](#external-research-validation) below.

---

## Phase 1: Fix the 5-10ft Regression (Quick Fix)

**Problem**: The model hurts accuracy between 5-10ft (-4.3% at 5-6.5ft, -2.8% at 6.5-10ft). The swell taper starts at 2.0m but the model starts making bad corrections at 1.5m.

**Fix**: Lower the swell taper start from 2.0m to 1.5m so bad mid-range corrections are suppressed sooner.

**Literature support**: NOAA's own neural network bias correction uses range-dependent corrections — different magnitudes at different forecast ranges. LightGBM wave height corrections (ECMWF) show corrections are most effective at low-to-mid heights and degrade at extremes. No literature advocates fixed global corrections across all wave heights.

### Step 1.1: Analyze impact of taper change

Before changing anything, simulate the impact by querying what the corrected values would have been with different taper settings.

```sql
-- Simulate: what if we tapered from 1.5m instead of 2.0m?
-- For predictions in the 1.5-2.0m range, the correction would be reduced
SELECT
  CASE
    WHEN raw_forecast_m < 1.5 THEN 'a) <1.5m (no change)'
    WHEN raw_forecast_m < 2.0 THEN 'b) 1.5-2.0m (newly tapered)'
    WHEN raw_forecast_m < 4.0 THEN 'c) 2.0-4.0m (already tapered)'
    ELSE 'd) 4.0m+ (no correction)'
  END AS bucket,
  COUNT(*),
  AVG(ABS(corrected_error_m)) AS current_mae,
  AVG(ABS(raw_error_m)) AS raw_mae
FROM ml_predictions_log
WHERE observed_m > 0
  AND predicted_at > NOW() - INTERVAL '30 days'
GROUP BY 1 ORDER BY 1;
```

### Step 1.2: Update taper config on Fly.io

**File**: `ml/config.py`

```python
# Change from:
LARGE_SWELL_TAPER_START = float(os.getenv("LARGE_SWELL_TAPER_START", "2.0"))
# Change to:
LARGE_SWELL_TAPER_START = float(os.getenv("LARGE_SWELL_TAPER_START", "1.5"))
```

This means:
- < 1.5m: full correction (unchanged)
- 1.5-4.0m: linearly tapered correction (was 2.0-4.0m)
- > 4.0m: no correction (unchanged)

### Step 1.3: Deploy and monitor

1. Deploy updated `config.py` to Fly.io
2. Monitor for 48 hours via `ml-stats` dashboard
3. Verify the 5-6.5ft bucket improves from -4.3% to neutral or positive
4. Check that the <5ft buckets aren't degraded

### Step 1.4: Fix `get_yesterday_accuracy` sentinel filtering

While we're at it, add `AND p.observed_m > 0` to the accuracy function to exclude sentinel values (-1) from aggregation.

**Migration**: `supabase/migrations/YYYYMMDDHHMMSS_fix_accuracy_sentinel_filter.sql`

```sql
-- In the WHERE clause, change:
--   AND p.observed_m IS NOT NULL
-- To:
--   AND p.observed_m > 0
```

**Estimated effort**: 1-2 days including monitoring

---

## Phase 2: Add Beach Identity to the Model

**Problem**: The model applies a single global correction. 14 beaches are actively hurt because their local bias pattern differs from the global average. With 10K+ observations per beach, we have more than enough data for per-beach learning.

**Literature support**: Site-specific models consistently outperform global models in wave forecasting (20-40% improvement). Surfline uses ML for per-spot corrections commercially. CDIP has an ML framework incorporating station/location features. Deep learning methods achieve 13-46% MAE reduction when adding spatial features.

**Approach (updated after research)**: Use XGBoost's **native categorical feature** support (`enable_categorical=True`, available since XGBoost v1.5) to pass `beach_id` directly as a categorical column. This is preferred over feature hashing because:

1. **279 beaches is small** — native categoricals handle this efficiently (hashing is designed for millions of categories, e.g., Uber's DeeprETA)
2. **No bucket collisions** — hashing to 64 groups forces ~4 beaches per bucket to share corrections, diluting per-beach signal
3. **Simpler code** — no hashing function needed, just column dtype and XGBoost config
4. **Better splits** — XGBoost's optimal partitioning algorithm can group beaches by learned correction patterns rather than arbitrary hash buckets

**Fallback**: If native categoricals cause training instability (unlikely with 279 categories), fall back to `beach_hash` with 128 buckets.

### Step 2.1: Add beach_id as categorical feature to the ML service

**File**: `ml/transformers_v2.py`

Add to `preprocess_v2()`:

```python
# In preprocess_v2():
if 'beach_id' in df.columns:
    df['beach_id_cat'] = df['beach_id'].astype('category')
else:
    df['beach_id_cat'] = pd.Categorical(['unknown'] * len(df))
```

Add `'beach_id_cat'` to `V2_FEATURE_COLUMNS` in `config.py`.

**File**: `ml/train.py` (or equivalent training entry point)

Enable categorical support in XGBoost:

```python
# In the XGBRegressor or xgb.train params:
params = {
    ...existing_params,
    'enable_categorical': True,
    'max_cat_to_onehot': 1,  # Force partition-based splits (better for 279 categories)
}

# Ensure DMatrix is created with enable_categorical=True:
dtrain = xgb.DMatrix(X_train, label=y_train, enable_categorical=True)
```

### Step 2.2: Pass beach_id through the correction pipeline

**File**: `app/api/cron/ml/correct-forecasts/route.ts`

The cron already has `beach_id` available but it's only used for logging. Include it in the payload sent to the ML service:

```typescript
// In the batch payload, add beach_id to each forecast record:
forecasts.map(f => ({
  beach_id: f.beach_id,  // <-- ADD THIS
  forecast_ts: f.forecast_at,
  wave_height_m: f.wave_height_m,
  // ... existing fields
}))
```

### Step 2.3: Pass beach_id through the training pipeline

**File**: `app/api/cron/ml/retrain/route.ts`

The training data extraction already includes `beach_id` (used for filtering). Verify it's passed through to the ML service's `/train` endpoint and that `preprocess_v2()` receives it.

### Step 2.4: Retrain and evaluate

1. Trigger a manual retrain: `POST /train` on the Fly.io service
2. The new model will be deployed as a candidate (shadow scoring)
3. Monitor via `promote-candidate` cron for 24-48 hours
4. Validation gates must pass:
   - Overall improvement > 50%
   - Per-bucket improvement > 40%
   - Per-bucket degradation <= 0.10m MAE
   - Mean bias < 0.5m

### Step 2.5: Validate per-beach improvement

After the new model is promoted, check the 14 "hurt" beaches:

```sql
SELECT
  b.name,
  AVG(ABS(p.raw_error_m)) AS raw_mae,
  AVG(ABS(p.corrected_error_m)) AS corrected_mae,
  100.0 * (1 - AVG(ABS(p.corrected_error_m)) / NULLIF(AVG(ABS(p.raw_error_m)), 0)) AS improvement_pct
FROM ml_predictions_log p
JOIN beaches b ON b.id = p.beach_id
WHERE p.observed_m > 0
  AND p.predicted_at > NOW() - INTERVAL '7 days'
  AND b.name IN ('South Beach', 'Narragansett Town Beach', 'Scripps',
                  'Cocoa Beach Pier', 'Topanga', 'Trails', 'Jacksonville Beach Pier')
GROUP BY b.name;
```

**Success criteria**: All 14 "hurt" beaches should show positive improvement (or at minimum no degradation).

**Estimated effort**: 1-2 weeks including shadow scoring period

---

## External Research Validation

Web research conducted Feb 16, 2026 to validate the Phase 1 and Phase 2 approach against published wave forecasting ML literature.

### Phase 1 — Range-Dependent Corrections (Strongly Validated)

| Source | Finding | Relevance |
|--------|---------|-----------|
| NOAA Neural Network Bias Correction | 64% bias improvement, 29% RMSE reduction using range-dependent corrections | Directly validates taper approach |
| LightGBM on ECMWF Wave Heights | 10-20% RMSE reduction; corrections most effective at low-to-mid range, degrade at extremes | Validates that mid-range guardrails improve accuracy |
| General literature | No papers advocate fixed global corrections across all wave heights | Range-dependent is standard practice |

### Phase 2 — Per-Location Learning (Strongly Validated)

| Source | Finding | Relevance |
|--------|---------|-----------|
| Multiple wave forecasting studies | Site-specific models outperform global by 20-40% | Validates adding beach identity |
| Surfline (commercial) | Uses ML for per-spot corrections | Commercial validation of per-beach approach |
| CDIP ML Framework | Incorporates station/location features | Academic validation |
| Deep learning bias correction papers | 13-46% MAE reduction with spatial features | Quantifies expected improvement range |

### Key Refinement: Native Categoricals > Feature Hashing

| Approach | Pros | Cons | When to Use |
|----------|------|------|-------------|
| **Native categorical** (chosen) | Exact per-beach splits, no collisions, simpler code | Slower training with very large cardinalities | <10K categories (we have 279) |
| Feature hashing (64 buckets) | Handles millions of categories, fixed memory | ~4 beaches per bucket, diluted signal | >10K categories |
| Learned embeddings | Most expressive, captures latent structure | Requires neural network, more complex | Deep learning pipelines |

**Decision**: Use native categoricals. 279 beaches is well within XGBoost's efficient range. Uber's DeeprETA paper validated hashing for millions of locations — our scale doesn't need it.

### What Research Did NOT Support

| Idea | Literature Says | Our Data Says | Decision |
|------|----------------|---------------|----------|
| Rolling 7-day bias | No support for short-window rolling bias in volatile coastal systems | 22/25 beaches VOLATILE (stddev > 0.2m) | Skip |
| Wider observation window | Marginal returns after matching 90%+ of reports | 91.6% matched within +/-1h | Skip |
| Ensemble models (Open-Meteo) | Promising but adds complexity | Unverified on Fly.io, new API dependency | Defer to Phase 3 |

---

## What We're NOT Doing (and Why)

| Idea | Why Skip | Data Evidence |
|------|----------|---------------|
| Rolling 7-day bias feature | Bias is too volatile week-to-week | 22 of 25 beaches VOLATILE (stddev > 0.2m) |
| Widen observation window to +/-3h | Current +/-1h catches 92% of buoy reports | Median buoy gap: 2h. Only 8% more matches, staler data |
| Widen swell taper for 13ft+ | NOAA over-predicts by +1.9m; model can't fix without better large-swell training | 13ft+ bucket: 1.94m MAE, +1.93m bias |
| Open-Meteo ensemble | Unverified if deployed on Fly.io; adds API dependency | Defer until Phase 2 proves beach identity works |
| Hyperparameter tuning | Modest 3-8% expected gain; lower priority than feature engineering | — |
| Feature hashing (64 buckets) | Native categoricals are better for 279 beaches | No bucket collisions, exact per-beach splits |

---

## Success Metrics

| Metric | Current | Phase 1 Target | Phase 2 Target |
|--------|---------|----------------|----------------|
| Overall corrected MAE | 0.727m | 0.70m | <0.50m |
| Overall improvement over raw | 9.5% | 12-15% | >25% |
| Beaches where model hurts | 14 | 10-12 | 0-3 |
| 5-6.5ft bucket improvement | -4.3% | >0% (neutral) | >10% |
| Accuracy card beaches (should_display) | 23 | 25-30 | 50+ |
| Predictions helped % | 59% | 62-65% | >70% |

---

## Timeline

| Week | Work | Deliverable |
|------|------|-------------|
| Week 1 (Feb 17-21) | Phase 1: taper fix + sentinel filter + deploy + monitor | Taper deployed, 48h monitoring data |
| Week 2 (Feb 24-28) | Phase 2: native categorical feature + pipeline plumbing | Feature added, manual retrain triggered |
| Week 3 (Mar 3-7) | Phase 2: shadow scoring + validation + promotion | New model in production, per-beach validation |
| Week 3+ | Monitor and iterate | Dashboard showing improvement metrics |
