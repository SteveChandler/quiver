---
phase: 20-app-links-analytics-and-qa
status: blocked
verified_at: "2026-06-02T17:05:09.000Z"
requirements:
  - SI-07
---

# Phase 20 Verification

## Status

Phase 20 local verification is passing, but production release readiness is
blocked. Live `www.quiversurf.app` does not yet include the Phase 20 app-link
route changes:

- Production AASA is `200` but does not include `/app/spot/*`.
- Production `/app/spot/la-jolla-shores?window=phase20-smoke` returns `404`.
- The local branch contains and verifies the fix; deployment remains
  approval-gated.

## Local Commands

- `yarn test:unit __tests__/app/well-known-app-links.test.ts __tests__/lib/recommendations/surf-window-links.test.ts --runInBand` passed: 2 suites, 11 tests.
- `yarn test:unit __tests__/api/events-taxonomy-characterization.test.ts __tests__/api/events-allowlist-db-sync.test.ts --runInBand` passed: 2 suites, 7 tests.
- `yarn test:unit __tests__/components/session-intelligence/app-deep-link-cta.test.tsx __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/components/session-intelligence/why-this-call.test.tsx --runInBand` passed: 3 suites, 17 tests.
- `yarn test:unit __tests__/components/forecast-accuracy/forecast-accuracy-page-state.test.tsx --runInBand` passed: 1 suite, 7 tests.
- `npx eslint --max-warnings=0 app/.well-known/apple-app-site-association/route.ts app/.well-known/assetlinks.json/route.ts app/app/spot app/forecast-accuracy/page.tsx components/session-intelligence components/forecast-accuracy lib/recommendations/surf-window-links.ts lib/analytics/event-taxonomy.ts types/implicit-preferences.ts e2e/guest-session-intelligence-phase20.spec.ts` failed with two ignored-file warnings for `.well-known` routes. Classified as command setup issue.
- `npx eslint --max-warnings=0 --no-warn-ignored app/.well-known/apple-app-site-association/route.ts app/.well-known/assetlinks.json/route.ts app/app/spot app/forecast-accuracy/page.tsx components/session-intelligence components/forecast-accuracy lib/recommendations/surf-window-links.ts lib/analytics/event-taxonomy.ts types/implicit-preferences.ts e2e/guest-session-intelligence-phase20.spec.ts` passed.
- `yarn typecheck` passed.
- `npx playwright test --list e2e/guest-session-intelligence-phase20.spec.ts e2e/guest-forecast-accuracy.spec.ts` passed: 22 tests registered across 2 files.
- `npx playwright test e2e/guest-session-intelligence-phase20.spec.ts --project=guest` passed: 20/20 tests.
- `npx playwright test e2e/guest-forecast-accuracy.spec.ts --project=guest` passed: 2/2 tests.
- `VERCEL_ENV=preview yarn build` passed.

## Static Guards

- `rg -n "surf_window_impression|surf_window_click|why_this_call_opened|app_deeplink_clicked|forecast_accuracy_table_viewed|save_alert_clicked|seo_intent_page_window_clicked" lib/analytics/event-taxonomy.ts types/implicit-preferences.ts supabase/migrations __tests__` passed.
- `rg -n "/app/spot|/app/\\*|apple-app-site-association|assetlinks|IOS_APP_STORE_URL" app/.well-known lib/recommendations __tests__ docs/session-intelligence` passed.
- `rg -n "GSC|PostHog|Vercel|before|after|CTR|average position|impressions|multi-page|bounce|deep-link conversion" docs/session-intelligence/phase-20-before-after-measurement.md` passed.
- `rg -n "360|390|412|tablet|desktop|no forecast data|7-day only|14-day|no buoy|no tide|no cam|no user reports|model only|low confidence|app not installed|canonical|schema|slow route" docs/session-intelligence/phase-20-qa-matrix.md` passed.

## Live Read-Only Checks

- `curl -I https://www.quiversurf.app` returned `HTTP/2 200`, `content-type: text/html; charset=utf-8`, `cache-control: public, max-age=0, must-revalidate`, `x-matched-path: /`.
- `curl -i https://www.quiversurf.app/.well-known/apple-app-site-association` returned `HTTP/2 200`, `content-type: application/json`, `cache-control: public, max-age=3600, stale-while-revalidate=86400`, `x-matched-path: /.well-known/apple-app-site-association`. Placeholder scan: absent. Required `/app/spot/*`: absent.
- `curl -i https://www.quiversurf.app/.well-known/assetlinks.json` returned `HTTP/2 200`, `content-type: application/json`, `cache-control: public, max-age=3600`, `x-matched-path: /.well-known/assetlinks.json`. Placeholder scan: absent. Live fingerprint present: `02:EC:D8:87:98:E9:F2:EC:47:EE:EF:90:88:5B:AA:D4:A9:DD:9E:6B:C5:C0:D5:42:07:84:66:46:BE:D4:18:E2`.
- `curl -I "https://www.quiversurf.app/app/spot/la-jolla-shores?window=phase20-smoke"` returned `HTTP/2 404`, `content-type: text/html; charset=utf-8`, `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`, `x-matched-path: /[intent]/[city]/[beachSlug]`.
- `node -e '...'` live placeholder scan passed for AASA and assetlinks, while confirming AASA does not contain `/app/spot/*`.

## Unresolved Findings

- Blocker: production is not carrying the Phase 20 app-link route and AASA changes. Expected result after deploy is AASA containing `/app/spot/*` and `/app/spot/la-jolla-shores?window=phase20-smoke` returning the browser fallback page instead of `404`.
- Blocker until approved: the additive production migration `supabase/migrations/20260602160000_add_session_intelligence_measurement_events.sql` has not been applied to production.
- Manual gate: native app-installed universal-link behavior still requires signed-device or simulator validation.

## Remaining Risks

- No production deployment, alias promotion, migration, or native test was run.
- After-measurement windows cannot start until the production deploy timestamp is known.
- GSC lift claims remain blocked until the 3-day, 7-day, and 28-day after windows complete and GSC lag clears.
- PostHog `app_deeplink_clicked` and new Session Intelligence events are expected to remain zero on production until the code and DB allowlist are live.
