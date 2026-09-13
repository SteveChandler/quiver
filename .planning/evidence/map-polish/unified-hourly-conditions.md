# Unified hourly map conditions — 2026-09-06

## Result

Pin colors and arrows now consume the same cached hourly partition for each beach. Every displayed beach receives a timeline in batches of at most 20, replacing the previous 20-beach sample plus one-off selected-pin fetch. Moving the forecast time reads cached partitions; marker metadata, colors, and loading borders update in place. The original arrows and layout are preserved.

Scores use the existing beach/skill/board scoring function and V5 display override. Three-hour source anchors interpolate onto the same hourly timeline as arrows. Each hourly score passes the existing major-event safety boundary after interpolation. Blocked or unavailable scores stay null; missing safety evidence cannot turn a pin green. Current water-quality visual overrides remain intact.

## Files changed in this refactor

Production:
- `app/api/forecasts/bulk/route.ts`: additive `includeConditions=true` request option; optional hourly scores, scoring inputs, safety checks, adaptive query chunks below the PostgREST row limit. Existing installed-client requests retain their response behavior.
- `app/api/forecasts/bulk/swell-partition.ts`: optional condition score, conservative interpolation around unavailable scores, shared score-to-summary thresholds.
- `components/map/map-beach-loader.ts`: all-beach hourly batching, selected-beach priority, score validation, existing response cache reuse.
- `components/map/interactive-map.tsx`: removes the separate selected-beach request; derives pin summaries from active hourly partitions; updates styles/metadata/borders without replacing markers; batches timeline extensions through the same loader.

Tests reviewed/modified:
- `__tests__/app/api/forecasts/bulk/route.test.ts`: allow, blocked, unavailable safety decisions at hourly timestamps, canonical scoring inputs.
- `__tests__/app/api/forecasts/bulk/swell-partitions.test.ts`: unavailable scores cannot interpolate into a positive score.
- `__tests__/components/map/map-beach-loader-partitions.test.ts`: all visible beaches included, bounded batches and request contract.
- `__tests__/components/map/interactive-map.test.tsx`: both native-hourly and web-expandable modes; changing colors without marker replacement or extra fetches; loading-border reset.
- `e2e/guest-map-polish.spec.ts`: desktop/mobile cached color-and-arrow updates with a deterministic score transition, real geometry/arrows/timestamps; live new-region colors compared to hourly API scores.
- Existing `e2e/guest-map-arrow-motion.spec.ts` and native-embed browser flow reviewed/run.

No native production source files changed. No commit, deployment, or production database mutation.

## Commands and outcomes

- PASS: `yarn typecheck` (after fixing initial TypeScript errors from Supabase select inference and an optional beach ref).
- PASS: `yarn test:unit --runInBand __tests__/app/api/forecasts/bulk __tests__/components/map __tests__/hooks/use-expandable-swell-timeline.test.ts` — 479 tests / 33 suites.
- PASS: `yarn test:unit --runInBand __tests__/app/api/forecasts/bulk/swell-partitions.test.ts __tests__/components/map/map-beach-loader-partitions.test.ts` — 34 tests, including added null-score interpolation coverage.
- PASS: `yarn test:unit --runInBand __tests__/components/map/interactive-map.test.tsx` — 53 tests after the loading-border fix.
- PASS: `./node_modules/.bin/eslint components/map/interactive-map.tsx components/map/map-beach-loader.ts app/api/forecasts/bulk/route.ts app/api/forecasts/bulk/swell-partition.ts --max-warnings=0`.
- PASS: `git diff --check`.
- PASS: `NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build` — initial build 167.55 seconds. Final rebuild after loading-border fix recorded below.
- PASS: `BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts --project=guest --workers=1 --retries=0 -g 'cached hourly'` — 2/2 desktop and mobile.
- Initial regression run: `BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts e2e/guest-map-arrow-motion.spec.ts --project=guest --workers=1 --retries=0 -g 'new-region pin colors|native embed|arrow bearings'` — 2 PASS, 1 FAIL. New-region color checked before all batches settled; isolated rerun passed. Updated the explicit color-state wait to allow the same 90-second forecast-loading bound used elsewhere, without arbitrary sleeps or weakened color assertions.
- PASS isolated regional rerun: same Playwright command with `e2e/guest-map-polish.spec.ts` and `-g 'new-region pin colors'` — 1/1.

Initial test iterations caught and corrected old sample-size assumptions, a test beach ID that was invalid at the safety boundary, and a missing test timeline toggle. No assertions were removed to hide product failures.

## Live evidence and limitations

Read-only local API backed by the existing production DB configuration returned Del Mar hourly scores of 71, 70, 69 ... 53 ... across the day, alongside its wind/swell tuples. Desktop and mobile screenshots `unified-hourly-1400.png` / `unified-hourly-390.png` were reviewed for preserved arrows and marker appearance.

This refactor does not fabricate missing forecasts or make every beach green. Gray/low-score pins can be correct. Hourly scores between source anchors are interpolated estimates. Native embed browser and native-hourly component coverage were run; an installed iOS simulator binary, Android device, signed release, full-repo CI, and exact Windy model parity were not certified in this follow-up. Repeated live test suites share a local IP and can exhaust the existing API burst limit; no production limiter was weakened.

## Final review corrections

- Loading pins restore a solid border when scored data arrives; historical sample advisory labels are preserved.
- Multiple initial batches explicitly share one UTC start hour. `timelineOnly=false` keeps current details in those initial responses, while extension-only requests remain lightweight. This avoids mismatched batch clocks at an hour boundary.
- PASS: `yarn test:unit --runInBand __tests__/app/api/forecasts/bulk __tests__/components/map/map-beach-loader-partitions.test.ts __tests__/components/map/interactive-map.test.tsx` — 145 tests / 4 suites after these corrections.
- PASS: final scoped ESLint and `git diff --check`.

## Final local build and browser verification

- PASS: final `NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build` — 100.07 seconds, includes TypeScript. Restarted `./node_modules/.bin/next start -p 3107` on this build.
- PASS: final focused browser command with `-g 'cached hourly|new-region pin colors|native embed'` — 4/4, 18.7 seconds.
- The first combined final attempt exhausted the shared local IP burst quota. Browser tests now assign distinct rate buckets only for localhost/127.0.0.1 API requests; external environments and production rate-limit code are unchanged. This removes cross-test traffic leakage while preserving the explicit throttling/recovery test. `e2e/guest-map-arrow-motion.spec.ts` received the same local-only isolation.

- PASS: `BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts e2e/guest-map-arrow-motion.spec.ts --project=guest --workers=1 --retries=0` — **13/13**, 1.2 minutes, no retries.
- PASS: final `yarn typecheck` — 85.68 seconds, including updated E2E files.
- Final E2E status: **PASS**. Final screenshots reviewed. No unresolved findings in this refactor; device/release and data-coverage limits above still apply.
