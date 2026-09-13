> Latest: [iOS simulator follow-up](ios-follow-up.md) resolves the accessibility targeting defect and a newly discovered native playback-command bug.

> Latest review: [production-readiness audit](production-readiness-review.md), including final regression results and remaining iOS accessibility verification.

> Latest update: [smooth arrow direction transitions](arrow-motion.md), verified with 68 targeted unit tests and 4 browser scenarios.

> Latest correction: [pan refresh and original arrow restoration](pan-follow-up.md). The card redesign and timeline restyling described below were reverted at the user’s request. All three final browser scenarios pass together.

# Map polish — local verification, September 5, 2026

Local changes only. No commits, pushes, deployment, migrations, or forecast-data writes.
Web branch: `fix/map-polish`; native branch: `fix/map-polish` in their respective isolated worktrees. Existing checkout changes were preserved.

## Scope and execution plan

Trace selection, forecast sampling, direction conversion, coastline masking, and camera bounds; fix shared paths; verify unit contracts and live-data browser behavior; inspect screenshots and review the diff. Web owns the shared native WebView renderer. Native fallback receives the same complete provider tuple. No new dependencies.

## Findings and changes

- Pin camera commands cleared the forecast state, and marker refresh removed the selected callout. Selection now survives refresh and playback, with explicit dismissal.
- The timeline sampled only eight of twenty loaded beaches. All twenty can now receive hourly data, prioritizing the selected beach.
- Field directions were averaged across beach partitions; card arrows were rotated for layout. Both now use actual bearings and the same complete swell tuple. The selected beach anchors field direction while its card is open.
- Exact rendered water polygons now clip swell fragments, including island holes. Coarse forecast cells no longer define the visible coastline. Wind remains allowed over land.
- Removed the swell camera bounds/zoom restriction. User panning loads nearby beaches outside the original region.
- Compact cards expose forecast time/timezone, source, incoming bearings, missing readings, explicit close, and current water temperature. Mobile selection hides the location prompt and suggestions. The forecast-range status moves below the timeline on mobile.
- Native fallback fetches and uses Open-Meteo swell height/period/direction together when complete; existing fallback remains for missing provider data.

## Data evidence and limits

Reads used the configured production Supabase project through local application endpoints. The automated browser tests stub non-GET API requests; live forecast GET requests are not mocked. Manual browsing can emit ordinary analytics telemetry.

Osprey Point (`c3b42f85-e650-445f-89b1-1debe661652e`) had a forecast: its stored beach primary direction was 292.5° while Open-Meteo swell was 182°. Ocean Beach Pier's corresponding values were 180° and 181°. This is a provider/component discrepancy, not proof that Osprey lacks data. The displayed offshore tuple is explicitly sourced as Open-Meteo; secondary swell and wind retain Quiver forecast provenance.

Exact Windy parity is **not certified**. Read-only inspection of the user’s open Windy tab showed Waves / ECMWF WAM 9 km, September 5 at 1 PM, 5 ft, 13 s, from S at an offshore San Diego point. The Quiver embed showed Open-Meteo swell 4.7 ft, 11 s, 182° at Osprey for 2 PM. The southerly direction agrees; these are different components, locations, hours and providers, so this is not a like-for-like numerical certification. Open-Meteo aggregate swell is not claimed to be Windy’s primary partition. Windy's API distinguishes model-specific wave/swell components: [official reference](https://api.windy.com/point-forecast/docs).

## Files changed

### Web production
- [app/api/forecasts/bulk/route.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/app/api/forecasts/bulk/route.ts)
- [app/api/forecasts/bulk/swell-partition.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/app/api/forecasts/bulk/swell-partition.ts)
- [components/map-view.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map-view.tsx)
- [components/map/conditions-callout-data.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/conditions-callout-data.ts)
- [components/map/conditions-callout.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/conditions-callout.ts)
- [components/map/interactive-map.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/interactive-map.tsx)
- [components/map/swell-field/field-sampler.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/swell-field/field-sampler.ts)
- [components/map/swell-field/swell-day-timeline.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/swell-field/swell-day-timeline.tsx)
- [components/map/swell-field/swell-particle-layer.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/swell-field/swell-particle-layer.ts)
- [components/map/timeline-beach-sampler.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/timeline-beach-sampler.ts)
- [components/map/swell-field/water-mask.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/components/map/swell-field/water-mask.ts)

### Web tests
- [__tests__/app/api/forecasts/bulk/route.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/app/api/forecasts/bulk/route.test.ts)
- [__tests__/app/api/forecasts/bulk/swell-partitions.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/app/api/forecasts/bulk/swell-partitions.test.ts)
- [__tests__/components/map/conditions-callout.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/conditions-callout.test.ts)
- [__tests__/components/map/interactive-map.test.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/interactive-map.test.tsx)
- [__tests__/components/map/map-beach-loader-partitions.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/map-beach-loader-partitions.test.ts)
- [__tests__/components/map/swell-day-timeline.test.tsx](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/swell-day-timeline.test.tsx)
- [__tests__/components/map/swell-field/swell-particle-layer.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/swell-field/swell-particle-layer.test.ts)
- [__tests__/components/map/swell-field/water-mask.test.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/__tests__/components/map/swell-field/water-mask.test.ts)
- [e2e/guest-map-polish.spec.ts](/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish/e2e/guest-map-polish.spec.ts)

### Native
- [src/__tests__/swell-field-model.test.ts](/Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/map-polish/src/__tests__/swell-field-model.test.ts)
- [src/hooks/use-forecast.ts](/Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/map-polish/src/hooks/use-forecast.ts)
- [src/lib/swell-field/forecast-swell-field.ts](/Users/stevenchandler/Desktop/dev/quiver-native/.worktrees/map-polish/src/lib/swell-field/forecast-swell-field.ts)

### E2E reviewed

`e2e/map.spec.ts` marker and mobile callout navigation; `e2e/map-swell-field.spec.ts` timeline loading and fixtures; `e2e/utils/error-detection.ts`; Playwright configuration and setup/teardown. New live-data test covers desktop/mobile selection, playback, time changes without removing the card, coastal travel, land/ocean pixel differences, and the native embed card. Evidence-specific config avoids auth seeding and cleanup against production.

## Commands and results

Run web commands in the web worktree and native commands in the native worktree.

- PASS: `yarn test:unit --runInBand --runTestsByPath __tests__/components/map/interactive-map.test.tsx __tests__/components/map/swell-field/field-sampler.test.ts __tests__/components/map/conditions-callout-data.test.ts __tests__/components/map/conditions-callout.test.ts __tests__/app/api/forecasts/bulk/swell-partitions.test.ts __tests__/components/map/swell-field/water-mask.test.ts __tests__/components/map/timeline-beach-sampler.test.ts __tests__/components/map/map-beach-loader-partitions.test.ts __tests__/components/map/swell-field/swell-particle-layer.test.ts __tests__/app/api/forecasts/bulk/route.test.ts` — 234 tests, ten suites.
- PASS: `yarn test:unit --runInBand --runTestsByPath __tests__/components/map/interactive-map.test.tsx __tests__/components/map/swell-field/swell-particle-layer.test.ts` — 75 tests rerun after the dynamic water/wind mask correction.
- PASS: `yarn test:unit --runInBand --runTestsByPath __tests__/components/map/swell-day-timeline.test.tsx` — 17 tests. Updated responsive status assertions; no remaining failure in this suite.
- PASS: `./node_modules/.bin/eslint app/api/forecasts/bulk/route.ts app/api/forecasts/bulk/swell-partition.ts components/map-view.tsx components/map/conditions-callout-data.ts components/map/conditions-callout.ts components/map/interactive-map.tsx components/map/swell-field/field-sampler.ts components/map/swell-field/swell-day-timeline.tsx components/map/swell-field/swell-particle-layer.ts components/map/timeline-beach-sampler.ts components/map/swell-field/water-mask.ts --max-warnings=0` (run as main file group plus timeline file).
- PASS: native `npm run typecheck`.
- PASS: native `npm test -- --runInBand src/__tests__/swell-field-model.test.ts src/__tests__/webview-map-bridge.test.ts` — 43 tests.
- PASS: `git diff --check` in both worktrees.
- PASS: initial `VERCEL_ENV=preview yarn build` — optimized build, TypeScript and static generation completed.
- Earlier web `yarn typecheck` attempts failed on development-generated route types and a dev-server cache regeneration race. Final clean result recorded below.
- Earlier Playwright attempts: dev-server reuse configuration rejected; one mobile click blocked by Next's developer indicator; a hot-reload run stalled on the loading shell. Indicator hidden only in the test page; no product overlay bypasses. Fresh dev run passed both desktop/mobile web flows; native embed remained on loading shell. Final compiled-server result recorded below.

## Final verification

- PASS: `NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build` — final compiled app, 124.36 seconds. An intermediate rebuild was intentionally interrupted for the mobile timeline CSS correction.
- PASS: `yarn typecheck --incremental false` — 189.25 seconds, after removing only the stopped dev server’s generated `.next/dev` cache. The production server does not regenerate those development types.
- Server: `./node_modules/.bin/next start -p 3107`, left running for local review against production forecast reads.
- `BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts --project=guest --workers=1 --retries=0` — desktop PASS (31.8 s), native embed PASS (4.4 s), mobile initially FAIL because the combined localhost runs hit the existing API burst limit and the timeline had no data.
- PASS after cooldown: `BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts --project=guest --workers=1 --retries=0 --grep 'map polish 390px.*keeps selection'` — mobile PASS (5.7 s). No rate-limit bypass or fabricated forecast response was used.
- Final scenario status: desktop PASS, mobile web PASS, native shared embed PASS. The single combined run was not entirely green; all three scenarios passed against the final compiled build across the combined run and the isolated mobile rerun.
- Unit coverage: 251 web tests across the targeted suites, 43 native tests. Full repository unit/E2E suites were not run.
- Visual inspection: desktop card, mobile card/timeline and native embed screenshots reviewed. Card text and arrows are readable, and mobile controls are unobscured. Land/water animation checked by desktop pixel comparison.

### Screenshots

- [Desktop selection](selected-1400.png)
- [Mobile selection and timeline](selected-390.png)
- [Native shared embed](native-embed.png)
- [Coastal travel](north-1400.png)

### Remaining risks and boundaries

- No iOS/Android simulator or physical-device run: native fallback unit contracts and the actual shared embed in mobile Chromium were verified. This does not certify device-specific WebGL/performance behavior.
- Exact Windy model parity remains open as described above. Forecast data itself was not rewritten to force agreement.
- Repeated rapid local scenarios can exhaust the existing 20-request burst cap; the mobile rerun passed after cooldown. Limits were preserved, and rate-limited coverage is not represented as successful forecast loading.
- The coastline mask relies on the current Mapbox style’s rendered `water` fill polygons. Missing water tiles fail closed until geometry is available. Large-view/device performance beyond the tested viewports remains unmeasured.
- Worktrees are uncommitted and not deployed; the live website/native release remain unchanged until reviewed integration.
