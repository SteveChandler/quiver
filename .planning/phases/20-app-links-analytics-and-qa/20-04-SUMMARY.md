---
phase: 20-app-links-analytics-and-qa
plan: 20-04
status: completed
completed_at: "2026-06-02T16:58:02.000Z"
requirements:
  - SI-07
---

# 20-04 Summary: Expand Public QA Matrix

## Outcome

Phase 20 public QA coverage is expanded and executable. The QA matrix now maps
the required viewport, sparse-data, app-link fallback, canonical/schema, and
slow-route checks to automated evidence or explicit manual gates. Guest
Playwright coverage exercises the app fallback route and sampled public Session
Intelligence surfaces across 360px, 390px, 412px, tablet, and desktop
viewports.

## Files Changed

- `docs/session-intelligence/phase-20-qa-matrix.md`
- `e2e/guest-session-intelligence-phase20.spec.ts`
- `e2e/utils/error-detection.ts`
- `__tests__/components/session-intelligence/best-surf-windows.test.tsx`
- `__tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts`
- `__tests__/middleware.test.ts`
- `__tests__/actions/ml/forecast-accuracy-actions.test.ts`
- `proxy.ts`
- `actions/ml/forecast-accuracy-actions.ts`

## Notable Fixes Found During QA

- `/app/spot/:slug` was being treated as an international city route by
  `proxy.ts`; `app` is now a reserved segment and covered by a regression test.
- `/forecast-accuracy` fallback data emitted a server `console.error` during
  valid local fallback rendering; the fallback now logs a warning instead.
- Local Next dev HMR/chunk reset noise is ignored by E2E error detection only
  for narrowly scoped dev-server reset patterns, while status and visible-page
  assertions continue to prove rendering.

## Verification

- `yarn test:unit __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts --runInBand` passed.
- `yarn test:unit __tests__/middleware.test.ts __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts --runInBand` passed.
- `yarn test:unit __tests__/actions/ml/forecast-accuracy-actions.test.ts __tests__/components/forecast-accuracy/forecast-accuracy-page-state.test.tsx __tests__/middleware.test.ts __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts --runInBand` passed.
- `npx eslint --max-warnings=0 actions/ml/forecast-accuracy-actions.ts proxy.ts e2e/guest-session-intelligence-phase20.spec.ts __tests__/actions/ml/forecast-accuracy-actions.test.ts __tests__/middleware.test.ts __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts` passed.
- `npx eslint --max-warnings=0 e2e/utils/error-detection.ts e2e/guest-session-intelligence-phase20.spec.ts` passed.
- `npx playwright test --list e2e/guest-session-intelligence-phase20.spec.ts` passed with 20 guest tests registered.
- `npx playwright test e2e/guest-session-intelligence-phase20.spec.ts --project=guest` passed with 20/20 tests passing.
- `rg -n "360|390|412|tablet|desktop|no forecast data|7-day only|14-day|no buoy|no tide|no cam|no user reports|model only|low confidence|app not installed|app-link fallback|canonical|schema|slow route" docs/session-intelligence/phase-20-qa-matrix.md` passed.
- `git diff --check -- docs/session-intelligence/phase-20-qa-matrix.md e2e/guest-session-intelligence-phase20.spec.ts __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts proxy.ts __tests__/middleware.test.ts actions/ml/forecast-accuracy-actions.ts __tests__/actions/ml/forecast-accuracy-actions.test.ts e2e/utils/error-detection.ts` passed.
- `yarn typecheck` passed.
- `VERCEL_ENV=preview yarn build` passed.

## Remaining Manual Gate

Native app-installed universal-link behavior still requires signed-device or
native-simulator verification. That is intentionally left for 20-05 final live
verification.
