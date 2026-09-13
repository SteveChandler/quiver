# Pan refresh and original arrow restoration

September 5, 2026. This supersedes the redesigned-card and timeline-layout portions of README.md. Local web worktree only; no commit/deploy. Existing native source changes from the earlier pass were not modified in this follow-up.

## Fixes

- Restored original SVG arrow banners, center name/temperature, circular backdrop, forecast link, center anchoring and scale. Restored original particle thickness and timeline layout. Bearings remain truthful instead of artificially fanned apart.
- Background nearby-beach requests keep the visible beach list while awaiting results. Explicit searches retain their existing behavior.
- Forecast loading with a supplied beach list is keyed by beach IDs and forecast/auth context, rather than camera position, zoom or selected pin. Moving over the same beach set or selecting an already-loaded pin does not refetch.
- Removed blanket marker removal on population. Existing marker reconciliation now updates/removes only the affected markers.
- Removed pre-request clearing of hourly forecast maps and seeds. A failed background forecast refresh retains loaded partitions instead of replacing them with an empty result.

## Production files changed in this follow-up

- `components/map/interactive-map.tsx`
- `components/map/conditions-callout.ts`
- `hooks/use-beach-search.ts`
- `components/map-view.tsx`
- `components/map/swell-field/swell-particle-layer.ts` — original thickness restored.
- `components/map/swell-field/swell-day-timeline.tsx` — restored completely to the original checkout version; no remaining diff.

## Tests reviewed/changed

Reviewed the existing marker reuse, hourly timeline loading, fractional playback and nearby request sequencing tests. Updated `__tests__/components/map/interactive-map.test.tsx` to assert no refetch on focus/camera changes, no empty callback before a response, and preservation after a failed refresh. Added background-pan preservation coverage in `__tests__/hooks/use-beach-search.test.ts`. Restored original callout tests and added a real-bearing SVG assertion in `__tests__/components/map/conditions-callout.test.ts`. Restored the original timeline tests.

Updated `e2e/guest-map-polish.spec.ts` for the original arrow UI and added an actual drag with canvas/callout DOM identity assertions, followed by forecast playback. Retained Osprey first-click forecast, coast travel, and land/ocean pixel checks. The native embed uses the same renderer and is covered in mobile Chromium.

## Exact verification commands

Working directory: `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish`.

- PASS: `yarn test:unit --runInBand --runTestsByPath __tests__/components/map/interactive-map.test.tsx __tests__/components/map/conditions-callout.test.ts __tests__/hooks/use-beach-search.test.ts` — 107 tests. Initial runs failed on obsolete clear-before-load expectations and an incomplete forecast fixture; both corrected and rerun.
- PASS: `yarn test:unit --runInBand --runTestsByPath __tests__/components/map/conditions-callout.test.ts` — 15 tests including the subsequently added exact-bearing regression. Total distinct tests across the targeted suites: 108.
- PASS: `./node_modules/.bin/eslint components/map/interactive-map.tsx components/map/conditions-callout.ts components/map-view.tsx hooks/use-beach-search.ts components/map/swell-field/swell-particle-layer.ts --max-warnings=0`.
- PASS: `NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build` — compilation, TypeScript and static generation; 132.22 seconds. An earlier build was interrupted to finish restoring the original appearance.
- RUNNING for review: `./node_modules/.bin/next start -p 3107`.
- PASS: `BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts --project=guest --workers=1 --retries=0` — all three passed together in 19.1 seconds, no retries or rate-limit cooldown. Desktop 11.4 s, native embed 1.3 s, mobile 4.8 s.
- PASS: `git diff --check`.

## Evidence and limits

Final E2E status: **3/3 PASS** against the compiled local app using real production forecast GET responses. Automated tests stub non-GET API requests and do not seed or mutate forecast data. Visual inspection confirms the original arrow design in [desktop](selected-1400.png) and [mobile](selected-390.png) screenshots, with Osprey swell readings visible.

No remaining failures in the checks run. Full repository test suites and a native simulator/physical device run were not repeated. Forecasts for a newly reached region still require a background network request; this change preserves the map during that request rather than claiming data is available without fetching it. Exact Windy-provider parity remains outside the verified evidence as documented in README.md.
