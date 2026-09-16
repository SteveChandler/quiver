# Forecast-to-decision journey — reviewed delivery

## Repository and scope

Working repository: `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/forecast-decision-review-main`, branch `codex/forecast-decision-review-main`. Base: current `origin/main` at `b5b81db2df60462c1859c06d1e5dcabcfc56e5a3`. The required recommendation contract commit, `e9c48d4e00218e5ef66b7e4a005d2a125c87efa8`, is an ancestor. The original implementation was reapplied cleanly onto current main, retaining its newer camera, date/window, auth and contract changes.

The shared checkout `/Users/stevenchandler/Desktop/dev/quiver` remains on `fix/seo-outreach-digest-contact-guard`, HEAD `c0fa2bfd8bbad44e7d56c1fbffd1208bbd011dcb`; unrelated dirty work was preserved. Original task and read-only baseline worktrees remain intact. The user subsequently authorized commit and push to main; no deployment, remote migration, production flag change or production write is part of this task.

Read canonical `soul.md`, applicable AGENTS/architecture instructions, Git workflow and E2E instructions/helpers/tests. September 4 UX-01/02/07/08/09/13/14 were investigation leads, not production facts. Plan: inspect rendered list → spot flow; retain the established contract; reproduce regressions; make bounded UI and camera patches; test; repeat review/fix/test; retain evidence. No agents were delegated.

## Verified flow and changes

Entrypoints: `app/forecast/page.tsx` → `RegionalBestSurfWindows` → `BestSurfWindows` zine cards → `app/[intent]/[city]/[beachSlug]/page.tsx` → `BeachDetailClient`, `PublicForecastAnswer` and `ForecastTab`. Recommendation producer: `buildSurfWindowRecommendations`; authenticated decision endpoint: `/api/surf/call?beachId=…&forecastAt=…`.

- Cards show spot, local date/window/timezone, material caveats, confidence, the existing qualified verdict, one truthful action, surf/wind/tide facts and one contract-backed reason. Detailed evidence remains discoverable. No scoring, ranking or raw numeric forecast changes; repeated `ft` suffixes are normalized only for display.
- Window start/end and forecast tab survive card navigation. A valid selected date takes precedence over a conflicting window. Invalid calendar dates are rejected. Account/beach/window scope and existing abort guards prevent another selection's authenticated call from being reused. Guest verdicts remain gated.
- Day selection updates the URL; reload and Back preserve it. Unavailable selected-day data does not silently substitute another day's best forecast. Now and current tides are explicitly separate. A selected future verdict cannot appear again in Now or attach to current-condition feedback.
- Hazards, water notices and stale warnings remain visible outside disclosures. Operational forecast precedes editorial/media/install content. Raw swell, wind, tide, source, methodology and charts remain accessible through existing components/native disclosures. Nearby spots are labelled accurately, with no ranked-backup promise.
- `/cams` originally returned local HTTP 500 for an unsupported catalog thumbnail host. The separate minimal patch routes catalog thumbnails through the existing proxy and supplies the existing local fallback. Neither remote-image nor proxy trust was expanded. Final route is HTTP 200.
- Event names, metadata builders and entitlement behavior remain unchanged. The relocated retained app CTA now correctly reports placement `after_public_hourly_forecast`; previous `above_fold` metadata would have been false. Removed promotional controls no longer produce their former interactions.

Exact production/test/documentation inventory: [changed-files.txt](evidence/forecast-decision-review/changed-files.txt).

## Review cycles

1. Reverified the former water-quality “environment” failure. Read-only requests for 1/100/495 beach IDs produced URL lengths 146/4007/19412; the largest failed with `UND_ERR_HEADERS_OVERFLOW` while smaller requests succeeded. The shared resolver now reads at most 100 IDs per request and never treats a partial hazard read as successful. Current county projection queries owner holds only for covered beaches, matching existing projection semantics. Added batching and failure regressions. Also corrected date/window precedence and URL-driven tab synchronization. Four regression failures reproduced before fixing.
2. A future selected surf verdict could be repeated under current conditions. Reproduced with a failing test, then prevented the mismatch. Fixed encountered pre-existing unit setup failures using local dummy configuration, narrowly scoped cron-run persistence mocks, explicit baseline forecast flag fixtures and cleanup of a real test-owned limiter interval. Dedicated trusted-adjustment tests still exercise the enabled path. No production flags changed.
3. Tablet screenshot showed the share control covering the signup link; its visible label falsely promised comparison. A browser geometry regression failed at 768px. The control now reads “Share forecast” and sits in normal flow below the actions, retaining its handler and analytics.
4. Settled screenshots exposed 47px tablet day cards clipping dates. A browser regression failed against the existing 88px mobile width. Retaining that minimum width allows the existing strip to scroll, keeping essential text readable. No text shrinking, new component or global style change.

Final review checks source/data flow, hazards, entitlement and analytics contracts, accessible actions, URL/back behavior, test assertions and original-resolution screenshots. Validation results are below; this is not a claim that the entire repository has no defects.

## Visual evidence and interaction counts

[Before/after gallery](evidence/forecast-decision-review/index.html), with 360/768/1440px list and spot captures, tablet/desktop share layout and camera evidence. Before captures use the original contract baseline; after captures use current main plus this patch. Live forecast dates and winners changed between captures, so these are not a controlled forecast-data experiment. Screenshot capture disables CSS animations so day cards are not recorded halfway through entry animations.

Across five comparison cards, removed five duplicated spot/time headlines, five board/skill tag groups, five app CTAs and five prominent score disks (scores remain in advanced detail). Why details no longer repeat the visible positives/watchouts. Wave/tide unit duplication is removed; measurements needed in hazards are intentionally retained.

One activation opens the exact comparison window, rather than the generic latest page. One day activation changes selection; reload preserves it; two Back actions return to the original window and then the list. One disclosure reveals advanced charts/raw rows; one opens card evidence. Selected guest detail keeps unrelated latest sources behind two disclosures. Keyboard focus and Enter, selected states, document bounds, missing-day handling and Overview → Explore forecast are browser-verified. Horizon navigation keeps its existing horizontal scroll behavior and entitlement gates.

Comprehension is an inspection result: where, when, uncertainty and the next action are visible; facts and reasons are together on the comparison card. No people, real devices or screen readers were tested. Browser checks use local Chromium with real read-only forecast responses; analytics writes are intercepted. Mocked unit tests cover authenticated loading/error/stale isolation and empty/unavailable states. Authenticated live E2E was not run because its existing setup can infer and persist home-beach data against the shared backend.

## Test commands and results

Node 22.23.1; Yarn 1.22.17. Commands run in the review worktree unless a baseline is named. Required dummy unit environment prefix below never writes production flags:

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test yarn test:unit --bail=0 --maxWorkers=2
```

Final full unit run: **PASS**, 1,410 suites / 18,122 tests, four snapshots; 16 suites and 195 tests skipped, one todo. First full run failed in 10 suites (30 tests); all encountered failures were corrected and the full command rerun successfully. Subsequent focused checks cover the final added regression/fixture cleanup and horizon changes.

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test yarn test:unit --runInBand __tests__/components/beach-detail/tabs/forecast-tab.test.tsx __tests__/lib/recommendations/major-event-hold/water-quality.test.ts __tests__/lib/services/water-quality-current-status.test.ts
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test yarn test:unit --runInBand __tests__/api/forecasts/forecasts-bulk.test.ts __tests__/components/forecast/regional-best-surf-windows.test.tsx __tests__/components/beach-detail/tabs/forecast-tab.test.tsx
```

PASS: 3 suites / 71 tests, then 3 suites / 63 tests. Future-window red regression failed once before its fix. Original unchanged-baseline camera/unit-formatting regression: two expected failures / 42 passes; the first implementation's 12-suite focused run passed 164 tests.

```sh
npx playwright test -c .planning/playwright-decision.config.ts e2e/guest-forecast-decision-journey.spec.ts --project=guest
npx playwright test -c .planning/playwright-decision.config.ts e2e/guest-forecast-decision-journey.spec.ts --project=guest --grep 'hero share'
npx playwright test -c .planning/playwright-decision.config.ts e2e/guest-forecast-decision-journey.spec.ts --project=guest --grep '768px'
```

The last two commands intentionally reproduced the share overlap and 47px day-card failures before their respective fixes. Final full browser run: **PASS, six tests in 40.8s**. Result is recorded in [e2e-final.log](evidence/forecast-decision-review/e2e-final.log). Existing console-error gates are unchanged; earlier water-quality fetch failures were repaired, not ignored. Cold-load timing failures were corrected with existing explicit `TIMEOUTS.long` waits, not sleeps.

E2E reviewed: regional forecast hub, guest authority/report/CTA specs, beach-detail forecast tabs, auth fixtures and error helpers. Added meaningful guest list → selected spot → day → reload → Back coverage, layout regressions and camera route check. Updated existing forecast-tabs selectors from Today to Now, made conditional no-op assertions unconditional, and corrected retained app CTA placement assertions. Existing authenticated forecast-tabs suite was collected with `npx playwright test -c .planning/playwright-decision.config.ts e2e/beach-detail/forecast-tabs.spec.ts --project=auth --list` (42 discovered); not executed. The entire guest CTA suite was not run.

```sh
yarn typecheck
VERCEL_ENV=preview yarn build
git diff HEAD --check
python3 /Users/stevenchandler/.codex/skills/visual-screenshot-evidence/scripts/render_visual_evidence.py --input .planning/evidence/forecast-decision-review/evidence.json
```

Scoped lint uses all changed TS/TSX/JS plus the two new source/test files, with zero warnings allowed:

```sh
git diff HEAD --name-only -z | python3 -c 'import sys,subprocess; files=[p for p in sys.stdin.buffer.read().decode().split("\0") if p.endswith((".ts",".tsx",".js"))]; files += ["lib/utils/forecast-window-param.ts", "e2e/guest-forecast-decision-journey.spec.ts"]; sys.exit(subprocess.call(["./node_modules/.bin/eslint","--max-warnings=0",*files]))'
```

One intermediate typecheck found an unsupported RTL `exact` option; removed and rerun. Three pre-existing conditional E2E lint warnings and three new geometry-test lint warnings were fixed without suppressions. Final gates: **PASS** typecheck (5.42s), strict changed-file ESLint (zero warnings), build (93.04s), whitespace and visual evidence. Final focused run: **PASS**, 3 suites / 77 tests. Results and exact final focused command are retained in [checks.txt](evidence/forecast-decision-review/checks.txt).

```sh
NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 NEXT_PUBLIC_SUPABASE_ANON_KEY=local-test SUPABASE_SERVICE_ROLE_KEY=local-test NEXT_PUBLIC_SITE_URL=http://localhost:3000 ./node_modules/.bin/knip --no-progress --reporter json
```

Raw deadcode check: **FAIL on both clean current-main and the patch**. Normalized baseline comparison: **PASS, zero introduced findings**; both have 1,506 findings. See [knip-comparison.json](evidence/forecast-decision-review/knip-comparison.json). Unrelated deadcode cleanup was not added. A previous concurrent typecheck was interrupted and is not counted as passed. Build emits the existing local missing-site-URL warning; no environment configuration was changed.

## Compatibility, rollback and remaining risk

No migrations, dependency changes, production flag changes or new infrastructure. Old URLs still work; window/date parameters are additive. The existing share parser import remains available via re-export. API, scoring, ranking, entitlements, hazard failure handling and privacy contracts remain intact. Bounded water-quality reads make additional small requests for large catalogs; failure remains unresolved rather than falsely safe.

The camera patch and water-quality query fix are separate commits and can be reverted independently. Revert the journey commit to roll back UI/navigation changes; do not reset the shared checkout. Test fixture corrections can remain independently. Main push is authorized; production deployment is not. Production incidence of the historical audit failures is not established. Real-device, screen-reader and live-authenticated validation remain gaps, not passes. No new task-related issue remained in the final review; repository-wide deadcode debt is documented above.

Atomic supporting commits: `b55c19a46` (camera), `95b10f365` (bounded water-quality reads), `d30654751` (test fixture corrections). This handoff accompanies the journey commit. Main delivery SHA is reported in the task response after remote verification.
