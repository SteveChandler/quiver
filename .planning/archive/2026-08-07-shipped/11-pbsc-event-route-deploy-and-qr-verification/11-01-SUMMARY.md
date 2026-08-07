---
phase: 11-pbsc-event-route-deploy-and-qr-verification
plan: 11-01
subsystem: ui
tags: [nextjs, pbsc, app-store, android-waitlist, playwright]
requires:
  - phase: 10-go-live-verification
    provides: go-live route verification patterns and approval gates
provides:
  - Server-rendered PBSC OS split for iOS App Store vs non-iOS Android waitlist
  - PBSC-specific CTA tracking metadata
  - Anonymous Android waitlist return-to-/pbsc coverage
  - Guest browser coverage for iPhone, Android, and desktop scan behavior
affects: [pbsc-event-route, android-waitlist, ios-app-store-cta, launch-qa]
tech-stack:
  added: []
  patterns:
    - Next.js request-header user-agent split with force-dynamic route rendering
    - Route-local client CTA composition over existing tracked CTA primitives
key-files:
  created:
    - app/pbsc/pbsc-scan-ctas.tsx
    - __tests__/app/pbsc-page.test.tsx
    - e2e/guest-pbsc.spec.ts
  modified:
    - app/pbsc/page.tsx
    - actions/android-waitlist-actions.ts
    - __tests__/actions/android-waitlist-actions.test.ts
    - __tests__/components/pricing/android-waitlist-cta.test.tsx
key-decisions:
  - "Used server-side user-agent detection for /pbsc to avoid first-paint CTA mismatch."
  - "Reused existing IosAppStoreCta and AndroidWaitlistCta instead of creating duplicate tracking or waitlist primitives."
  - "Kept commits uncreated because repository instructions require an explicit user request before committing."
patterns-established:
  - "PBSC scan CTAs: route server computes isIosVisitor, client component renders tracked iOS or Android CTA with event metadata."
requirements-completed:
  - PBSC-01
  - PBSC-02
  - PBSC-03
  - PBSC-04
duration: 7 min
completed: 2026-05-26
---

# Phase 11 Plan 11-01: PBSC OS-Specific Route Summary

**Server-rendered PBSC QR route now sends iOS visitors to the tracked App Store CTA and every non-iOS visitor to the tracked Android waitlist.**

## Performance

- **Duration:** 7 min
- **Started:** 2026-05-26T02:06:58Z
- **Completed:** 2026-05-26T02:13:38Z
- **Tasks:** 3
- **Files modified:** 7

## Accomplishments

- Converted `/pbsc` to a dynamic request-aware route using `headers()` and `parseUserAgent`.
- Added `PbscScanCtas` to reuse existing tracked App Store and Android waitlist components with PBSC metadata.
- Removed the web fallback from `/pbsc` and tightened metadata copy around iPhone/App Store and Android updates.
- Added Jest coverage for route branching and Android waitlist return-to-`/pbsc`.
- Added guest Playwright coverage for iPhone, Android, and desktop scanner behavior.

## Task Commits

No commits created. Repository instructions say not to commit without an explicit request.

## Files Created/Modified

- `app/pbsc/page.tsx` - Dynamic PBSC route with server user-agent split and no web fallback.
- `app/pbsc/pbsc-scan-ctas.tsx` - Route-local client CTA component for PBSC App Store and Android waitlist actions.
- `actions/android-waitlist-actions.ts` - Revalidates `/pbsc` after waitlist confirmation.
- `__tests__/app/pbsc-page.test.tsx` - Verifies iOS vs non-iOS CTA branch and web fallback removal.
- `__tests__/components/pricing/android-waitlist-cta.test.tsx` - Verifies anonymous PBSC waitlist clicks return to `/pbsc`.
- `__tests__/actions/android-waitlist-actions.test.ts` - Verifies `/pbsc` revalidation.
- `e2e/guest-pbsc.spec.ts` - Verifies guest PBSC behavior for iPhone, Android, and desktop user agents.

## Decisions Made

- Used server-side user-agent detection instead of client-only branching so QR scanners do not see the wrong CTA before hydration.
- Preserved existing CTA tracking and waitlist server-action behavior by composing existing components.
- Updated the Android waitlist action test because adding `/pbsc` revalidation changes the action's observable behavior.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Updated action test for new /pbsc revalidation**
- **Found during:** Task 1 (Wire PBSC OS-specific CTAs)
- **Issue:** The plan changed `actions/android-waitlist-actions.ts` but did not list the existing action test that asserts revalidation behavior.
- **Fix:** Added the `/pbsc` assertion to `__tests__/actions/android-waitlist-actions.test.ts`.
- **Files modified:** `__tests__/actions/android-waitlist-actions.test.ts`
- **Verification:** `yarn test:unit --runInBand __tests__/app/pbsc-page.test.tsx __tests__/components/pricing/android-waitlist-cta.test.tsx __tests__/actions/android-waitlist-actions.test.ts`
- **Committed in:** Not committed by instruction.

---

**Total deviations:** 1 auto-fixed missing-test update.
**Impact on plan:** No scope creep; the added assertion protects the planned behavior.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- PASS `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn test:unit --runInBand __tests__/app/pbsc-page.test.tsx __tests__/components/pricing/android-waitlist-cta.test.tsx __tests__/actions/android-waitlist-actions.test.ts` - 3 suites, 15 tests passed.
- PASS `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && yarn typecheck`
- PASS `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx eslint --max-warnings=0 app/pbsc/page.tsx app/pbsc/pbsc-scan-ctas.tsx actions/android-waitlist-actions.ts __tests__/app/pbsc-page.test.tsx __tests__/components/pricing/android-waitlist-cta.test.tsx __tests__/actions/android-waitlist-actions.test.ts e2e/guest-pbsc.spec.ts`
- PASS `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx playwright test --list e2e/guest-pbsc.spec.ts` - 3 guest PBSC tests listed.
- PASS `source ~/.nvm/nvm.sh && nvm use 22 >/dev/null && npx playwright test e2e/guest-pbsc.spec.ts --project=guest` - 3 tests passed.
- PASS `git diff --check -- app/pbsc/page.tsx app/pbsc/pbsc-scan-ctas.tsx actions/android-waitlist-actions.ts __tests__/app/pbsc-page.test.tsx __tests__/components/pricing/android-waitlist-cta.test.tsx __tests__/actions/android-waitlist-actions.test.ts e2e/guest-pbsc.spec.ts .planning/STATE.md .planning/config.json`

## Self-Check: PASSED

- `/pbsc` contains `export const dynamic = "force-dynamic"`.
- `/pbsc` reads `await headers()` and checks `parseUserAgent(userAgent).os === "iOS"`.
- `/pbsc` no longer contains `WEB_APP_URL`, `/map`, or `Use Quiver on web`.
- `PbscScanCtas` exports PBSC App Store and Android waitlist metadata.
- Android waitlist confirmation revalidates `/pbsc`.
- Guest browser checks prove iOS App Store, Android waitlist, and desktop waitlist behavior.

## Next Phase Readiness

Ready for `11-02`, which records current live route truth and stops at the production release approval checkpoint.

---
*Phase: 11-pbsc-event-route-deploy-and-qr-verification*
*Completed: 2026-05-26*
