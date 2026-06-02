# 19-01 Summary: Accuracy Report And Claim Policy

**Completed:** 2026-06-02
**Status:** passed

## What Changed

- Added `getForecastAccuracyReport()` in `actions/ml/forecast-accuracy-actions.ts`.
- Added typed report, summary, beach row, building row, and confidence models.
- Centralized improvement-claim gating in `canClaimForecastAccuracyImprovement()`.
- Added confidence label logic matching Session Intelligence wording:
  `High - buoy + model`, `Medium - buoy + model`, `Low - sparse data`, and
  `Model only`.
- Added the Phase 19 claim-policy doc:
  `docs/session-intelligence/phase-19-forecast-accuracy-claim-policy.md`.
- Extended action tests for service-role fallback, live rows, no rows, and
  non-positive improvement.

## Verification

| Command | Result |
| --- | --- |
| `yarn test:unit __tests__/actions/ml/forecast-accuracy-actions.test.ts --runInBand` | passed |
| `npx eslint --max-warnings=0 actions/ml/forecast-accuracy-actions.ts __tests__/actions/ml/forecast-accuracy-actions.test.ts` | passed |
| `rg -n "NOAA baseline|Quiver MAE|validated-pair|last updated|High - buoy \\+ model|sparse data|must not claim|building" docs/session-intelligence/phase-19-forecast-accuracy-claim-policy.md` | passed |

## Notes

- No schema changes or production mutations were made.
- The report currently reads existing baseline rows and preserves existing
  regional/time-series action exports for downstream UI use.
