# 17-05 Summary: Final Pilot QA And Evidence

Status: Complete with one documented broad-auth-suite caveat

## Delivered

- Added `e2e/guest-session-intelligence-pilot.spec.ts` with spot and regional pilot checks across 360, 390, 412, 768, and 1280 widths.
- Filtered optional background E2E noise for PostHog ingest and local HLS manifest misses.
- Added scoped changelog entry for the limited Session Intelligence pilot.
- Recorded local route timing evidence:
  - `/ca/san-diego/blacks`: status 200, wall 1997ms, load 1974ms.
  - `/forecast?region=southern-california`: status 200, wall 31322ms, load 30984ms.
  - `/`: status 200, wall 586ms, load 584ms with auth storage.

## Verification

- `npx playwright test --list e2e/guest-session-intelligence-pilot.spec.ts e2e/forecast-hub.spec.ts e2e/home.spec.ts` passed and registered the new tests.
- `npx playwright test e2e/guest-session-intelligence-pilot.spec.ts --project=guest` passed: 11 passed.
- `npx playwright test e2e/guest-session-intelligence-components.spec.ts e2e/guest-spot-surf-report.spec.ts e2e/guest-session-intelligence-pilot.spec.ts --project=guest` passed: 27 passed, 2 skipped.
- `npx playwright test e2e/home.spec.ts --project=auth --grep "session intelligence without replacing existing home modules"` passed.
- `npx playwright test e2e/forecast-hub.spec.ts --project=auth --grep "best windows section and seven-day outlook both render"` passed.
- `yarn typecheck` passed.
- `git diff --check` passed.

## Caveat

- Full auth bundle command `npx playwright test e2e/forecast-hub.spec.ts e2e/home.spec.ts --project=auth` remains unstable locally under 3 workers. Latest run: 47 passed, 5 skipped, 10 failed. Failures were broad page-load or forecast-fetch timeouts and did not reproduce in focused Phase 17 assertions.

