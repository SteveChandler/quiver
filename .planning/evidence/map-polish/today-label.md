# Today and the forecast week

Implemented locally in `/Users/stevenchandler/Desktop/dev/quiver/.worktrees/map-polish`.

## Final change

- Keep **Today**, remove the hours-left text and tooltip suffix.
- Give today its full local-day span instead of sizing it only from the remaining hours. The slider starts at the first available forecast hour; earlier hours are not invented or made selectable.
- Preserve the entire available forecast horizon: the verified screenshots show Today through Monday 14, ten days. Phone layouts retain compact date numbers for subsequent days.
- Measure the track when forecast data arrives. Previously the measurement effect ran only while the loading shell was mounted, so responsive label sizing never initialized.
- Reserve space for the Today label and separate it from the next date on narrow screens. Retain the existing palette, controls, and map UI.

## Files changed in this follow-up

Production: `components/map/swell-field/swell-day-timeline.tsx`.

Tests: `__tests__/components/map/swell-day-timeline.test.tsx` and `e2e/guest-map-polish.spec.ts`.

The unit updates verify Today labeling, full-day geometry, the available slider range, local-midnight calculation through a daylight-saving transition, and measurement after asynchronous loading. The browser regression checks readable Today text, no hours-left text, at least seven visible day entries, and no overlap between the first two labels at 1400px and 390px widths.

Reviewed the existing timeline tests, guest map E2E tests and error-detection setup, and the existing local Playwright configuration. No new test infrastructure or dependencies were added; local-midnight conversion uses the already installed `date-fns-tz`.

## Exact commands and results

Run in the web worktree:

```sh
yarn test:unit --runInBand --runTestsByPath __tests__/components/map/swell-day-timeline.test.tsx
./node_modules/.bin/eslint components/map/swell-field/swell-day-timeline.tsx --max-warnings=0
NEXT_PUBLIC_PLAYWRIGHT_TEST=true VERCEL_ENV=preview yarn build
git diff --check
```

Final results: all PASS. Unit suite: 19/19. Final build: 118.42 seconds, including TypeScript validation. An early JSX edit failed compilation and was corrected; subsequent builds passed. Two earlier browser attempts exposed mobile label overlap and the missing post-loading measurement; both were fixed before the final run.

Restarted the preview with:

```sh
./node_modules/.bin/next start -p 3107
```

PASS; left running at `http://localhost:3107/map` with the existing production DB configuration.

```sh
BASE_URL=http://localhost:3107 ./node_modules/.bin/playwright test -c .planning/evidence/map-polish/playwright.config.ts e2e/guest-map-polish.spec.ts --project=guest --workers=1 --retries=0 --grep 'shows Today'
```

Final E2E: **PASS, 2/2 in 5.6 seconds**, no retries. Production forecast reads were used; non-read application requests were stubbed. No database mutation, commit, or deployment occurred.

## Visual evidence and limits

Inspected the final `first-weekday-1400.png` and `first-weekday-390.png` screenshots in this directory. Both show Today and the remaining forecast dates without the hours-left suffix.

No unresolved failure in the scoped checks. Full repository tests, a separate typecheck command, and native simulator checks were not run; this change was validated with targeted timeline tests, a full web build, and desktop/mobile browser checks. Other previously recorded map issues are outside this follow-up.
