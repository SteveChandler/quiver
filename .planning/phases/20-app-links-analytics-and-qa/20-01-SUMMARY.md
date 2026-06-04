---
phase: 20-app-links-analytics-and-qa
plan: 20-01
status: completed
completed_at: 2026-06-02T15:49:44.000Z
---

# 20-01 Summary: Align App-Link Route, Manifests, And Fallback

## Completed

- Added `/app/spot/*` to the required Apple AASA app-link paths.
- Added Apple team ID placeholder fallback so obvious placeholder values do not
  become live app-link evidence.
- Added Android SHA-256 fingerprint filtering for malformed or obvious
  placeholder values while keeping package and fingerprint config env-driven.
- Moved slugged Session Intelligence app and universal links to
  `/app/spot/{slug}?window={windowId}`.
- Preserved canonical web URLs on canonical beach paths without `window=`.
- Added a lightweight noindex browser fallback at `/app/spot/[slug]` with App
  Store and `/beach/{slug}` web fallback links.
- Added Phase 20 app-link verification documentation with local, live, and
  native verification gates.

## Tests

```bash
yarn test:unit __tests__/app/well-known-app-links.test.ts __tests__/app/app-spot-handoff-page.test.tsx __tests__/lib/recommendations/surf-window-links.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts --runInBand
npx eslint --max-warnings=0 --no-warn-ignored app/.well-known/apple-app-site-association/route.ts app/.well-known/assetlinks.json/route.ts app/app/spot lib/recommendations/surf-window-links.ts __tests__/app/well-known-app-links.test.ts __tests__/app/app-spot-handoff-page.test.tsx __tests__/lib/recommendations/surf-window-links.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts
npx eslint --max-warnings=0 --no-ignore app/.well-known/apple-app-site-association/route.ts app/.well-known/assetlinks.json/route.ts
yarn typecheck
rg -n "/app/spot|/app/\\*|apple-app-site-association|assetlinks|IOS_APP_STORE_URL|ANDROID_SHA256_FINGERPRINTS|APPLE_TEAM_ID|YOUR_TEAM_ID|YOUR_SHA256_FINGERPRINT" app/.well-known lib/recommendations __tests__/app __tests__/lib/recommendations docs/session-intelligence/phase-20-app-link-verification.md
git diff --check -- app/.well-known/apple-app-site-association/route.ts app/.well-known/assetlinks.json/route.ts app/app/spot lib/recommendations/surf-window-links.ts __tests__/app/well-known-app-links.test.ts __tests__/app/app-spot-handoff-page.test.tsx __tests__/lib/recommendations/surf-window-links.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts docs/session-intelligence/phase-20-app-link-verification.md
```

All commands passed.

## Not Done

- Native universal-link handling was not verified on a signed app build.
- Live production manifest checks were not run in this slice.
- Guest Playwright E2E was not run for this slice; 20-04 and 20-05 cover the
  broader public QA matrix and live closeout.
