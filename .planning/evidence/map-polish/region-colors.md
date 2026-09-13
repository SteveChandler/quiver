# Regional pin colors — September 5, 2026

Fixed locally in the existing `fix/map-polish` web worktree. The map rendered up to 50 nearby beaches, but the forecast loader and its cache key considered only the first 20. Later pins therefore had no requested condition score.

## Changes in this follow-up

Production files:

- `components/map/map-beach-loader.ts`: retain all supplied marker beaches and use the existing 50-ID request batching. Keep the hourly field sample bounded to 20; restrict each batch's timeline IDs to its own beaches and combine the returned timeline partitions. Multi-batch requests use one shared starting hour.
- `components/map/interactive-map.tsx`: include every supplied beach ID in the forecast cache key, so changes beyond position 20 trigger enrichment.

Tests modified:

- `__tests__/components/map/map-beach-loader-partitions.test.ts`: verify 25 supplied beaches are all requested, and 50/120 beaches all receive scores while the timeline sample stays bounded and merges correctly.
- `__tests__/components/map/interactive-map.test.tsx`: extend the cache regression to change beaches after an unchanged 20-beach prefix; reordering still avoids duplicate requests.
- `e2e/guest-map-polish.spec.ts`: add a real user drag into Orange County, match the region's production API summaries against rendered pins beyond index 20, verify their computed gradient colors, and assert the original canvas remains mounted.

E2E reviewed: `e2e/guest-map-polish.spec.ts`, `e2e/guest-map-arrow-motion.spec.ts`, their error-detection helpers, `e2e/README.md`, the base Playwright config, and the existing local read-only evidence config. Arrow-motion coverage was unchanged.

No marker/arrow styling, scoring formula, API contract, or native-repository files changed in this follow-up. Existing worktree changes were preserved.

## Commands and outcomes

Run from `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish`:

```sh
yarn test:unit --runInBand --runTestsByPath __tests__/components/map/map-beach-loader-partitions.test.ts __tests__/components/map/interactive-map.test.tsx
```

Initial run: FAIL, one old assertion required the obsolete 20-beach cap. Updated that assertion to the requested behavior. Final run: PASS, 77 tests, two suites, one snapshot.

```sh
./node_modules/.bin/eslint components/map/map-beach-loader.ts components/map/interactive-map.tsx --max-warnings=0
NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build
git diff --check
```

All PASS. Build completed in 96.73 seconds, including TypeScript validation. A separate `yarn typecheck` and full repository unit suite were not run; validation was scoped to the changed behavior plus the full production build.

Local preview restarted using:

```sh
./node_modules/.bin/next start -p 3107
```

PASS; left running at `http://localhost:3107/map`, using the existing production DB configuration. Browser checks allow application GET/HEAD requests and stub non-read application requests; no production writes, migrations, commits, or deployment occurred.

```sh
BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts e2e/guest-map-arrow-motion.spec.ts --project=guest --workers=1 --retries=0
```

Combined run: FAIL, 3 passed / 2 failed. The new-region colors, arrow interpolation, and mobile map passed. Desktop water-animation and native-embed forecast checks failed after the shared local IP exceeded the forecast API's 20-request burst limit; server logs confirmed rate-limit rejections.

```sh
BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts e2e/guest-map-arrow-motion.spec.ts --project=guest --workers=1 --retries=0 --grep-invert 'loads new-region'
```

After a local server restart: arrow motion and desktop map PASS. Interrupted when native again encountered the cumulative burst limit; mobile did not run in this attempt.

```sh
BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts --project=guest --workers=1 --retries=0 --grep 'native embed'
BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts --project=guest --workers=1 --retries=0 --grep 'loads new-region'
```

After another local server restart: both commands PASS, respectively 1/1 in 3.4 seconds and 1/1 in 6.3 seconds. Final E2E status: every scenario passed across runs; the combined suite is not green because of the shared rate limit. No limiter bypass or relaxed assertion was introduced.

## Visual evidence and limitations

Inspected `region-colors.png`: the Orange County coast has scored green/brown/slate pins, retaining the existing UI. The test compares actual computed colors to returned production summaries rather than assuming all beaches should be green.

- The burst-limit behavior remains a risk during rapid repeated forecast requests; this change does not alter rate limits or retry policy.
- Gray can still mean a real lower condition score. Pin scores retain the existing today-headline semantics rather than following each selected timeline hour.
- Previously identified location-banner, marker sizing/overlap, timeline region-reset, rotation, and score-input alignment issues remain outside this follow-up.
- Native embed passed in mobile Chromium; no simulator or physical-device run. Exact Windy model/time/component parity remains uncertified.
- Not deployed. Refresh the local preview to load this build.
