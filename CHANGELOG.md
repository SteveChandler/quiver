### Added

- Post-signup verification modal on `auth/sign-up` using `components/ui/dialog`.

  - In `components/auth/sign-up-form.tsx`, successful signup now shows a modal instructing users to verify their email and provides a CTA to go to `Sign In`.
  - Aligns with `components/ARCHITECTURE.md` UI composition patterns.

- Recommendations v1 scaffold:

  - Pure scorer in `lib/utils/recommendation-scorer.ts` using beach preference fields
  - API `GET /api/v1/recommendations?lat&lon&time` returning nearby ranked spots
  - DB table `spot_feedback` with RLS for user feedback

- Beach Details accordion with three sections following `components/ARCHITECTURE.md` patterns:
  - Spot Overview (default open, persisted via localStorage) showing spot summary, amenities, hazards, surfer reviews, and best-of gallery
  - Local Intel with real-time check-ins, accuracy voting, and Add Your Check-in
  - Forecast & Tides with tide chart, forecast tables, and best times
- New components: `components/beach-detail/spot-overview.tsx`, `components/beach-detail/beach-check-ins.tsx`, `components/beach-detail/forecast-and-tides.tsx`
- New action: `actions/beach-media-actions.ts` for best-of gallery photos (session media by beach)
- New hook: `hooks/use-local-storage-state.ts` to persist UI open/closed state

- SEO baseline setup following App Router patterns (`app/ARCHITECTURE.md`, `components/seo/ARCHITECTURE.md`):
  - `app/robots.ts` with staging-aware noindex handling
  - `app/sitemap.ts` auto-generating sitemap for core routes and dynamic beach pages
  - `lib/seo/meta.ts` helper for DRY page metadata (title, description, canonical, OG/Twitter)
  - Page-level metadata for Map, Plan Session, Log Session; dynamic metadata for Beach and Forecast pages
  - Environment setup for dev→prod flow using Vercel domains and env vars (see below)

### Changed

- Coach Picks UI: visual refresh and desktop width

  - Styled `components/recommendations/coach-card.tsx` with primary-tinted header, subtle gradient, and color-coded score badges (emerald/amber/neutral).
  - Made the Coach Card stretch full width on desktop by changing `components/beach-detail/forecast-and-tides.tsx` to pass `className="w-full"`.
  - Ensured Top Picks list shows unique beaches (no duplicates). Deduplicates by `spotId`/`name` after distance filtering.

- Forecast actions now read from `enhanced_forecasts` with explicit date window; removed dependency on deleted `ten_day_enhanced_forecasts` view to fix runtime errors on beach pages

- Database cleanup: removed legacy `current_enhanced_forecasts` view. New migration `20250817180000_drop_current_enhanced_forecasts_view.sql` drops it; creation statements were deleted from `20250815093000_create_enhanced_forecasts.sql` and script migrations updated. App reads from `ten_day_enhanced_forecasts` or `enhanced_forecasts` only.

- Intel API access: granted `anon` execute on `get_nearby_intel_posts`, `get_beach_reviews`, `get_beach_review_stats`, `get_intel_confirmations` so unauthenticated users can load Local Intel. Added migration `20250817181000_grant_intel_functions_to_anon.sql` and updated `20250817160000_add_intel_api_functions.sql`.

- Consolidated global metadata in `app/layout.tsx` to use `SEO_CONFIG` defaults and standardized title template
- Updated `SEO_CONFIG` Open Graph image to use existing `public/images/buoy.png`
- Converted Vitest-style tests to Jest-compatible mocks for check-in features (`__tests__/setup/vitest-shim.ts` added)
- Stabilized selectors and expectations in SEO-related tests; applied flexible error assertions to session-planner API tests
- SEO structured data now derives domain from `NEXT_PUBLIC_SITE_URL` instead of hardcoded URLs
- Scheduled cron limited to Production deployments only via `vercel.json` (`target: production`)

- Vercel Hobby compliance: changed `vercel.json` cron for `/api/cron/forecasts/refresh` from every 3 hours (`0 */3 * * *`) to daily at 12:00 UTC (`0 12 * * *`). This staggers from the 06:00 UTC enhanced sync and avoids Hobby limit violations.

- UI polish: Added bell icon to Notifications item in avatar dropdown (`components/app-header.tsx`) following `components/ARCHITECTURE.md` icon sizing/spacing patterns.

- Beach page recommendations card now wired with beach context. `app/beach/[id]/page.tsx` passes `beachId`, `lat`, `lon`, and optional `regionId` into `CoachCard`, and sets `key={beach.id}` to prevent reuse across beaches. `components/recommendations/coach-card.tsx` accepts these optional props and includes them in fetch dependencies, following `hooks/ARCHITECTURE.md` `useDataFetcher` pattern.

- Favorites ranking and primary beach behavior:

  - Migration `20250817120000_add_rank_to_favorite_beaches.sql` adds `rank` to `favorite_beaches` and backfills sequential ranks; index on `(user_id, rank)`.
  - `actions/beach/beach-favorite-actions.ts`: favorites now ordered by `rank`; assign rank on add; new `reorderFavoriteBeaches` and `getTopFavoriteBeach` actions.
  - `components/favorite-beaches.tsx`: added Move Up/Down buttons and Save Order to persist ranks.
  - `components/beach-detail.tsx`: displays a Favorite button in quick actions area.
  - `hooks/use-cached-profile.ts`: prefers the top-ranked favorite as `defaultBeach` before legacy `favorite_spot`/`default_beach_id`.

- Added beach-scoped coach picks endpoint and server action:

  - New server function `actions/recommendations/coach-pick-actions.ts#getCoachPicksForBeach` calling RPC `get_coach_picks(_beach_id, _radius_km)` using `withDatabaseOperation`.
  - New API route `GET /api/coach-picks?beachId=<id>&radiusKm=80` returning `{ picks: [...] }` via `createSuccessResponse`.
  - `components/recommendations/coach-card.tsx` now prefers `/api/coach-picks` when `beachId` is provided; falls back to `/api/v1/recommendations?lat&lon` otherwise. Ensures SWR keys include `beachId` semantics and avoids cross-page reuse.

- Home screen Forecast tab now displays normalized face height using `WaveHeightDisplay`, matching Beach Detail. This ensures consistent, calibrated surf height across the app and adds an explanatory tooltip. Follows `components/ARCHITECTURE.md` DRY component usage. Also aligned font sizing with other metrics (consistent `text-lg`).
- KPI tiles on Home screen Forecast tab unified using new `components/ui/kpi-tile.tsx` for consistent centering and baseline alignment. Wave Height tile is now centered like the others, with number+unit kept in a single, non-wrapping row and baseline-aligned. Removes left bias from inline tooltip/icon.
- Beach list cards: rounded review average to one decimal place (e.g., 2.6) and corrected singular/plural review label for readability.
- Forecast refresh: ingest multiple recent CDIP observations and add 12h short‑horizon persistence (cdip_persistence/ndbc_persistence, is_observed=false) to ensure hourly marine coverage without Open‑Meteo.

  - Note: Best Times section on Beach Detail has been temporarily replaced with Coach Pick due to instability.

- Local Intel section on beach pages now uses `components/intel/beach-intel-section.tsx` backed by `/api/intel` and `get_nearby_intel_posts` RPC. Removed check-ins view from this section to surface intel posts, confirmations, and tagging. Followed `hooks/ARCHITECTURE.md` data fetching with `useDataFetcher` via `useIntelData`.

- Local Intel deep link and inline expansion:

  - Beach page supports `?section=intel` (and `#intel`) to auto-open and scroll to the Local Intel section.
  - Added inline “View all” → “Show less” toggle to expand/collapse all intel posts without leaving the page.
  - `components/beach-detail.tsx` reads query/hash via `useSearchParams` and passes `initialShowAll` when `show=all`.
  - `components/intel/beach-intel-section.tsx` now accepts `initialShowAll` and renders all posts when requested.
  - Follows `hooks/ARCHITECTURE.md` data fetching and `components/ARCHITECTURE.md` client-navigation patterns.

- Fixed: `session_invitations` RLS blocked inbox queries by referencing `auth.users`. Replaced with JWT email claim in policies:
  - SELECT: `invitee_id = auth.uid() OR invitee_email = (auth.jwt() ->> 'email')`
  - UPDATE: same USING/WITH CHECK. Migration `20250811153000_fix_session_invitations_rls.sql`.

### Fixed

- Local authentication API route 500 error: changed runtime from `edge` to `force-dynamic` and added async/await for `cookies()` in `app/api/auth/[...supabase]/route.ts` to fix Next.js 15+ compatibility. Local sign-in now works correctly with established patterns.
- Map page no longer fails to show nearby beach forecasts for non-admin users. Made `GET /api/beaches/nearby` public-read (minimal fields) and added a client-side fallback in `components/map/interactive-map.tsx` to filter from `/api/beaches` when needed, restoring Ocean Beach/Mission/Sunset markers and badges.
- Corrected `date-fns-tz` v3 import usage in `app/api/recommendations/morning/route.ts` (`toZonedTime`/`fromZonedTime`), fixing Vercel build import errors
- Resolved Next.js "use server" export violation by exporting a server action function for `getTopFavoriteBeach` in `actions/beach/beach-favorite-actions.ts`

- Coach Picks showing Orange County spots for San Diego beaches: enforced strict 30 km radius.

  - DB: new migration `20250822120000_strict_radius_get_coach_picks.sql` removes region-id bypass; results now require `distance_km <= radius`.
  - UI: `components/recommendations/coach-card.tsx` now filters picks to numeric `distance_km <= 30` only.
  - Tests: added `__tests__/components/recommendations/coach-card.filtering.test.tsx` and `__tests__/api/coach-picks.radius.test.ts`.

- Nearby tab now shows beaches sorted by closest to the user (using `useGeolocation` + `getNearbyBeaches` with `useDataFetcher`). Replaces static ordering and hardcoded location; distances displayed reflect the user's actual position.
- Hide all rating stars for planned sessions on profile and session cards so planned sessions don't display ratings.
- Fixed invariant error on Beach Detail Forecast & Tides: added missing imports in `components/beach-detail/forecast-and-tides.tsx` for `createClient` and `fetchBestTimesApi/fetchBestTimes` following `hooks/ARCHITECTURE.md` and `lib/supabase/ARCHITECTURE.md` patterns.
- Stabilized `ForecastAndTides` hook dependencies: guarded `today` memo for empty forecasts and removed unused `today` from `fetchBest` deps to avoid unnecessary re-renders/refetch loops.
- **React Suspense crash in Beach Details flow**: Fixed React Suspense error (minified React error #460) that occurred when client components used async patterns without proper boundaries:

  - Added Suspense boundary around `BeachDetail` component in `app/beach/[id]/page.tsx` to catch async rendering issues
  - Enhanced data guards in `ForecastAndTides` component to handle null/empty beach data and filter invalid forecast rows
  - Added array validation in `BeachDetail` component to prevent grouping logic errors when forecasts are malformed
  - Confirmed `useLocalStorageState` hook is already SSR-safe with proper `window` existence checks
  - No `use(promise)` patterns found in codebase; all data fetching uses standard React state/effect patterns

- TypeScript fixes across utilities:

  - Migrated `date-fns-tz` imports to v3 API: `toZonedTime`/`fromZonedTime` in `lib/surf/sun.ts` and `lib/time.ts`
  - Resolved enum mismatch in image compression by removing explicit MIME `type` option in `lib/supabase/storage.ts`
  - Guarded analytics calls with `window.gtag` existence check in `lib/utils/performance-utils.ts`
  - Removed unused imports/types and added explicit param typings: `lib/utils/beach-search-utils.ts`, `lib/utils/posts-utils.ts`, `types/intel.ts`, `lib/supabase/api-server-client.ts`, `lib/surf/windows.ts`, `lib/utils/forecast-service-utils.ts`, `lib/utils/forecast-analytics.ts`

- Tide chart extrema plotting fixed in `components/forecast/tide-chart-recharts.tsx`:

  - Normalized hourly/extrema heights to feet with a single helper.
  - Both the line and extrema use the same `yAxisId` and `dataKey` (`h`).
  - Extrema dots now render at their own heights (not tied to line Y/index).
  - Shared Y domain computed from both series with ±0.5 ft padding.
  - Tooltip/labels show feet with one decimal. Follows `components/forecast/ARCHITECTURE.md` Recharts patterns.
  - Added regression test `__tests__/components/forecast/tide-chart-recharts.regression.test.tsx` that renders the real chart under `React.StrictMode` and exercises empty → loaded transitions to catch key/reconciliation issues.

- Tide chart readability on small screens:

  - `components/forecast/tide-chart-recharts.tsx` now uses `useIsMobile()` to adapt layout.
  - Mobile aspect ratio changed to `aspect-[4/3]` (desktop remains `aspect-[8/3]`).
  - Reduced chart margins, smaller tick fonts, fewer Y ticks, and auto-skipped X ticks on mobile.
  - Slightly smaller extrema dots on mobile. Follows `components/forecast/ARCHITECTURE.md` responsive guidance.

- React minified error #460 (Suspense/use promise blocked): Removed inline `Promise.then(...)` rendering in `app/beach/[id]/page.tsx` and moved fetch/await into an async server component `CoachCardSection` wrapped in `Suspense`. This aligns with `app/ARCHITECTURE.md` guidance for async work in server components and eliminates the Suspense crash.

### Added

- Database utility script `scripts/load_beaches_inline.sql` updated to run atomically and dedupe by case-insensitive name, keeping NEW coordinates over existing ones. Adds `country` column if missing and enforces unique index on `lower(name)`. Suitable for Supabase SQL editor.
- Beach preferences formalized via migration `20250809000000_add_beach_preferences.sql`:

  - Columns on `beaches`: `break_type`, `shoreline_aspect_deg`, `swell_window_min_deg`, `swell_window_max_deg`, `wind_offshore_deg`, `wind_offshore_tol_deg`, `wind_cross_shore_ok_kt`, `wind_onshore_bad_kt`, `preferred_tide_ft_min`, `preferred_tide_ft_max`, `skill_level`, `best_swell_cardinals`, `best_wind_cardinals`, `preference_model`
  - New table: `beach_recommendation_calibration` for ongoing calibration rollups
  - Inline loader no longer declares ad‑hoc metadata columns; preference upserts handled in `scripts/load_beaches_with_meta.sql`

- Beach preference backfill and calibration seed:

  - Migration `20250809000010_backfill_beach_preferences.sql` backfills new preference columns for all beaches (no NULLs remaining)
  - Computes aspect, offshore wind, swell window (by break type), wind tolerances, tide range, and `skill_level`; seeds `preference_model`
  - Inserts one `default_seed` row per beach into `beach_recommendation_calibration`
  - Idempotent via COALESCE/existence checks; includes validation preview queries

- Home screen beach search under tabs:

  - New `components/home-screen/beach-search-bar.tsx` centered container below tabs
  - Fuzzy search via `searchBeachesByName` (close matches, abbreviations like OB/PB)
  - Inline error handling: "No beach found. Try again."
  - Forecast tab now accepts `overrideBeach` and updates when a search succeeds

- Mock data scripts for reviews and intel (for lively demo data following `components/beach/ARCHITECTURE.md` and `components/intel/ARCHITECTURE.md` patterns):

  - `scripts/mock-beach-reviews.sql` seeds realistic beach reviews across popular beaches using existing persona profiles; idempotent with unique `(beach_id, user_id)` constraint and randomized ratings/visit dates.
  - `scripts/mock-intel-all-beaches.sql` seeds intel posts across many beaches, with surf condition fields and randomized confirmations; complements existing `scripts/mock-popular-beaches-intel.sql` and `scripts/mock-last-week-community-data.sql`.
  - Both scripts include quick verification queries and are safe to re-run in Supabase SQL editor.

- Supabase migrations for intel and reviews are included and should be applied locally for populated content:
  - `20250817120000_create_intel_and_reviews_tables.sql`
  - `20250817160000_add_intel_api_functions.sql`
  - `20250817130000_seed_mock_users.sql`
  - `20250817140000_seed_intel_posts.sql`
  - `20250817150000_seed_beach_reviews.sql`
  - Optional: `20250817170000_seed_pacific_ocean_beach_data.sql` for PB/OB richness
  - `scripts/mock-solid-snake.sql` seeds the “Solid Snake” persona with a profile, board, planned and completed sessions, follows to Big Boss/Liquid Snake (if present), and two pending invitations for inbox testing; includes verification queries. Idempotent and safe to re-run.

## [2025.08.20] - Morning Recommendations & Forecast Refresh Docs

### Added

- API: `POST /api/recommendations/morning` and `GET /api/recommendations/morning`

  - Local-time aware morning/near-term window calculation (darkness → tomorrow sunrise; else now→min(sunset, horizon))
  - Uses `getBeachesNear`, `getMarineForecastRange`, `getTideForecastRange`, and warms `sun_times` via `getSunTimes`
  - Ranks 2‑hour windows with `topWindowsInRange`; returns top 3 cards via `windowBlurbDetailed`

- New `lib/surf/ARCHITECTURE.md`
  - Documents `data.ts`, `scoring.ts`, `sun.ts`, `windows.ts` and best‑times usage across APIs/UI
- Database: materialized view `mv_beach_hourly_scores`, refresh function, and optional pg_cron schedule (~every 2h)

### Changed

- `app/api/ARCHITECTURE.md` updated with:

  - `/api/recommendations/morning` endpoint details (methods, inputs, logic, outputs, usage)
  - `/api/cron/forecasts/refresh` pipeline (NDBC/CDIP observed + 12h persistence, NOAA tides with CO‑OPS hilo interpolation fallback, SunCalc 5‑day cache)

- `app/ARCHITECTURE.md` updated for `/plan-session`:

  - Geolocation warm call to morning recommendations on mount; default `CoachCard` until user context is available

- `components/home-screen/ARCHITECTURE.md`:

  - Notes background warmup to `POST /api/recommendations/morning` when `useGeo` provides coords

- `components/beach-detail/ARCHITECTURE.md`:

  - Documents Best Times chip UX and “why” factor breakdown from `v_beach_hourly_scores`

- `hooks/ARCHITECTURE.md`:

  - Adds `useGeo` hook entry and aligns naming from `use-geolocation` → `useGeo`

- Morning recommendations UI:
  - Empty state text updated in `components/recommendations/coach-card.tsx` to: "No confident call for tomorrow morning yet. Check full forecast."
  - API now ensures non-overlapping windows and limits candidates to top‑8 nearest beaches before scoring
  - `app/api/ARCHITECTURE.md` updated: cache key, MV preference, non-overlap selection, and pg_cron schedule noted

# Quiver Surf App - Changelog

All notable changes to the Quiver surf app are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Cursor agents for Cursor IDE: Fullstack Engineer and Design Review personas with Playwright MCP integration. Docs at `docs/CURSOR_AGENTS.md`; config at `.cursor/mcp.json`; personas at `.cursor/agents/*`.
- Documentation updates: `ARCHITECTURE.md`, `.cursorrules`, and `CLAUDE.md` now reference Cursor agents and MCP usage.
- Design Principles: New `docs/DESIGN_PRINCIPLES.md` summarizing core principles (simplicity/consistency, DRY, performance, security/privacy, transparency, testing, AI-augmented automation, growth focus).

### Fixed

- Local authentication and seed script FK violations: Updated `scripts/mock-intel-all-beaches.sql` and `scripts/mock-beach-reviews.sql` to use dynamic user lookups instead of hardcoded persona UUIDs, resolving foreign key errors during database seeding.

- Map beach card review count no longer wraps on very small screens. Added responsive class `hidden sm:inline` to the review count text in `components/beach-card.tsx` so rating stays on a single line on devices < 360px.
- Plan Session gear suggestions failing despite user having boards. Root cause: API route used a generic server client that didn't read auth cookies in API context, returning 401 and surfacing a misleading error. Switched to API-route client utilities (`getAuthenticatedAPIClient`) in `app/api/session-planner/gear-suggestions/route.ts`.

### Removed

- Dead code cleanup (minor):
  - Removed `app/plan-session/head.tsx` (App Router metadata handled via `page.tsx`/`generateMetadata`)
  - Removed unused `actions/recommendations/coach-pick-actions.ts` (API route `GET /api/coach-picks` is the single source)

### Changed

- Linked `ARCHITECTURE.md`, `docs/ARCHITECTURE_REVIEW.md`, and `docs/CURSOR_AGENTS.md` to `docs/DESIGN_PRINCIPLES.md`.
- Profile: Updated "Explore beaches" empty-state link to navigate to `/map` instead of `/` in `components/favorite-beaches.tsx`. Added unit test `__tests__/components/favorite-beaches.test.tsx` to verify link target. Follows App Router internal navigation via `next/link` per `app/ARCHITECTURE.md`.
- Development dependencies:
  - Removed unused dev dependency `supabase`
  - Added missing test dev dependencies: `@jest/globals`, `node-mocks-http`

### Added

- Local dev bootstrapping and data ingestion

  - Baseline migrations for core tables: `profiles`, `beaches`, `sessions`, `boards`
  - Seed script `scripts/mock-last-week-sessions-and-intel.sql` to generate 100 realistic sessions and ~30 intel posts across the last 7 days. Sessions are tied to nearest `enhanced_forecasts` rows and updated to `completed` to trigger `session_forecast_snapshots` per `supabase/migrations/028_forecast_calibration_tables.sql`. Safe to re-run; includes verification notices.
  - Forecast tables and uniques: `marine_forecasts`, `tide_forecasts`, `sun_times`
  - Seed migration for mock, numeric-first forecast data (guarded/idempotent)
  - Constraint fix: `sun_times.source` now allows 'computed' to match API behavior
  - Local env wiring: `.env.local` points to Supabase local (127.0.0.1:54321)

- Forecast API usage (documented and verified):

  - `GET /api/forecasts/window?beachId=<uuid>&start=<iso>&end=<iso>` reads normalized window; auto-backfills tides (NOAA) and sun (computed) if missing
  - `GET /api/cron/forecasts/refresh[?beachId=<uuid>]` ingests marine (NDBC→CDIP), tides (NOAA hourly), and sun (computed); accepts `x-vercel-cron: 1` locally or `Authorization: Bearer <CRON_SECRET>`

- Local dataset loading

  - Script run: `load_beaches_with_meta_fixed.sql` (no TRUNCATE) to insert 72 OC/SD/BAJA beaches
  - Added mapping `lat/lon -> latitude/longitude` for API compatibility

- Working application verification

  - Health: `GET /api/health` → healthy
  - Auth: created local user `dev@local.test` (confirmed), created matching `public.profiles` row
  - Home renders; sessions table present (empty by default)

- Database function `public.cardinal_to_deg(text)` to map cardinal directions to degrees; migration `20250812160000_add_cardinal_to_deg_function.sql`.

- API integration tests for `/api/session-planner/gear-suggestions` ensuring auth, validation, and happy-path suggestions for users with boards (`e2e/api-gear-suggestions.spec.ts`).

- Database view `public.v_beach_hourly_scores` to compute per-hour beach suitability score (0–100) based on wind (vs offshore), tide band, and swell window; inputs from `marine_forecasts`, `tide_forecasts`, and `beaches`. Migration `20250812160500_create_v_beach_hourly_scores.sql`.

- RPC `public.get_best_times(p_beach uuid, p_start timestamptz, p_end timestamptz, p_limit int)` to return top 2-hour windows with labels (`epic/good/fair/poor`) based on rolling averages from `v_beach_hourly_scores`. Migration `20250812161000_create_get_best_times.sql`.

- Per-beach scoring weights (`w_wind`, `w_swell`, `w_tide`, `w_period`, `w_height`) stored on `public.beaches` with defaults 0.4/0.4/0.2/0/0, consumed by `v_beach_hourly_scores`. Migration `20250812162000_add_beach_scoring_weights.sql`.

- Updated default weights to wind .30, tide .20, swell .25, period .15, height .10 and backfilled existing rows. Migration `20250812162500_update_beach_scoring_weight_defaults.sql`.

- Materialized view `public.mv_best_times` with hourly pg_cron refresh and API `GET /api/recommendations/best-times` that prefers MV and sets edge cache (s-maxage=600, SWR=300). UI now calls the API first with RPC fallback.

- Integrated Vercel Web Analytics and Speed Insights in `app/layout.tsx` to collect page views and performance metrics in production. Follows App Router root layout pattern documented in `app/ARCHITECTURE.md`.

- Google Analytics (GA4) integration:

  - Added GA script and init via `next/script` in `app/layout.tsx`
  - New `components/analytics/google-analytics.tsx` to track SPA route changes with `usePathname`
  - Uses `NEXT_PUBLIC_GA_ID` with fallback to `G-JZNX7C7XKL`
  - Enables Web Vitals reporting via existing `lib/utils/performance-utils.ts` when `gtag` is present

- Jest coverage reporting configured following repository testing patterns:

  - Enabled coverage collection with V8 provider and reports: text, lcov, json, html
  - Scoped `collectCoverageFrom` to `actions/`, `app/`, `components/`, `context/`, `hooks/`, `lib/`, and `types/` (`*.ts, *.tsx`)
  - Excluded tests, setup/mocks, migrations, and barrel `index` files
  - Added `npm run test:coverage` script
  - Initial baseline after enablement: ~33.7% statements, 45.5% functions, 67.6% branches, 33.7% lines

- New unit tests to raise coverage in high-impact areas:

  - `__tests__/hooks/use-session-forecast.test.ts` (forecast mapping to session time, error/no-data cases)
  - `__tests__/hooks/use-data-fetcher.test.ts` (success, error, refetch/reset, skip toggling)

- Session invitations: in-app activity + email notifications from plan-session tagging
  - Migration `20250810000020_session_invites_prefs_and_constraints.sql` adds: per-invitee uniqueness, `idempotency_key`, expanded status (`revoked`), and profile prefs (`inapp_session_invites`, `email_session_invites`, `digest_session_invites`)
  - Mailer utilities and React email template for Resend
  - Activity feed rendering for `session_invite.created`
  - Profile preferences UI toggles for in-app and email session invites

### Changed

- Cron execution is now Vercel-only. Removed GitHub Actions workflow for enhanced forecast sync and updated cron route auth:

  - Introduced `validateCronRequest(request)` in `lib/api-response-utils.ts` to accept Vercel's `x-vercel-cron` header or a Bearer token (`CRON_SECRET`/`CRON_SECRET_TOKEN`).
  - Updated `app/api/cron/enhanced-forecast-sync/route.ts` and `app/api/cron/smart-forecast-update/route.ts` to use the new validator.
  - Documented invocation/auth in `app/api/ARCHITECTURE.md`.

- Coverage configuration excludes expanded to reduce low-signal noise:

  - Excluded `types/**`, `app/**/page.tsx`, and `app/**/layout.tsx`
  - Resulting coverage after tests and excludes: ~34.8% lines, 46.9% functions, 67.6% branches, 34.8% statements

- Root-level `ARCHITECTURE.md`: Top-level architecture overview and index linking to directory architecture docs and `docs/` references
- Profile page redirect: Users are now automatically redirected to their profile after logging a session
- Architecture documentation for all core directories:
  - `styles/ARCHITECTURE.md` - Global CSS and Tailwind configuration
  - `supabase/ARCHITECTURE.md` - Database migrations and performance optimizations
  - `test-utils/ARCHITECTURE.md` - Testing utilities and navigation helpers
  - `types/ARCHITECTURE.md` - TypeScript type definitions and domain models
- CHANGELOG.md for tracking all project changes
- **Intel Sharing Modal - Surf Conditions Integration**

  - Added surf condition fields to intel sharing modal for "conditions" tag posts
  - Includes wave height, wind speed/direction, water temperature, crowd level
  - Wave type selector with same icons and UI as session logging
  - Forecast accuracy rating with same visual components as check-in form
  - Database migration to support surf condition fields in intel_posts table
  - Updated TypeScript types and backend actions to handle new condition data
  - Fixed wave characteristics layout: removed duplicate label and improved 2x4 grid layout
  - Enhanced button text wrapping to prevent overflow in wave type selector

- Development convenience: `scripts/mock-last-week-community-data.sql` to generate last-week community data

  - Populates `check_ins` across key SD beaches with realistic values and forecast accuracy ratings
  - Adds `intel_posts` condition entries using new surf condition fields (`wave_height`, `wind_speed`, `wind_direction`, `water_temp`, `crowd_level`, `wave_types`, `forecast_accuracy`)
  - Creates confirmations and updates `confirmations_count` for recent intel

- Plan Session E2E test validating save, redirect, and validation behavior

  - Uses Playwright with reasonable load states and flexible checks
  - References established testing guidance

- Sign-up display name collection

  - Added `Display Name` field to `components/auth/sign-up-form.tsx`
  - Extended `context/auth-context.tsx` `signUp` to pass `options.data.full_name` to Supabase
  - Profiles auto-seed `profiles.full_name` from user metadata via existing `createProfile`
  - Updated E2E tests to fill/allow the new field when present

- Password recovery flow

  - New pages: `app/auth/forgot-password/page.tsx` and `app/auth/update-password/page.tsx`
  - Forgot page sends reset link via `supabase.auth.resetPasswordForEmail` with `redirectTo` → `${NEXT_PUBLIC_SITE_URL}/auth/update-password`
  - Update page sets new password using `supabase.auth.updateUser({ password })`

- `POST /api/session-planner/invitations` now respects idempotency, creates activity, and conditionally sends email per user prefs; inviter-based unique constraints dropped in favor of per-invitee uniques
  - Added “Forgot password?” link to `components/auth/sign-in-form.tsx`

### Changed

- Profile Sessions UX: The profile Sessions tab now separates Planned and Completed sections while preserving the existing card look and feel. Planned sessions no longer display overall ratings and instead show the planned board when available. Implementation reuses `SessionCardWrapper`/`SessionCard` per `components/ARCHITECTURE.md` and keeps data fetching via `useDataFetcher`.

### Added

- Context-aware Optimal Times anchored to user-selected time (±2h), with tide/wind/swell-aware scoring and 2-hour block aggregation. Labeled as "Best for Your Session Time" when applicable. Follows `app/ARCHITECTURE.md` API utilities and `hooks/ARCHITECTURE.md` data fetching patterns.

- Normalized forecast storage and ingestion
  - Tables: `marine_forecasts`, `tide_forecasts`, `sun_times` with RLS and indexes
  - Migrations: `20250808000100_create_forecast_tables.sql`, `20250808000110_add_unique_constraints_forecasts.sql`
  - Cron API route: `GET /api/cron/forecasts/refresh` (auth via `Authorization: Bearer CRON_SECRET_TOKEN` with fallback to `CRON_SECRET`)
  - Services: `lib/services/ndbc-service.ts` (NDBC stations + latest obs), `lib/services/noaa-tide-service.ts` (NOAA Tides & Currents hourly predictions), `lib/utils/fetch-utils.ts` (timeout wrapper)
  - UI: `components/forecast/spot-conditions-summary.tsx` and integration on `components/beach-detail.tsx`
  - Actions/Hooks: `actions/forecast/forecast-actions.ts#getForecastWindow`, `hooks/use-beach-forecast.ts`
  - API: `GET /api/forecasts/window` for normalized 24h window (marine/tide/sun) used by Spot Conditions summary

### Changed

- Cron refresh now uses service-role Supabase client to bypass RLS for scheduled upserts
- `vercel.json` includes `/api/cron/forecasts/refresh` every 3h
- Aliased DB `location` to `location_text` in actions selecting beach info
- Open‑Meteo client marked deprecated; ingestion switched to NOAA/NDBC/CDIP pipeline
- NDBC active stations source updated to `ndbcmapstations.json` and robust timestamp parsing for realtime2 files
- NOAA tides `datagetter` begin/end date parameters corrected (YYYYMMDD), with diagnostics on failures
- Beach detail now fetches normalized window via API using `useDataFetcher` (standard pattern) and conditionally renders the Spot Conditions summary; "Today's Overview" remains primary

### Known Issues / Follow-ups

- Initial Open‑Meteo marine/tide calls returned 0 rows (marine variable mismatch and tide coverage); replaced by NOAA/NDBC/CDIP
- Current NOAA/NDBC seed shows 0 inserts for marine/tide on first run; next step is to log nearest station IDs and inspect responses from:
  - NDBC: `activestations.json` and `data/realtime2/<station>.txt`
  - NOAA T&C: nearest tide station and hourly `predictions` window
- Sun times now computed locally via SunCalc; previously seeded via Open‑Meteo

- Updated `scripts/load_beaches_with_meta.sql` to be schema-safe for current `public.beaches` table:

  - Removed schema-altering statements and PostGIS setup from the loader
  - Replaced TRUNCATE/MERGE with single-transaction CTE-driven update+insert upsert
  - Upserts only `name`, `location`, `latitude`, `longitude`, and `description`
  - Filters invalid coordinates and excludes known problematic entry (`204s`)
  - Keeps case-insensitive unique index on `lower(name)`

- Enhanced `app/api/session-planner/optimal-times/route.ts` scoring logic to include tide height/direction and swell period; introduced window filtering and fallback expansion.
- Updated `components/session-forms/OptimalTimesSection.tsx` to render time ranges, add test ids, and context-aware label.

### Fixed

### Removed

- Dead code cleanup and tooling:

  - Added `knip`, `ts-prune`, and `depcheck` with scripts: `dead:knip`, `dead:tsprune`, `dead:deps`, `dead:all`, `typecheck:strict-unused`
  - Removed unused files flagged by analysis:
    - `actions/beach-review-actions-optimized.ts`
    - `actions/forecast/forecast-actions.ts` (superseded by normalized forecast APIs)
    - `actions/setup-actions.ts`
    - `app/map/enhanced-page.tsx`
    - `hooks/use-beach-forecast.ts`, `hooks/use-enhanced-beach-data.ts`, `hooks/use-form-submission.ts`, `hooks/use-optimized-realtime.ts`
    - `lib/auth/admin-wrapper.ts`, `lib/beach-update-config.ts`, `lib/client-fetch.ts`, `lib/constants.ts`, `lib/services/open-meteo-service.ts`
    - Scripts: `clean-and-regenerate-enhanced-forecasts.mjs`, `cleanup-invalid-buoys.mjs`, `setup-enhanced-forecasts.mjs`, `update-enhanced-forecasts-real-data.mjs`, `update-ocean-beach-forecast.ts`
  - Removed unused dependencies: `autoprefixer`, `file-saver`, `leaflet`, `node-fetch`, `uuid`, `@types/file-saver`, `@types/leaflet`
  - Fixed duplicate export by making `components/ui/forecast-data-transparency.tsx` default-only export and updating imports/tests
  - Ensured build and tests pass after removals

- Playwright E2E suite consolidation (no coverage loss):

  - Removed redundant specs: `e2e/end-to-end.spec.ts`, `e2e/realistic-user-scenarios.spec.ts`, `e2e/map-simplified.spec.ts`, `e2e/beach-card-interactions.spec.ts`, `e2e/session-planning-critical.spec.ts`, `e2e/plan-session-photo-upload.spec.ts`, `e2e/unauthenticated-user-flows.spec.ts`
  - Kept umbrella `e2e/comprehensive.spec.ts` and focused domain specs
  - Updated `e2e/ARCHITECTURE.md` to reflect lean, non-overlapping suite

- Made Optimal Times recommendations relevant for afternoon/evening selections instead of generic early morning suggestions.
- Replaced non-existent `Tide` icon with `Droplet` from `lucide-react` in Spot Conditions summary

### Changed

- Enhanced .cursorrules to reference Architecture files for better development workflow
- **Consolidated Forecast Table Components**
  - Merged `multi-day-forecast-table.tsx` and `simplified-forecast-table.tsx` into unified `forecast-table.tsx`
  - Added variant props ("standard" vs "simplified") for different display modes
  - Maintained backward compatibility with existing component exports
  - Updated all imports across the codebase to use consolidated component
  - Supports both `EnhancedForecast` and `EnhancedForecastEntity` types
- Removed duplicate page-level headers from `app/about/page.tsx` and `app/features/page.tsx` to rely on global `AppHeader` from `app/layout.tsx`
- Landing page UX: Updated "Explore Features" button style to translucent on-image variant for better contrast (no solid white pill)
- Landing page copy: Replaced inflated counts with honest language (e.g., "Join surfers near you", "Growing surf community")
- Removed remaining numeric claims from landing sections (hero badge, social stats, CTA) and updated SEO copy to reflect realistic growth messaging

### Fixed

- Updated UI copy across profile and analytics components from "Default Spot" to "Home Break" for consistency; adjusted related validation messages and tests. Follows `components/ARCHITECTURE.md` wording conventions.
- Nearby tab now limits display to 10 beaches for clarity and performance, still sorted nearest-first and using existing data fetching patterns.

## [2025.08.08] - Profile Edit Modal Deep Link

### Changed

- "Set Default Beach" now navigates to `/profile?edit=true`, which auto-opens the Edit Profile modal.
- Centralized profile editing on `/profile` via `EditProfileModal`; removed legacy `/profile/edit` route and references.
- Updated docs and tests to reflect the new deep link.

- Plan Session form now requires start time in plan mode; improved validation toasts
- Redirect occurs immediately on successful plan; invitations are sent in background
- Added analytics activity events for attempts, success, and failure of planning

### Removed

- Compact summary row from beach detail (normalized marine/tide/sun snippet and “Source: …” badge). The beach page now focuses on the enhanced forecast overview only. API `GET /api/forecasts/window` retained for future use.
- **Dead Code Cleanup in Forecast Components**

  - Removed `tide-chart-example.tsx` (134 lines) - Pure demo component with no usage
  - Removed `forecast-line-chart.tsx` (208+ lines) - Unused custom SVG chart, redundant with Recharts
  - Removed `multi-day-forecast-table.tsx` (368 lines) - Consolidated into forecast-table.tsx
  - Removed `simplified-forecast-table.tsx` (432 lines) - Consolidated into forecast-table.tsx
  - Removed associated test files for deleted components
  - Cleaned up component mock references in test setup files
  - Updated ARCHITECTURE.md files to reflect consolidation

- **Test Suite Cleanup**
- Local Intel UX: Intel post modal now shows nearest beach name instead of raw latitude/longitude
  - Removed `__tests__/components/session-forms/session-form-forecast-integration.test.tsx` - Tested non-existent forecast feedback functionality
  - Removed `__tests__/components/forecast/forecast-feedback-form.test.tsx.disabled` - Disabled Jest test replaced by Playwright E2E
  - Re-enabled several previously skipped unit tests:
    - `__tests__/context/auth-context.error-paths.test.tsx`
    - `__tests__/actions/check-in-actions.test.ts` (submit/update/delete/getRecent/getStats)
    - `__tests__/lib/cdip-service.test.ts` (mocked API interactions)
    - `__tests__/components/session-forms/EquipmentStep.test.tsx`
    - `__tests__/components/session-forms/OptimalTimesSection.test.tsx`
  - Re-enabled middleware smoke tests in `__tests__/middleware.test.ts` to validate API pass-through and protected redirects
  - Restored ForecastTab component test (renamed from `.disabled`) pending green run
  - Fixed Supabase mocking issues that caused test failures
  - All forecast tests now pass (359 tests, 23 test suites)
- Removed `docs/README.md` (redundant with root `ARCHITECTURE.md` acting as primary index)

## [2025.01.15] - Production Release

### Added

- **Core Social Platform Features**
  - Complete activity feed system with real-time updates
  - Session likes, comments, and threading support
  - User following/followers system
  - Profile management with social metrics
- **Enhanced Forecasting System**
  - CDIP buoy data integration for real-time wave measurements
  - Data source transparency (NOAA vs FALLBACK indicators)
  - Raw forecast storage with quality scoring
  - Multi-day forecast tables with confidence indicators
- **Local Intel Club**
  - Community-driven surf intelligence posts
  - Geospatial search and filtering
  - User confirmation system for post accuracy
  - Tag-based categorization (parking, hazards, conditions, etc.)
  - 40+ mock intel posts for Ocean Beach and La Jolla Shores
- **Session Management Evolution**
  - Session conversion feature (planned → completed)
  - Photo upload integration for sessions
  - Session-based forecast snapshots
  - Enhanced session analytics and insights
- **Professional Landing Page**
  - Growth-optimized design for user acquisition
  - Feature showcase and social proof
  - Mobile-first responsive design
  - SEO optimization and structured data

### Performance

- **Database Optimizations**

  - Added 4 critical foreign key indexes (50-80% query speed improvement)
  - Removed 16 unused indexes (15% storage reduction)
  - RLS performance fixes eliminating InitPlan overhead
  - Consolidated multiple permissive policies
  - Added covering indexes for Supabase linter flags:
    - `idx_beaches_owner_id_fkey` on `beaches(owner_id)`
    - `idx_session_invitations_invitee_id_fkey` on `session_invitations(invitee_id)`
    - `idx_session_invitations_inviter_id_fkey` on `session_invitations(inviter_id)`
    - `idx_session_participants_user_id_fkey` on `session_participants(user_id)`
  - Fixed RLS InitPlan warnings by wrapping auth calls with SELECT wrappers:
    - `intel_posts`: insert/update/delete policies now use `(select auth.uid())`
    - `intel_post_confirmations`: insert/delete policies now use `(select auth.uid())`
    - `session_forecast_snapshots`: select/insert/update/delete now use `(select auth.uid())`
    - `beach_forecast_accuracy`: service/admin manage policy uses `(select auth.jwt())` and `(select auth.uid())`

- **Frontend Optimizations**
  - DRY component consolidation (~1,050 lines eliminated)
  - Optimized data fetching patterns with useDataFetcher
  - Efficient real-time subscriptions with proper cleanup
  - Mobile-first responsive design optimizations

### Testing

- **Comprehensive Test Suite (120+ tests)**

  - Unit tests for all utilities and components
  - Integration tests for server actions and API routes
  - End-to-end tests for critical user flows
  - Performance tests with realistic thresholds
  - API route testing with flexible status code validation

- **Testing Infrastructure**
  - Playwright E2E testing with navigation helpers
  - Jest unit testing with Next.js App Router mocking
  - React Testing Library configuration
  - Mock data factories and test utilities

### Security

- **Authentication & Authorization**

  - Row Level Security (RLS) on all tables
  - Authentication wrappers for server actions
  - Proper user data ownership patterns
  - Rate limiting for public endpoints

- **Data Protection**
  - Input validation with proper schemas
  - Parameterized queries preventing SQL injection
  - Consistent error responses with centralized utilities
  - Privacy-aware type definitions

### Developer Experience

- **Architecture Documentation**

  - Complete component architecture guides
  - DRY component usage patterns
  - Testing patterns and utilities
  - Database schema and migration documentation

- **Type Safety**
  - Comprehensive TypeScript definitions
  - Branded types for domain modeling
  - Database schema type generation
  - Full type safety from database to UI

### Fixed

- Session duration dropdown regression: Fixed empty dropdown and restored "1 hour" default selection
- User boards display regression: Fixed boards not appearing for existing users in session forms
- Session form consolidation and language consistency
- Profile picture upload error messaging
- Visit date validation in review forms
- Out-of-area search messaging improvements
- Success messages for session saves and profile updates
- Board creation authentication flow simplification
- Supabase security linter warning: Recreated `public.enhanced_forecasts_with_quality` view with `WITH (security_invoker = true)` to remove definer semantics

- Fixed issue where tapping Save on Plan Session did nothing and session was not saved
  - Root cause: server action payload included "$undefined" for optional fields (e.g., `board_id`), causing Supabase insert to fail silently and return `{ success: false, error: "Unknown error" }`.
  - Fix: added payload sanitization in `actions/session-actions.ts` to strip `undefined`/`"$undefined"`/empty UUIDs and set `user_id/profile_id/status` server-side; improved error message fallback in `lib/server-action-utils.ts`; revalidate `/profile` after creation to ensure immediate visibility.

## [2025.01.16] - Community-Enhanced Surf Forecasts

### Added

- **Community Check-In System**: Complete surf condition reporting system with real-time community data
  - New `check_ins` database table with RLS policies and performance indexes
  - Server actions for CRUD operations with authentication wrappers
  - Reusable CheckInForm component with comprehensive validation
  - CheckInDisplay and CheckInFeed components for community data visualization
  - Data fetching hooks following established useDataFetcher patterns
- **Enhanced Session Conditions**: Merged check-in functionality into existing session conditions form
  - Beautiful forecast vs actual conditions comparison
  - Improved UI with slider-based crowd level and forecast accuracy buttons
  - Community condition reporting integrated seamlessly into session logging
- **Local Intel Enhancement**: Enhanced Local Intel tab with condition reports
  - Real-time conditions feed from community check-ins
  - Check-in submission modal with beach-specific data
  - Forecast accuracy statistics and community validation
- **Comprehensive Testing**: 3 new test files covering all check-in functionality
  - Server action tests with Supabase mocking
  - Component tests with user interaction validation
  - Hook tests with data fetching patterns

### Performance

- Database functions for optimized check-in queries with user profile joins
- Indexed timestamp queries for efficient recent condition lookups
- RLS policies using performance-optimized auth patterns

### Fixed

- **Dynamic Forecast Integration**: Fixed static forecast data in Session Conditions
  - Forecast now updates automatically when users change session date/time
  - Created `useSessionForecast` hook to fetch real forecast data for specific date/time/beach
  - Added loading states and proper error handling for forecast data
  - Users now see accurate forecast vs actual conditions comparison
- Migration syntax error: Changed `timestamp` column to `checked_in_at` to avoid PostgreSQL reserved keyword conflict
- Index predicate error: Removed `now()` function from index WHERE clause since non-immutable functions aren't allowed in index predicates

## [2024.12.01] - Initial Foundation

### Added

- Next.js 14 App Router foundation
- Supabase database setup with initial schema
- Tailwind CSS + Shadcn UI design system
- Basic session logging functionality
- Beach directory with location services
- User authentication and profile management

### Infrastructure

- Initial database migrations
- Basic RLS policies
- Development environment setup
- CI/CD pipeline configuration

---

## Release Notes

### Current Status

- **Version**: 2025.01.15 (Production Ready)
- **Active Users**: 0 (Technical foundation complete, focus on user acquisition)
- **Test Coverage**: 120+ comprehensive tests
- **Performance**: Optimized for 0 → 1,000+ user growth
- **Documentation**: Complete architecture guides for all major systems

### Next Milestones

- **User Acquisition**: 0 → 100 users (Q1 2025)
- **Social Features**: Enhanced viral mechanics and sharing
- **Community Growth**: 100 → 1,000 users (Q2 2025)
- **Analytics**: User behavior insights and retention optimization

### Growth Strategy

- **Focus**: Viral features and network effects before monetization
- **Priority**: Social media sharing, photo integration, community features
- **Timeline**: 6 months to reach 1,000+ active users
- **Success Metrics**: 1.5+ viral coefficient, 70%+ retention, 200+ monthly shares

---

**Maintained by**: Development Team  
**Last Updated**: January 15, 2025  
**Next Review**: After reaching 50 active users

### Documentation

- Added `ARCHITECTURE.md` files for:
  - `actions/` — server action patterns, security, testing
  - `components/beach/` — review components data flow and UX
  - `components/intel/` — intel feed/map/form and interactions
  - `components/journal/` — calendar/analytics/export
  - `components/landing-page/` — sections, SEO, and performance conventions
