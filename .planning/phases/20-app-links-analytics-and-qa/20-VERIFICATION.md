---
phase: 20-app-links-analytics-and-qa
status: verified_with_simulator_native_evidence
verified_at: "2026-06-02T19:00:51.000Z"
requirements:
  - SI-07
---

# Phase 20 Verification

## Status

Phase 20 local verification passed, the production analytics allowlist
migration is applied and tracked, and the approved production deploy now serves
the Phase 20 app-link route/AASA contract on `www.quiversurf.app`. The native
route gap for `/app/spot/:slug` is mitigated in `quiver-native`; simulator
native route evidence is accepted for Phase 20 closeout.

- Production AASA is `200` and includes `/app/spot/*`.
- Production `/app/spot/la-jolla-shores?window=phase20-smoke` returns `200`.
- Production analytics allowlist migration is applied and tracked.
- Native `/app/spot/:slug` routing was patched and simulator-verified through
  the app scheme.
- Signed iOS HTTPS handoff is deferred to the next native release validation
  lane because simulator builds do not carry Associated Domains entitlements.

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
- Clean production deploy worktree at `f98f3e79`: `yarn typecheck` passed under Node 22.22.0.
- Clean production deploy worktree at `f98f3e79`: `VERCEL_ENV=preview yarn build` passed under Node 22.22.0.

## Static Guards

- `rg -n "surf_window_impression|surf_window_click|why_this_call_opened|app_deeplink_clicked|forecast_accuracy_table_viewed|save_alert_clicked|seo_intent_page_window_clicked" lib/analytics/event-taxonomy.ts types/implicit-preferences.ts supabase/migrations __tests__` passed.
- `rg -n "/app/spot|/app/\\*|apple-app-site-association|assetlinks|IOS_APP_STORE_URL" app/.well-known lib/recommendations __tests__ docs/session-intelligence` passed.
- `rg -n "GSC|PostHog|Vercel|before|after|CTR|average position|impressions|multi-page|bounce|deep-link conversion" docs/session-intelligence/phase-20-before-after-measurement.md` passed.
- `rg -n "360|390|412|tablet|desktop|no forecast data|7-day only|14-day|no buoy|no tide|no cam|no user reports|model only|low confidence|app not installed|canonical|schema|slow route" docs/session-intelligence/phase-20-qa-matrix.md` passed.

## Native Route Mitigation

- `quiver-native` patch adds `BeachDetail` alias `app/spot/:beachId` in
  `src/navigation/types.ts`.
- `quiver-native` patch adds Android app-link path prefix `/app/spot/` in
  `app.config.js`.
- `npm test -- src/__tests__/linking-config.test.ts --runInBand` passed:
  1 suite, 8 tests. The new assertion proves
  `/app/spot/la-jolla-shores?window=phase20-smoke` parses to `BeachDetail`
  with `beachId: "la-jolla-shores"`.
- `npm run typecheck` passed in `quiver-native`.
- `git diff --check -- app.config.js docs/DEEP_LINKING.md docs/ARCHITECTURE.md src/navigation/ARCHITECTURE.md src/navigation/types.ts src/__tests__/linking-config.test.ts`
  passed in `quiver-native`.
- `npx eslint --max-warnings=0 app.config.js src/navigation/types.ts src/__tests__/linking-config.test.ts`
  failed before linting files because `quiver-native` does not install ESLint or
  include an ESLint flat config.
- Simulator evidence: `xcrun simctl openurl 0AAFB827-6BF0-4F8C-87F0-0CF2DE87706E "quiver://app/spot/la-jolla-shores?window=phase20-smoke"`
  opened native `BeachDetail` for La Jolla Shores after Metro loaded the
  patched JS bundle. Screenshot: `/tmp/quiver-phase20-custom-scheme-app-spot.png`.
- Deferred simulator limitation: `xcodebuild ... -showBuildSettings` reports
  `ENTITLEMENTS_ALLOWED = NO` for the simulator destination; `codesign -d
  --entitlements :-` on the installed simulator app returned an empty
  entitlements plist. A production HTTPS open therefore fell back to Safari on
  this simulator and cannot prove Associated Domains handoff. This is accepted
  for Phase 20 and deferred to signed physical/TestFlight validation.

## Live Read-Only Checks

- `curl -I https://www.quiversurf.app` returned `HTTP/2 200`, `content-type: text/html; charset=utf-8`, `cache-control: public, max-age=0, must-revalidate`, `x-matched-path: /`.
- `curl -i https://www.quiversurf.app/.well-known/apple-app-site-association` returned `HTTP/2 200`, `content-type: application/json`, `cache-control: public, max-age=3600, stale-while-revalidate=86400`, `x-matched-path: /.well-known/apple-app-site-association`. Placeholder scan: absent. Required `/app/spot/*`: absent.
- `curl -i https://www.quiversurf.app/.well-known/assetlinks.json` returned `HTTP/2 200`, `content-type: application/json`, `cache-control: public, max-age=3600`, `x-matched-path: /.well-known/assetlinks.json`. Placeholder scan: absent. Live fingerprint present: `02:EC:D8:87:98:E9:F2:EC:47:EE:EF:90:88:5B:AA:D4:A9:DD:9E:6B:C5:C0:D5:42:07:84:66:46:BE:D4:18:E2`.
- `curl -I "https://www.quiversurf.app/app/spot/la-jolla-shores?window=phase20-smoke"` returned `HTTP/2 404`, `content-type: text/html; charset=utf-8`, `cache-control: private, no-cache, no-store, max-age=0, must-revalidate`, `x-matched-path: /[intent]/[city]/[beachSlug]`.
- `node -e '...'` live placeholder scan passed for AASA and assetlinks, while confirming AASA does not contain `/app/spot/*`.

Pre-deploy rerun at `2026-06-02T18:36:59.000Z` confirmed the production
app-link blocker: AASA omitted `/app/spot/*`, assetlinks had the concrete
Android fingerprint, and `/app/spot/la-jolla-shores?window=phase20-smoke`
returned `404` matched to `/[intent]/[city]/[beachSlug]`.

## Production Deploy Checks

- Approved plan hash: `0d58a16e7743ce1aad5e5232a31537fe6225ed702c9675b3f5c2be86f0bac3de`.
- Clean deploy source: detached worktree at commit `f98f3e79`.
- `vercel deploy --prod --force` with global Vercel CLI 41.4.1 failed before deploy because the Vercel API now requires CLI 47.2.2 or later.
- `npx vercel@latest --version` returned Vercel CLI 54.7.1.
- First `npx vercel@latest deploy --prod --force` succeeded as `dpl_48sxsRLo965pXVjonALYTi8cPN8a`, but its build log detected a copied local `.env` file in the temporary deploy worktree.
- A second no-env clean worktree deploy superseded it; the clean worktree had only `.env.example` and `.env.playwright.example`, not local `.env*` files.
- Final deployment ID: `dpl_KEzsjrsojDepfbruv82mm8hyjwuK`.
- Final deployment URL: `https://v0-prd-design-concept-l9tp1tb13-stcha0004-9905s-projects.vercel.app`.
- Production alias: `https://www.quiversurf.app`.
- `npx vercel@latest inspect www.quiversurf.app` returned `status ● Ready`, `target production`, created `Tue Jun 02 2026 11:55:38 GMT-0700`.
- `npx vercel@latest inspect v0-prd-design-concept-l9tp1tb13-stcha0004-9905s-projects.vercel.app --logs | rg "Detected \\.env|Environments:"` returned no matches.
- `npx vercel@latest ls v0-prd-design-concept` listed the final deployment as `● Ready`, `Production`.
- `curl -i https://www.quiversurf.app/.well-known/apple-app-site-association` returned `HTTP/2 200`, `content-type: application/json`, `x-matched-path: /.well-known/apple-app-site-association`, `x-vercel-cache: PRERENDER`, and body includes `/app/spot/*`.
- `curl -i https://www.quiversurf.app/.well-known/assetlinks.json` returned `HTTP/2 200`, `content-type: application/json`, `x-matched-path: /.well-known/assetlinks.json`, `x-vercel-cache: PRERENDER`, and the concrete Android fingerprint.
- `curl -I "https://www.quiversurf.app/app/spot/la-jolla-shores?window=phase20-smoke"` returned `HTTP/2 200`, `x-matched-path: /app/spot/[slug]`.
- Node 22 live scan returned `AASA_HAS_APP_SPOT true`, `AASA_PLACEHOLDER false`, `ASSETLINKS_HAS_FINGERPRINT true`, `ASSETLINKS_PLACEHOLDER false`, and spot route `200`.

## Production Migration Checks

- `supabase db push --db-url "$POSTGRES_URL_NON_POOLING" --yes` applied `20260602160000_add_session_intelligence_measurement_events.sql`.
- `SELECT version, name FROM supabase_migrations.schema_migrations WHERE version = '20260602160000'` returned `20260602160000 add_session_intelligence_measurement_events`.
- `supabase db push --dry-run --db-url "$POSTGRES_URL_NON_POOLING"` returned `Remote database is up to date.`

## Unresolved Findings

- None blocking Phase 20 closeout.

## Remaining Risks

- Native routing is covered by focused Jest, typecheck, and simulator app-scheme
  evidence. A physical/TestFlight build is still required to prove iOS
  Associated Domains handoff for `https://www.quiversurf.app/app/spot/...`
  before the next native release.
- After-measurement windows should use `2026-06-02T18:55:38Z` as deployment time `D`; exclude deploy day from before/after comparisons.
- GSC lift claims remain blocked until the 3-day, 7-day, and 28-day after windows complete and GSC lag clears.
- PostHog `app_deeplink_clicked` and new Session Intelligence events can now be measured in production, but early counts may remain zero until real traffic exercises the surfaces.
