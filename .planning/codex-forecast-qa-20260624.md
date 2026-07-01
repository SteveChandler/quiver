# Codex task — Forecast pipeline QA after prod PR #344

You are validating that the forecast-computation changes merged to **prod** in PR #344
(`feat(forecast): promote forecast-accuracy computation core to prod`) did not regress
displayed surf numbers. Work in this repo (`quiver/`). Read-only on prod data; do not
write to the DB. Report findings — do not change code unless you find a clear bug, and
if you do, propose a fix in a branch + PR, don't push to prod.

## What changed in #344 (the surfaces to validate)
- `lib/services/forecast/forecast-builder.ts`, `log-display-prediction.ts`, `accuracy-metrics.ts`
- `lib/utils/wave-height-source.ts` (refactored `WaveHeightSourceTag` to derive from a const array — same 6 tags)
- `lib/scoring/native-condition-score.ts` + `lib/services/discovery/window-selector/*` (native skill-aware scoring; `scoreWindowConditionScore`)
- `lib/services/noaa-wavewatch/gfs-wave-shadow.ts`, `lib/validation/schemas.ts`, `app/api/forecasts/update-enhanced/route.ts`

## Context that matters
- prod + dev share ONE Supabase instance: project `vawdnbbgawichorsjiwe` ("quiverDB"). Query it read-only.
- `enhanced_forecasts.wave_height` is computed at WRITE TIME by the batch cron (`ForecastBuilder.getWaveHeight()`). A transform change only shows once forecasts regenerate — check `forecast_at` freshness first.

## Steps
1. **Freshness:** confirm the batch cron has regenerated forecasts since the prod deploy (~2026-06-24 17:15 UTC). `SELECT max(forecast_at), max(updated_at) FROM enhanced_forecasts;` — if stale, the new code isn't reflected in stored heights yet; note it.
2. **Run the gates locally:**
   - `yarn regression:shoaling` (gates A–D must pass)
   - `yarn jest lib/services/forecast __tests__/lib/services/forecast __tests__/lib/utils/wave-height __tests__/lib/scoring/native-condition-score.test.ts __tests__/lib/services/discovery/window-selector.test.ts`
   - `yarn typecheck`
3. **Spot-check 5–8 marquee SoCal beaches** (e.g. Tourmaline, Ocean Beach, Blacks, Trestles, Malibu, Huntington). For each: pull the current `enhanced_forecasts` row, compute expected face height by hand through the transform layers, and compare to Surfline LOTUS (`https://services.surfline.com/kbyg/spots/forecasts/wave?spotId=<ID>&days=1&intervalHours=1&units[waveHeight]=FT`; spot IDs in `scripts/shoaling-regression.ts`). Flag any beach >~1.5× off.
4. **Post-merge invariants** (these are the things #344's scoring change could break):
   - `snapshot.primarySwell.periodS === snapshot.wavePeriod` AND `snapshot.primarySwell.directionDeg === snapshot.waveDirection` (post-b06f5708; `forecastToSnapshot` must use `pickDominantSwell`).
   - `swellAlignment` and `swellInterference` multiply by `getDirectionalRelevance(primarySwell.periodS)` — on windswell-dominant rows neither should contribute >40.
5. **Compare old vs new scoring:** because #344 swapped `scoreWindowWithEngine` (composite) for the native `scoreWindowConditionScore`, sanity-check that discovery/window selection scores at a few beaches are still reasonable (not all 0, not all 100). The `swellDirScore` wrap-math fix should be in; verify `computeSwellDirScore` is non-zero across directions.

## Output
A short report: gates pass/fail, per-beach expected-vs-Surfline table, invariant check results, and a GO / NO-GO on the #344 changes. If NO-GO, name the exact layer + file and open a fix PR against `main` (never push to prod).
