# Phase 17 Patterns: Limited Session Intelligence Pilot

**Gathered:** 2026-06-02

## Data Patterns

- Prefer existing loaded data over new client fetches.
- Spot page: use `forecasts` from `useBeachDetailData()` in
  `components/beach-detail.tsx`.
- Regional page: compute recommendations from the forecast maps already built in
  `getRegionalSummaries()`.
- Homepage: use `discovery.recommendations` from `useSurfDiscovery()`.
- Keep transformations pure and testable in `lib/recommendations/`.
- Use `forecast_at` through existing helpers; do not add new
  `forecast_date`/`forecast_time` query logic.

## UI Patterns

- Use `BestSurfWindows`, `WhyThisCall`, `SourceConfidenceBadge`, and
  `AppDeepLinkCTA` from `components/session-intelligence/`.
- Prefer wrapper components per surface over changing core layout everywhere.
- Keep cards 8px-radius-or-less where new UI is authored unless reusing the
  Phase 16 component's existing style.
- Avoid nested cards inside cards. Surface wrappers should be sections/bands.
- Preserve the Brand-Vault sticker language via `QuiverSticker` and mirrored
  `/images/quiver-stickers` assets.

## Routing And Link Patterns

- Spot URLs use hierarchical paths such as `/ca/san-diego/blacks`; do not
  introduce canonical changes.
- App CTA links come from `buildSurfWindowLinks()` and should remain anchors.
- The CTA may land on the website universal link; this is acceptable for the web
  pilot as long as the link is exact and safe.

## Auth And CTA Patterns

- The pilot's recommendation content should not be hidden behind signup.
- Do not emit pre-auth funnel events from the pilot for authenticated users.
- If a CTA is added for anonymous users, it must self-guard with `useAuth()`.
- Phase 17's app CTAs are surf-window links, not signup prompts.

## Test Patterns

- Unit tests use Jest + Testing Library.
- E2E tests use Playwright with `setupErrorDetection()` in `beforeEach` and
  `assertNoErrors()` in `afterEach`.
- Prefer stable role/name/test-id locators.
- Use `isVisibleSafe()` for data-dependent sections.
- Validate responsive layouts at 360, 390, 412, 768, and 1280 widths.

