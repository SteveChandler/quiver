# Phase 19 Forecast Accuracy Claim Policy

**Captured:** 2026-06-02

## Purpose

`/forecast-accuracy` is a public proof page. It may explain Quiver's accuracy
pipeline at all times, but it must only claim accuracy lift when live,
buoy-validated metrics support that claim.

## Backed Fields

| Display field | Backing field |
| --- | --- |
| Beach | `beach_ml_performance_baseline.beach_name` |
| NOAA baseline MAE | `beach_ml_performance_baseline.raw_mae` |
| Quiver MAE | `beach_ml_performance_baseline.corrected_mae` |
| Improvement percentage | derived from NOAA baseline MAE and Quiver MAE, or `mae_improvement_pct` when valid |
| Validated-pair count | `beach_ml_performance_baseline.predictions_matched` |
| Last updated | `beach_ml_performance_baseline.last_prediction_at` |
| Sample window | `period_start` and `period_end` |

## Allowed Claims

- "Quiver MAE" can be shown when `corrected_mae` is a positive finite number.
- "NOAA baseline MAE" can be shown when `raw_mae` is a positive finite number.
- "Better than NOAA" or equivalent lift copy requires:
  - NOAA baseline MAE is positive.
  - Quiver MAE is positive.
  - Quiver MAE is lower than NOAA baseline MAE.
  - At least 10 validated forecast-buoy pairs are present.
  - Last updated is present.
- "No measurable lift yet" is allowed when live metrics exist but Quiver MAE is
  not lower than NOAA baseline MAE.

## Confidence Labels

Use the same visible wording as Session Intelligence source badges:

| State | Label |
| --- | --- |
| Recent high-volume buoy-matched sample | `High - buoy + model` |
| Recent minimum viable buoy-matched sample | `Medium - buoy + model` |
| Sparse or stale buoy-matched sample | `Low - sparse data` |
| No validated buoy match ready | `Model only` |

## Building State

When metrics are missing, sparse, unavailable, or errored, render building rows
instead of an empty page. Building rows may say:

- "Validated forecast-buoy pairs: Building"
- "NOAA baseline comparison: Queued"
- "Accuracy lift claim: Held"

They must not show fake beach-level MAE, fake improvement percentage, or fake
last updated values.

## Must Not Claim

- Do not claim "100+ beaches" unless the live report count supports it.
- Do not claim "Quiver is more accurate" when `corrected_mae >= raw_mae`.
- Do not claim user session reports update live accuracy metrics.
- Do not imply the model is trained from unreviewed weak user observations.
- Do not treat a missing service-role key or query error as evidence that
  accuracy data does not exist in production.

## Known Limits To Explain

- MAE is average wave-height miss; lower is better.
- Buoy observations are matched within the documented validation window.
- Nearby buoys are not perfect proxies for every beach.
- Sparse samples can move quickly in a rolling window.
- NOAA baseline is a regional marine forecast baseline, not a spot-specific
  competitor product.
