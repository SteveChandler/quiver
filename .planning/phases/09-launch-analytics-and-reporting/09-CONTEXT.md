# Phase 09 Context: Launch Analytics And Reporting

## Goal

Instrument the go-live campaign and define a read-only reporting path for launch
performance.

## Source Files Read

- `app/api/events/route.ts`
- `types/implicit-preferences.ts`
- `components/page-tracker.tsx`
- `hooks/use-track-event.ts`
- `lib/analytics/ios-app-cta-tracking.ts`
- `components/pricing/founding-access-cta.tsx`
- `app/blog/page.tsx`
- `app/blog/[slug]/page.tsx`
- `lib/data/blog-posts.ts`
- `docs/analytics/ACTIVATION_FUNNEL.md`
- `docs/analytics/paid-personalization-release-queries.sql`
- `.planning/phases/08-outreach-and-social-kit/08-*.md`

## Existing Event Contract

- `page_view` is valid and anonymous-allowed.
- `cta_impression` and `cta_click` are valid and anonymous-allowed.
- Pricing waitlist CTA uses `signup_cta_view` / `signup_cta_click` with
  `cta_type=founding_access_waitlist`; these are pre-auth only and suppressed
  for authenticated users.
- iOS App Store CTAs dual-fire product analytics
  `ios_app_cta_view` / `ios_app_cta_click` plus internal
  `cta_impression` / `cta_click` rows using `cta_family=ios_app`.
- Blog pages had page views through `PageTracker`, but no launch-specific
  content metadata or cross-link click instrumentation.

## Decisions

- Do not add new `user_events` event types for launch reporting.
- Use `launch_campaign=go_live_2026_05` as the campaign spine.
- Add launch metadata to existing `page_view` events for `/`, `/pricing`,
  `/blog`, and `/blog/[slug]`.
- Track blog hub/post cross-links through existing `cta_click` events with
  `cta_family=launch_blog_cross_link`.
- Keep App Store/TestFlight truth checks in the reporting runbook because Apple
  status can change outside this repo.

## Subagents

- Explorer audit: `019e5c76-16a7-73e3-8a23-b29fc1b3b0be`
- Growth reporting outline: `019e5c76-2dad-7783-bae8-790bbd962463`
