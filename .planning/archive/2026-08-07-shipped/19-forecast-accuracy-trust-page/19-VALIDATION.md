# Phase 19 Validation Strategy

## Purpose

Phase 19 changes a public trust page. Validation must prove the page is honest,
non-empty, crawlable, and useful in both live-metrics and metrics-building
states.

## Required Local Checks

```bash
yarn test:unit __tests__/actions/ml/forecast-accuracy-actions.test.ts --runInBand
yarn test:unit __tests__/components/forecast-accuracy/beach-accuracy-leaderboard.test.tsx __tests__/components/forecast-accuracy/forecast-accuracy-page-state.test.tsx --runInBand
npx eslint --max-warnings=0 app/forecast-accuracy/page.tsx actions/ml/forecast-accuracy-actions.ts components/forecast-accuracy/*.tsx __tests__/actions/ml/forecast-accuracy-actions.test.ts __tests__/components/forecast-accuracy/*.tsx e2e/guest-forecast-accuracy.spec.ts
yarn typecheck
npx playwright test --list e2e/guest-forecast-accuracy.spec.ts
npx playwright test e2e/guest-forecast-accuracy.spec.ts --project=guest
```

Adjust component-test filenames if execution chooses a different focused test
split, but keep equivalent coverage.

## Required Assertions

- Metrics-present path renders beach name, Quiver MAE, NOAA baseline MAE,
  improvement percentage, validated-pair count, last updated, and confidence.
- Metrics-building path renders in-progress rows and never claims improvement.
- Non-positive improvement path does not render "better than NOAA" language.
- Missing service-role/env path degrades to building status, not a crash.
- Confidence/source labels match Session Intelligence wording.
- Methodology explains MAE, data sources, trusted observation criteria, known
  limits, and last updated/sample-window behavior.
- `/forecast-accuracy` renders on guest mobile and desktop without horizontal
  overflow or visible errors.

## Browser QA

- Open `http://localhost:3000/forecast-accuracy`.
- Inspect mobile around 390px wide and desktop around 1280px wide.
- Confirm first viewport makes the page purpose obvious.
- Confirm Brand-Vault sticker assets render and do not overlap text.
- Confirm either real metric rows or building rows are visible.

## Release Readiness

- Production impact: no deploy, alias promotion, database mutation, or migration
  in Phase 19 without explicit approval.
- If execution changes rendering mode from `force-dynamic`, run
  `VERCEL_ENV=preview yarn build` before claiming release readiness.
