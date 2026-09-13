# Map release verification — 2026-09-06

Web worktree: `quiver/.worktrees/map-polish`; native: `quiver-native/.worktrees/map-polish`.
Feature changes were cherry-picked onto current main; newer map tile recovery, adaptive particle rendering, incremental masks and interaction provenance were retained. Only this task's changes were selected; unrelated original branch history was excluded.

## Files changed

- `__tests__/app/api/forecasts/bulk/route.test.ts`
- `__tests__/app/api/forecasts/bulk/swell-partitions.test.ts`
- `__tests__/components/map-view.test.tsx`
- `__tests__/components/map/conditions-callout.test.ts`
- `__tests__/components/map/embed-map-native-messages.test.tsx`
- `__tests__/components/map/interactive-map.test.tsx`
- `__tests__/components/map/map-beach-loader-partitions.test.ts`
- `__tests__/components/map/map-condition-summary.test.ts`
- `__tests__/components/map/map-forecast-basic.test.tsx`
- `__tests__/components/map/map-forecast-recovery.test.ts`
- `__tests__/components/map/swell-day-timeline.test.tsx`
- `__tests__/components/map/swell-field/swell-particle-layer.test.ts`
- `__tests__/components/map/swell-field/water-mask.test.ts`
- `__tests__/hooks/use-beach-search.test.ts`
- `__tests__/hooks/use-expandable-swell-timeline.test.ts`
- `__tests__/lib/recommendations/major-event-hold/water-quality.test.ts`
- `__tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts`
- `app/api/forecasts/bulk/route.ts`
- `app/api/forecasts/bulk/swell-partition.ts`
- `app/best-surf-forecast-app/comparison-sources.ts`
- `app/best-surf-forecast-app/page.tsx`
- `app/embed/map/embed-map-client.tsx`
- `components/map-view.tsx`
- `components/map/conditions-callout-data.ts`
- `components/map/conditions-callout.ts`
- `components/map/interactive-map.tsx`
- `components/map/map-beach-loader.ts`
- `components/map/map-beach-preview-popup.ts`
- `components/map/map-content.tsx`
- `components/map/map-marker-builder.ts`
- `components/map/swell-field/field-sampler.ts`
- `components/map/swell-field/swell-day-timeline.tsx`
- `components/map/swell-field/swell-particle-layer.ts`
- `components/map/swell-field/water-mask.ts`
- `components/map/timeline-beach-sampler.ts`
- `e2e/guest-map-arrow-motion.spec.ts`
- `e2e/guest-map-polish.spec.ts`
- `hooks/use-beach-search.ts`
- `hooks/use-expandable-swell-timeline.ts`
- `lib/recommendations/major-event-hold/water-quality.ts`
- `lib/services/nearby-beach-service.ts`

Native production files: `src/hooks/use-forecast.ts`, `src/lib/swell-field/forecast-swell-field.ts`. Native test: `src/__tests__/swell-field-model.test.ts`.

## Verification

- PASS: `git diff --check`, secret scan and precommit guardrails.
- PASS: `yarn test:unit --runInBand __tests__/app/api/forecasts/bulk __tests__/components/map __tests__/lib/recommendations/major-event-hold/water-quality.test.ts` — 492 tests / 34 suites after integration.
- PASS: `yarn typecheck`.
- FAIL then PASS: `NODE_OPTIONS=--max-old-space-size=8192 yarn lint` included the untracked local Playwright evidence config; `yarn lint --ignore-pattern '.planning/evidence/map-polish/**'` passed. GitHub lint also passed without special exclusions on tracked source.
- PASS: `NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build` after main integration.
- FAIL: `yarn test:unit --bail=0 --runInBand` — a stale recent-session fixture and missing installed auth SDK patch from newer main. CI independently found expired comparison-source review. Fixed the fixture, reverified sources, and ran `./node_modules/.bin/patch-package` successfully.
- PASS: `yarn test:unit --runInBand __tests__/lib/supabase/auth-session-recovery.test.ts __tests__/lib/services/discovery/surf-discovery-orchestrator.test.ts __tests__/app/best-surf-forecast-app-freshness.test.ts` — 67 tests.
- PASS: `yarn test:unit --runInBand __tests__/app/best-surf-forecast-app-freshness.test.ts __tests__/app/best-surf-forecast-app-metadata.test.ts` — 4 tests.
- PASS: `yarn check:comparison-sources` — all 8 links; two Surfline bot-protected URLs manually checked in browser. Surfline annual plans and features confirmed; LazySurfer free tier/prices corrected; unsupported old rating count and unqualified free extended-forecast claims removed. Sources are the links in `app/best-surf-forecast-app/comparison-sources.ts`.
- Native PASS: `npm run typecheck`.
- Native initial `npm test -- --runInBand` and first push hook failed unrelated UI timeouts under concurrent load. Final `git push -u origin fix/map-polish-release-20260906` ran `npm run regression:gate` without bypass: 535 suites / 6,081 tests passed (21 skipped).

## E2E reviewed and modified

`e2e/guest-map-polish.spec.ts` and `e2e/guest-map-arrow-motion.spec.ts`, existing Playwright setup and error detection helpers; prior Maestro `.planning/evidence/map-polish/native-map.yaml` and `ios-webkit.yaml` flows.

Integrated browser first run: 10 passed / 3 failed. Fixed test assumptions: historical sample evidence is now controlled in an intercepted read response, new-region metadata waits for all batches, and circle dimensions are measured after camera motion ends. API writes are intercepted, production reads remain live. Pin-color time changes use controlled scores but live geometry, forecast times, and arrow measurements.

## Scope and remaining risks

No production DB writes, deployment, native OTA or signed binary release. Earlier iOS simulator selection/playback/native forecast navigation passed; no new signed-device or Android release validation. Forecast coverage and availability remain dependent on upstream data; unavailable scores stay unknown.

Native main PR: https://github.com/SteveChandler/quiver-native/pull/331 (merged).
Web main PR: https://github.com/SteveChandler/quiver/pull/698.

## Final integration follow-up

The full browser run still exposed a real race after test timing fixes: a queued 1.5-second pan callback captured the previous beach list, then replaced new-region data with the old region. The callback now uses the existing latest-populate ref. A fake-clock unit regression failed before the fix (three loads instead of two), then passed. No UI design changed.

- Expected FAIL (regression proof): `yarn test:unit --runInBand __tests__/components/map/interactive-map.test.tsx -t 'queued pan'`.
- PASS: `yarn test:unit --runInBand __tests__/components/map/interactive-map.test.tsx` — 61 tests after final assertions.
- Initial scoped lint FAIL: two broad assertions warned; both now assert concrete types. PASS: `npx eslint --max-warnings=0 components/map/interactive-map.tsx __tests__/components/map/interactive-map.test.tsx`.
- PASS: `NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build` — final runtime fix, 113.75 seconds.
- Earlier second full local unit run (`yarn test:unit --bail=0 --maxWorkers=2`) failed one weak async assertion; fixed to wait for the actual forecast payload. GitHub full unit gate then passed at e6c2475dc. Latest CI must also pass before merge.
- Commits and pushes ran secret scanning and guardrails successfully; no hook bypass.

- Final E2E PASS: `BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test --config=.planning/evidence/map-polish/playwright.config.ts --project=guest --workers=1 e2e/guest-map-polish.spec.ts e2e/guest-map-arrow-motion.spec.ts` — 13/13, 2.1 minutes. Earlier full runs with the old queued callback failed the new-region test; the final runtime fix resolved it. The coastal-travel flow also recovered from real local API throttling.
- Visual review: final `region-colors.png` and `unified-hourly-390.png` inspected; compact separated coastal pins, original arrow design and readable mobile controls retained. Narrow mobile timeline intentionally uses numeric dates after Today and truncates the long forecast-end summary.

## Release result

- Web main: PR #698 squash-merged as `0bae4c3b3be3b8064d42c870204543cab7b345ae`.
- Native main: PR #331 squash-merged as `248d545f8fc31776d8a0774f77e6390484bbd754`.
- Production PR: https://github.com/SteveChandler/quiver/pull/699 — main → prod, open and unmerged. Only the web task squash commit is ahead of prod.
- Final GitHub Main Gate PASS: https://github.com/SteveChandler/quiver/actions/runs/34037351429 — build 3m28s, lint 2m27s, TypeScript 2m47s, full unit tests 3m51s.
- Release commands PASS: `git push origin fix/map-polish-release-20260906`; `gh pr merge 698 --squash --match-head-commit c556fa05a9b63bd83ee0d59a7d41da3121244b88`; `git fetch origin main prod`; `gh pr create --base prod --head main --title 'release: promote map forecast synchronization and interaction fixes' --body-file /tmp/map-prod-pr-body.md`.
- Final E2E: PASS (13/13). No unresolved findings from the scoped integration checks. Prod Gate for the new promotion PR is separate and must complete before production merge. No deployment performed.

Final web CI totals: 1,399 suites passed; 17,896 tests passed, 197 skipped, 1 todo. Production PR #699 confirmed OPEN with base prod and head main; its Prod Gate and Vercel preview checks are pending.
