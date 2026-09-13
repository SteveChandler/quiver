# Pin size and selected-circle zoom — September 5, 2026

Fixed locally in the existing web `fix/map-polish` worktree. No commit or deployment.

## Files changed in this follow-up

Production:

- `components/map/interactive-map.tsx`: selection/hover styling now targets the visible dot instead of painting and scaling its 44px button. Selection rings fit inside that button. A Mapbox zoom listener updates one CSS variable on the existing callout; it does not reconstruct the SVG or map.
- `components/map/map-marker-builder.ts`: initial selected/hovered dot scales match subsequent updates (1.4/1.2), and initial selection rings use the same compact inset.
- `components/map/conditions-callout.ts`: existing artwork is grouped in a zoom-scaled inner element. The forecast link retains its own size and follows the scaled artwork. The outer positioning element is pointer-transparent, so its unscaled invisible area does not intercept gestures.

Tests:

- `__tests__/components/map/conditions-callout.test.ts`: updated link-position assertion and added pointer-target assertions.
- `e2e/guest-map-polish.spec.ts`: added desktop and phone regressions for transparent 44px touch targets, selected dots below 26px, 30px selection rings, shrinking callout circles, stable canvas/artwork nodes, unchanged link height, and restored size after zooming back in. Screenshots wait for loaded tiles.

E2E reviewed: existing `guest-map-polish.spec.ts`, `guest-map-arrow-motion.spec.ts`, error-detection helpers, base Playwright configuration, and the local read-only evidence configuration. Existing native-embed and smooth-arrow coverage was rerun. `app/embed/map/embed-map-client.tsx` uses the shared map and its 18px point markers; no native-repository edit was needed.

Earlier task changes remain intact. No arrow shape, palette, labels, scoring, or clustering policy changed.

## Behavior

Ordinary web dots remain 15px; selected web dots are 21px. Embed dots remain 18px, selected at 25.2px. All retain the transparent 44px touch target. The small pin selection ring is 30px.

The conditions circle/artwork is full size at zoom 13 and above, half size at zoom 11, with a 45% minimum at wider views. Existing phone viewport scaling still applies. Zoom updates preserve arrow animation and the forecast link's readable size.

## Exact validation commands

Working directory: `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish`.

```sh
yarn test:unit --runInBand --runTestsByPath __tests__/components/map/conditions-callout.test.ts __tests__/components/map/interactive-map.test.tsx __tests__/components/map/map-condition-summary.test.ts
./node_modules/.bin/eslint components/map/map-marker-builder.ts components/map/conditions-callout.ts components/map/interactive-map.tsx --max-warnings=0
NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build
git diff --check
```

All PASS. Final unit run: 76 tests / 3 suites. Final build: 92.56 seconds, including TypeScript validation. These checks were repeated after the pointer-target review adjustment and remained green.

The local server was restarted after builds with:

```sh
./node_modules/.bin/next start -p 3107
```

PASS; left running with the existing production DB configuration.

Initial browser checks:

```sh
BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts e2e/guest-map-arrow-motion.spec.ts --project=guest --workers=1 --retries=0 --grep 'keeps pins compact|arrow bearings'
BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts --project=guest --workers=1 --retries=0 --grep 'keeps pins compact|native embed'
```

Both PASS, respectively 3/3 in 17.5 seconds and 3/3 in 18.4 seconds. The screenshot check was improved to await map tiles after the initial captures showed tiles still loading.

Final command against the final build:

```sh
BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts e2e/guest-map-arrow-motion.spec.ts --project=guest --workers=1 --retries=0 --grep 'keeps pins compact|native embed|arrow bearings'
```

**PASS: 4/4 in 20.0 seconds, no retries.** Desktop/phone zoom sizing, native-embed selection, and interrupted arrow animation all passed. The checks use production forecast reads and stub non-read application requests. No production data mutations occurred.

## Evidence and remaining limits

Inspected `pin-zoom-1400.png` and `pin-zoom-390.png`: the original selected-arrow layout shrinks around the beach while the forecast link remains readable. Screenshot artifacts are in this directory.

- Full repository tests and a separate `yarn typecheck` were not run; targeted tests and the full TypeScript-checking production build passed.
- No native simulator or physical-device validation; the shared embed was checked in mobile Chromium.
- This does not implement collision avoidance; dense neighboring dots can still overlap.
- The screenshots also show particle concentration around the previously zoomed viewport. That existing swell-field behavior was not changed by this pin/circle fix.
- Previously documented rate-limit, timeline, location-banner, and score-input findings remain separate. The final scoped browser run did not hit the rate limit.
- Refresh `http://localhost:3107/map` to use the final local build. Not deployed.
