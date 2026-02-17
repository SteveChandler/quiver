# ML Forecast Accuracy Analysis — Feb 16, 2026

## Overview

Data-driven analysis of the Quiver ML correction pipeline's accuracy, identifying root causes of error and ranking improvement opportunities by measured impact.

**Pipeline**: NOAA NWS raw forecast -> XGBoost bias correction (v3) -> `corrected_forecast_m`
**Ground truth**: IOOS buoy observations matched within +/-1h windows
**Analysis window**: Last 30 days (432K matched observations across 48 beaches)

---

## Key Findings

### 1. The ML Correction Is Barely Helping (9.5% overall improvement)

| Metric | Raw | Corrected | Change |
|--------|-----|-----------|--------|
| MAE | 0.804m | 0.727m | -9.5% |
| Mean bias | -0.446m (under) | -0.220m (under) | Better |
| Predictions helped | — | 253K (59%) | — |
| Predictions **hurt** | — | 152K (35%) | — |
| No change | — | 27K (6%) | — |

**35% of predictions are made worse by the correction.** The model is adding value on average, but hurting a large minority of forecasts.

### 2. The Model Actively Hurts 14 Beaches

These beaches had BETTER raw NOAA forecasts before ML correction was applied:

| Beach | Raw MAE | Corrected MAE | Degradation | Root Cause |
|-------|---------|--------------|-------------|------------|
| South Beach | 0.239m | 0.695m | -191% | Over-corrects +0.69m |
| Narragansett Town Beach | 0.281m | 0.471m | -68% | Over-corrects +0.41m |
| Scripps | 0.275m | 0.459m | -67% | Over-corrects +0.44m |
| Cocoa Beach Pier | 0.268m | 0.419m | -56% | Over-corrects +0.34m |
| Topanga | 0.401m | 0.537m | -34% | Over-corrects +0.51m |
| Trails | 0.303m | 0.431m | -42% | Over-corrects +0.31m |
| Jacksonville Beach Pier | 0.327m | 0.440m | -34% | Over-corrects +0.18m |
| Ala Moana Bowls | 0.544m | 0.595m | -9% | Over-corrects +0.53m |
| Brookings (Harris Beach) | 0.815m | 0.907m | -11% | Under-corrects -0.17m |
| Short Sands | 1.015m | 1.099m | -8% | Nearly neutral bias |
| Westport - The Jetty | 0.920m | 0.993m | -8% | Under-corrects -0.35m |
| Avalon Pier | 0.644m | 0.701m | -9% | Under-corrects -0.11m |
| Garrapata State Beach | 0.860m | 0.899m | -5% | Under-corrects -0.28m |
| Nauset Beach | 0.537m | 0.556m | -4% | Over-corrects +0.10m |

**Root cause**: The model has no beach identity feature (no `beach_id`, no embedding, no per-beach context). It applies a **single global correction** that happens to help some beaches and hurt others.

### 3. Error by Wave Size — Model Hurts at 5-10ft

| Size Bucket | Corrected MAE | Raw MAE | Improvement | Bias Direction |
|-------------|--------------|---------|-------------|----------------|
| <1.6ft | 0.793m | 0.996m | **+20%** | Under-predicts -0.77m |
| 1.6-3.3ft | 0.644m | 0.775m | **+17%** | Under-predicts -0.52m |
| 3.3-5ft | 0.674m | 0.797m | **+16%** | Under-predicts -0.32m |
| 5-6.5ft | 0.741m | 0.711m | **-4.3%** | Under-predicts -0.07m |
| 6.5-10ft | 0.796m | 0.774m | **-2.8%** | Over-predicts +0.21m |
| 10-13ft | 1.114m | 1.169m | **+4.7%** | Over-predicts +1.02m |
| 13ft+ | 1.940m | 1.940m | **0.0%** | Over-predicts +1.93m |

**Key insight**: The model helps below 5ft (where it reduces NOAA's under-prediction bias) but **hurts between 5-10ft** where it over-corrects upward. The current swell taper starts at 2.0m (6.5ft) but the damage starts at 1.5m (5ft).

The 13ft+ bucket has 1.9m MAE with +1.9m over-prediction — NOAA grossly over-predicts large swells and the taper prevents any correction.

### 4. Systematic Over-Prediction Bias by Beach

Bias direction (corrected_forecast - observed) over last 30 days:

| Beach | Bias (ft) | Direction | Obs Count |
|-------|-----------|-----------|-----------|
| La Push - Third Beach | +6.3 ft | OVER | 1,428 |
| Carmel River State Beach | +3.0 ft | OVER | 11,166 |
| Ala Moana Bowls | +1.7 ft | OVER | 11,143 |
| Topanga | +1.7 ft | OVER | 8,585 |
| Haleiwa | +1.5 ft | OVER | 6,480 |
| Scripps | +1.5 ft | OVER | 10,748 |
| Narragansett Town Beach | +1.3 ft | OVER | 6,020 |
| Cocoa Beach Pier | +1.1 ft | OVER | 11,143 |
| Trails | +1.0 ft | OVER | 8,639 |
| ... | | | |
| El Porto (Manhattan) | -0.4 ft | UNDER | 6,902 |
| Manasquan Inlet | -0.4 ft | UNDER | 7,367 |
| Brookings (Harris Beach) | -0.6 ft | UNDER | 11,028 |
| Lahaina Harbor (Breakwall) | -0.7 ft | UNDER | 11,051 |

18 of 30 beaches with 100+ obs over-predict, 7 under-predict, 5 neutral. The over-prediction bias is dominant.

### 5. Per-Beach Bias Is Volatile Week-to-Week

| Stability | Count | Example |
|-----------|-------|---------|
| STABLE (stddev < 0.1m) | 0 | — |
| MODERATE (stddev 0.1-0.2m) | 3 | Ala Moana, Jalama, Lower Trestles |
| VOLATILE (stddev > 0.2m) | 22 | Beacons: -0.04m to +0.52m swing |

**Implication**: A simple rolling 7-day bias feature would chase noise. Per-beach corrections need to be learned by the model from features (beach embedding + conditions), not from lagging bias statistics.

### 6. Training Data Volume Is Abundant

48 beaches have matched observations in 90 days:
- Median: **10,678 observations per beach**
- 47 of 48 beaches have 500+ observations
- Total: ~432K matched predictions

This is more than enough data for beach-level model features.

### 7. Buoy Reporting Frequency — Window Is Already Optimal

| Gap Bucket | % of Observations |
|-----------|-------------------|
| 30-60 min | 0.6% |
| **1-2 hours** | **91.6%** |
| 2-3 hours | 2.8% |
| 3-6 hours | 2.2% |
| 6+ hours | 2.9% |

Median gap: 2 hours. The current +/-1h matching window catches 92% of observations. Widening would add only ~8% more matches with significantly staler data.

---

## Decisions

### DO (data-supported):
1. **Add beach identity to the model** — 14 beaches are actively hurt by the global correction. Per-beach features with 10K+ observations each is a strong signal.
2. **Fix the 5-10ft correction problem** — The model hurts at 5-6.5ft (-4.3%) and 6.5-10ft (-2.8%). Either lower the taper start or fix via beach embeddings.

### DON'T (data says skip):
3. **Rolling bias feature** — Bias is too volatile week-to-week (22 of 25 beaches VOLATILE). Would chase noise.
4. **Observation window widening** — Buoys report every 2h, +/-1h already catches 92%. Marginal gain, stale data risk.
5. **Swell taper widening for 13ft+** — NOAA over-predicts by +1.9m at 13ft+. Widening the taper would let the model try to fix this, but the model isn't trained well enough on large swells yet. Defer until beach embeddings improve overall accuracy.

---

## Appendix: Current Pipeline Architecture

```
NOAA NWS text forecasts ("3-4ft")
  |-- parse-wave-height.ts (midpoint -> meters)
  v
enhanced_forecasts table
  |-- correct-forecasts cron (every 10min)
  |-- Sends to Fly.io ML service
  v
XGBoost v3 (13 features, 90-day training window)
  |-- Guardrails: swell taper 2-4m, bias clamp +/-75%, cap +/-1.5m
  v
corrected_forecasts + ml_predictions_log
  |-- backfill-observations cron (every 10min, +/-1h window)
  v
Matched with IOOS buoy observations (observed_m)
  |-- retrain cron (weekly Sunday 6am UTC, or drift-triggered)
  v
New model candidate -> shadow scoring -> promotion
```

### Model Features (v3)
`forecast_height_m`, `wave_period_sq`, `wave_steepness`, `wave_direction_sin/cos`, `wind_speed_ms`, `wind_direction_sin/cos`, `hour`, `month`, `wind_missing`, `swell_access_factor`, `wind_exposure_factor`

### Swell Taper (current)
Linear scale 100% -> 0% correction between 2.0m (6.5ft) and 4.0m (13ft).

### Accuracy Card Thresholds
- Hide when MAE > 0.45m AND relative error > 40%
- Hide when observed waves < 0.3m (~1ft)
- Currently 23 of 279 beaches show the card
