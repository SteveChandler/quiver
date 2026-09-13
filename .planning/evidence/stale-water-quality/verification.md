# Water-quality sample age policy

Local branch: fix/stale-water-quality-samples. No commit, push, deployment or database mutation.

At seven days, a sample-derived alert becomes an unconfirmed-status warning. It no longer creates a map hold/red pin or excludes the beach from recommendations. County advisories/closures and explicit holds remain authoritative. Evidence retains the sample date; this does not claim the water is safe.

Production files: lib/constants/water-quality.ts; lib/recommendations/major-event-hold/water-quality.ts; components/map/map-marker-builder.ts; components/map/conditions-callout.ts.
Tests modified: __tests__/lib/recommendations/major-event-hold/water-quality.test.ts; __tests__/components/map/map-condition-summary.test.ts; __tests__/components/map/conditions-callout.test.ts; e2e/guest-map-polish.spec.ts.

Checks:
- PASS: git diff --check.
- PASS: npx eslint --max-warnings=0 lib/constants/water-quality.ts lib/recommendations/major-event-hold/water-quality.ts components/map/map-marker-builder.ts components/map/conditions-callout.ts.
- PASS: yarn test:unit --runInBand __tests__/lib/recommendations/major-event-hold __tests__/lib/services/water-quality-current-status.test.ts __tests__/components/map/conditions-callout.test.ts __tests__/components/map/map-condition-summary.test.ts — 443 tests / 15 suites.
- PASS: yarn test:unit --runInBand __tests__/components/map/interactive-map.test.tsx __tests__/components/map-view.test.tsx __tests__/components/map/map-beach-loader-partitions.test.ts — 106 tests / 3 suites, one snapshot.
- Initial draft tests failed two sample fixtures without current dates; corrected their explicit dates and retained old-sample regression coverage.

E2E reviewed: existing guest-map-polish historical-sample scenario and local Playwright config. Uses intercepted read-only evidence with real beach geometry; all application writes intercepted.

- PASS: NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build — 128.45 seconds, including TypeScript.
- PASS: BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test --config=.planning/evidence/map-polish/playwright.config.ts --project=guest --workers=1 e2e/guest-map-polish.spec.ts --grep 'warns about old samples' — 1/1, 7.2 seconds.
- Visual PASS: inspected mobile advisory-source.png; warning readable and contained within the existing callout. Pin has no active water-quality hold.

Final scoped E2E status: PASS. No unresolved findings in reviewed scope. Full E2E suite and iOS simulator were not rerun for this change; shared web callout is used by the native embed. Production is unchanged until this branch is committed and deployed.

## Dated-warning follow-up

Warning copy changed to “Water quality not recently verified”, with a visible second line containing the sample date. Sample-only stale evidence has no closure hold; current county closures remain unchanged.

- PASS: yarn test:unit --runInBand __tests__/components/map/conditions-callout.test.ts __tests__/components/map/map-condition-summary.test.ts __tests__/lib/recommendations/major-event-hold/water-quality.test.ts — 46 tests. Assertions include the displayed date and absence of “Closed”.

- PASS: npx eslint --max-warnings=0 components/map/conditions-callout.ts.
- PASS: NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build — 402.06 seconds, including TypeScript.
- PASS: BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test --config=.planning/evidence/map-polish/playwright.config.ts --project=guest --workers=1 e2e/guest-map-polish.spec.ts --grep 'warns about old samples' — 1/1, 5.6 seconds.
- PASS: reviewed resulting 390px screenshot; both warning and sample date fit without clipping or overlapping the beach name. Stale sample does not label the beach closed or set its map hold.
Final dated-warning E2E status: PASS. No new unresolved findings. Still local, uncommitted and undeployed.

## Main integration

- PASS: git diff --check.
- PASS: git commit -m 'fix: distinguish stale water samples from active beach closures' — 403996ac3; secret scan and 14 guardrails passed.
- PASS: git push -u origin fix/stale-water-quality-samples.
- PASS: gh pr create --base main --head fix/stale-water-quality-samples --title 'fix: distinguish stale water samples from active beach closures' --body-file /tmp/wq-main-pr.md — https://github.com/SteveChandler/quiver/pull/700.

- PASS: GitHub Main Gate https://github.com/SteveChandler/quiver/actions/runs/34060922836 — build, lint, TypeScript and full unit tests.
- PASS: gh pr merge 700 --squash --match-head-commit 403996ac3aeb119661ea64893fa231de46bfe21b.
- PASS: gh pr view 700 --json state,mergeCommit,url — MERGED, main commit 09af7f0bf0e865fb18613334e708050bc352c49c.
Final state: committed and merged to main; no prod promotion or deployment performed in this turn. Scoped E2E remains PASS (1/1); no unresolved scoped findings.
