# Phase 20 Validation Strategy

## Required Local Checks

```bash
yarn test:unit __tests__/app/well-known-app-links.test.ts __tests__/lib/recommendations/surf-window-links.test.ts --runInBand
yarn test:unit __tests__/api/events-taxonomy-characterization.test.ts __tests__/api/events-allowlist-db-sync.test.ts --runInBand
yarn test:unit __tests__/components/session-intelligence/app-deep-link-cta.test.tsx __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/components/session-intelligence/why-this-call.test.tsx --runInBand
yarn test:unit __tests__/components/forecast-accuracy/forecast-accuracy-page-state.test.tsx --runInBand
npx eslint --max-warnings=0 app/.well-known/apple-app-site-association/route.ts app/.well-known/assetlinks.json/route.ts app/app/spot app/forecast-accuracy/page.tsx components/session-intelligence components/forecast-accuracy lib/recommendations/surf-window-links.ts lib/analytics/event-taxonomy.ts types/implicit-preferences.ts e2e/guest-session-intelligence-phase20.spec.ts
yarn typecheck
npx playwright test --list e2e/guest-session-intelligence-phase20.spec.ts e2e/guest-forecast-accuracy.spec.ts
npx playwright test e2e/guest-session-intelligence-phase20.spec.ts --project=guest
npx playwright test e2e/guest-forecast-accuracy.spec.ts --project=guest
```

Adjust filenames if execution chooses a narrower split, but keep equivalent
coverage for app links, analytics, QA matrix, and `/forecast-accuracy`.

## Required Static Guards

```bash
rg -n "surf_window_impression|surf_window_click|why_this_call_opened|app_deeplink_clicked|forecast_accuracy_table_viewed|save_alert_clicked|seo_intent_page_window_clicked" lib/analytics/event-taxonomy.ts types/implicit-preferences.ts supabase/migrations __tests__
rg -n "/app/spot|/app/\\*|apple-app-site-association|assetlinks|IOS_APP_STORE_URL" app/.well-known lib/recommendations __tests__ docs/session-intelligence
rg -n "GSC|PostHog|Vercel|before|after|CTR|average position|impressions|multi-page|bounce|deep-link conversion" docs/session-intelligence/phase-20-before-after-measurement.md
rg -n "360|390|412|tablet|desktop|no forecast data|7-day only|14-day|no buoy|no tide|no cam|no user reports|model only|low confidence|app not installed|canonical|schema|slow route" docs/session-intelligence/phase-20-qa-matrix.md
```

## Live Read-Only Checks

Run only as read-only checks:

```bash
curl -i https://www.quiversurf.app/.well-known/apple-app-site-association
curl -i https://www.quiversurf.app/.well-known/assetlinks.json
curl -I https://www.quiversurf.app/app/spot/la-jolla-shores?window=phase20-smoke
```

Record exact status codes, content types, and whether live values include
placeholders. Do not mutate production.

## Release Readiness Gates

- `VERCEL_ENV=preview yarn build` is required before claiming release readiness,
  because Phase 20 touches routes, app-link manifests, and browser behavior.
- Production migration application is approval-gated.
- Deploy and alias promotion are approval-gated.
- Native app universal-link handling must be verified or explicitly listed as a
  blocker before public launch claims.
