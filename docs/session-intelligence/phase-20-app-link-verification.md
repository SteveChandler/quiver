# Phase 20 App-Link Verification

**Captured:** 2026-06-02

## Purpose

Phase 20 routes Session Intelligence surf-window CTAs through an app handoff
path:

- App and universal links: `/app/spot/{slug}?window={windowId}`
- Web canonical fallback: `/beach/{slug}` or the existing canonical beach URL
- Browser fallback page: `/app/spot/[slug]`

The handoff URL exists for installed native apps. It is intentionally
`noindex` on web so it does not create search canonical churn.

## Local Proof

Run these checks after changing app-link code:

```bash
yarn test:unit __tests__/app/well-known-app-links.test.ts __tests__/app/app-spot-handoff-page.test.tsx __tests__/lib/recommendations/surf-window-links.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts --runInBand
npx eslint --max-warnings=0 app/.well-known/apple-app-site-association/route.ts app/.well-known/assetlinks.json/route.ts app/app/spot lib/recommendations/surf-window-links.ts __tests__/app/well-known-app-links.test.ts __tests__/app/app-spot-handoff-page.test.tsx __tests__/lib/recommendations/surf-window-links.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/lib/recommendations/session-intelligence-surface-adapters.test.ts
QUIVER_WEB_REPO="$PWD" npm --prefix ../quiver-native run verify:app-link-parity
yarn typecheck
```

Expected local evidence:

- Apple AASA derives the approved route set from
  `config/app-link-contract.json`, includes `/app/spot/*` and
  `/app/forecast`, and excludes broad `/app*` capture.
- The web and native copies of the contract are semantically identical.
- Apple AASA falls back to the checked-in Quiver team ID when an obvious
  placeholder `APPLE_TEAM_ID` is configured locally.
- Android assetlinks remains environment-driven and filters obvious placeholder
  or malformed fingerprints.
- Slugged surf-window `appDeepLink` and `universalLink` use `/app/spot/`.
- Canonical web URLs stay on canonical beach URLs and do not include
  `window=`.
- `/app/spot/[slug]` renders an App Store fallback and a web forecast fallback.

## Live Read-Only Checks

Run these only as read-only verification against deployed environments:

```bash
curl -i https://www.quiversurf.app/.well-known/apple-app-site-association
curl -i https://www.quiversurf.app/.well-known/assetlinks.json
curl -I "https://www.quiversurf.app/app/spot/la-jolla-shores?window=phase20-smoke"
```

Record:

- HTTP status.
- Content-Type.
- Cache-Control.
- AASA app IDs and paths.
- Android package names and whether any fingerprints are placeholder values.
- Whether `/app/spot/...` returns a web fallback without a canonical URL.

## Native Gate

Local web tests do not prove native handling. Before launch claims, verify on a
signed native build:

- iOS opens `/app/spot/{slug}?window={id}` from Safari into the Quiver app when
  the app is installed.
- iOS falls back to the browser page when the app is not installed.
- Android behavior is verified only after real package names and SHA-256
  fingerprints are configured.

Production deploys, alias promotion, and any migration application remain
approval-gated.
