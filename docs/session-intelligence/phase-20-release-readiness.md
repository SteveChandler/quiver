# Phase 20 Release Readiness

Status: production web verified; simulator native route evidence accepted.

Captured: `2026-06-02T19:00:51.000Z`.

## Readiness Summary

Local Phase 20 checks are passing, including unit tests, scoped lint, typecheck,
guest Playwright, and preview build. The approved production deployment now
serves the Phase 20 app-link route/AASA contract on `www.quiversurf.app`. The
production analytics allowlist migration is applied and tracked. Native now has
a companion patch in `quiver-native` so `/app/spot/:slug` resolves to
`BeachDetail`; the simulator JS route was verified through the app scheme and
accepted for Phase 20 closeout.

## Production Evidence

- Domain reachability: `curl -I https://www.quiversurf.app` returned
  `HTTP/2 200`.
- Deployment: `npx vercel@latest deploy --prod --force` produced the final
  no-env deployment `dpl_KEzsjrsojDepfbruv82mm8hyjwuK` at
  `https://v0-prd-design-concept-l9tp1tb13-stcha0004-9905s-projects.vercel.app`
  and aliased `https://www.quiversurf.app`.
- AASA: `curl -i https://www.quiversurf.app/.well-known/apple-app-site-association`
  returned `HTTP/2 200` with `content-type: application/json`; the body includes
  `/app/spot/*` and placeholder scan is absent.
- Android assetlinks: `curl -i https://www.quiversurf.app/.well-known/assetlinks.json`
  returned `HTTP/2 200` with `content-type: application/json`; placeholder scan
  was absent and a concrete certificate fingerprint is present.
- App-link fallback: `curl -I "https://www.quiversurf.app/app/spot/la-jolla-shores?window=phase20-smoke"`
  returned `HTTP/2 200` with `x-matched-path: /app/spot/[slug]`.
- Analytics migration: `20260602160000_add_session_intelligence_measurement_events.sql`
  is applied in production, and final `supabase db push --dry-run` reports the
  remote database is up to date.
- Native route mitigation: `quiver-native` maps `app/spot/:beachId` as a
  `BeachDetail` alias, adds Android app-link filtering for `/app/spot/`, and
  focused Jest confirms `/app/spot/la-jolla-shores?window=phase20-smoke`
  parses to `BeachDetail`.
- Simulator app validation: Metro loaded the patched native JS bundle and
  `xcrun simctl openurl ... "quiver://app/spot/la-jolla-shores?window=phase20-smoke"`
  opened the native La Jolla Shores `BeachDetail` screen. Screenshot evidence:
  `/tmp/quiver-phase20-custom-scheme-app-spot.png`.
- Deferred signed handoff boundary: the booted simulator build reports
  `ENTITLEMENTS_ALLOWED = NO`, and the installed app's signed entitlements are
  empty despite `ios/Quiver/Quiver.entitlements` containing
  `applinks:www.quiversurf.app`. The production HTTPS link therefore falls back
  to Safari on this simulator and cannot prove Associated Domains handoff.
  Signed physical/TestFlight handoff is deferred to the next native release
  validation lane.

## Commands

- `yarn typecheck` passed.
- `VERCEL_ENV=preview yarn build` passed.
- `npx playwright test e2e/guest-session-intelligence-phase20.spec.ts --project=guest` passed.
- `npx playwright test e2e/guest-forecast-accuracy.spec.ts --project=guest` passed.
- `npx playwright test --list e2e/guest-session-intelligence-phase20.spec.ts e2e/guest-forecast-accuracy.spec.ts` passed.

Full command evidence is recorded in
`.planning/archive/2026-08-07-shipped/20-app-links-analytics-and-qa/20-VERIFICATION.md`.

## Approval Gates

- Production deploy or alias promotion requires explicit approval.
- Future production migration application requires explicit approval.
- Native app-installed HTTPS handoff requires a signed device or TestFlight
  build when that deferred validation lane is reopened.

## Unresolved

- No blocking unresolved findings for Phase 20 closeout. Full iOS HTTPS
  universal-link handoff is deferred to signed physical/TestFlight validation
  before the next native release.

## After Measurement

Use `2026-06-02T18:55:38Z` as deployment time `D`. Exclude deploy day from
before/after comparisons. Run the 3-day, 7-day, and 28-day checks documented in
`docs/session-intelligence/phase-20-before-after-measurement.md`.
