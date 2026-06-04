# Phase 19: Forecast Accuracy Trust Page - Context

**Gathered:** 2026-06-01
**Status:** Added to roadmap, not planned

<domain>
## Phase Boundary

Upgrade `/forecast-accuracy` into a visible proof/trust page. Do not claim
accuracy improvements unless backed by live metrics.
</domain>

<work>
## Work

1. If live metrics exist, render beach, Quiver MAE, NOAA baseline MAE,
   improvement percentage, validated-pair count, last updated, and confidence.
2. If metrics are not ready, render graceful building/in-progress rows and do
   not leave the page empty.
3. Add clear sections for how the score works, data sources used, when Quiver
   trusts buoy/observed data, known limits, and last updated.
4. Reuse the same confidence/source language as `BestSurfWindows`: high,
   medium, low, model only, and sparse data.
</work>

<validation>
## Default Validation

- Tests or assertions for both metrics-available and metrics-building states.
- No empty page state.
- No unbacked accuracy claims.
- Confidence/source language matches recommendation UI.
- Targeted Playwright or browser check for `/forecast-accuracy`.
- Scoped ESLint and `yarn typecheck` for touched files.
</validation>

---

*Phase: 19-Forecast Accuracy Trust Page*
*Context gathered: 2026-06-01*
