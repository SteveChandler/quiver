# Changelog

All notable changes to the Quiver surf app will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **SEO: State-level intent links on beach detail pages** — `RelatedGuidesSection` now links to all 7 state-level intent pages (e.g., `/dawn-patrol/ca`) as a compact text row below the existing city-level intent cards
- **SEO: Sibling cities section on city hub pages** — New `SiblingCitiesSection` component shows up to 8 other surf cities in the same state on both StandardLayout and EditorialLayout
- **SEO: FAQSection on editorial city hub layout** — Editorial cities now render data-driven FAQs via `generateCityRichContent`, matching StandardLayout's FAQ coverage
- **SEO: Editorial-backed FAQ generator** — `CityContentInput` accepts optional `editorialBeachData` to generate additional FAQs from real beach editorial content (tide, safety, crowd data)
- **SEO: Beach highlights prep on StandardLayout** — Optional `beachHighlights` prop renders beginner/safety badges with links (awaiting content pipeline data)
- **SEO: HowTo schema for beginner beaches** — New `HowToSurfSchema` component outputs JSON-LD for "how to surf [beach]" queries, rendered only on beginner-level beach pages
- **SEO: Structured data on state root pages** — `/ca`, `/or`, etc. now include BreadcrumbStructuredData, ItemListSchema, and WebPageSchema

### Fixed

- **Auth modals: missing `returnTo`, stale closure risk, and unnecessary eager mounting (code review items 2, 4, 6, 7)** — `beach-card.tsx` and `beach-actions.tsx` now pass `returnTo={pathname}` to their `UnifiedAuthModal` instances so users land back on the correct page after sign-up. `favorite-button.tsx` deferred-action `useEffect` now guards on `hasInitialized` before firing `toggleFavorite()`, preventing a stale-closure call while favorites are still loading; the `eslint-disable` comment now includes the suppression reason. All seven components that render `UnifiedAuthModal` added in this feature branch now use lazy-render (`{showAuth && <UnifiedAuthModal .../>}`) to avoid mounting the modal subtree until it is actually needed. `beach-card-session-link.test.tsx` mock for `next/navigation` updated to include `usePathname`.

### Added

- **Alerts: `runForecastThresholdAlerts` now processes per-favorite-beach alerts** — Extended the forecast alert cron service to also evaluate `favorite_beaches` rows where `alerts_enabled = true`. The per-user-beach evaluation logic was extracted into a reusable `evaluateAndSendAlert` helper (same threshold/dedupe/quiet-hours logic). Favorite beach forecasts are fetched in the same cache pass as home beach forecasts; beaches already fetched for a home beach are not re-fetched. The `ForecastAlertRunSummary` type gains a `favoriteBeachesProcessed` counter. 29 TDD tests cover pure functions and all new integration paths (favorite fires, disabled skipped, home dedupe does not block favorite, both home and favorite fire in same run, no double-fetch for shared beach).

- **Alerts: `enableFavoriteAlerts` server action** — Added `enableFavoriteAlerts(beachId)` to `actions/beach/beach-favorite-actions.ts`. The action favorites the beach (if not already) then sets `alerts_enabled = true` on the `favorite_beaches` row in a single authenticated call. Idempotent: calling it twice leaves the row in the same state. Uses `makeAuthenticatedAction` so no `userId` parameter is required from callers. 6 TDD tests (insert + alert when not yet favorited, alert-only when already favorited, idempotent on double-call, update failure, insert failure, unauthenticated rejection).

- **Growth: Improved session logging discovery for guests (Task 8A/8B)** — Updated `BeachActions` guest-mode button labels and added per-button auth modal tracking: "Log Session" becomes "Track Your Sessions" with description "Build your surf log and unlock personalized recommendations"; "Plan Session" becomes "Plan a Session" with description "Coordinate with friends and pick the best time". Each button now opens `UnifiedAuthModal` with a distinct source (`session-log-cta` vs `session-plan-cta`) instead of delegating to the shared `onAuthRequired` callback, enabling precise analytics attribution. Added a subtle "Log a session here" link to `BeachCard` that opens the auth modal in signup mode for guests (with contextMessage "Track Your Sessions / Track your sessions at {name} and get personalized recommendations") and links directly to `/sessions/new?beach={id}` for authenticated users. 13 new TDD tests cover all label changes, description text, source props, modal interactions, and auth-state branching.

- **Growth: `BeachAlertCta` now calls `enableFavoriteAlerts` server action** — Rewrote `components/beach-detail/beach-alert-cta.tsx` to call `enableFavoriteAlerts(beachId)` (favorites the beach + sets `alerts_enabled = true`) when an authenticated user clicks "Get Alerts". Adds loading state (disabled button + `Loader2` spinner), error toast via `toast()` on failure, and a deferred-action `useEffect` that auto-fires after sign-in when a matching `pendingAction` (`type: "alert"`, `beachId`) is stored. Auth modal is now lazy-rendered (`{authModalOpen && <UnifiedAuthModal .../>}`). 13 TDD tests (5 new) cover `enableFavoriteAlerts` call, success message, loading/disabled state, error toast on `success: false`, error toast on thrown error, deferred auto-trigger on sign-in, and no-trigger when beachId differs.

- **Growth: `PersonalizedForecastTeaser` for guests on beach detail pages** — Created `components/beach-detail/personalized-forecast-teaser.tsx`, a card shown to non-authenticated users on beach detail forecast tabs. Renders a gradient card (blue-50 to indigo-50) with a `Target` icon, three static feature bullets (wave difficulty, best time windows, crowd preferences), and a "Get Your Forecast" CTA that opens `UnifiedAuthModal` in `signup` mode with `source="personalized-forecast-teaser"`. Returns `null` for authenticated users. Integrated into `ForecastTab` at the top of the forecast content via a `!user` conditional using `useAuth`. 10 TDD tests cover guest render, auth render (null), all three bullets, modal open/close, source prop, and className prop.

- **Growth: `MatchScoreTeaser` added to `BeachCard` and `BeachDiscoveryCard` (Phase 2B/2C)** — Non-authenticated users now see a "Match: ???" amber teaser badge in place of the personalized score badge on both card types. `BeachCard` calls `useAuth()` and renders `MatchScoreTeaser` at `absolute top-2 left-2 z-10` when `!user && id`; shows `PersonalizedBadge` when `user && personalized && personalizedScore`; shows nothing when the user is authenticated but the score is not yet available. `BeachDiscoveryCard` follows the same three-way conditional in the badge row. Clicking the teaser opens the `UnifiedAuthModal` in signup mode. 8 new TDD tests in `beach-card-match-teaser.test.tsx` and `beach-discovery-card-match-teaser.test.tsx` cover all three conditional branches for both components.

- **Growth: `MatchScoreTeaser` component (Phase 2A)** — Created `components/recommendations/match-score-teaser.tsx`, a teaser badge for non-authenticated users that renders "Match: ???\" in the same amber/yellow style as `PersonalizedBadge` (Sparkles icon, `bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100`, size `sm`). Clicking opens `UnifiedAuthModal` in `signup` mode with contextMessage "See Your Match Score / See your personalized match score for {beachName}", `source="match-score-teaser"`, and `returnTo={pathname}`. After auth the parent beach-card swaps this component for the real `PersonalizedBadge` automatically. Exported from `components/recommendations/index.ts`. 10 TDD tests cover badge text, icon rendering, modal open/close, source/mode/returnTo props, contextMessage title/description, and className prop.

- **Growth: `FavoriteButton` added to `BeachCard` and `BeachDiscoveryCard` (Phase 1B/1C)** — Users can now save beaches directly from discovery/listing views. `BeachCard` renders a ghost-variant `FavoriteButton` at `absolute top-2 right-2 z-10` inside the map image container (opposite corner from `PersonalizedBadge`). `BeachDiscoveryCard` renders it inline in the badge row with `ml-auto` for right-alignment. Both pass `beachId` and `beachName` props. Works for authenticated and non-authenticated users (shows auth modal for guests). Six new TDD tests cover rendering and prop-forwarding for both cards.

- **Auth: `FavoriteButton` now opens auth modal + defers action for guests (Phase 1A)** — Replaced the dismissible "Sign in required" toast with `UnifiedAuthModal` (mode `"signup"`, contextMessage "Save to Your Spots"). Non-auth'd clicks call `setPendingAction({ type: "favorite", beachId, beachName })` from `usePendingAction` before opening the modal. A new `useEffect` watches for `user` + matching `pendingAction` and auto-fires the toggle after sign-in, then clears the pending action. Added optional `beachName` prop to `FavoriteButtonProps` (defaults to `"this beach"`). Three new TDD tests cover modal open, pending action storage, and deferred completion.

- **Growth: `PersonalizationShowcase` CTA for non-authenticated users** — Added a "Get Your Match Scores" button below the ML forecast demo card that opens `UnifiedAuthModal` in `signup` mode with contextMessage "Get Personalized Match Scores". Button and supporting "Free account, no credit card" text are hidden for authenticated users. Modal is wired with `source="personalization-showcase"` for analytics attribution. Three TDD tests cover: CTA visible for guests, hidden for authed users, and modal opens on click.

- **Auth: `usePendingAction` hook for deferred post-auth actions** — Created `hooks/use-pending-action.ts` (and accompanying tests at `__tests__/hooks/use-pending-action.test.ts`). The hook stores a guest-initiated action (`"favorite"` or `"alert"`) in localStorage so it can be replayed automatically after an OAuth redirect completes. Reads on mount, auto-expires after 5 minutes, and uses `safeGetItem`/`safeSetItem`/`safeRemoveItem` wrappers for Safari private mode and SSR safety.

- **Personalization: Batch personalization layer for homepage discovery** — Created `lib/services/discovery/personalization-layer.ts` with `fetchPersonalizationContext` (2 parallel DB queries: implicit prefs + batch affinity fetch) and pure-computation `calculatePersonalizationBonus`. Eliminates the N+1 pattern from `personalized-scoring-service.ts` (previously 4-6 queries per beach) for the homepage discovery flow. Exported from `lib/services/discovery/index.ts`.
- **Personalization: Integrated personalization layer into surf-discovery-orchestrator** — `discoverSurfSpotsInner` now destructures `preferredBreakType` from `buildCandidatePool`, fetches `userPrefs` once then passes it to `fetchPersonalizationContext` (avoids duplicate DB round-trip), runs sun times / water quality / personalization context in a single `Promise.all`, calls `calculatePersonalizationBonus` per beach before `scoreBeachForDiscovery`, and surfaces `affinityBonus`, `personalizationBonus`, and personalization-sourced reasons in each `DetailedScore`. Debug log now includes `pers=` and `affinity=` subscore columns.

- **SEO: Dynamic OG images for intent and guide pages** — Created `app/api/og/intent/route.tsx` (edge runtime, params: `intent`, `city`, optional `count`) and `app/api/og/guide/route.tsx` (edge runtime, params: `title`, `region`) generating 1200x630 social-share cards with dark gradient background, orange accent branding, and consistent Quiver identity matching the existing beach OG route. Both include input validation, `renderFallback()` for missing params, and `stale-while-revalidate=604800` cache headers. Updated `generateMetadata` in `app/[intent]/[city]/page.tsx` (state-level and city-level intent branches) and `app/guides/[slug]/page.tsx` to pass the new OG routes as the `image` param to `buildPageMetadata`, wiring Open Graph and Twitter card images for all intent and guide pages.

### Changed

- **SEO: Extracted shared `WebPageSchema` component** — Created `components/seo/web-page-schema.tsx` with a typed `WebPageSchema` component that centralizes all `"@type": "WebPage"` JSON-LD output. Replaced 11 inline `<script type="application/ld+json">` blocks across 9 files (`app/[intent]/[city]/page.tsx` × 4 branches, `app/[intent]/[city]/[beachSlug]/page.tsx`, `app/cams/page.tsx`, `app/best-time-to-surf/page.tsx`, `app/guides/[slug]/page.tsx`, `app/beaches/.../standard-layout.tsx`, `app/beaches/.../editorial-layout.tsx`, `app/forecast/page.tsx`, `app/forecast/[beachId]/page.tsx`, `app/mexico/.../page.tsx`). The beach detail pages now include the previously missing `url` field in their WebPage schema.
- **Beginner beach URLs use `buildBeachUrl()` consistently** — `BeginnerBeachWithEditorial` now carries `city` and `state` fields (fetched in `getBeginnerBeachesWithEditorial`); the beginner branch of `app/[intent]/[city]/page.tsx` now calls `buildBeachUrl(b)` for both the Place schema and ItemList schema URLs instead of manually constructing `/${stateSlugLower}/${params.city}/${b.slug}`, ensuring Hawaii island disambiguation and other edge cases are handled correctly.

### Removed

- **`components/beginner/BeginnerFAQ.tsx` deleted** — the component had zero imports across the codebase after its barrel export was removed from `components/beginner/index.ts`; the file is now permanently removed.

### Fixed

- **12 failing test suites (45 tests) aligned with source code** — Updated test assertions and mocks across 12 files to match evolved source: `undefined` vs `null` in RPC params, `latitude`/`longitude` field names in dedupe mocks, `null` featured photo fields, missing `usePathname`/`useSearchParams` navigation mocks, `aria-label` ticker assertion, `useAuth`/`closeDialog` onboarding mocks, and `beach_water_quality`/chained `.order()` in discovery scoring mocks.
- **Double-fetch in beach autocomplete** — Removed redundant `debouncedQuery` effect from `hooks/use-beach-autocomplete.ts`. `useDataFetcher` already auto-fetches when `fetchBeaches` identity changes, so the explicit `refetch()` call was causing duplicate requests.
- **SEO: ReviewSchema no longer emits AggregateRating on Place type** — Google does not support review snippets for Place/TouristAttraction types; emitting them triggered Search Console errors. `components/seo/review-schema.tsx` now renders nothing (no-op), consistent with the documented rationale in `BeachPageStructuredData`.
- **SEO: Duplicate Organization JSON-LD removed from beach pages** — `BeachPageStructuredData` in `structured-data.tsx` was emitting both the Organization schema and beach Place data; since the root layout already emits Organization via `buildRootStructuredDataGraph()`, the component now only emits the beach Place schema.
- **SEO: `"use client"` removed from structured-data.tsx** — The component only uses `JSON.stringify` (no browser APIs), so it can be a server component for optimal crawler visibility.
- **SEO: Missing Place/WebPage/ItemList on beginner and tide intent pages** — `/beginner/[city]` and `/tide/[city]` pages were missing Place (GeoCoordinates), WebPage (dateModified), and ItemList structured data that `/least-crowded/[city]` already had. Added these schemas in `app/[intent]/[city]/page.tsx` before rendering the dedicated components.
- **SEO: FAQ rendering standardized with visible HTML** — `BeginnerPageContent` and `TidePageContent` replaced `FAQSchema` (JSON-LD only) with `FAQSection` (JSON-LD + visible `<dl>/<dt>/<dd>` markup). Removed unused `BeginnerFAQ` accordion component.
- **SEO: SpotStructuredData breadcrumbs use hierarchical URLs** — `components/seo/spot-structured-data.tsx` now generates `/state/city/beach` URLs when state/city data is available instead of legacy `/spots/{slug}`.
- **SEO: WebPage JSON-LD with `dateModified` added to hub and city pages** — `app/cams/page.tsx`, `app/best-time-to-surf/page.tsx`, `app/guides/[slug]/page.tsx`, `app/beaches/[country]/[state]/[city]/standard-layout.tsx`, and `editorial-layout.tsx` now emit a `WebPage` structured-data block with `dateModified`; `app/forecast/page.tsx` had the block but was missing `dateModified`, now fixed
- **SEO: Breadcrumb state URL corrected from `/{state}` to `/beaches/usa/{state}`** — `lib/utils/beach-url-utils.ts` `getUsStateRootPathOrNull` was returning `/ca`, `/hi` etc. (non-existent routes); now returns `/beaches/usa/ca`, `/beaches/usa/hi` etc. matching the canonical state listing pages
- **SEO: Tide intent page title trimmed to fit 60-char limit** — dropped the `| {count} Spots` suffix from the live-data tide title format in `lib/seo/intent-content-templates.ts`; e.g. `San Diego Tide Chart Today: Next Low 06:00 PM` (48 chars) instead of 67 chars including the `| Quiver` template suffix
- **SEO: Best-time-to-surf hub title shortened** — removed `| Month-by-Month Guide` suffix from the `app/best-time-to-surf/page.tsx` metadata title; new title is `Best Time to Surf in the US (2026)` (44 chars + `| Quiver` = 53 total)
- **SEO: Location (city) page title enriched for metro areas** — `app/beaches/[country]/[state]/[city]/city-page-metadata.ts` now builds a dynamic `{n} {City} Surf Spots: {BreakTypes}` title for metro areas instead of using the static `pageTitle` string, giving Google better indexable keywords
- **SEO: Metro city page description capped at 160 chars** — added `MAX_DESC_LENGTH` truncation logic for metro `description` overrides in `city-page-metadata.ts` to prevent >160-char meta descriptions
- **SEO: Homepage meta description trimmed to 155 chars** — removed `wind &` and `& more` from `SEO_CONFIG.description` in `lib/constants/seo.ts` to stay within the 160-char limit

- **SEO: 404 pages no longer emit indexable fallback metadata** — `generateMetadata` in `app/[intent]/[city]/[beachSlug]/page.tsx` now returns `robots: { index: false, follow: false }` immediately when the beach lookup returns null (or on any error), instead of falling through to a `buildPageMetadata` call that emitted a canonical URL and `index: follow`. Both the invalid-state-slug guard and the bottom-of-function error fallback are also updated to noindex. The redundant `if (beach)` wrapper was removed since an early return now guards the not-found path.
- **SEO: Legacy `/spots/{slug}` redirects now emit HTTP 301 instead of 308** — `permanentRedirect()` in the spots page server component always emitted HTTP 308 (Next.js App Router default), which has lower crawler compatibility than 301. The redirect logic is moved to `middleware.ts` which uses `NextResponse.redirect(url, { status: 301 })`, reusing the existing `lookupBeachBySlug` / `buildCanonicalBeachUrl` helpers from `lib/middleware/seo-redirect-handler.ts`. The spots page now renders normally for the fallback path (middleware timeout/failure), with the canonical URL signal preserved via `generateMetadata`.

- **TypeScript schema drift – profile/preferences files (10 files):** Resolved all TypeScript errors in profile and preference-related files after regenerating `types/database.generated.ts`. Fixes include: `profiles.skill_level` renamed to `experience_level` in `forecast-digest-email` select query and `EligibleUser` interface; `get_nearby_beaches` RPC returns a subset of beach columns — cast to `as unknown as Beach[]`; `city | state` columns typed `string | null` on beaches table — guarded with `?? ""`; `find_cities_by_pattern` RPC `state_filter` arg typed `string | undefined` (not `null`) — replaced `null` with `undefined` and `?? undefined` for `string | null` values; `CityMetadata.beaches[].slug` typed `string` — added `?? ""` to map; `get_city_editorial` RPC return type doesn't overlap with `CityEditorialContent` — cast via `as unknown as`; `get_most_visited_beach` RPC absent from generated types — accessed via `(supabase as any).rpc`; `username` column absent from `profiles` — removed from `getUserMetadata` select and downstream usage in `app/user/[id]/page.tsx`; `forecast_snapshot` / `actual_conditions` typed as `Json` — cast to `Record<string, any>` for property access in preference-learning-service; `personalization_milestones.metadata` insert now cast to `Json`; `user_email_prefs` upsert payload cast to `any`; `withAuthenticatedAction` callback `supabase` typed as `any` to resolve union client type mismatch in preference-actions.

### Added

- **CCC Coastal Commission amenities integration (Phase 1):** Syncs 1,575 CA coastal access points from the CCC API into `ccc_access_locations`, matches them to beaches within 1500m via Haversine, and aggregates amenity flags into `mv_beach_amenities` materialized view. Monthly cron (`/api/cron/ccc-sync`) with import + match phases. Beach detail pages now show data-driven amenity badges grouped by category (Access, Facilities, Recreation, Terrain) instead of hardcoded placeholders. Non-CA beaches fall back to keyword-derived badges from existing `features`/`amenities` arrays. `BeachPageStructuredData` emits dynamic `LocationFeatureSpecification` entries in JSON-LD.
- **EPA water quality monitoring (Phase 2):** Syncs bacteria monitoring data (Enterococcus, Fecal Coliform) from the Water Quality Portal (EPA/USGS) into `wq_monitoring_stations`, `wq_samples`, and `beach_water_quality` tables. Bi-weekly cron (`/api/cron/water-quality-sync`) with station discovery, sample fetch (streaming CSV), and EPA criteria evaluation phases. Beach detail pages show a color-coded water quality badge (green/amber/red) with expandable details including sample dates, readings, and exceedance counts.
- **Water quality integrated into scoring, discovery, and Morning Intel:** `scoreConditions()` now accepts optional water quality status — closure forces skip, advisory adds warning. Discovery orchestrator batch-fetches water quality (no N+1) and adjusts rankings. Morning Intel payload includes water quality status; `conditions-intel-card` renders amber/red badges for advisory/closure.
- **Water quality push notifications (Phase 3):** Status change alerts (advisory, closure, recovery) sent to users with matching `home_beach_id`. Follows forecast-alerts pattern: quiet hours, dedup, FCM push + in-app notification. Shareable OG image at `/api/og/water-quality` with status-colored gradients. Added `notif_water_quality` preference to profiles.

- **SEO: Place schema with GeoCoordinates on intent pages (Task 2B)** — Enhanced `buildLocationPlaceStructuredData()` in `lib/seo/location-structured-data.ts` to accept `centerLat`/`centerLon` (city-level geo) and `beachGeoData` (per-beach lat/lon). Intent pages now emit a `Place` JSON-LD block with `GeoCoordinates` for the city center and each beach's `containsPlace` entry, exposing Mapbox pin data to Google's structured data parser which cannot read canvas renders.
- **SEO: WebPage schema with dateModified on intent pages (Task 2C)** — City-level and state-level intent pages (`app/[intent]/[city]/page.tsx`) now emit a `WebPage` JSON-LD block containing `name`, `description`, `url`, and `dateModified` (current ISO timestamp), signaling content freshness to Google.
- **SEO: 4-level breadcrumb schema on city-intent pages (Task 2C)** — Breadcrumb structured data on city-level intent pages now has 4 levels: Home → State → City → Intent (previously 3 levels missing the state tier). State-level intent pages also updated from "Quiver" to "Home" as the root node for consistency with beach detail pages.
- **Data layer: `BeachEditorialItem` type and `getCityBeachEditorialData` action** — Adds a new exported interface (`types/location.ts`) and server action (`actions/city/city-metadata-actions.ts`) that fetches 20 editorial columns (`break_type`, `description`, `crowd_level/tips`, `wave_tips`, `best_conditions_prose`, `access_tips`, `parking_tips`, `best_months`, `hazards`, `aspect_deg`, `skill_level`, `preferred_tide_direction/ft_min/ft_max`) for all public beaches in a city. Kept separate from `CityMetadata` so existing callers are unaffected.
- **Sitemap: 15 new 2-beach city markets in intent pages** — Lowered threshold from 3 to 2 beaches with an editorial quality guard (description + at least one of crowd_tips/wave_tips/best_conditions_prose on both beaches). Adds Carmel-by-the-Sea, Del Mar, Goleta, Kill Devil Hills, Kailua-Kona, Luquillo, Melbourne Beach, Montauk, Narragansett, Pacifica, Pupukea, Queens, Scarborough, Seaside, Venice to all intent routes (`app/sitemap.ts`, `actions/beach/beach-location-actions.ts`, DB migration)
- **Sitemap: ~20 new best-time-to-surf city pages** — Lowered `getCitiesWithBestMonthsData` threshold from 3 to 2 beaches with best_months data. Adds Del Mar, Encinitas, Goleta, Haleiwa, Hermosa Beach, Kailua-Kona, Kill Devil Hills, La Push, Luquillo, Manhattan Beach, Melbourne Beach, Montauk, Narragansett, Pacifica, Pupukea, Queens, San Onofre, Scarborough, Venice (`actions/city/best-time-actions.ts`)
- **Sitemap: Aguadilla, Isabela, Hermosa Beach, Santa Cruz now gain beginner/longboard intent routes** — Expanded `has_beginner` in RPC and beginner beach queries to include `lower-intermediate` skill level. Updated `categorizeSkillLevel()` for consistency with page metadata noindex guard (`actions/city/city-metadata-actions.ts`, `actions/beginner/beginner-actions.ts`, DB migration)

### Fixed

- **Water quality sync service (code review fixes):** Six correctness and performance issues addressed in `water-quality-sync-service.ts` and `e2e/water-quality.spec.ts`: (1) E2E source text assertion updated from stale "WQP" text to `/Source:.*(?:CEDEN|Clean Water Branch)/i` regex; (2) delay disclaimer regex updated from "1-2 weeks" to "1-5 days" to match component copy; remaining "WQP" references in log messages and JSDoc updated. (3) Added `YYYY-MM-DD` format assertion before CEDEN SQL date interpolation plus a comment that the value is derived from a trusted `Date` object. (4) Extracted `CEDEN_SAMPLE_QUERY_LIMIT = 32_000` constant, replacing the inline hardcoded value. (5) Fixed single `CEDEN_CONFIG.matchRadiusM` used for all stations — now uses `PACIOOS_CONFIG.matchRadiusM` for Hawaii (`state_code === "HI"`) and `CEDEN_CONFIG.matchRadiusM` for California within the station loop. (6) Eliminated N+1 query pattern in `evaluateWaterQuality`: all samples now fetched in a single `.in("station_id", allStationUuids)` query and grouped by beach via a `Map`, reducing DB round-trips from O(beaches) to O(1). (7) `computeGeometricMean` now filters zero/negative values before computing log-transform, returning `null` when no positive values exist.

- **SEO: Collision-aware city slugs in beach detail intent backlinks (Task 4 Phase 1D):** `RelatedGuidesSection` now uses `buildCitySlug(beach.city, stateSlug, COLLISION_CITY_MAP)` instead of the bare `slugifyAscii(beach.city)` call, ensuring collision cities like Newport, OR generate `/tide/newport-or` (not the ambiguous `/tide/newport`) and Long Beach, CA generates `/tide/long-beach-ca`. Previously these links would land on incorrect or non-existent intent pages for the ~3 collision cities in the database (`components/beach-detail/related-guides-section.tsx`)

- **SEO: Fallback titles for beach detail pages (no live forecast):** Changed generic "Surf Report & Forecast | City, ST" format to break-type + value-proposition pattern — "Bolsa Chica — Beach Break | Crowds, Wind & Tide Intel" — giving each beach a unique, CTR-optimised title even before wave-height data loads. Falls back to "{Beach} | Crowds, Wind & Tide Intel" when break type is unavailable (`lib/seo/meta.ts`)
- **SEO: Intent page city-not-found fallback title now includes city name:** Slug is parsed via `parseLocationFromSlug` so Google sees "Beginner Spots in Nags Head | Quiver" instead of the generic "Beginner Spots | Quiver" (`app/[intent]/[city]/page.tsx`)

- **Review tracking from Overview CTA:** Fixed `handleWriteReview` callback being passed directly as `onClick`, causing React's MouseEvent to overwrite the default `overview_cta` source parameter — zero `overview_cta` tracking events were ever recorded in production (`components/beach-detail.tsx`)
- **Rate limits too strict in dev:** `surf-discovery` and `surf-insights` rate limit keys used hardcoded production values; added `IS_PRODUCTION` ternary for dev flexibility matching other keys (`lib/api/rate-limit-config.ts`)
- **E2E: Beach detail forecast selectors:** Updated stale test selectors for refactored forecast tab with sub-tabs (Today/Tides/Conditions) (`e2e/beach-detail.spec.ts`)
- **E2E: Review tracking event capture:** Replaced `page.route` with `addInitScript` fetch monkey-patch to capture `keepalive: true` tracking events that Playwright cannot intercept natively (`e2e/beach-review-tracking.spec.ts`)
- **E2E: Board recommendations negative waveHeight:** Updated test expectation from 200 to 400 for negative wave heights now that API validates input (`e2e/api/board-recommendations.spec.ts`)
- **E2E: Featured beaches schema:** Added `score` to expected fields allowlist (`e2e/api/featured-beaches.spec.ts`)
- **E2E: Home page score format:** Updated regex from `\d+\.\d+/10` to `\d+(\.\d+)?/10` to match integer scores like "8/10" (`e2e/home.spec.ts`)
- **Discovery today-first window selection:** Discovery orchestrator now tries today's forecasts before falling back to all forecasts (today + tomorrow), preventing "Skip today — tomorrow at X is good" recommendations when today has a viable surf window (`lib/services/discovery/surf-discovery-orchestrator.ts`)
- **Overview CTA review tracking never fires:** `handleWriteReview` was passed directly as an `onClick` handler, causing React to pass the MouseEvent as the `source` argument instead of `'overview_cta'`. This silently broke all tracking events (form open, validation errors, abandon) when opening the review form from the Overview tab. Wrapped the callback to pass the correct source string (`components/beach-detail.tsx`)

### Changed

- **Preference-aware surf call verdicts:** Beach detail YES/NO verdict now factors in the user's `preferred_wave_size` and `experience_level` from their profile. `applyPreferenceAdjustments` adjusts the best window's score before `computeSurfCall` runs, so a medium-wave surfer no longer sees "YES" on a 2ft day (`actions/spot/spot-surf-report-actions.ts`)

- **Brand alignment:** Unified visual language across landing page and authenticated app — ocean-blue is now the primary action color everywhere, orange demoted to secondary accent
- **Primary actions ocean-blue:** Home screen CTA buttons use ocean-blue gradient instead of orange (`primary-actions.tsx`)
- **Bottom nav active state:** Changed from orange to ocean-blue (`bottom-nav.tsx`)
- **Font consistency:** Added `font-roboto` to greeting and hero headings for consistent typography
- **CSS primary variable:** Aligned `--primary` and `--ring` CSS variables with ocean-blue (#0077B6)
- **Ocean-blue hover states:** Replaced `ocean-blue-dark` token with `ocean-blue/90` opacity modifier in beach-actions and product-tour
- **Style guide expanded:** Added font family rules, logo usage, naming conventions, landing/app alignment, and updated brand color documentation

### Removed

- **Duplicate footer component:** Deleted `components/landing-page/footer-section.tsx` and consolidated into `components/shared/site-footer.tsx` via `showBrandSection` and `showSocialLinks` props
- **Orphaned assets:** Deleted `public/logo-word (2).png`; optimized `logoQuiver.png` from 2.6MB to 96KB
- **Unused color token:** Removed `ocean-blue-dark` from Tailwind config (replaced by opacity modifier)

### Fixed

- **Broken email CTA links:** Fixed "Check Full Forecast" links 404ing in forecast-digest and reengagement emails by using `buildBeachUrl()` for correct hierarchical URLs (`/{state}/{city}/{beachSlug}` instead of `/beaches/{slug}`). Fixed "Log Your Session" links in reengagement and conditions-alert emails to pre-fill the beach via `beach` and `beachName` URL params.
- **Infinite render loop in onboarding HomeBeachStep:** Fixed "Maximum update depth exceeded" error caused by three concurrent `useDataFetcher` instances cascading state updates. `useDataFetcher` now bails out of the loading state setter when already loading (same-reference return), and `HomeBeachStep` replaces the popular-beaches `useDataFetcher` instance with a plain `useState` + `useEffect` fetch, reducing the component from 3 to 2 hook instances. Updated E2E onboarding spec: heading text assertions, scoped selectors for strict mode compliance, and soft-navigation-aware completion assertion.

### Changed

- **Data fetching consolidation:** Migrated `use-sun-times`, `use-beach-detail-data`, and `useNearbyBeaches` hooks from SWR/React Query to the standard `useDataFetcher` pattern
- **Package rename:** Changed package.json name from `my-v0-project` to `quiver`
- **TypeScript strictness:** Replaced ~60 `@ts-ignore` directives with `@ts-expect-error` (or removed where unnecessary)
- **Build strictness:** Removed `ignoreBuildErrors: true` from `next.config.mjs` — TypeScript errors now block builds
- **useDataFetcher refetch on param change:** Hook now re-fetches when `fetchFn` identity changes, matching React Query/SWR behavior for parameter-driven refetches

### Added

- **Unit test coverage for migrated hooks:** New TDD test suites for `use-sun-times` (6 tests), `use-beach-detail-data` (11 tests), `useNearbyBeaches` (6 tests)
- **Jest CI gate:** Added unit test step with coverage thresholds to `prod-gate.yml` workflow
- **Migration squash strategy:** Documented 374-migration squash recommendation in `supabase/ARCHITECTURE.md`

### Fixed

- **Tide status showing past events:** Surf Call card no longer shows stale "→ Low @ 8:00 AM" when the tide event has already passed; displays phase-only (e.g., "Falling") instead

### Removed

- **SWR dependency:** Removed `swr` package (no longer used by any hook)
- **React Query dependency:** Removed `@tanstack/react-query` package and `ReactQueryProvider` component
- **Root directory cleanup:** Deleted 93 PNG screenshots, 13 orphaned report markdown files, and miscellaneous debris (`console-errors-full.txt`, `capacitor.config.ts.bak`, `beach_bias_model_v1.json`); moved utility scripts to `scripts/`
- **Dead code sweep:** Removed unused `AdjustedForecastDisplay` component and its test (408 lines)
- **Dead scripts:** Removed unused standalone scripts (`ml-stats.ts`, `validate-cameras.ts`)
- **Dead dependencies:** Removed `@capacitor/browser`, `@types/pg`, and `pg` from package.json
- **Dead exports:** Removed ~120 unused exported functions, constants, and re-exports across actions, lib, hooks, and services — reducing public API surface without changing runtime behavior

### Added

- **Git workflow documentation:** Created `docs/GIT_WORKFLOW.md` formalizing the two-branch model (`main` → `prod`), feature branch conventions, hotfix process, and branch hygiene rules
- **Prod CI gate:** Added `.github/workflows/prod-gate.yml` — PRs targeting `prod` now require TypeScript check, lint, build, and Playwright smoke tests to pass before merging
- **Stale branch cleanup:** Deleted ~29 abandoned remote branches, reducing remote branch count to just `main` and `prod`

### Fixed

- **Shadow scoring candidate health check:** Fixed `deployToFly()` in the retrain cron route to poll the health endpoint for `candidate_loaded === true` and `candidate_version` match when deploying in candidate mode, instead of returning `{ success: true }` immediately. Shadow scoring candidates were being set as secrets on Fly.io but never verified as loaded, causing them to accumulate 0 shadow predictions and fail promotion after 48h.

- **Tide "Unknown" status on home screen:** Deduplicated `tide_forecasts` rows by hour in `fetchCachedTides()` — multiple cron runs were inserting 3 rows per hour at different seconds, creating plateaus that broke `TideExtremaDetector` extrema detection and caused `getTideStatusAtTime()` to return "Unknown" instead of "Rising"/"Falling"

- **Tide "Unknown" in conditions ticker:** Frontend now filters "Unknown" from tide status display — shows just the height when available (e.g., "0.6 ft" instead of "Unknown 0.6 ft"), or omits the tide card entirely when neither status nor height is meaningful

### Changed

- **"Tomorrow" headline wording:** Updated `buildHeadlineText()` prefixes from "Tomorrow at..." to "Skip today — tomorrow at..." to give context about why today isn't the recommendation

### Fixed

- **E2E forecast-tabs test selectors:** Fixed 3 failing Playwright tests (`should display metric cards`, `should display swell information`, `should display tide-related text`) by scoping text locators to the active tabpanel. The tests were calling `.first()` on page-wide text searches and matching elements inside `ConditionsTicker`'s CSS-hidden `ticker-static-track` (rendered as `display: none`) before reaching the visible forecast cards.

- **CI lint/type errors:** Fixed 13 pre-existing lint errors and 1 TypeScript error to enable strict prod-gate CI checks (removed `continue-on-error` from typecheck and lint jobs)

- **`get_yesterday_accuracy` sentinel filter:** Changed `AND p.observed_m IS NOT NULL` to `AND p.observed_m > 0` in the SQL function so that sentinel values (`-1.00`, used to mark ongoing/unmatched predictions) are excluded from accuracy calculations. Previously, beaches with many sentinels (e.g. Upper Trestles had 165 sentinels vs 40 valid obs) would report negative `avg_observed_m` and inflated error metrics. Migration: `20260222120000_fix_yesterday_accuracy_sentinel_filter.sql`.

- **ML pipeline sentinel filtering (6 locations):** Changed `observed_m IS NOT NULL` to `observed_m > 0` across the entire ML pipeline to exclude sentinel values (`-1`). `get_ml_weekly_metrics()` had inflated `with_ground_truth` counts and deflated `pct_improved`; `check_ml_drift()` included sentinels in previous-week AVG; `check-drift/route.ts` and `promote-candidate/route.ts` included sentinels in improvement calculations; `ml-stats.ts` produced NaN from sentinel rows; `validate_model.sql` had same count inflation. Migration: `20260222130000_fix_sentinel_filtering_ml_functions.sql`.

- **Discovery scoring false alarms:** Suppressed 3.7k false `subscore_tideFit -> 50` Sentry errors from discovery scoring skip results where subscores are intentionally absent for scorers that did not run

- **Google OAuth on mobile (Capacitor):** Replaced browser-based OAuth (broken by Chrome Custom Tabs blocking 302 redirects to custom URL schemes) with native Google Sign-In via `@capgo/capacitor-social-login`. The app now uses the OS-level Google account picker and `signInWithIdToken` — no browser, no redirect, no deep linking needed for OAuth.

- **Android Google Sign-In fails after account selection:** The `@capgo/capacitor-social-login` plugin's `GoogleProvider.java` rejected the entire login when the Authorization API (access token step) failed, even though only the idToken is needed. Applied a `patch-package` patch to fall back to idToken-only when the access token step fails or returns null. Also added raw error message to Sentry extras for native sign-in diagnostics. Note: the patch (`patches/@capgo+capacitor-social-login+8.3.5.patch`) must be re-evaluated when upgrading the plugin.

### Changed

- **Landing page hero polish:** conditions ticker now says "Current conditions nearby" instead of showing a random beach name, hero title uses `text-balance` for even word wrapping, removed em dash from subtitle, and aligned search bar icon/text positioning between placeholder and loaded cmdk states

### Fixed

- **NPC forecast bot — 9 bug fixes across `forecast-formatter.ts` and `template-hydration.ts`:**
  - **Beach disambiguation (Bug 1):** Replaced `REGIONAL_SEARCH_TERMS` with `REGIONAL_BEACHES` (includes `city` field) and updated `fetchRegionalForecast` / `getRegionalBeachId` to filter by both name AND city, preventing Ocean Beach SD from appearing in NorCal reports.
  - **Wind descriptions with offshore/onshore awareness (Bugs 2 & 7):** Rewrote `describeWindForForecast` and `describeConditionsBriefly` to use `classifyWindDirection` from `lib/utils/wind-classification`. Offshore winds get enthusiastic copy; onshore gets honest descriptors with speed-appropriate intensity.
  - **Tide double AM/PM suffix (Bug 3):** Rewrote `formatTideInfo` to parse "HH:MM AM/PM" DB format correctly — no longer appends a redundant am/pm after the existing suffix.
  - **Tide type from DB (Bug 4):** `formatTideInfo` now accepts and uses `tideType` (High/Low) and `tideAt` (timestamptz) parameters; defaults to "Low" only when type is absent.
  - **Water temp — parse DB text (Bug 5):** Replaced random `getDefaultWaterTemp()` with `parseWaterTemp()` (parses "57°F" text) and `getSeasonalWaterTemp()` (deterministic monthly averages per region).
  - **Water temp in template-hydration (Bug 6):** `fetchSurfConditions` now selects `water_temp` from `enhanced_forecasts` and parses it; deterministic fallback of 64°F replaces `62 + Math.random() * 8`.
  - **Opening tone logic (Bug 7):** `generateRegionalForecast` now selects "waking up to" / "showing" / "at" based on wind classification and speed.
  - **SELECT columns (Bug 8):** `fetchRegionalForecast` now selects `wind_direction_deg`, `next_tide_type`, `next_tide_height`, `next_tide_at`, `water_temp` from `enhanced_forecasts` and `wind_offshore_deg` from `beaches`.
  - **Remove deprecated `forecast_time` filter (Bug 9):** Removed `.gte('forecast_time', '05:00:00').lte('forecast_time', '08:00:00')` — the `forecast_at` range already handles the time window.

- **E2E self-cleaning intel post tests:** `e2e/input-validation.spec.ts` and `e2e/api/intel.spec.ts` now track IDs of successfully created intel posts and soft-delete them (`is_active = false`) in a `test.afterAll` hook using the Supabase service role client, rather than relying solely on global teardown.

- **Nearby Surf Spots "All levels" bug:** Added `skill_level` to the `get_nearby_beaches` RPC return columns so nearby beach cards display actual skill levels instead of "All levels" for every card.
- **SD beach skill ratings:** Corrected skill levels for Ocean Beach Pier (→ advanced), Swami's (→ advanced), and Avalanche (→ intermediate-advanced).
- **QuickStats skill level formatting:** Fixed `formatSkillLevel` in QuickStats to properly title-case compound hyphenated values (e.g., "intermediate-advanced" → "Intermediate-Advanced" instead of "Intermediate-advanced").

### Removed

- **Duplicate 5-Day Outlook section:** Removed the card-style "5-Day Outlook" section (mini forecast cards + collapsible forecast table) from the Today sub-tab in `ForecastTab`. The `HorizonStrip` at the top of the tab already provides the N-Day Outlook, making the section redundant. Deleted the now-orphaned `DetailedSwellModal` component and its tests.

### Fixed

- **E2E tests updated for PublicContentGate:** Replaced stale assertions against the deleted `SurfCallSignInCTA` component in `e2e/guest-spot-surf-report.spec.ts` and `e2e/auth-spot-surf-report.spec.ts`. Guest tests now verify the `PublicContentGate` CTA heading ("See Today's Best Window") and "Sign Up Free" button are visible, and that clicking the button opens a modal (not navigates to `/auth/sign-in`). Auth test now asserts that the gate heading and button are absent for authenticated users.

- **CDIP buoy station assignments:** Corrected 10 San Diego beaches that were incorrectly resolving to CDIP 201 (Scripps Nearshore) via haversine nearest-station. Mission Beach / Ocean Beach area (6 beaches) now uses CDIP 220 (Mission Bay West); Sunset Cliffs area (4 beaches) now uses CDIP 191 (Point Loma South). Also added optional `cdipStationOverride` parameter to `DataSourceManager.fetchBuoyObservationWithFallback()` for code path consistency with `enhanced-forecast-service.ts`.

- **E2E selector bugs:** Fixed "Use Near Me" button selector mismatch across 4 tests in `e2e/map.spec.ts` and `e2e/map-use-near-me.spec.ts` — updated from `/Near Me/i` to `/use near me/i` to match the exact "Use Near Me" button text rendered by `MapSearchHeader`. Removed `isVisibleSafe + test.skip` guards wrapping the button checks, replacing them with `await expect(nearMeButton).toBeVisible()` so failures are reported correctly. Removed now-unused `isVisibleSafe` import from `map-use-near-me.spec.ts`.

- **E2E silent skip in dev-validation:** Replaced `test.skip(true, 'No beach cards found...')` in the "Clicking beach card navigates to detail" test with `throw new Error(...)` — the test runs in authenticated context where `[data-testid="beach-card"]` and `a[href*="/california/"]` selectors should always resolve.

- **E2E silent skip in map-coordinate-validation:** Replaced `test.skip(true, 'Coordinate validation test encountered an error...')` in `coordinate validation prevents invalid data entry` with `throw new Error(...)` — a JS page evaluation error is a real failure, not an environment limitation.

- **E2E test skip reasons:** Replaced 16 generic `'Beach input not found - UI may have changed'` skip messages in `e2e/session-wizard.spec.ts` and `e2e/session-wizard-autofill.spec.ts` with specific descriptions matching the actual condition checked (e.g., `'Rating fields not found on step 4'`, `'Submit button not found on last wizard step'`, `'Date/time inputs not found on step 2'`, `'Previous/cancel button not visible'`).

- **E2E defensive skips removed:** Removed all `if (!found) { test.skip(true, '...'); return; }` guard patterns from `e2e/session-wizard.spec.ts` and `e2e/session-wizard-autofill.spec.ts`. Replaced with `await expect(element).toBeVisible()` assertions that fail loudly. Fixed the rating-field selector in "should have rating fields for logged sessions" — `RatingInput` renders star `<button>` elements with `aria-label="Rate X as Y out of 5"`, not `input[type="range"]` or `data-testid*="rating"`. Removed a silent post-submission skip in the "persist all condition fields" test that masked submission failures.

- **E2E silent console.log+return patterns:** Converted ~14 `console.log('...'); return;` patterns across `e2e/map.spec.ts`, `e2e/map-coordinate-validation.spec.ts`, `e2e/map-use-near-me.spec.ts`, `e2e/dev-validation.spec.ts`, and `e2e/guest-landing.spec.ts` to `test.skip(true, 'reason'); return;` so Playwright reports them as skipped rather than silently passing green.

### Added

- **Surf call conditions gating:** Blurred best window, wave height, wind, tide, and why sentence behind a `PublicContentGate` sign-up CTA for unauthenticated users on the Today's/Tomorrow's Surf Call card. Verdict badge, heading, updated time, and confidence badge remain visible to all users. Removed the obsolete `SurfCallSignInCTA` inline link (replaced by the gate).

- **Forecast unit tests:** Added 61 new tests for `batch-beach-processor.ts` (DeadlineTracker, batch config loading, batch processing) and `data-source-manager.ts` (service delegation, data source accessors, wave/tide/weather fetching).

- **Personalization API mocks:** New `e2e/fixtures/personalization-mocks.ts` provides `setupPersonalizationMocks(page)` for E2E tests — intercepts 4 personalization API endpoints via `page.route()` so tests run in any environment without seeded data.

### Changed

- **Jest coverage thresholds:** Added `coverageThreshold` to `jest.config.js` (lines: 54%, statements: 54%, functions: 61%, branches: 72%) to prevent silent regression. Removed `collectCoverage: true` from default config so `yarn test:unit` runs fast (~4s vs ~180s).

- **Personalization E2E tests:** Refactored all 3 personalization specs (`personalization-scores`, `personalization-activation`, `personalized-insights`) from `test.skip()` on non-local environments to API mocking via `page.route()`. Tests now verify real UI behavior in any environment (42 passing, 10 fixme for deleted component).

### Fixed

- **E2E selector:** Fixed `familiarity-badge` -> `affinity-badge` in `personalization-helpers.ts` (3 occurrences).

- **E2E selector:** Fixed brittle XPath `contains(@class, 'bg-white')` in surf style card test — matched 2 elements (`bg-white/80` and `bg-white/10`). Now targets `backdrop-blur` ancestor with `.first()`.

- **Error detection comments:** Clarified why `error-detection.ts` suppresses generic Chrome 500 console messages — they're de-duplicated, not ignored (network error reporter still catches 500s with full URLs).

### Fixed

- **E2E tests:** Fixed assertion-less tests and silent error swallowing across 3 spec files. `e2e/personalization-scores.spec.ts`: added `expect(activeTag).toBeTruthy()` to keyboard navigation test and added `expect(badgeClasses).toBeTruthy()` plus computed outline-style assertion to focus states test. `e2e/beach-detail/yesterdays-accuracy.spec.ts`: replaced 3 `Promise.race([card.waitFor().catch(() => {}), waitForTimeout()])` blocks with direct `isVisibleSafe(card, { timeout: 5000 })` calls; added missing `isVisibleSafe` import. `e2e/home/header-animations.spec.ts`: replaced 2 `expect(heroLoading).not.toBeVisible().catch(() => {})` assertion-as-wait patterns with `heroLoading.waitFor({ state: 'hidden' }).catch(() => {})` (wait mechanism, not assertion); added missing `isVisibleSafe` import.

- **E2E tests:** Replaced 8 `expect(true).toBe(true)` antipatterns across `e2e/discover.spec.ts`, `e2e/api/user-profile.spec.ts`, `e2e/session-wizard-autofill.spec.ts`, and `e2e/coast-pulse-infinite-scroll.spec.ts` with real assertions (`toBeVisible`, `toBeDefined`) or `throw new Error('Not implemented: ...')` per project convention for unimplemented features.

### Added

- **`lib/formatters/surf-data.ts`:** New single source of truth for all surf data formatting. Exports `formatWaveHeight` (integer-rounded range string, "Flat" for non-positive), `formatWindSpeed` (rounded integer + " mph"), `formatSwellPeriod` (rounded integer + "s"), `formatTideHeight` (1 decimal + "ft"), and `formatWaterTemp` (rounded integer + "°F").

### Changed

- **surf-data.ts formatter hardening:** Added `Number.isFinite` guards to all 5 formatters (`formatWaveHeight`, `formatWindSpeed`, `formatSwellPeriod`, `formatTideHeight`, `formatWaterTemp`) returning safe fallback strings (`'Flat'`, `'-- mph'`, `'--s'`, `'--ft'`, `'--°F'`) for NaN/Infinity inputs. Added corresponding test cases for all guards.

- **`forecast-builder.ts` period formatting:** Removed 3 private `formatPeriodSeconds` closures that used decimal rounding (`Math.round(num * 10) / 10`). Replaced with import of the canonical `formatPeriodSeconds` from `lib/services/forecast/format-utils.ts`, which delegates to `formatSwellPeriod` (integer rounding). Updated the stale integration test expectation (`"13.1s"` → `"13s"`).

- **Missed formatter migrations:** Migrated 5 files that were not updated in the initial refactor: `components/buoy/tides-display.tsx` (2 inline tide heights → `formatTideHeight`), `components/intel/conditions-intel-card.tsx` (tide height `toFixed(1)` → `formatTideHeight`), `components/beach-detail/tabs/forecast-tab.tsx` (dynamic tide height → `formatTideHeight`), `components/ui/check-in-display.tsx` (raw `wind_speed` → `formatWindSpeed`), `components/journal/journal-view.tsx` (`Math.round(mph)` → `formatWindSpeed`).

- **`forecast-digest-service.ts` wind formatting:** Replaced 6 inline `${Math.round(windSpeed)} mph` template literals in natural-language reason strings with `formatWindSpeed(windSpeed)`.

- **`coast-pulse-formatter.ts` double-rounding fix:** Removed outer `Math.round()` from `formatWindSpeed(Math.round(conditions.wind_speed * 1.151))` — `formatWindSpeed` already rounds internally.

- **`surf-data.ts` doc comment:** Updated `formatWaveHeight` JSDoc to accurately describe its implementation (uses `Math.round` and `SET_WAVE_VARIANCE` directly; no delegation to `formatWaveHeightRangeString`).

- **Tide height formatting:** Migrated all inline tide height display to `formatTideHeight()` from `@/lib/formatters/surf-data`. Replaced `.toFixed(1) + "ft"` patterns and the manual `Math.round(x * 10) / 10}ft` equivalent across `components/forecast/tide-hourly-table.tsx` (3 occurrences), `components/forecast/tide-chart-recharts.tsx` (Now-line label), `components/forecast/tide-chart/TideTooltip.tsx`, `components/forecast/tide-next-extreme.tsx` (4 occurrences across card, compact, and row variants), `components/intent/seven-day-tide-table.tsx` (3 occurrences), `components/intent/beach-tide-cards.tsx`, and `components/ui/tide-timing.tsx`. Chart Y-axis `tickFormatter` and diagnostic `.toFixed(2)` usages intentionally preserved.

- **Swell period formatting:** Migrated all inline swell period display to `formatSwellPeriod()` from `@/lib/formatters/surf-data`. Replaced `{day.period.toFixed(0)}s` in `components/forecast/horizon-strip.tsx`, `{event.period.toFixed(0)}s` in `components/forecast/swell-event-card.tsx`, the inline `` `${num}s` `` template in the `formatPeriod` helper in `components/ui/wave-period-display.tsx`, and the final return in `lib/services/forecast/format-utils.ts` `formatPeriodSeconds` (validation logic preserved, delegation added).

- **Wave height formatting:** Migrated all inline wave height display formatting to `formatWaveHeight()` from `@/lib/formatters/surf-data`. Affected files: `components/landing-page/surf-spot-card.tsx` (removed `Math.round(waveHeight)}ft`), `components/map/sidebar-beach-card.tsx` (replaced local `formatCompactWaveHeight` body), `components/forecast/best-right-now.tsx` (removed template literal), `components/forecast/adjusted-forecast-display.tsx` (all raw/adjusted wave display strings), `lib/utils/surf-call-logic.ts` (too-small wave height fallback string).

- **Water temperature formatting:** Migrated all inline water temperature display to `formatWaterTemp()` from `@/lib/formatters/surf-data`. Replaced `Math.round(tempF)}°F` and `${tempF}°F` patterns in `lib/utils/coast-pulse-formatter.ts` (fallback buoy message path, via aliased import `formatWaterTempSimple`), `lib/services/forecast/forecast-builder.ts` (IOOS and NDBC priority paths, and `estimateWaterTemperature`). Removed duplicate local `formatWaterTemp` implementation from `lib/utils/wetsuit-utils.ts`, replacing it with a re-export from `@/lib/formatters/surf-data`. Migrated `{forecastData.water_temp}°F` in `components/session-forms/ConditionsSection.tsx` and `formatConditionValue(checkIn.water_temp, "°F")` in `components/ui/check-in-display.tsx`.

- **Wind speed formatting:** Migrated all inline wind speed display to `formatWindSpeed()` from `@/lib/formatters/surf-data`. In `lib/utils/coast-pulse-formatter.ts`, replaced the knot-based `${conditions.wind_speed}kt` display in `formatIntelMessage` with `formatWindSpeed(Math.round(conditions.wind_speed * 1.151))` (knots-to-mph conversion), and replaced `${Math.round(windSpeed)}mph` patterns in `formatForecastConditions` (onshore, cross-shore, and fallback branches). In `lib/analyzers/wind-analyzer.ts`, replaced all six `${wind.speed} mph` template literals in `analyzeWindConditions` with `formatWindSpeed(wind.speed)`.

### Removed

- **Landing page:** Removed "Best conditions right now" card grid section — ticker remains.
- **Dead code:** Deleted `actions/forecast/get-best-conditions-today.ts` — consumed only by the now-deleted `BestConditionsSection` component, zero live references remaining.

### Fixed

- **Tide height display (`surf-call-logic`, `spot-surf-report`):** Added `tideHeight` field (formatted as e.g. `"2.3ft"`) to `TideData`, `SurfCallResult`, and all `getWindowTide` return paths. `spot-surf-report.tsx` now renders `"Rising 2.3ft"` when next-tide-event data is unavailable but a current height reading exists, instead of just `"Rising"`. All 85 existing `surf-call-logic` tests continue to pass with no changes to test expectations.

- **Embed chart (wind bars):** Wind histogram bars now span the full chart width instead of being compressed to the left ~1/6. Switched visible range sync from logical (index-based) to time-based, so charts with different data densities (smoothed wave vs raw wind) share the same time window. Added an invisible anchor series with dense time points to the wind chart so the crosshair snaps to fine-grained positions instead of nearest hourly bar.

- **cam-resolve security hardening:** Added `redirect: "manual"` to both the primary page fetch and the HDRelay config fetch to prevent SSRF via open redirects; both return 502 if a redirect response is received. Added domain validation requiring HDRelay `servers.hls` to be a `*.hdrelay.com` hostname before constructing the HLS URL. Added a 64 KB size guard on the HDRelay config body (read as text, then `JSON.parse`). Extracted `HDRELAY_CONFIG_BASE` constant and reformatted `ALLOWED_RESOLVE_HOSTS` as multi-line. Made `HDRELAY_PLAYER_RE` case-insensitive for UUID hex digits (`[0-9a-fA-F-]`). Added explanatory comment on `kind: "hdontap"` reuse in `cam-embed.ts`. Test suite updated to use `text()` mock on HDRelay config responses and covers all new security paths.

- **Ocean Beach Pier camera (HDRelay):** Added HDRelay provider support so the OB Hotel webcam at `obhotel.com` resolves to its HLS stream. `buildCamEmbed` now detects `obhotel.com` and returns `hdontap` kind (reusing the same resolution UI flow). `HDRELAY_PLAYER_RE` regex added to `cam-constants.ts` to extract the player ID from page HTML. `/api/cam-resolve` allowlists `obhotel.com`, skips the `/embed/` pathname rewrite for non-HDOnTap hosts, and falls back to a two-step HDRelay resolution (scrape player ID → fetch `manage.hdrelay.com/player/{id}` config → construct HLS URL from `servers.hls` + `camera` fields) when no HDOnTap stream URL is found in the page.

- **Embed chart (data-transform):** Hoisted `windowStartMs` and exported `LOOKBACK_HOURS = 6` constant in `data-transform.ts` so the lookback boundary is defined once and reusable in tests. Updated JSDoc to reflect `[now - 6h, now + timeRangeHours]` window. Fixed `"excludes forecasts older than 6h lookback"` test (was using a 1h-past timestamp that now falls inside the lookback window; moved to 7h past) and added `"includes forecasts within 6h lookback window"` boundary test.
- **Embed chart:** Surf Terminal embed charts now show 6 hours of historical data before the "Now" marker instead of starting blank.
- **Cardiff Reef camera:** Added `portal.hdontap.com` support to cam-embed and cam-resolve pipeline so portal-hosted HDOnTap streams resolve correctly. Added unit test coverage for `portal.hdontap.com` in `cam-embed.test.ts` (buildCamEmbed returns `hdontap` kind) and `cam-resolve.test.ts` (allowlist passes, no `/embed/` suffix appended).
- **Dashboard skill:** Clarified Vercel Analytics API calls in `dashboard.md` — the 6 queries use `overview` + `timeseries` (with 4 `groupBy` variants), not separate endpoint names like `/path` or `/referrer` that don't exist.
- **Service role leak:** Landing page components (`BestConditionsSection`, `LandingConditionsTicker`) were importing `getTopBeachesRightNow` directly, pulling `createSupabaseServiceRoleClient` into the client bundle. Switched to `getTopBeachesNow` server action.
- **Embed impressions:** `/api/embed-impressions` now accepts all four widget types (`tides`, `conditions`, `surf-terminal`, `ticker`) — was rejecting the two new types added by the DB migration.
- **E2E tests:** Removed duplicate `test.describe` block in `location-pages.spec.ts`.

### Changed

- **Surf Terminal embed:** Chart x-axis now displays beach local time instead of UTC. Added `utcToLocalChartTimestamp` / `localChartTimestampToUtc` helpers in `data-transform.ts` that encode local wall-clock time as fake-UTC seconds (the format lightweight-charts expects). The "Now" marker and click handler both use the same conversion so forecast lookups remain accurate.
- **Surf Terminal embed:** Chart lines (wave height, tide, ML-corrected height, swell period) are now smooth curves rendered via cosine interpolation (`smoothSeries`). Wind histogram bars are intentionally excluded from smoothing.

- **Map Navigation:** Fixed mobile map beach card "View Details" being a dead link when `get_nearby_beaches` RPC didn't return `slug`/`city`/`state`. Applied missing DB migration and switched all beach URL generation from `getBeachUrlSafe` to `getBeachHrefSafe` for graceful fallback across map card, marker clicks, sidebar nav, hub map, nearby chips, and beach cards.
- **ML Deployment:** Fixed Fly.io model deployment silently failing because GraphQL `setSecrets` doesn't override machine-level env vars. Replaced with Machines REST API (`POST /machines/{id}`) that directly updates machine config. Created shared `lib/services/fly-deploy.ts` utility used by both retrain and promote-candidate cron routes.
- **ML Deployment (promote-candidate):** Standardized to use `createServiceRoleClient()`, `validateCronRequest()`, and static imports — was using raw `createClient` and inline auth checks inconsistent with codebase patterns.
- **ML Deployment (fly-deploy):** Added defensive validation for Fly API responses, terminal machine state filtering, error logging in catch blocks, and nullish coalescing for timeout defaults.

### Added

- `ConditionsTicker` auto-scroll: replaced static horizontal scroll with a dual-track CSS marquee using a new `animate-ticker-scroll` utility (30s `waveFlow` loop). Hover pauses animation via `group-hover:[animation-play-state:paused]`. `prefers-reduced-motion` users see a scrollable static track instead (`ticker-static-track` / `ticker-animated-track` CSS classes in `globals.css`).
- `ConditionsTicker` repositioned on beach detail page: moved above the surf report slot (just below `BeachHeroCompact`) so conditions are visible at the top of the page without scrolling; spacing updated from `mb-6` to `mb-4`.
- `ConditionsTicker` in-app component (`components/conditions/conditions-ticker.tsx`): reusable at-a-glance conditions strip showing waves, swell, wind, water temp, and tide with Lucide icons, dark/light theme support, loading skeleton, and ARIA labels
- `ConditionsData` shared type (`types/conditions.ts`) and `forecastToConditionsData` mapper (`lib/mappers/conditions-mappers.ts`) for converting `EnhancedForecastEntity` to ticker-compatible shape; embed widgets re-export aliases for backward compat
- `buildConditionsCards` pure function (`lib/utils/conditions-card-builder.ts`) extracted from embed ticker — returns data objects instead of JSX for testability
- Home screen conditions ticker for home beach (dark theme, `useDataFetcher` pattern)
- Landing page conditions ticker showing top-scored beach conditions (light theme)
- 45 tests across 6 suites covering card builder, ticker component, and all three integration points

### Removed

- Dead code cleanup: deleted `TodaysForecast`, `FallbackForecastDisplay`, and `ConditionsSnapshot` components plus their test files (5 files, zero real imports)

### Changed

- Rebuilt mobile map to AllTrails-style bottom sheet pattern: selected beach card now renders inside the Vaul drawer (same DOM tree = reliable mobile taps), marker taps snap sheet to 40% showing detail card, map canvas taps deselect, X button on card deselects; removed `createPortal` approach and debug coordinate popup; desktop sidebar + auto-navigation unchanged
- Test suite hardening: removed global console suppression, added eslint-plugin-jest/playwright, deployed error detection to 67 E2E specs, eliminated .catch(() => false) patterns, replaced waitForTimeout with semantic waits
- Fixed 13 failing test suites (63 tests) exposed by test hardening: migrated console mock conflicts to `expectConsoleErrors()`, updated stale selectors ("Sign Up" → "Get Started", SEO templates), fixed Supabase mock chains (`.lte()` → `.lt()`), added `.then()` for fire-and-forget mock patterns
- Extracted `resolveForecastTime` and `localDateTimeToUTC` to shared `lib/utils/forecast-time-resolver.ts`; `toForecastForScoring()` now accepts optional `beachTz` parameter for timezone-aware forecast time resolution
- **Forecast Timezone Fix:** Fixed `prepareForecasts()` and `toForecastForScoring()` treating `forecast_time` (local time) as UTC — introduced timezone-aware heuristic that detects legacy local-as-UTC encoding and converts correctly

### Added

- Scrolling surf ticker embed widget at `/embed/ticker/[slug]`: horizontal stock-ticker–style strip showing waves, swell, wind, water temp, and tide data; CSS keyframe scroll with hover-pause, `prefers-reduced-motion` static fallback, light/dark theme, and `utm_campaign=ticker` attribution link
- 3-way intel voting system: `intel_votes` table with `helpful`/`off`/`confirmed` types, cached counters on `intel_posts`, trigger-maintained counts, trust-weighted report auto-hide, and time-decayed ranking RPC (`rank_score`)
- `IntelVoteButtons` component (`components/intel/intel-vote-buttons.tsx`): shared 3-button voting row (Helpful / Off / Confirmed) with optimistic toggle logic and `getVoteConfidenceBadge` confidence badge
- `ReportDialog` component (`components/intel/report-dialog.tsx`): structured report dialog with radio-group reason selection (spam, harassment, dangerous, false_info, other) and optional details field
- `POST/DELETE /api/intel/[id]/vote` API routes for casting, changing, and removing votes
- `voteOnIntelPost` / `removeIntelVote` server actions with XP awards on first vote
- 131 new tests: 72 unit (confidence badges, Zod schemas, server actions), 19 integration (API route), 40 E2E (vote/confirm/report contract tests)

### Changed

- Removed `as any` cast in `intel-tab-simple.tsx` optimistic vote update — `IntelPostWithUser` already declares all spread fields as optional so the object literal satisfies the type without a cast
- Removed `(supabase as any)` casts in `app/api/intel/[id]/report/route.ts` — `intel_reports` is now present in `types/database.generated.ts` so direct typed access works
- Added post-ID guard in `intel_votes` realtime subscription handler: vote events for posts outside the current feed are silently skipped, reducing unnecessary refetches (`postsRef` pattern avoids re-subscribing)
- Documented the check-then-insert pattern in `intel-vote-actions.ts` with a comment explaining why it is safe: the UNIQUE constraint provides a data-integrity safety net and the UI `isVoting` guard prevents double-clicks
- Replaced all `(supabase as any)` casts in intel voting API routes with a typed `fromIntelVotes` helper (`lib/supabase/intel-votes-query.ts`) that isolates the single `as any` escape hatch at the `.from()` call boundary, with a `TODO: remove after type regen` comment
- Replaced all `(post as any).field` casts in `intel-feed.tsx`, `beach-intel-section.tsx`, and `intel-post-modal.tsx` with direct `post.field` access — `IntelPostWithUser` already declared `user_vote_type`, `helpful_count`, `off_count`, and `confirmed_count` as optional fields
- Updated `intel-confirm.test.ts` mock chains to match the refactored confirm route (no longer returns `confirmation_id`, uses `confirmed_count` from unified `selectIntelVoteCounts` helper)
- Updated `intel-visibility.test.ts` vote mock to include `vote_type: "confirmed"` so `user_confirmed` propagates correctly through the votes map

### Fixed

- `voteOnIntelPost` / `removeIntelVote`: removed `setTimeout(100ms)` delays that waited for DB triggers — UI optimistic updates make the delay unnecessary latency
- `voteOnIntelPost` / `removeIntelVote`: added UUID validation via `uuidSchema` before any auth or DB calls, returning `"Invalid intel post ID"` for malformed input
- `voteOnIntelPost` / `removeIntelVote`: refactored to use `withAuthenticatedAction` wrapper from `lib/server-action-utils.ts` (removes manual `supabase.auth.getUser()` calls)
- `voteOnIntelPost`: XP is now only awarded on first votes with type `"helpful"` or `"confirmed"` — `"off"` votes no longer trigger XP credits
- `confirmIntelPost` / `removeIntelPostConfirmation`: replaced `result.data!` non-null assertions with `result.data?.confirmed_count ?? 0` optional chaining

- `IntelVoteButtons`: added `aria-label` attributes to all three vote buttons with toggle-aware text ("Mark as helpful" / "Remove helpful vote", etc.) for screen reader accessibility
- `getVoteConfidenceBadge` (`lib/constants/intel.ts`): removed unreachable duplicate `if (total === 0)` branch — merged into single terminal return
- `ReportDialog`: empty catch block now logs via `console.error` for debuggability; toast message preserved
- `get_nearby_intel_posts` RPC (`20260218120200_update_intel_ranking_rpc.sql`): clamped `rank_score` numerator to `GREATEST(0, ...)` so heavily-downvoted posts never score below zero-engagement posts
- `update_intel_vote_counts` trigger (`20260218120000_add_intel_voting_schema.sql`): added `SECURITY DEFINER` comment explaining why the trigger owner context is required to bypass RLS for counter updates on non-owned posts
- `POST /api/intel`: enriched response now includes `user_vote_type: null`, `helpful_count: 0`, `off_count: 0`, `confirmed_count: 0` so newly created posts have the same shape as GET results

### Changed

- `IntelFeed` / `IntelFeedCard`: replaced single confirm button with `IntelVoteButtons` + kebab dropdown (Report); prop renamed `onConfirm` → `onVote` with new `IntelVoteType | null` signature
- `IntelPostModal`: replaced confirm button + confirmations count with `IntelVoteButtons`; added Report kebab menu; prop renamed `onConfirm` → `onVote`
- `BeachIntelSection` / `IntelPostCard`: migrated from `confirmIntelPost` / `removeIntelPostConfirmation` to `voteOnIntelPost` / `removeIntelVote`; updated optimistic state to include `user_vote_type`, `helpful_count`, `off_count`, `confirmed_count`
- `IntelTabSimple`: migrated confirm handler to vote handler using `voteOnIntelPost` / `removeIntelVote`
- `IntelMap`: migrated confirm handler to vote handler
- `CoastPulse`: hardcoded report reason changed from freeform string to structured `"spam"` enum value matching `IntelReportSchemaV2`

- `FooterSection`: removed dead `FooterLink` wrapper (external branch was unreachable — all `FOOTER_LINKS` entries are internal routes); replaced usages with `Link` directly; removed `"use client"` directive, making the component a server component
- `BeachBreadcrumb`: replaced trailing-space-prone template literal className with `cn()` utility
- Breadcrumbs: beach detail pages now show `Home › State › City › Beach` (USA) / `Home › City › Beach` (international) instead of `← Back to Map`
- Breadcrumbs: city browse pages now show `Home › United States › State › City` instead of `← Back to Map`
- Breadcrumbs: city browse standard and editorial layouts now derive country/state labels and URLs from `params.country` instead of hardcoding "United States" and `/beaches/usa`; Mexico pages now render "Mexico" with correct `/beaches/mexico/...` paths; breadcrumb separator `<span>` elements now carry `aria-hidden="true"`
- Footer: extracted shared `FOOTER_LINKS` to `lib/constants/footer-links.ts`, removed 4 dead `#` links and 1 duplicate from landing footer
- Follow-up refactoring pass after dead code cleanup: removed dead `getViolationStatistics` function from `lib/monitoring/rate-limit-telemetry.ts` (was module-private and never called); stripped stale commented-out code blocks (deferred Sentry/analytics TODOs) from the same file; updated `docs/API_MIDDLEWARE.md`, `docs/API_MIDDLEWARE_REFERENCE.md`, `docs/REFACTORING_PROGRESS.md`, and `docs/DESIGN_PRINCIPLES.md` to remove references to deleted exports (`withAuthAndRateLimit`, `withFullProtection`, `ENHANCED_ANIMATIONS`)

### Removed

- Dead code cleanup: deleted 11 unused shadcn/ui component wrappers (`context-menu`, `hover-card`, `menubar`, `navigation-menu`, `resizable`, `input-otp`, `pagination`, `particle-background`, `toggle-group`, `carousel`, `kpi-tile`), 6 dead library/component files (`use-home-data`, `daily-best-window-email`, `heads-up-alert-email`, `ForecastQuickEmail`, `board-matching`, `landing-page-server`), and 23 dead scripts from `scripts/`
- Removed 10 unused npm dependencies: `@radix-ui/react-context-menu`, `@radix-ui/react-hover-card`, `@radix-ui/react-menubar`, `@radix-ui/react-navigation-menu`, `@radix-ui/react-toggle-group`, `react-resizable-panels`, `input-otp`, `embla-carousel-react`, `@capacitor/status-bar`, `@resvg/resvg-js`
- Dead export cleanup: removed unused `export` keywords and deleted entirely dead exports across 18 files — `requireAdminOrThrow`, `isAdminFromCookie`, `clearViolationTracking`, `logRateLimitSuccess`, `getRateLimitMetrics`, `shouldBlockRequest`, `getBlockedBotPatterns`, `getAllowedBotPatterns`, `generateCitySummary`, `generateCityFAQ`, `withAuthAndRateLimit`, `withFullProtection`, `ENHANCED_ANIMATIONS`, `QUIVER_MOTION`, `PHASE2_ANIMATIONS`, `IOOS_REGIONAL_SERVERS`, `MILESTONE_ORDER`, `VALIDATION_MESSAGES`, `BOARD_WAVE_MATCHING`; demoted to module-private: `getAllCitiesWithBeaches`, `requireAdmin`, `getViolationStatistics`, `HUB_REGIONS`, `ENHANCED_SHARD_SCHEDULES`, `SLUG_TO_STATE`, `VALID_STATE_SLUGS`, `REGIONAL_DATA`, `logger`; migrated `getBeachAccuracy`/`getSessionForecastSnapshots` callers to canonical `getBeachForecastAccuracy`/`getBeachSessionSnapshots` and removed aliases; removed `metersToFeet` alias in favor of `metersToFeetString`

### Added

- `BreadcrumbList` JSON-LD structured data on city browse pages for SERP breadcrumb display
- "More Surf Tools" cross-link section on `/cams` hub (forecast, beaches, best-time-to-surf)
- Footer links to `/for-businesses` and `/for-surf-schools` (previously zero inbound links)
- Intent page conversion upgrade: CTA repositioned above map with intent-specific copy, new data-driven "Today's Plan" module replacing static focus pills, interactive `MiniLogTeaser` session preview, shareable `SmartChecklist` with copy/share buttons, and `getIntentForecastSummary()` server action powering forecast data for longboard, least-crowded, dawn-patrol, sunset, and water-temp intent pages
- Auth-gated `TodaysIntentPlan`: converted to client component; logged-out users see best-window times locked/blurred with a signup CTA that opens `UnifiedAuthModal`; after login, component auto-scrolls back to `#todays-plan` via sessionStorage flag; tracks `plan_unlock_click` event per intent

### Fixed

- Removed VideoObject JSON-LD schema from `/cams` listing pages to fix Google Search Console "not on a watch page" warnings — these are category pages, not dedicated video watch pages
- Increased CDIP staleness threshold from 1.5h to 4h -- the hourly CDIP cron doesn't reliably update every beach every cycle, causing 11 CDIP beaches (including Blacks, Oceanside Pier, PB Point) to show empty forecast states

### Removed

- Dropped `_backup_beach_timezones_pr_hi` backup table (no longer needed after timezone migration)
- Dropped dead profile columns: `favorite_spot`, `favorite_spot_id`, `home_beach_ids`, `secondary_beaches` (replaced by `home_beach_id` and `favorite_beaches` table)
- Dropped `sessions.profile_id` column (redundant with `user_id`); rewrote RLS policies to use `user_id`

### Performance

- Migrated 8 scoring and utility files to use `forecast_at` timestamptz column instead of legacy `forecast_date` + `forecast_time` columns, eliminating timezone double-conversion bug that caused 8-hour shift in tide data
  - `forecast-snapshot-utils.ts`: Updated Supabase query to use `forecast_at` range filter (`.gte()` + `.lt()`) and `.order('forecast_at')`, with timestamp-based closest-forecast matching

### Fixed

- **ML Pipeline Stability** - Adaptive validation gates with named constants (min 30 samples per bucket, 0.10m degradation limit, 0.5m bias limit). Exponential decay sample weighting replaces binary step function. Shadow scoring pipeline: candidate models run in parallel for 24h before promotion. Auto-rollback with 7-day cooldown prevents oscillation. 502 retry logic for Fly.io cold starts. Training diagnostics logged as structured JSON. New `/ping` health endpoint with `min_machines_running=1` to prevent timeouts.
- **Android Capacitor Auth Redirect** - Native app users with expired session cookies are now redirected to `/auth/sign-in` instead of landing on the marketing home page. New `NativeAuthGuard` component handles cold start, app resume, and mid-session expiry scenarios. Web users unaffected.
- **Auth Utils LocalStorage Safety** - Refactored all `localStorage` calls in `lib/auth/auth-utils.ts` to use safe storage wrappers (`safeGetItem`, `safeSetItem`, `safeRemoveItem`) from `lib/utils/safe-storage.ts`. Prevents crashes in restricted environments (Safari private mode, SSR, disabled cookies) for globally mounted components like `NativeAuthGuard`.

### Changed

- **Live Cam in Hero Area** - Beach pages with a camera now show the live cam player in the hero slot (replacing the photo gallery), making it immediately visible on page load. Photos remain in the Overview tab gallery. Cam card links from `/cams` now navigate to the beach page directly instead of the non-existent `?tab=cams`. Eliminated duplicate `/api/beaches/{id}/sources` fetch by passing sources as a prop to `CamsSection`.

### Added

- **Yesterday's Accuracy Card** -- Trust signal on Forecast tab showing predicted vs actual wave heights from IOOS buoy observations:
  - `YesterdaysAccuracyCard` component with predicted/actual (ft), accuracy %, color-coded progress bar, observation count
  - `get_yesterday_accuracy()` RPC function with smart display logic (hidden when error > 1.5ft AND > 40% relative, or waves < 1ft)
  - `swell_windows_overlap()` function for angular overlap computation with 0/360 wraparound handling
  - Expanded `observable_beaches` from ~45 to ~100 beaches via combined nearest_beach_id + spatial proximity (10km) with swell compatibility
  - `get_beach_observation_station()` helper for backfill spatial lookup
  - Updated backfill-observations cron with spatial fallback and station lookup cache for newly-covered beaches
  - Optimized SQL: O(1) swell overlap (was O(360) loop), range-based index filter for accuracy queries, JOINs replacing correlated subqueries, capped relative error at 999%

- **Visitor-to-Signup Conversion Uplift** -- Comprehensive conversion optimization across beach pages:
  - Glassmorphic match score teaser card with IntersectionObserver view tracking (replaces dashed pill)
  - Contextual AppHeader CTA text ("Get Your Match" on beach pages, "Full Forecast" on forecast pages)
  - StickySignupBar on beach detail pages with frosted glass design (mobile-only, 150px scroll threshold)
  - Redesigned forecast gates: horizon strip inline card with day name teaser, outlook card with CalendarDays icon
  - PublicContentGate: added `ctaButtonText` prop, replaced Lock with Sparkles icon, updated social proof tagline
  - InlineSignupCta: premium card redesign with "Know Before You Go" copy, single CTA button
  - Landing page navbar: added "Get Started" frosted pill button alongside subtle "Log in" text link
  - Contextual auth modal: `contextMessage` prop on UnifiedAuthModal for trigger-specific titles/descriptions
- **California Surfer Search Query Map** - Comprehensive query research document at `docs/plans/2026-02-14-surfer-search-query-map.md` mapping the full California surfer search landscape by customer journey stage, with competitive gap analysis and priority matrix for SEO targeting.
- **Product Marketing Context Documentation** - Formalized product-marketing-context.md with customer personas (The Daily Checker, The Beginner, The Explorer, The Optimizer, The Planner, The Switcher) and P0/P1/P2 keyword priorities based on Quiver's competitive advantages (ML forecasts, crowd intel, Best Surf Window, session tracking).
- **Social Interaction Tracking** -- 6 new event types (`social_follow`, `social_like`, `social_share`, `social_invite_send`, `social_invite_respond`, `social_intel_confirm`), new hooks (`use-session-like.ts`, `use-user-follow.ts`), share sheet tracking
- **IOOS Pipeline Safe Deactivation** -- 3-consecutive-miss tracking with 50% safety cap prevents premature station deactivation from incomplete ERDDAP results
- **Growth Metrics Framework** -- `docs/GROWTH_METRICS_FRAMEWORK.md` with WASL north star, AARRR metrics, unified `/dashboard` command

### Changed

- **Improved Internal Linking to `/best-time-to-surf/[city]` Pages** -- Added conditional "Best Time to Surf in {City}" links across intent pages (beginner, tide, generic intents), beach detail pages, city hub pages (editorial + standard layouts), and added "Continue Exploring" section to best-time-to-surf pages. Links only appear when city has 3+ beaches with `best_months` data (via `getBestTimeToSurfUrl` utility). Eliminates broken links and improves SEO discoverability
- Added internal linking for `/best-time-to-surf` pages (site footer + city hub cross-links) to improve indexation
- Consolidated Puerto Rico `/pr/rinc-n` redirect chain from 2-hop to single-hop 301
- Realigned SEO metadata to lead with data richness (surf reports, forecasts, ML-powered conditions) instead of community messaging
- Replaced "session windows" with "best surf windows" across beach and city page metadata
- Updated intent page titles to match high-volume search queries (e.g., "Best Beginner Surf Spots", "Least Crowded", "Best Time to Surf")
- Removed anti-signup language ("no paywall", "no sign-up", "no subscription") from cams pages and metadata
- Updated root layout, structured data, and FAQ schema to match new data-richness positioning
- **Forecast Timestamptz Migration** -- Migrated `enhanced_forecasts` from `forecast_date` + `forecast_time` (text) to `forecast_at` (timestamptz). 50+ source files, 52 test files. Eliminates 8-hour tide shift bug. Adapter at `lib/utils/forecast-at-adapter.ts`. (Migrations: 20260214130000, 20260214130100, 20260214180000)

### Added

- **Sentry Cron Monitoring for Forecast Pipeline** - Primary forecast cron (enhanced shard 0) reports check-ins to Sentry. If Vercel cron scheduling stops (e.g. during rapid deployments), Sentry will alert within the expected schedule window. Utility at `lib/monitoring/sentry-cron.ts`. (Reduced from 7 monitors to 1 to fit free-tier limit; shards 1-3, CDIP sync, and forecast refresh monitors removed.)
- **Deep Health Check Endpoint** - `/api/health?deep=true` calls `checkForecastHealth()` to return full pipeline status: database connectivity, enhanced forecast coverage/freshness, per-source health for all 5 pipelines (enhanced, marine, tide, sun, IOOS), and issues list. Returns 200 for healthy/degraded, 503 for critical. Default shallow check unchanged.
- **Service Health CI Workflow** - Hourly GitHub Actions workflow (`.github/workflows/service-health.yml`) runs shallow + deep health checks against production using only `curl`/`python3` (~30s). Reports coverage, issues, and pipeline status in step summary. Fails on critical status.
- **Service Health Playwright Tests** - New `e2e/guest-service-health.spec.ts` with smoke tests validating forecast pipeline health, featured beaches data, and beach page wave data rendering. Extended `e2e/api/health.spec.ts` with deep check contract tests.
- **Lighthouse CI Schedule + Health Step** - Added 6-hourly scheduled runs and a service health check step between deployment verification and smoke tests. Annotates warnings for degraded/critical status.
- **Quick Log Mode** - Streamlined 2-step session logging flow via `/sessions/new?mode=log&quick=true`. Step 1 combines beach, date/time, and duration selection. Step 2 is a simplified star rating with optional notes. Pre-fills today's date and morning/afternoon time. Skips post-submission feedback and review modals for faster completion.
- **Personalization Progress Card** - Gradient card on the home screen (between Top Spots and 7-Day Outlook) that shows the user's personalization journey stage: Getting Started (0 sessions), Learning (1-4 sessions), or Fully Personalized (5+ with learned prefs). Includes progress bar, contextual copy, intel prompt for low-activity users, and CTA. Auto-hides when activeLayers >= 3 and learnedConfidence > 0.8. Dismissible with 7-day localStorage cooldown.
- **First Session CTA on Home Screen** - Zero-session users now see a dedicated activation card in place of PrimaryActions, encouraging them to log their first session with a one-tap quick-log flow.
- **Personalization Milestone Toasts** - Home screen now delivers styled Sonner toasts for unshown personalization milestones (max 2 per visit with staggered delay).
- **Personalization Context Line (Hero)** - Hero recommendation now shows a subtle explanation line (e.g., "Tuned to your session history") when the recommendation is personalized, using `getPersonalizationExplanation` from the shared messaging utility.
- **Match Score Education Tooltip** - One-time popover on `PersonalizedBadge` explains what the match score means and that it improves with logged sessions. Auto-dismisses after 8 seconds, stored in localStorage.
- **Community Intel Social Proof** - Intel tab header shows real-time social proof (e.g., "3 surfers confirmed conditions today" or "Updated 2h ago by [name]") based on posts from the last 24 hours.

### Fixed

- **Sentry Cron Monitor Timeout for Forecast Shards** - Fixed missing `completeCronCheckIn` calls in early-return paths of `enhanced-forecast-sync/_shared.ts`. Added `Sentry.flush(2000)` after check-in completions. (Cron monitoring now limited to shard 0 only; CDIP and forecast-refresh monitors removed.)
- **Discovery Stale-Data Fallback** - When all forecast data is stale (e.g., cron pipeline hasn't run), discovery now falls back to serving stale forecasts instead of returning an empty "No surf recommendations" screen. Logs a `[STALE_FALLBACK]` error for internal alerting. `usingStaleData` flag added to response metadata for monitoring.
- **Discover Endpoint Timeout & Silent Failure** - Added `maxDuration = 30` export to prevent Vercel from killing the function at default timeout. Enforced `DEFAULT_OVERALL_TIMEOUT_MS` via `Promise.race` (was declared but never used). Changed catch block to re-throw errors so `withAuth` returns a proper 500 instead of a misleading 200 with empty recommendations.
- **Milestones Rate Limiter Crash (Production Down)** - Fixed invalid `authAware: true` (boolean) in milestones route rate limit config that caused `getCachedRateLimiter(undefined, undefined)` to throw, triggering fail-closed 503 responses on every request. Replaced with `{ key: "authenticated-default" }`. Added runtime guard in `withRateLimit` to catch boolean `authAware` misconfiguration at startup.
- **Growth Metrics Seed Account Filter** - All growth dashboard queries now exclude `@example.invalid` seeded demo accounts (created 2026-02-05) that were inflating WAU from 25 to 1, WASL from 22 to 0, and D7 retention from 92.3% to 0%. Baselines in `docs/GROWTH_METRICS_FRAMEWORK.md` updated with real user data.
- **ML Pipeline Stability** - Adaptive validation gates with named constants (min 30 samples per bucket, 0.10m degradation limit, 0.5m bias limit). Exponential decay sample weighting replaces binary step function. Shadow scoring pipeline: candidate models run in parallel for 24h before promotion. Auto-rollback with 7-day cooldown prevents oscillation. 502 retry logic for Fly.io cold starts. Training diagnostics logged as structured JSON. New `/ping` health endpoint with `min_machines_running=1` to prevent timeouts.
- **Android Capacitor Auth Redirect** - Native app users with expired session cookies are now redirected to `/auth/sign-in` instead of landing on the marketing home page. New `NativeAuthGuard` component handles cold start, app resume, and mid-session expiry scenarios. Web users unaffected.
- **Auth Utils LocalStorage Safety** - Refactored all `localStorage` calls in `lib/auth/auth-utils.ts` to use safe storage wrappers (`safeGetItem`, `safeSetItem`, `safeRemoveItem`) from `lib/utils/safe-storage.ts`. Prevents crashes in restricted environments (Safari private mode, SSR, disabled cookies) for globally mounted components like `NativeAuthGuard`.
- **Map Page Infinite Loop** -- Unstable `useEffect` dependencies caused map init to re-fire on every render, triggering ~2,462 requests over 51 minutes. Fixed with refs for callbacks and stable dependency arrays.

### Changed

- **Live Cam in Hero Area** - Beach pages with a camera now show the live cam player in the hero slot (replacing the photo gallery), making it immediately visible on page load. Photos remain in the Overview tab gallery. Cam card links from `/cams` now navigate to the beach page directly instead of the non-existent `?tab=cams`. Eliminated duplicate `/api/beaches/{id}/sources` fetch by passing sources as a prop to `CamsSection`.

### Added

- **Beach Coordinate Snapping Script** - New `scripts/snap-beaches-to-coastline.ts` utility that verifies beach coordinates using Mapbox reverse geocoding and generates SQL migration files for beaches with significant deviations (>50m). Supports dry-run mode, verbose logging, and limit flag for testing. Rate-limited to respect Mapbox API limits.
- **ChunkLoadError Auto-Reload** - Global handler that detects stale JS chunk errors after Vercel deployments and auto-reloads the page (max 2 retries per session) to fetch fresh assets. New `chunk_load` error category in error boundaries.
- **HLS Live Cam Player** - New `HLSVideoPlayer` component with `hls.js` for inline playback of HLS (.m3u8) streams. Enables 6 existing Surfchex East Coast cams that previously couldn't render. Native Safari HLS support, dynamic code-split hls.js for Chrome/Firefox.
- **HLS Proxy for Surfline Streams** - Server-side proxy at `/api/hls-proxy/[...path]` bypasses Surfline's CORS restrictions. Strict hostname whitelist (SSRF prevention), rate-limited, with structured monitoring logs for bandwidth tracking. Replaced 3 dead SurfOutlook camera URLs with Surfline HLS streams (Blacks, Tourmaline, C-Street) and added 4 new Surfline cams (Windansea, Sunset Cliffs).
- **Content Gravity: Enriched Nearby Beaches** - Beach detail pages now show enriched `SurfSpotCard` components (with score badges, wave heights, photos) instead of plain text links for nearby spots. Horizontal scroll on mobile, responsive grid on desktop. IntersectionObserver-based engagement tracking.
- **Content Gravity: Best Conditions Right Now (Homepage)** - New landing page section above featured highlights showing the top 6 highest-scored beaches with live conditions, wave heights, and photos. Skeleton loading state, graceful null fallback.
- **Content Gravity: Partial Community Content for Guests** - Beach detail Reviews, Intel, and Sessions tabs now show 2-3 real items of content to unauthenticated visitors before a gradient fade + sign-up CTA, replacing the full blur lockout that caused high bounce rates. New `PartialContentGate` component with IntersectionObserver-based analytics tracking. Lock icons removed from tab labels.
- **Content Gravity: Engagement Tracking** - Dual-fire analytics utility (`lib/analytics/engagement-tracking.ts`) sends events to both GA4 and Vercel Analytics. Tracks nearby beach clicks/views, best conditions clicks/views, and partial gate views/signups. New `/engagement-metrics` skill for querying feature CTR and bounce rate trends.
- **Grouped Region Cards on /forecast** - Regional forecast cards are now organized into California, Pacific, East Coast, and International sections instead of a flat grid.
- **Local "Best Near You" Leaderboard** - "Best Right Now" section on /forecast now filters to the user's closest region when location is available, showing "Best Near You" heading.
- **Closest Region Hero** - Hero card shows the user's closest region (by distance) instead of the highest-scoring nearby region.
- **Shared Region Groups** - Extracted `REGION_GROUPS` constant to `lib/data/region-groups.ts` for use by both the landing page navbar and forecast hub.
- **Fallback Observability** - New `trackFallback()` utility in `lib/monitoring/` that tracks when silent fallback values are substituted for missing data. Instruments ~15 critical locations (wave height, tide, confidence score, synthetic data generators) with structured Sentry alerts for dangerous/high severity and breadcrumbs for low/medium. Server-side tracking now persists events to `fallback_events` table via lazy-initialized Supabase admin client (fire-and-forget). Zero user-facing changes.
- **HDOnTap HLS Stream Resolution** - HDOnTap cams now play inline via server-side HLS URL extraction (`/api/cam-resolve`). HDOnTap blocks all iframe embedding (X-Frame-Options: DENY), so the resolver fetches the embed page server-side, extracts the signed HLS stream URL, and feeds it to the HLS player. ~20 HDOnTap cams now stream live in-site.
- **52 New Surf Cameras** - Populated camera URLs for 52 beaches across CA, HI, OR, TX, FL, NC, NJ, SC, and ME using HDOnTap, YouTube Live, SurfOutlook, and Surfchex HLS sources. Total camera coverage: 39 → 91 of 279 beaches (33%).
- **Internal Link Density in SEO Content** - City and state listing pages now render beach/city names as internal links in auto-generated summaries and FAQs. New `RichContent` type system with `RichContentRenderer` component and `linkFirstMentions()` utility. Backward-compatible — original plain-text generators unchanged.
- **Embed Widget Promotion Pages** - New `/for-surf-schools` and `/for-businesses` pages promoting free embed widgets. Dark hero with mock browser preview, 3-column value props, interactive embed generator with beach selector and widget type toggle, copy-to-clipboard code block, and ocean gradient CTA. Added to sitemap.
- **Surf Cam Directory Pages** - New `/cams` hub page and `/cams/[region]` regional pages showcasing 91 free live surf cams across 8 regions. Cards link to beach detail pages with LIVE badges. Includes VideoObject schema, breadcrumb structured data, region quick-nav, nearby regions cross-linking, and sitemap entries. Competitive moat against Surfline's paywall.
- **Surf Cam OG Images & Share Button** - New `/api/og/cams` Edge route generates 1200x630 OG images for cam pages (default and region-specific variants with query params). Added `CamsShareButton` client component to `/cams` page with native Web Share API support and clipboard fallback. Both hub and regional pages now include proper OG image metadata.

### Fixed

- **Tide Chart Missing Past Data** - Tide chart on `/tide/[city]` pages now draws the full curve including past hours before the "Now" marker. Previously the line started at "Now" because the data query only fetched future data, leaving the chart's 20% backward-looking window empty. The 7-Day Tide Schedule table still correctly shows 7 days starting from today.
- **Session Timing Editorial Copy** - Removed references to non-existent features ("marine layer burn-off", "crowd meter") from San Diego city landing page cards. Replaced with accurate copy referencing forecast data and crowd intel posts.
- **PR/HI Broken Redirects** - Added 33-entry static redirect map for old compound beach slugs (e.g., `marias-rincon-pr` → `/pr/rincon/marias`) that were 404ing after migration 20260211060000. Extended `/pr/rinc-n` diacritic redirect to handle subpaths.
- **SEO Meta Tags for PR/HI** - Beach titles now include break type and expanded state names (PR → Puerto Rico, HI → Hawaii) when wave data is unavailable. City listing titles include top beach names. Fixed a/an grammar before vowel-starting skill levels. Added description excerpt support for richer SERP snippets.
- **Least-Crowded Intent Wording** - Changed "Near" to "in" in least-crowded page titles and descriptions for accuracy.
- **HLS Live Cam Playback** - Surfline HLS cams (Blacks, Tourmaline, etc.) now play correctly on Chrome/macOS. Root cause: `canPlayType("application/vnd.apple.mpegurl")` returns `"maybe"` on Chrome macOS, causing the player to take the unreliable native HLS path instead of hls.js. Fixed by preferring hls.js when `Hls.isSupported()`, falling back to native only on iOS Safari.
- HLS video player no longer silently disappears on error; shows visible error fallback with camera-off icon
- "Open cam" button hidden for HLS streams (previously linked to raw .m3u8 files that aren't browser-navigable)
- Added `.catch()` on hls.js dynamic import to prevent silent failures when module fails to load
- Added loading spinner during HLS player initialization
- **Dead Camera Cleanup** - Removed 10 dead/broken camera URLs: C Street (Surfline 404), Folly Beach (dead server), Higgins Beach/Ogunquit/Linda Mar/Ponce Inlet/Short Sands (dead YouTube streams), D Street/Gold Beach (403), La Push (404)
- **Cam-Resolve Security Hardening** - HTTPS-only enforcement, hostname allowlist validation, 512KB response size limit with Content-Length pre-check, extracted URL validation, `DEFAULT_SECURITY_HEADERS` on all response paths, `onError` ref pattern to prevent re-render loops, `viewableUrl` memoized via `useMemo`

### Changed

- **Camera Autoplay** - YouTube embeds now use `autoplay=1` (muted), HDOnTap embeds include `allow: "autoplay; fullscreen"`, direct video elements have `autoPlay`, and default iframes include `allow: "autoplay"`.
- **Camera Embed Reliability** - Removed aggressive 3-second iframe timeout from `CamsSection` that was prematurely showing "Preview unavailable" fallback. Iframes now render immediately and only fall back on actual `onError` events.

### Fixed

- **Camera Embed Preflight Breaking HDOnTap Cams** - Embed preflight HEAD request was checking `X-Frame-Options` on raw camera URLs, but HDOnTap returns `DENY` on raw stream URLs. Now skips preflight for known embeddable sources (HDOnTap, YouTube, Vimeo, HLS, direct video) since `buildCamEmbed` transforms these to proper embed URLs. Also added 3-second timeout to prevent slow servers from blocking API responses.
- **Undefined iframeRef Crash** - Added missing `useRef` declaration in `CamsSection`, preventing runtime crash on beach pages with camera embeds.
- **Cron Auth Fails Open** - `validateCronAuth()` now returns `false` when `CRON_SECRET` is not configured (previously returned `true`, allowing any request through). Vercel-triggered crons unaffected.
- **Hardcoded GA Fallback** - Removed hardcoded `G-JZNX7C7XKL` fallback from both `AnalyticsLoader` and `GoogleAnalytics` components. GA scripts only render when `NEXT_PUBLIC_GA_ID` env var is set.
- **Empty Catch Blocks** - Replaced 14+ empty `.catch(() => {})` and `catch {}` blocks with error logging. Fixed `CompletionCelebration` bug where confetti load failure left user stuck (now redirects to `/profile`).
- **Coordinate Naming Violation** - Renamed `SurfSpot.coordinates.lng` to `.lon` and updated all consumers, plus migrated `Coordinates` interface in `app/api/surf/utils.ts` and `beach-coordinates.ts` dictionary.

### Added

- **Safe localStorage Wrapper** - New `lib/utils/safe-storage.ts` with `safeGetItem`, `safeSetItem`, `safeRemoveItem` to prevent crashes in Safari private mode. Migrated 16 calls across auth-context, profile-context, and use-cached-profile.
- **BeachSummary/BeachMapItem/BeachBasicInfo Types** - Pick-based view types in `types/database.ts` for lightweight beach references. Migrated home-beach actions.
- **Strategic Error Boundaries** - Added `error.tsx` for `[intent]/[city]/[beachSlug]` route, wrapped InteractiveMap with `DataErrorBoundary`, ForecastTab with `DataErrorBoundary`, and SessionWizard with `FormErrorBoundary`.

### Refactored

- **Magic Numbers Extracted** - `EARTH_RADIUS_KM`/`EARTH_RADIUS_MI` now exported from `geo-utils.ts` (eliminated 5 duplicated `6371` literals). Auth timeout `8000` → `AUTH_INIT_TIMEOUT_MS`.
- **Circular Dependencies Broken** - Created `lib/services/beach-query-service.ts` to eliminate 5 `lib/ → actions/` circular imports. Moved `CityMetadata` type to `types/location.ts`.
- **Intel Actions Split** - Split 1,118-line `intel-actions.ts` into `actions/intel/` directory with create, query, confirm modules + shared types.
- **Coast Pulse Service Extraction** - Extracted 1,053-line API route into `lib/services/coast-pulse/` service + types, leaving a 75-line thin handler.
- **API Route Auth Standardization** - Migrated 12 routes total to `withAuth`/`withAdminAuth`/`withBearerAuth` wrappers. New `withAdminAuth` (admin session) and `withBearerAuth` (dual bearer token + admin fallback) wrappers in `lib/middleware/api-wrappers/`.
- **City Page Split** - Split 613-line `page.tsx` into 6 focused modules: utils, metadata, static generation, editorial layout, and standard layout. Core page reduced to 121 LOC (80% reduction).
- **Interactive Map Split** - Split 854-line `interactive-map.tsx` into 5 modules with typed dependency injection interfaces: marker builder, favorites loader, beach loader, cluster renderer. Core reduced to 550 LOC.
- **SessionForm Split** - Split 779-line `SessionForm.tsx` into 6 modules. New shared `buildSessionPayload()` ensures both session creation paths (legacy form + wizard) keep 6 condition fields in sync. 15 unit tests for the shared builder.

### Added

- **Data Fetching Guide** - New `docs/DATA_FETCHING_GUIDE.md` with decision matrix covering all 6 data fetching patterns (useDataFetcher, SWR, TanStack Query, Server Actions, fetch+API, unstable_cache).
- **Test Coverage: HLS, Intel, Coast Pulse** - 117 new tests: HLS proxy (30 tests: SSRF, path traversal, rate limiting), Intel actions (52 tests: CRUD, dedup, confirmations), Coast Pulse service (23 tests: aggregation, pagination, staleness).

### Fixed

- **Bearer Token Validation** - `withBearerAuth` wrapper now uses strict exact-match comparison instead of `.includes()` substring match. Previously, an empty `SUPABASE_SERVICE_ROLE_KEY` env var would grant admin access to any Bearer request.

- **E2E Test: Conditions Tab Hero Text** - Fixed 2 pre-existing forecast-tabs E2E test failures. Tests expected "Best Day This Week" but the hero shows "Selected Day" when a day is auto-selected in the horizon strip. Updated selectors to match both labels. Also increased `beforeEach` timeout to reduce flaky failures from slow forecast data loading.
- **Map Selected Beach Card UI** - Replaced MapPin icons with Star icons for ratings, show actual review count instead of hardcoded "128", show "No reviews" for unrated beaches instead of fake 4-star rating, removed hardcoded "San Diego" location fallback.
- **Forecast Weather Condition Truncation** - Weather conditions like "Partly Cloudy" were truncated to just "Partly" by `.split(" ")[0]`. Now shows the full weather condition string.
- **Map Loading Skeleton** - Restored loading skeleton that was commented out during debugging.
- **Map Wave Height Interpolation** - Beaches without forecast data no longer show "0-1ft". Missing wave heights are now filled from the nearest beach that has data, so the map shows realistic values everywhere.
- **Map Marker Wave Heights Truncated by Row Limit** - Bulk forecast API fetched 12 days of forecasts (~4,700 rows for 50 beaches), exceeding Supabase's 1,000-row default limit. Beaches with later-sorting UUIDs silently lost all forecast data, showing "0-1ft". Replaced with `get_bulk_current_forecasts` RPC that returns exactly 1 row per beach via database-side aggregation.
- **Hawaii & Puerto Rico Beach 404s** - Fixed 31 HI/PR beach slugs that used compound format (`{name}-{city}-{state}`) instead of short slugs expected by routing. All beaches now resolve correctly (e.g. `/hi/honolulu/waikiki-canoes`, `/pr/rincon/domes`).
- **Console 400 Errors on Every Page** - Added `skip: !user` guard to notification count fetcher in AppHeader, preventing unauthenticated API calls that produced 400 errors in the console.
- **React Hydration Mismatch on Beach Pages** - Added `suppressHydrationWarning` to date-formatted elements in forecast-tab, detailed-swell-modal, and todays-forecast components to suppress React error #418 from server/client timezone differences.

### Changed

- **Merge Landing Page Conditions into Surf Spot Cards** - Removed separate "Best Conditions Today" and "Best Right Now" sections from landing page. Enriched existing surf spot photo cards with live forecast score badges and wave heights, sorted by best conditions first. Section title changed to "Top surf spots near {location}".
- **Remove Auth Gate from Map Page** - Removed `<AuthGate block />` from `/map` so unauthenticated users can browse the full map without a login modal or blocking overlay, turning the map into a top-of-funnel acquisition channel. Deleted now-unused `auth-gate.tsx` and `auth-blocking-overlay.tsx` components, removed `isAuthGate` prop from `UnifiedAuthModal`.
- **Extract ForecastSectionContainer Component** (uncommitted) - Created shared `ForecastSectionContainer` to DRY up repeated `<section className="py-10 px-4"><div className="max-w-3xl mx-auto">` wrapper pattern. Updated `BestRightNow` and `ConditionsSnapshot` components to use the new container, preserving existing `data-testid` values and styling.

### Performance

- **Forecast Hub Data Fetching Optimization** (uncommitted) - Refactored `getRegionalSummaries()` to accept optional `beaches` parameter, eliminating wasteful double-fetch when called by `getTopBeachesRightNow()`. Removed internal `getRegionalSummariesWithBeaches()` function. Forecast hub page and best conditions action call without args (fetch internally), top beaches action fetches once and passes to both utilities.

### Added

- **"Best Right Now" Beach Leaderboard** (uncommitted) - Compact ranked list of the top 5 beaches by current forecast score, shown on the landing page (below Conditions Snapshot) and forecast hub (after Best Today hero). New `getTopBeachesRightNow()` utility flattens beach conditions across all regions, enriches with URLs via `getBeachHrefSafe`, and sorts by score. Server action `getTopBeachesNow()` returns a lightweight payload; `BestRightNow` client component uses `useDataFetcher` with skeleton loading. Each row links to the beach page with score badge, wave height, and region name.
- **Homepage Conditions Snapshot** (uncommitted) - "Best Conditions Today" card on the landing page showing live forecast data (region, score, wave range, wind) to anonymous visitors right after the Hero section. Extracted `getRegionalSummaries()` and `getBestRegionToday()` into shared `lib/utils/forecast-hub-utils.ts` for reuse by both `/forecast` hub and homepage. Server action `getBestConditionsToday()` returns a lightweight payload; client component uses `useDataFetcher` with skeleton loading state.
- **10 New Regional Forecasts** (uncommitted) - Added Hawaii, Oregon, Washington, Baja California, Santa Cruz, Ventura & Santa Barbara, Florida, Outer Banks, New York, and New Jersey regional forecasts to `/forecast` hub. Updated metadata keywords to include new regions. Made guide cross-links conditional to only show for regions with hub guides (filters out 5 regions without dedicated guides: northern-california, oregon, washington, baja-california, new-york).
- **Resend Webhook Email Open/Click Tracking** (uncommitted) - Added webhook endpoint at `/api/webhooks/resend` to receive Resend delivery events (delivered, opened, clicked, bounced). All 7 email-sending routes now capture the Resend message ID and store it in `email_send_log`. New columns: `resend_message_id`, `delivered_at`, `opened_at`, `clicked_at`, `bounced_at` with partial index for fast lookups. Svix signature verification, rate limiting, idempotent updates. App-stats skill updated with email engagement metrics (open rate, click rate).
- **Guest Smoke Tests for Lighthouse CI** (uncommitted) - Added `e2e/guest-smoke.spec.ts` with 7 new `@smoke` tests covering features page, map, beach detail, intent state pages, 404 handling, sitemap XML, and OG image endpoint. These run in the `guest` project during CI, matching the Lighthouse-audited URLs that previously had zero Playwright coverage.
- **Conditions Subtab Overhaul** (uncommitted) - Replaced plain forecast table in the Conditions subtab with a rich multi-section view: Best Day Hero with animated score gauge, Other Good Days grid, 12-Day Outlook bar chart (Recharts), and Explore More navigation links. Public mode gates chart/other-days behind `PublicContentGate` while keeping hero visible as teaser.
- **Conditions Alert Email** (uncommitted) - Daily 6:30 AM PT email to users with a home beach when conditions are good (score >= 7/10). Includes score badge, conditions summary, best window, and CTAs to check forecast or log a session. Skips users already active in the app today. Max one email per user per day across all email types.
- **Session Prompt Email** (uncommitted) - Daily 10:00 AM PT "How was your session?" email sent to users whose home beach had good conditions yesterday but who didn't log a session. Nudges toward session logging to build community data.
- **Returning-User Auto-Login Prompt** (uncommitted) - Previously-authenticated users whose sessions expire now see the login modal auto-open when they return to the app, reducing friction compared to showing the cold landing page. Uses persistent `quiver_returning_user` localStorage flag set on first sign-in, with auto-open triggered via `autoOpenLogin` prop flow from ClientApp → LandingPage → Navbar.
- **Beach Page Engagement Quick Wins** (uncommitted) - Moved NearbySpots and RelatedGuidesSection outside tab system to SSR for SEO crawlability, added InlineSignupCta to all beach detail pages for anonymous visitor conversion, added city hub link to RelatedGuidesSection for better internal linking back to city pages.
- **Internal Linking ("Looping") Overhaul** (uncommitted) - Site-wide `SiteFooter` server component (~14 crawlable links on ~35+ pages), shared `ContinueExploring` component replacing 3 hardcoded sidebars (now 8+ cross-links per intent page), `IntentGuidesGrid` with `currentIntent` highlighting on state-level intent pages, intent grid on standard city hubs, and browse links section on forecast hub.
- **Beginner Page Redesign** (`aaaa944d2`) - Phase 1 city content hub with 11 modular components, editorial content DB schema (`city_beginner_editorial`), consolidated 16 state-specific routes into dynamic `[intent]/[city]` route, Framer Motion scroll animations via `SectionFadeUp`, FAQPage + BreadcrumbList structured data, and 15 E2E tests.
- **7-Day Regional Forecast Hub** (`0c06d754e`) - `/forecast` hub landing + `/forecast/[region]` detail pages with animated UI components (score gauge, wave chart, sparkline), forecast outlook on home screen, LA beaches migration, and 34 E2E tests.
- **Tide Intent Page** (uncommitted) - Dedicated `/tide/[city]` pages with `TideHeroSection`, `TideFullChart` (24h/72h/168h tabs), `SevenDayTideTable`, `BeachTideCards`. Server action `getCityTideDataExpanded()` with extrema detection via `TideExtremaDetector`.
- **Conversion CTAs** (`2f745542c`) - `InlineSignupCta` and `StickySignupBar` on programmatic SEO pages for unauthenticated visitors.

- **Slim Onboarding (3 Steps + Payoff)** (uncommitted) - Cut onboarding from 6 steps to 3: Home Beach → Level + Time → "Your Next Best Window" payoff. New `LevelAndTimeStep` combines experience level (2x2 grid) and surf time preference. New `PayoffStep` shows personalized best surf window from daily intel with conditions score, wave/wind details, and XP badge. `saveOnboardingData` now conditionally sets profile fields and uses `preferredTime` for email prefs. Deleted 5 orphaned old step components, cleaned up unused Zod schemas, and added 25 new unit tests for the new steps.

### Fixed

- **Fix Puerto Rico "No Data" on Forecast Hub** (uncommitted) - Fixed batch forecast query silently truncating results due to Supabase PostgREST 1000-row default limit. With ~186 beaches × ~64 rows each, the single query only returned data for the first ~15 beaches (by UUID sort), causing Puerto Rico and other regions to show "No data". Fix chunks beaches into groups of 10 and fetches in parallel, with a truncation canary warning if any chunk hits exactly 1000 rows.
- **Fix San Diego Swell Windows** (uncommitted) - Corrected swell_window_min/max_deg for 24 SD beaches across two migrations using terrain ray-tracing data as ground truth. Phase 1: La Jolla Shores extended NW (peak at 340°, not 270°), Tijuana Sloughs opened to NW (was capped at 270°), Mission Beach Central expanded from 40° to 85° window, Pacific Beach narrowed to match actual W-dominant exposure. Phase 2: Extended NW max for 12 more beaches (Torrey Pines, Trestles, Tamarack, etc.) that were capped at 270° despite strong terrain access to 315°+.
- **Comprehensive Swell Window Audit & Fix** (uncommitted) - Automated swell window derivation via `scripts/derive-swell-windows.ts`. Of 261 beaches with terrain data, updated swell windows for 251 (excluded 5 fully-blocked + 5 narrow-window beaches pending terrain re-analysis). Windows derived from `swell_access_factors` (threshold >= 0.15) using contiguous-bin algorithm with wrap-around handling. Enabled terrain-aware scoring (`terrain_enabled=true`) for 202 additional beaches — previously only 59 CA beaches had terrain scoring.

- **Fix Fallback Antipatterns Masking Bad Data** (uncommitted) - Eliminated ~40 instances where hardcoded fallback values silently masked missing or broken data:
  - **Coordinate safety**: Added NOT NULL + CHECK constraints on `beaches.lat/lon`, removed `?? 0` and `?? 32.7157` (San Diego) fallbacks across 8 files, deprecated hardcoded `beach-coordinates.ts` dictionary
  - **API error honesty**: Bulk forecast API now returns HTTP 500 on DB errors instead of silently returning 200 with empty data; added amber warning banner on beach detail page when forecast data fails to load
  - **Null display integrity**: Created `nullable-display-utils.ts` (displayNumber, displayPercent, hasValue, nullsLast); confidence scores show "—" instead of "0%" when data is missing; review ratings section hidden when no rating exists instead of showing "0 stars (0 reviews)"
  - **Dead code removal**: Removed unused `loadBeachAffinity()` DB query from discovery orchestrator; cache layer now distinguishes errors from empty results via `{ data, cacheError }` pattern
- **Landing Page Local Beaches** (uncommitted) - "Popular surf spots" section now shows nearby beaches when user location is available via IP geolocation. Falls back to global list when location is unavailable or fewer than 4 beaches are within 50 miles. Heading updates to "Popular surf spots near {location}". SSR footer list unchanged for SEO crawlers.

### Changed

- **UI Consistency & Design Debt Cleanup** (uncommitted) - Fixed raw markdown rendering in beach descriptions, auth overlay opacity on map page, raw pathname in auth dialog, empty gallery card showing when no photos. Changed misleading "Near San Diego" heading to "Popular surf spots". Refactored error boundary buttons and loading skeletons to use design system components. Migrated empty states to ZeroState component. Added semantic status color tokens (success/warning/info) to CSS and Tailwind config. Added z-index scale (overlay/toast/auth-wall). Created `docs/STYLE_GUIDE.md`.
- **Code Review Follow-Up Fixes** (uncommitted) - Removed unused `p_cooldown_hours` param from `get_conditions_alert_candidates` and `get_session_prompt_candidates` SQL RPCs; conditions alert CTA now uses canonical hierarchical URLs (`buildBeachUrl()`) instead of legacy `/beach/{slug}`; redacted email addresses from console.log in both email cron handlers (PII compliance); moved `pg`/`@types/pg` to devDependencies; parallelized `getSpotSurfReport` and `getNearbyBeaches` on beach detail pages via `Promise.all`.
- **Supabase SSR Package Upgrade** — Upgraded `@supabase/ssr` from 0.7.0 to 0.8.0 and migrated all cookie handlers from deprecated `get/set/remove` interface to new `getAll/setAll` interface across all server clients (auth routes, API routes, middleware, server components).
- **ML Retrain: Post-Shoaling Data Filter** — Added `--since` arg to `extract_training_data_v2.py` and shoaling change date floor (`2026-02-05`) in automated retrain route to exclude pre-shoaling training data.
- **Region-Aware 7-Day Outlook Link** — Home screen "7-Day Outlook" card now links to the user's regional forecast (e.g. `/forecast/san-diego`) based on top recommendation or home beach city, with fallback to `/forecast`.
- **Intent Pages Design Language** (`4b5d561bf`) - Frosted glass aesthetic with `bg-white/60 backdrop-blur-md`, ocean-tinted borders (`border-blue-100/50`), and `rounded-2xl` across all 7 intent types.
- **Auth Gate Pattern** (`2f9a5f01c`) - Modal-based auth gating replacing blocking overlay for unauthenticated users on beach detail page action buttons.

### Fixed

- **Supabase 1000-Row Truncation Bug in Batch Forecast Cache** (uncommitted) - Fixed critical data loss bug where `getBatchFreshForecastsFromCache()` was silently truncated to first 1000 rows by Supabase PostgREST default limit. With ~186 beaches × ~64 rows each = ~11,900 rows, only the first ~15 beaches (alphabetically by UUID) received forecast data. This caused region