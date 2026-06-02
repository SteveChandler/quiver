---
phase: 20-app-links-analytics-and-qa
plan: 20-02
status: completed
completed_at: 2026-06-02T16:07:34.000Z
---

# 20-02 Summary: Add Session Intelligence Analytics Events

## Completed

- Added Phase 20 Session Intelligence measurement events to the analytics
  taxonomy: `surf_window_impression`, `surf_window_click`,
  `why_this_call_opened`, `app_deeplink_clicked`,
  `forecast_accuracy_table_viewed`, `save_alert_clicked`, and
  `seo_intent_page_window_clicked`.
- Added the same events to anonymous allowlists while keeping them out of the
  pre-auth-only list.
- Added zero implicit-preference weights and typed metadata for the new
  measurement events.
- Added an additive migration to extend the `user_events_event_type_check`
  constraint without dropping existing event types.
- Added Session Intelligence tracking for window impressions, window clicks,
  app deep-link clicks, and "Why this call?" opens.
- Added forecast-accuracy table view tracking with explicit claimable-row
  counts.
- Added alert CTA and SEO intent handoff click tracking.
- Kept native/web app-link and fallback behavior unchanged from 20-01.

## Tests

```bash
yarn test:unit __tests__/api/events-taxonomy-characterization.test.ts __tests__/api/events-allowlist-db-sync.test.ts __tests__/components/session-intelligence/app-deep-link-cta.test.tsx __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/components/session-intelligence/why-this-call.test.tsx __tests__/components/forecast-accuracy/forecast-accuracy-page-state.test.tsx __tests__/components/seo/alert-capture-cta.test.tsx __tests__/components/intent/session-intelligence-intent-handoff.test.tsx --runInBand
yarn test:unit __tests__/components/forecast-accuracy/forecast-accuracy-page-state.test.tsx --runInBand
npx eslint --max-warnings=0 lib/analytics/event-taxonomy.ts types/implicit-preferences.ts components/session-intelligence components/forecast-accuracy/beach-accuracy-leaderboard.tsx components/seo/alert-capture-cta.tsx components/intent/session-intelligence-intent-handoff.tsx components/intent/session-intelligence-intent-link.tsx components/home-screen/session-intelligence-module.tsx components/forecast/regional-best-surf-windows.tsx components/beach-detail/session-intelligence-pilot.tsx app/dev/session-intelligence-preview/page.tsx __tests__/api/events-taxonomy-characterization.test.ts __tests__/api/events-allowlist-db-sync.test.ts __tests__/components/session-intelligence/app-deep-link-cta.test.tsx __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/components/session-intelligence/why-this-call.test.tsx __tests__/components/forecast-accuracy/forecast-accuracy-page-state.test.tsx __tests__/components/seo/alert-capture-cta.test.tsx __tests__/components/intent/session-intelligence-intent-handoff.test.tsx
yarn typecheck
VERCEL_ENV=preview yarn build
rg -n "surf_window_impression|surf_window_click|why_this_call_opened|app_deeplink_clicked|forecast_accuracy_table_viewed|save_alert_clicked|seo_intent_page_window_clicked|user_events_event_type_check" lib/analytics/event-taxonomy.ts types/implicit-preferences.ts supabase/migrations/20260602160000_add_session_intelligence_measurement_events.sql __tests__/api components __tests__/components
git diff --check -- lib/analytics/event-taxonomy.ts types/implicit-preferences.ts supabase/migrations/20260602160000_add_session_intelligence_measurement_events.sql components/session-intelligence components/forecast-accuracy/beach-accuracy-leaderboard.tsx components/seo/alert-capture-cta.tsx components/intent/session-intelligence-intent-handoff.tsx components/intent/session-intelligence-intent-link.tsx components/home-screen/session-intelligence-module.tsx components/forecast/regional-best-surf-windows.tsx components/beach-detail/session-intelligence-pilot.tsx app/dev/session-intelligence-preview/page.tsx __tests__/api/events-taxonomy-characterization.test.ts __tests__/api/events-allowlist-db-sync.test.ts __tests__/components/session-intelligence/app-deep-link-cta.test.tsx __tests__/components/session-intelligence/best-surf-windows.test.tsx __tests__/components/session-intelligence/why-this-call.test.tsx __tests__/components/forecast-accuracy/forecast-accuracy-page-state.test.tsx __tests__/components/seo/alert-capture-cta.test.tsx __tests__/components/intent/session-intelligence-intent-handoff.test.tsx
```

All commands passed.

## Not Done

- The migration was added but not applied to production.
- PostHog production counts for the new events are expected to remain zero until
  the migration and build are deployed.
- End-to-end browser tracking assertions were not added in this slice; 20-04
  covers the public QA matrix and 20-05 covers live verification.
