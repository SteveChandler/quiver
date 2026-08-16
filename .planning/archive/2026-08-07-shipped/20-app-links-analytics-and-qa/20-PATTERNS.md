# Phase 20 Patterns

## App-Link Patterns

- Use `app/.well-known/apple-app-site-association/route.ts` for iOS associated
  domains.
- Use `app/.well-known/assetlinks.json/route.ts` for Android Digital Asset
  Links.
- Keep App Store constants centralized in `lib/constants/app-store.ts`.
- Keep canonical SEO URLs separate from app/universal links in
  `lib/recommendations/surf-window-links.ts`.
- Use `__tests__/app/well-known-app-links.test.ts` as the route-contract test
  anchor.

## Analytics Patterns

- Add user-event names to `lib/analytics/event-taxonomy.ts`.
- Add zero-weight entries to `types/implicit-preferences.ts` for measurement
  events that should not influence personalization.
- Add an additive migration that preserves the current
  `user_events_event_type_check` before OR-ing in new event names.
- Update event-set hashes in
  `__tests__/api/events-taxonomy-characterization.test.ts` intentionally.
- Use `useTrackEvent` when writing to `/api/events`; use `lib/analytics.ts`
  only for external-only GA/PostHog events.
- Public Session Intelligence events should generally be anonymous-allowed but
  not pre-auth-only, because they can legitimately fire for signed-in users too.

## E2E Patterns

- Guest specs should call `setupErrorDetection(page)` in `beforeEach` and
  `assertNoErrors(page, errorCapture)` in `afterEach`.
- Prefer role, test id, and visible text assertions over sleeps.
- Use viewport loops from the Phase 16/18 specs for 360, 390, 412, tablet, and
  desktop coverage.
- Use `isVisibleSafe()` when a branch depends on environment-specific data.
- Run `npx playwright test --list <spec>` before expensive browser runs.

## Measurement Patterns

- GSC evidence should include the exact date range, noting its lag.
- PostHog evidence should list event names, event counts, and whether the event
  exists before claiming conversion rates.
- Vercel/performance evidence should be a dated route-performance snapshot,
  not a vague "looked fine" note.
- Before/after docs must state "before" and "after" separately. Immediate
  release closeout may only record the "before" baseline and the scheduled
  after-check window.

## Production Gates

- No deploy or alias promotion without explicit approval.
- No production migration application without explicit approval.
- No public SEO lift, conversion lift, or app-link conversion claim without
  dated source evidence.
- No placeholder Apple team IDs, bundle IDs, Android packages, or Android
  certificate fingerprints may be shipped as live validation evidence.
