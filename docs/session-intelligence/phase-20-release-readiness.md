# Phase 20 Release Readiness

Status: blocked by production app-link mismatch.

Captured: `2026-06-02T17:05:09.000Z`.

## Readiness Summary

Local Phase 20 checks are passing, including unit tests, scoped lint, typecheck,
guest Playwright, and preview build. The release is not production-ready yet
because live `www.quiversurf.app` still serves the pre-Phase-20 app-link
contract.

## Production Evidence

- Domain reachability: `curl -I https://www.quiversurf.app` returned
  `HTTP/2 200`.
- AASA: `curl -i https://www.quiversurf.app/.well-known/apple-app-site-association`
  returned `HTTP/2 200` with `content-type: application/json`, but the body does
  not include `/app/spot/*`.
- Android assetlinks: `curl -i https://www.quiversurf.app/.well-known/assetlinks.json`
  returned `HTTP/2 200` with `content-type: application/json`; placeholder scan
  was absent and a concrete certificate fingerprint is present.
- App-link fallback: `curl -I "https://www.quiversurf.app/app/spot/la-jolla-shores?window=phase20-smoke"`
  returned `HTTP/2 404` with `x-matched-path: /[intent]/[city]/[beachSlug]`.

## Commands

- `yarn typecheck` passed.
- `VERCEL_ENV=preview yarn build` passed.
- `npx playwright test e2e/guest-session-intelligence-phase20.spec.ts --project=guest` passed.
- `npx playwright test e2e/guest-forecast-accuracy.spec.ts --project=guest` passed.
- `npx playwright test --list e2e/guest-session-intelligence-phase20.spec.ts e2e/guest-forecast-accuracy.spec.ts` passed.

Full command evidence is recorded in
`.planning/phases/20-app-links-analytics-and-qa/20-VERIFICATION.md`.

## Approval Gates

- Production deploy or alias promotion requires explicit approval.
- Production migration application requires explicit approval.
- Native app-installed universal-link verification requires device/simulator
  access and remains a manual gate.

## Unresolved

- Production AASA must include `/app/spot/*`.
- Production `/app/spot/la-jolla-shores?window=phase20-smoke` must return the
  noindex App Store/web fallback page instead of `404`.
- Production analytics DB allowlist migration must be applied before relying on
  the new Phase 20 event names.

## After Measurement

Use the exact production deployment timestamp as `D` once deployment is
approved and complete. Exclude deploy day from before/after comparisons. Run
the 3-day, 7-day, and 28-day checks documented in
`docs/session-intelligence/phase-20-before-after-measurement.md`.
