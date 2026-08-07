# Phase 19 Codebase Patterns

## Existing Files

- Route: `app/forecast-accuracy/page.tsx`
- Data actions: `actions/ml/forecast-accuracy-actions.ts`
- Existing forecast-accuracy components:
  - `components/forecast-accuracy/accuracy-hero.tsx`
  - `components/forecast-accuracy/noaa-comparison-bar.tsx`
  - `components/forecast-accuracy/beach-accuracy-leaderboard.tsx`
  - `components/forecast-accuracy/regional-accuracy-chart.tsx`
  - `components/forecast-accuracy/methodology-section.tsx`
  - `components/forecast-accuracy/accuracy-faq.tsx`
  - `components/forecast-accuracy/crowdsource-cta.tsx`
- Existing tests:
  - `__tests__/actions/ml/forecast-accuracy-actions.test.ts`
  - `__tests__/components/forecast-accuracy/beach-accuracy-leaderboard.test.tsx`
- Existing Brand-Vault web mirror:
  - `public/images/quiver-stickers/manifest.json`
  - `lib/ui/quiver-sticker-assets.ts`
  - `components/zine/quiver-sticker.tsx`
- Existing Session Intelligence source wording:
  - `components/session-intelligence/source-confidence-badge.tsx`
  - `types/session-intelligence.ts`

## Data Rules

- Read only from existing accuracy sources unless execution proves they cannot satisfy the phase.
- Prefer one report-building action over repeated page-level `Promise.allSettled()` wiring.
- Keep existing action exports when possible so older tests/components do not break.
- Use `last_prediction_at`, `period_start`, and `period_end` from `beach_ml_performance_baseline` for freshness and sample-window copy.
- Use `predictions_matched` as the validated-pair count.
- Show improvement only when `rawMae > 0`, `correctedMae > 0`, `correctedMae < rawMae`, and the row meets the minimum matched-pair threshold.

## UI Rules

- Preserve a public first screen with a clear trust-page identity, not an app-home duplicate.
- Use Quiver stickers for refreshed visual treatment, for example `forecastWaveMark`, `spotSwellMatch`, `surfWax`, `orangeTape`, `creamTape`, or `creamCoastMap`.
- Keep cards at 8px radius or less unless preserving an existing component style.
- Never render an empty leaderboard container; render building rows or omit the table section with an explicit status block.
- Use source/confidence text that matches Session Intelligence semantics:
  - `High - buoy + model`
  - `Medium - buoy + model`
  - `Low - sparse data`
  - `Model only`

## Copy Rules

- "Better than NOAA" requires a data-backed positive-lift row or summary.
- "NOAA baseline" means raw NOAA/NWS marine wave-height forecast.
- "Ground truth" means IOOS/NOAA buoy observation matched within the documented window.
- Explain known limits: buoy proximity, match window, sparse sample sizes, regional forecast baseline, and rolling-window churn.
- Include a dated or status-style "last updated" label everywhere the page displays live metrics.

## E2E Pattern

- Use a guest spec because `/forecast-accuracy` is public.
- Include `setupErrorDetection(page)` in `beforeEach`.
- Include `assertNoErrors(page, errorCapture)` in `afterEach`.
- Check mobile and desktop.
- Use assertions that pass in either live-metrics or building-data state but fail on a blank page.
- Check no horizontal overflow.

## Guardrails

- No production database mutations.
- No new ML model.
- No broad SEO metadata edits outside `/forecast-accuracy`.
- No commit unless explicitly requested.
