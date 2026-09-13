# Smooth swell/wind arrow direction updates

Scope clarified by the user: the swell/wind arrows changing direction, not camera movement. Original arrow shapes, ring, labels and layout are retained.

## Changes

- `components/map/conditions-callout.ts`: native Web Animations API interpolates bearing changes over 500 ms with easing. Uses the shortest rotation across north. Reads the previous arrow's computed transform so interrupted transitions continue from the actual visible angle. Reduced motion skips rotation animation; browsers without the API retain immediate updates.
- `components/map/interactive-map.tsx`: supplies the previous callout element when constructing updated arrows, including selection changes and timeline updates.
- `__tests__/components/map/conditions-callout.test.ts`: added shortest-turn and reduced-motion assertions.
- `e2e/guest-map-arrow-motion.spec.ts`: new live-data browser regression samples the actual SVG transform at the start, middle and end of a transition, then interrupts it and checks angle continuity. The test controls native animation time, avoiding sleep-based assertions.

Reviewed the existing callout tests, interactive-map callout refresh tests, `e2e/guest-map-polish.spec.ts`, shared error detection and the existing local Playwright configuration before changing tests. No new dependency, native source edit, commit, deployment or forecast-data write.

## Commands

Working directory: `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish`.

- PASS: `yarn test:unit --runInBand --runTestsByPath __tests__/components/map/conditions-callout.test.ts __tests__/components/map/interactive-map.test.tsx` — 68 tests, two suites.
- PASS: `./node_modules/.bin/eslint components/map/conditions-callout.ts components/map/interactive-map.tsx --max-warnings=0`.
- PASS: `git diff --check`.
- PASS: `NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build` — compilation, TypeScript and static generation completed in 207.20 seconds.
- RUNNING for local review: `./node_modules/.bin/next start -p 3107`.
- PASS: `BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-arrow-motion.spec.ts e2e/guest-map-polish.spec.ts --project=guest --workers=1 --retries=0` — 4/4 passed in 22.1 seconds. Arrow interpolation and interruption continuity, desktop selection/playback/pan/coastline, mobile web, and native embed.

Final E2E status: **PASS**. No failed commands or unresolved findings in this scoped change. Production forecast GET data was used unchanged; automated non-GET API traffic was stubbed to avoid writes. Reviewed the final [arrow layout screenshot](arrow-motion.png); original visual design remains intact.

## Limits

The other audit findings (location prompt, marker sizing/decluttering, score consistency and timeline region changes) are separate from this explicitly clarified arrow-motion request. Native device/simulator behavior is not certified by Chromium verification. Full repository test suites were not run for this scoped change.
