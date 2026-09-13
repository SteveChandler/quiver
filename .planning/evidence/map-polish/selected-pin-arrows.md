# Selected pin arrows — 2026-09-06

The default map loaded 50 beaches but requested hourly partitions for only 20 spatial samples. Del Mar (`5e72b79d-a12d-4cd3-8da4-b7b92069efbf`) had a valid current forecast but was absent from the hourly sample. Selection rendered an empty ring because callouts read only the active hourly map. Searching Del Mar reduced the beach list and made its arrows appear, confirming that source data was available.

## Change

- Production: `components/map/interactive-map.tsx` fetches the selected beach's own hourly timeline when it is outside the field sample, using the existing cached bulk endpoint and abort handling. Web and native embed select the partition for the displayed forecast time. The map, field sampling, camera, timeline state, and original arrow design are preserved.
- Unit tests: `__tests__/components/map/interactive-map.test.tsx` exercises selection outside a 20-of-21 sample for both hourly/native and expandable/web modes; verifies one retained callout receives the fetched swell data.
- Browser tests: reviewed `e2e/README.md`, existing map polish and arrow motion specs, error helpers, and existing isolated Playwright config. Extended `e2e/guest-map-polish.spec.ts` with live Del Mar selection outside the default sample, current arrows, future arrows, and a comparison with the API's value at the displayed timestamp, desktop and mobile.

No native production files, API contracts, or production records changed. No commit or deployment.

## Validation

- PASS: `yarn test:unit --runInBand __tests__/components/map/interactive-map.test.tsx` — 53 tests.
- PASS: `./node_modules/.bin/eslint components/map/interactive-map.tsx --max-warnings=0`.
- PASS: `git diff --check`.
- PASS: `yarn test:unit --runInBand __tests__/components/map` — 396 tests, 30 suites.
- PASS: `NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build` — 99.39 seconds, includes TypeScript.
- PASS: `BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts --project=guest --workers=1 --retries=0 -g 'selected Del Mar'` — 2/2, desktop and mobile, read-only production-backed API.
- Screenshots visually reviewed: `del-mar-arrows-1400.png` and `del-mar-arrows-390.png`. Both show Del Mar's original wind and swell arrows for the selected next-day time.
- Local server restarted with `./node_modules/.bin/next start -p 3107`; the new build is running.
- Full targeted browser regression results follow below.

## Limits

Missing source forecasts still cannot produce truthful arrows. Native simulator, physical devices, and signed releases were not rerun for this follow-up; the shared native-hourly code path has a unit regression. Requests use read-only local endpoints backed by the existing production data configuration. A failed or genuinely empty selected timeline retains the existing no-reading behavior.

## Final browser results

- `BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts e2e/guest-map-arrow-motion.spec.ts --project=guest --workers=1 --retries=0`: 12 PASS, 1 FAIL. The mobile Del Mar test timed out waiting for the initial forecast request after the local public API burst limit was exhausted. Server log confirms `public-default` / `forecast-bulk` 429s.
- `BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts --project=guest --workers=1 --retries=0 -g '390px.*selected Del Mar'`: first rerun FAIL on explicit HTTP 429 assertion. After restarting only the local Next server to clear its in-memory test traffic quota, identical command PASS (1/1, 5.5 seconds).
- Final targeted behavior status: PASS on both viewports and both hourly component modes. All 13 browser cases have passed across these runs, but the combined run was not clean. Repeated live browser loads sharing one local IP can exhaust the existing burst limiter; no rate-limit settings were weakened for testing.
- Final diff review and `git diff --check`: PASS. No unresolved finding in the selected-pin fix; rate-limit test-environment limitation and device verification gaps remain as described above.
