> Latest: [iOS simulator follow-up](ios-follow-up.md) resolves the accessibility targeting defect and a newly discovered native playback-command bug.

# Map review — September 5, 2026

Local production build, production forecast reads. No commits, deployment, migrations, or production database writes. This report supersedes earlier verification counts in this evidence directory.

## Result

Repeated review and fixes preserved the original SVG arrows and Quiver layout. Verified selection, smooth interrupted arrow rotation, pan without canvas remount, regional forecast colors, zoom scaling/decluttering, full first-day timeline, primary swell consistency, water-only swell rendering, and recovery from rate limiting.

New audit fixes: reuse successful forecast responses for 60 seconds; honor Retry-After with one abortable retry; avoid duplicate forecast horizon requests; retain playback across regions; remove copied neighboring-beach heights; distinguish missing data from low surf scores; label historical water samples with dates in callouts, hover text and accessibility; hide redundant location prompts after search/selection; keep flipped arrow labels readable; preserve particle distribution on zoom, including reduced motion; expose beach buttons to iOS accessibility instead of Mapbox's generic image role.

Pin colors describe today's surf rating, as the legend now states. They do not represent an hourly re-scored forecast. A gray rating is not necessarily missing data; missing data now uses a dashed pale marker.

## Review and test scope

Reviewed existing map E2E specs, helpers, error detection, Playwright configuration and setup. The dedicated evidence configuration avoids production seeding and blocks non-GET/HEAD API requests in browser tests. Reviewed native `.maestro/flows/discovery/explore-s1-only.yaml` and the native WebView URL/bridge. Native installed-app login flow was not run.

Browser specs added/updated: `e2e/guest-map-polish.spec.ts`, `e2e/guest-map-arrow-motion.spec.ts`. Unit changes cover selection reuse, regional batching, forecast retry/cache/auth/abort, missing data, source tuples, historical warnings, timeline continuity, water masking, particle viewport changes, and accessible marker wrappers. Existing assertions expecting the removed San Diego bounds or callout remount were corrected.

## Commands and results

| Command | Result |
|---|---|
| `yarn typecheck` | PASS; final build also validates types |
| `yarn test:unit --runInBand __tests__/components/map __tests__/hooks/use-expandable-swell-timeline.test.ts __tests__/lib/nearby-beach-service.test.ts __tests__/lib/recommendations/major-event-hold/water-quality.test.ts` | PASS: 423 tests, 32 suites |
| `yarn test:unit --runInBand __tests__/app/api/forecasts/bulk __tests__/lib/recommendations` | PASS: 568 tests, 28 suites; overlaps the map command |
| `yarn test:unit --runInBand __tests__/components/map/map-condition-summary.test.ts` | PASS: 8 tests |
| `./node_modules/.bin/eslint components/map/map-beach-loader.ts components/map/map-content.tsx components/map/map-marker-builder.ts components/map/conditions-callout.ts components/map/interactive-map.tsx components/map/map-beach-preview-popup.ts components/map/swell-field/swell-particle-layer.ts components/map/swell-field/swell-day-timeline.tsx hooks/use-expandable-swell-timeline.ts lib/recommendations/major-event-hold/water-quality.ts lib/services/nearby-beach-service.ts --max-warnings=0` | PASS |
| `./node_modules/.bin/eslint components/map/map-marker-builder.ts components/map/interactive-map.tsx --max-warnings=0` | PASS after accessibility correction |
| `git diff --check` | PASS |

Final build/browser/iOS results appended below. Earlier failures exposed missing search warning provenance, obsolete mocks, and iOS marker semantics; these were corrected. Builds 2 and 5 were intentionally interrupted to include follow-up fixes. Read-only file searches with missing paths failed without changing files.

## Remaining certification limits

- Exact Windy numerical parity is not certified. The inspected Windy layer was ECMWF WAM Waves; Quiver uses an Open-Meteo swell tuple. Different components/providers must not be presented as identical. See the original evidence report for the comparison.
- The field is regional beach-forecast interpolation, not a global offshore model grid. Large offshore coverage and physical-device frame-rate/thermal behavior remain unmeasured.
- Safari/WebKit embed QA is distinct from a release-build native host/bridge test. No physical iOS or Android release validation was performed.
- Water-quality sample dates are now explicit; historical holds were not automatically removed. The upstream hold policy and county sampling cadence remain unchanged.
- Full repository unit/E2E suites and CI were not run. Passing targeted tests does not certify all production behavior.

## Visual evidence

Reviewed desktop/mobile selection, first-day timeline, zoomed pins, regional colors, coastal clipping, rotated Baja arrows and historical advisory screenshots at original detail: `selected-1400.png`, `selected-390.png`, `first-weekday-1400.png`, `first-weekday-390.png`, `pin-zoom-1400.png`, `pin-zoom-390.png`, `region-colors.png`, `baja-recovery.png`, `advisory-source.png`, `native-embed.png`, `arrow-motion.png`.

## Changed files

The following includes accumulated earlier fixes in this worktree, not only this final review. Evidence assets/configuration live under `.planning/evidence/map-polish/`.

### Web production

- [app/api/forecasts/bulk/route.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/app/api/forecasts/bulk/route.ts)
- [app/api/forecasts/bulk/swell-partition.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/app/api/forecasts/bulk/swell-partition.ts)
- [components/map-view.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map-view.tsx)
- [components/map/conditions-callout-data.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/conditions-callout-data.ts)
- [components/map/conditions-callout.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/conditions-callout.ts)
- [components/map/interactive-map.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/interactive-map.tsx)
- [components/map/map-beach-loader.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/map-beach-loader.ts)
- [components/map/map-beach-preview-popup.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/map-beach-preview-popup.ts)
- [components/map/map-content.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/map-content.tsx)
- [components/map/map-marker-builder.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/map-marker-builder.ts)
- [components/map/swell-field/field-sampler.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/swell-field/field-sampler.ts)
- [components/map/swell-field/swell-day-timeline.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/swell-field/swell-day-timeline.tsx)
- [components/map/swell-field/swell-particle-layer.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/swell-field/swell-particle-layer.ts)
- [components/map/timeline-beach-sampler.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/timeline-beach-sampler.ts)
- [hooks/use-beach-search.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/hooks/use-beach-search.ts)
- [hooks/use-expandable-swell-timeline.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/hooks/use-expandable-swell-timeline.ts)
- [lib/recommendations/major-event-hold/water-quality.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/lib/recommendations/major-event-hold/water-quality.ts)
- [lib/services/nearby-beach-service.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/lib/services/nearby-beach-service.ts)
- [components/map/swell-field/water-mask.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/swell-field/water-mask.ts)

### Tests

- [__tests__/app/api/forecasts/bulk/route.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/app/api/forecasts/bulk/route.test.ts)
- [__tests__/app/api/forecasts/bulk/swell-partitions.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/app/api/forecasts/bulk/swell-partitions.test.ts)
- [__tests__/components/map-view.test.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map-view.test.tsx)
- [__tests__/components/map/conditions-callout.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/conditions-callout.test.ts)
- [__tests__/components/map/interactive-map.test.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/interactive-map.test.tsx)
- [__tests__/components/map/map-beach-loader-partitions.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/map-beach-loader-partitions.test.ts)
- [__tests__/components/map/map-condition-summary.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/map-condition-summary.test.ts)
- [__tests__/components/map/map-forecast-basic.test.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/map-forecast-basic.test.tsx)
- [__tests__/components/map/swell-day-timeline.test.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/swell-day-timeline.test.tsx)
- [__tests__/components/map/swell-field/swell-particle-layer.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/swell-field/swell-particle-layer.test.ts)
- [__tests__/hooks/use-beach-search.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/hooks/use-beach-search.test.ts)
- [__tests__/hooks/use-expandable-swell-timeline.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/hooks/use-expandable-swell-timeline.test.ts)
- [__tests__/lib/recommendations/major-event-hold/water-quality.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/lib/recommendations/major-event-hold/water-quality.test.ts)
- [__tests__/components/map/map-forecast-recovery.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/map-forecast-recovery.test.ts)
- [__tests__/components/map/swell-field/water-mask.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/swell-field/water-mask.test.ts)
- [e2e/guest-map-arrow-motion.spec.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/e2e/guest-map-arrow-motion.spec.ts)
- [e2e/guest-map-polish.spec.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/e2e/guest-map-polish.spec.ts)

### Native changes retained from earlier work

- `src/hooks/use-forecast.ts`
- `src/lib/swell-field/forecast-swell-field.ts`
- `src/__tests__/swell-field-model.test.ts`

Earlier native checks: `npm run typecheck` PASS; `npm test -- --runInBand src/__tests__/swell-field-model.test.ts src/__tests__/webview-map-bridge.test.ts` PASS (43 tests). No native code changed in this final review.

## Final iOS check and unresolved finding

`maestro --device 4123DB86-1864-455A-B01E-98F384EDDFA7 test .planning/evidence/map-polish/ios-webkit.yaml --debug-output /tmp/map-audit-maestro8` — PASS for visible-pin touch selection on iOS 26.5 Safari/WebKit. Osprey's sourced callout and Full forecast control appeared; screenshot `ios-webkit-selected.png` was visually reviewed.

The earlier label-based variant FAILED the strict selected-beach assertion: Maestro reported Osprey's accessibility rectangle as `[201,283][433,535]`, extending well beyond its visible 44px button, and tapped Luscombs. The coordinate-based tap at the visible Osprey pin passed. Marker semantics are corrected, but the remaining Safari/XCTest accessibility-bounds discrepancy is unresolved; the coordinate flow is not a substitute for VoiceOver certification. The initial looser test falsely passed by matching Osprey's unselected pin; it was tightened before this conclusion.

Production readiness remains **not certified** because this accessibility targeting discrepancy and release-host/device verification remain open. No further speculative CSS/DOM workaround was applied without isolating the bounds issue.

## Final build

`NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build` — PASS, 83.92 seconds (`/tmp/map-audit-build6.log`). The resulting build is served by `./node_modules/.bin/next start -p 3107` and left running.

An intermediate combined browser/iOS run was 9/11: a marker style read raced a replacement (fixed with a polling assertion), and concurrent local clients exhausted the API burst limit. The final browser rerun is sequential with iOS.

## Final browser E2E status: PASS

`BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts e2e/guest-map-arrow-motion.spec.ts --project=guest --workers=1 --retries=0` — **11/11 PASS**, 1.5 minutes, against the final build (`/tmp/map-audit-e2e7.log`). No automatic retries. Desktop, mobile Chromium and shared embed scenarios passed together. The final diff whitespace check passed. No confirmed web regression remains in the exercised scenarios; the iOS accessibility-bounds discrepancy and certification limits above remain explicit.
