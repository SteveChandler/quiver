# Phase 17 Research: Limited Session Intelligence Pilot

**Gathered:** 2026-06-02
**Status:** Ready for planning

## Scope

Phase 17 should prove Session Intelligence on three existing surfaces only:

- One high-value spot page, preferably `/ca/san-diego/blacks`.
- The regional forecast hub, preferably `/forecast`.
- The authenticated homepage.

No broad SEO rollout, canonical URL changes, new ML model, DB migration, or new
forecast-fetching pattern belongs in this phase.

## Read

- `AGENTS.md` instructions from the user prompt.
- `CLAUDE.md`
- `docs/ARCHITECTURE.md`
- `app/ARCHITECTURE.md`
- `components/beach-detail/ARCHITECTURE.md`
- `components/forecast/ARCHITECTURE.md`
- `components/home-screen/ARCHITECTURE.md`
- `hooks/ARCHITECTURE.md`
- `lib/utils/ARCHITECTURE.md`
- `lib/services/ARCHITECTURE.md`
- `types/ARCHITECTURE.md`
- `e2e/ARCHITECTURE.md`
- `e2e/README.md`
- `package.json`, `playwright.config.ts`, `jest.config.js`

## Existing Session Intelligence Base

- Phase 15 added the framework-free `SurfWindowRecommendation` model in
  `types/session-intelligence.ts`.
- Phase 15 added deterministic recommendation helpers in
  `lib/recommendations/surf-window-recommendations.ts`; the helper consumes
  existing `EnhancedForecastEntity[]` rows and returns ranked top windows.
- Phase 15 added source/link helpers in:
  - `lib/recommendations/surf-window-source-flags.ts`
  - `lib/recommendations/surf-window-links.ts`
- Phase 16 added reusable UI in `components/session-intelligence/`.
- Phase 16 UI already uses Brand-Vault sticker-sheet assets through
  `components/zine/quiver-sticker.tsx` and `lib/ui/quiver-sticker-assets.ts`.

## Spot Page Findings

- Canonical high-value US spot route:
  `app/[intent]/[city]/[beachSlug]/page.tsx`.
- The server page resolves beach identity, structured data, surf-call preview,
  nearby spots, reviews, amenity/water-quality data, and then renders
  `BeachDetailClient`.
- `components/beach-detail.tsx` client-side fetches the beach, forecasts, and
  sources via `useBeachDetailData({ forecastDays: 10 })`.
- Top-level beach tabs are rendered in `components/beach-detail.tsx` through
  `BeachTabs`.
- `components/beach-detail/tabs/forecast-tab.tsx` already receives forecast
  rows and has a legacy authenticated-only `BestSurfWindow` card for daily
  intel.
- Best pilot placement is above the top-level `BeachTabs` inside
  `components/beach-detail.tsx`, using already-loaded `forecasts`, so the pilot
  is near Forecast/Reviews/Local Intel without removing tab content or adding a
  second forecast fetch.

## Regional Forecast Findings

- `/forecast` is rendered by `app/forecast/page.tsx`.
- The page resolves one active region and renders:
  - `RegionalCallHero`
  - `SevenDayOutlook`
  - `BestRightNow`
  - `OtherRegionsStrip`
  - `RegionalGuidesStrip`
- `getRegionalSummaries()` in `lib/utils/forecast-hub-utils.ts` already fetches
  beaches, batch-fetches cached forecasts, builds `regionForecastMap`, and
  aggregates each region through `aggregateRegionalForecast()`.
- The least risky way to add regional recommendations is to compute top windows
  from the already-built forecast maps during the existing summary pass, rather
  than fetching regional forecasts again.
- `SevenDayOutlook` is a server component and should remain visually and
  structurally intact. Add "Best windows this week" before it.

## Homepage Findings

- The root app renders `HomeScreen` for authenticated users through
  `app/client-app.tsx`.
- `components/home-screen/index.tsx` already fetches personalized discovery via
  `useSurfDiscovery({ maxResults: 6, horizonHours: 24, userLocation:
  seedDiscoveryLocation })`.
- `seedDiscoveryLocation` falls back from browser GPS to home beach, IP location,
  then San Diego, so the homepage already works without explicit user location.
- The homepage should not introduce another discovery fetch. The pilot module
  should reuse `discovery.recommendations`.
- The anonymous landing page is outside Phase 17 unless a test needs to verify it
  remains unaffected.

## Brand Findings

- Primary asset source:
  `/Users/stevenchandler/Desktop/dev/Brand-Vault/media/icons/quiver-sticker-sheet`.
- Web mirror:
  `public/images/quiver-stickers`.
- Existing web abstraction:
  `QuiverSticker` plus `QuiverStickerKey`.
- Preserve Phase 16 sticker treatment for wave, wind, tide, rank, and source
  information. Real surfaces can wrap it in quieter containers, but should not
  invent generic new decorative icons.

## Research Decisions

1. Use existing forecast/discovery data already present on each surface.
2. Add only pure adapters or narrow surface wrappers when needed.
3. Keep existing content in place; the pilot is additive.
4. Keep app CTAs as real anchors and validate `href` behavior.
5. Validate route timing before and after implementation because Phase 17 has a
   "not noticeably slower" success criterion.

