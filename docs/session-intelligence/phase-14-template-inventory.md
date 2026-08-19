# Session Intelligence Phase 14 Template Inventory

Owner: Quiver Web
Created: 2026-06-01
Update trigger: Before adding Session Intelligence recommendation UI to a new template.

## Purpose

This inventory is the Phase 14 planning contract for Session Intelligence v1.
It records the web templates that may later receive surf-window recommendations,
the current code entry points, and the safety fences that must hold before any
recommendation UI ships.

## Guardrails

- Ahrefs is sampled. It is not the source of truth for implementation scope.
- The Ahrefs fixed crawl cap remains in place; do not pay to expand it for this
  addendum.
- Ahrefs findings must be confirmed against GSC, Vercel, PostHog, direct
  template review, or code inspection before they drive changes.
- Existing canonical URLs are unchanged in Phase 14.
- Phase 14 does not add recommendation UI.
- Phase 14 does not introduce a new ML model.
- unsupported data-source claims are prohibited. If a template does not fetch or
  render buoy, cam, tide, user-report, or local-intel data, later UI must omit
  that source or label the recommendation as model-only.
- Water-temp pages must not be retargeted as surf-report pages.
- Phase 14 does not create duplicate thin SEO pages, mass-change metadata,
  rename routes, edit schemas, add dependencies, or mutate production data.

## Eligible Template Inventory

| Template | Route or component entry point | Current purpose | Later Session Intelligence eligible? | Notes |
| --- | --- | --- | --- | --- |
| anonymous homepage | `app/page.tsx`, `components/landing-page/*` | Public landing page with App Store metadata, auth-aware hero, and SSR crawl links. | Yes, after pilot validation. | Later module must keep useful answers visible without sign-in and preserve `/` canonical behavior. |
| authenticated home screen | `app/client-app.tsx`, `components/home-screen/index.tsx` | Signed-in dashboard with discovery recommendations, top spots carousel, push setup, and quick actions. | Yes, after shared primitive and UI exist. | This is app-like product UI, not an SEO template; guard against pre-auth CTA events firing for authenticated users. |
| spot page | `app/[intent]/[city]/[beachSlug]/page.tsx`, `app/beach/[slug]/beach-detail-client` | Hierarchical beach detail page with surf report, forecast tabs, reviews, amenities, water quality, camera, nearby spots, and signup CTAs. | Yes, strong later pilot candidate. | Fetches `getSpotSurfReportPublic`, nearby beaches, reviews, best-time URL, amenities, water quality, camera URL, and approved photo in parallel. |
| regional forecast hub | `app/forecast/page.tsx`, `lib/utils/forecast-hub-utils.ts` | `/forecast` regional 7-day forecast hub with active region call, top spots, guides, browse links, and signup CTA. | Yes, strong later pilot candidate. | Uses `getRegionalSummaries()` and active-region resolution; keep the current regional outlook rather than replacing it. |
| city/region page | `app/beaches/[country]/[state]/[city]/page.tsx` | Location listing page with editorial or standard layout, map/list, Place schema, ItemList schema, and FAQ. | Yes, after pilot validation. | Inventory both editorial and standard branches; canonical pattern remains `/beaches/{country}/{state}/{city}`. |
| state intent page | `app/[intent]/[city]/page.tsx` | State-level intent route, for example `/beginner/ca`, with state map, city grids, ItemList, Place, WebPage, and FAQ schema. | Maybe. | Empty beginner, longboard, and least-crowded state pages can noindex; avoid adding thin content to empty states. |
| generic city intent page | `app/[intent]/[city]/page.tsx` | Generic intent route for non-dedicated branches, including longboard page and least-crowded page behavior. | Maybe. | Uses intent-filtered beaches, `getIntentForecastSummary`, map/list, `TodaysIntentPlan`, checklist, and StickySignupBar. |
| dedicated tide city page | `app/[intent]/[city]/page.tsx`, `TidePageContent` | `/tide/[city]` page with expanded tide hero, chart, seven-day table, beach tide cards, map, and CTAs. | Maybe, with strict source claims. | Slow-risk target because it calls `getCityTideDataExpanded` and renders heavier tide UI. |
| dedicated water-temp city page | `app/[intent]/[city]/page.tsx`, `WaterTempPageContent` | `/water-temp/[city]` page with expanded water-temperature history, beach comparisons, gear context, map, and CTAs. | Maybe, with strict intent preservation. | Do not retarget this as a surf-report page; water-temp decision value must remain supplemental. |
| dedicated dawn-patrol city page | `app/[intent]/[city]/page.tsx`, `DawnPatrolPageContent` | `/dawn-patrol/[city]` page using sunrise, first-light, editorial beaches, and intent-filtered beach data. | Maybe. | Current branch is sun-time driven; later surf-window copy must not imply live forecast scoring unless the shared primitive is connected. |
| dedicated sunset city page | `app/[intent]/[city]/page.tsx`, `SunsetPageContent` | `/sunset/[city]` page using sunset/golden-hour timing, editorial beaches, and intent-filtered beach data. | Maybe. | Current branch is sun-time driven and should stay distinct from all-day forecast recommendations. |
| beginner page | `app/[intent]/[city]/page.tsx`, `components/beginner/BeginnerPageContent` | Dedicated beginner route with editorial content, live beginner conditions, map/list, schema, and CTAs. | Maybe. | Must preserve beginner intent and avoid hiding basic beginner guidance behind auth. |
| longboard page | `app/[intent]/[city]/page.tsx` | Generic city intent branch for mellow/longboard-friendly spots. | Maybe. | Shares generic intent data flow; later logic should use board-fit tags from Phase 15, not bespoke scoring. |
| least-crowded page | `app/[intent]/[city]/page.tsx` | Generic city intent branch for light/moderate crowd levels; returns 404 when no matching beaches exist. | Maybe. | Respect existing no-empty-results behavior and do not create duplicate thin pages. |
| best-time page | `app/best-time-to-surf/[city]/page.tsx`, `actions/city/best-time-actions.ts` | Seasonal city guide with monthly surf score, top beaches, water-temp/wetsuit context, ItemList, FAQ, live handoff links, and CTAs. | Maybe, as contextual handoff only. | Keep seasonal best-time intent; live windows should supplement, not replace, the calendar framing. |
| beach tide subpage | `app/[intent]/[city]/[beachSlug]/tides/page.tsx`, `lib/utils/beach-sub-page-utils.tsx` | Beach-level tide utility page with TideDatasetSchema, TideFAQSchema, forecast tab default, alert CTA, next steps, nearby beaches, and StickySignupBar. | Maybe, with strict utility-page framing. | Required structured-data sample target. |
| beach water-temp subpage | `app/[intent]/[city]/[beachSlug]/water-temp/page.tsx`, `lib/utils/beach-sub-page-utils.tsx` | Beach-level water-temp utility page with WaterTempDatasetSchema, WaterTempFAQSchema, conditions tab default, alert CTA, next steps, nearby beaches, and StickySignupBar. | Maybe, with strict utility-page framing. | Required structured-data sample target; must not become a surf-report duplicate. |
| forecast-accuracy page | `app/forecast-accuracy/page.tsx`, `actions/ml/forecast-accuracy-actions.ts` | `/forecast-accuracy` proof/trust page using ML baseline views, graceful data-building state, methodology, FAQ, and forecast CTAs. | No for recommendations in Phase 14. | Phase 19 owns improvements; Phase 14 only inventories backed-claim guards. |
| /for-surf-schools | `app/for-surf-schools/page.tsx` | Marketing page for surf schools. | Avoid for Session Intelligence v1 unless separately profiled. | Listed as a slow-risk/blocker surface; do not add heavy Session Intelligence UI without route timing evidence. |

## Data Availability Matrix

Cells describe what the template itself fetches or renders today. They do not
claim data that merely exists elsewhere in the system.

| Template | Forecast horizon | Tide | Water temp | Buoy/source confidence | Cam | User reports/intel | Local spot intel | CTA/deep-link support |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| anonymous homepage | partial - featured beach/landing content only, `app/page.tsx` | not fetched - no tide module | not fetched - no water-temp module | not fetched - no confidence component | not fetched - no live cam | not fetched - public landing only | partial - SSR beach links only | partial - App Store CTA uses `IOS_APP_STORE_URL`; no exact window deep-link |
| authenticated home screen | partial - 24h discovery feed in `components/home-screen/index.tsx` | partial - only if discovery payload includes it | partial - only if recommendation payload includes it | partial - discovery confidence, not matrix-backed source chips | not fetched | partial - profile/session context after auth | yes - personalized discovery/home beach context | partial - in-app nav/share; no Session Intelligence window link yet |
| spot page | yes - today/tomorrow 48-row surf-call path in `getSpotSurfReportPublic` and `lib/services/spot-surf-report-service.ts` | yes - forecast rows include tide fields and preferred-tide beach fields | partial - rendered via detail tabs or companion utility page, not the surf-call row itself | partial - `ForecastDataSourceIndicator` exists, but spot page does not yet render a source-chip contract | yes - `getBeachCameraUrl` and `LiveCamSchema` when camera exists | yes - reviews, intel, sessions tabs and `getBeachReviews` | yes - canonicalized beach fit fields feed `computeSurfCall` and `selectBestWindow` | partial - `InlineSignupCta`, `StickySignupBar`, canonical web URL; no exact app window link |
| regional forecast hub | yes - 168 hours / 7-day summaries through `getRegionalSummaries` and `getBatchFreshForecastsFromCache` | partial - included only through aggregated forecast rows | partial - included only when rows provide it | partial - regional summary confidence, not a per-window source badge | not fetched | not fetched | partial - regional/beach grouping only | partial - forecast CTAs and App Store handoff; no exact app window link |
| city/region page | not fetched - location listing data, not live forecast rows | not fetched | not fetched | not fetched | not fetched | partial - beach counts/listing context, not user reports | partial - ranked beaches and editorial content | partial - intent/map links; no app window link |
| state intent page | partial - state overview may fetch condition summaries for supported intents | partial - tide state links and overviews only where branch renders them | partial - state water-temp overview can fetch representative temps | not fetched - no source-chip contract | not fetched | not fetched | partial - state/city/beach list context | partial - state/city cross-links and StickySignupBar |
| generic city intent page | partial - today/tomorrow `getIntentForecastSummary` for top 5 beaches | partial - only for tide intent overview fallback | partial - only for water-temp intent overview fallback | not fetched - no source-chip contract | not fetched | not fetched | partial - intent-filtered beaches and beach fit fields | partial - StickySignupBar, map, best-time and tide links |
| dedicated tide city page | partial - uses tide-focused expanded data, not full forecast windows | yes - `getCityTideDataExpanded` and `tide_forecasts` seven-day extrema | not fetched - only links to water-temp | not fetched - no source-chip contract | not fetched | not fetched | partial - per-beach tide preferences | partial - `InlineSignupCta`, StickySignupBar, related links |
| dedicated water-temp city page | partial - water-temp history and per-beach temps, not full surf windows | not fetched - only links to tide | yes - 7-day history, per-beach temps, optional 12-month averages in `getCityWaterTempExpanded` | not fetched - no source-chip contract | not fetched | not fetched | partial - editorial/top beaches only | partial - StickySignupBar, related links |
| dedicated dawn-patrol city page | partial - sun times and intent beaches, not full surf windows | not fetched | not fetched | not fetched | not fetched | not fetched | partial - editorial beaches and intent-filtered list | partial - StickySignupBar and cross-links |
| dedicated sunset city page | partial - sun times and intent beaches, not full surf windows | not fetched | not fetched | not fetched | not fetched | not fetched | partial - editorial beaches and intent-filtered list | partial - StickySignupBar and cross-links |
| beginner page | partial - beginner conditions and city beach data, not 14-day windows | not fetched unless linked | not fetched unless linked | not fetched - no source-chip contract | not fetched | not fetched | yes - beginner editorial, skill fit, and beach list | partial - signup CTAs and best-time links |
| longboard page | partial - generic intent summary for top beaches | partial - only if generic summary includes tide text | not fetched | not fetched - no source-chip contract | not fetched | not fetched | partial - longboard-friendly beach filter | partial - StickySignupBar and intent links |
| least-crowded page | partial - generic intent summary for top beaches | partial - only if generic summary includes tide text | not fetched | not fetched - no source-chip contract | not fetched | not fetched | partial - crowd-level beach filter | partial - StickySignupBar and intent links |
| best-time page | partial - seasonal, not live windows; `getBestTimeToSurfData` aggregates best_months and monthly scores | not fetched - links to tide/live routes | partial - seasonal regional water-temp and wetsuit context | not fetched - no source-chip contract | not fetched | not fetched | yes - seasonal best months, top beaches, skill/crowd fields | partial - live handoff links, InlineSignupCta, StickySignupBar |
| beach tide subpage | partial - reuses `BeachDetailClient` forecast tab but page purpose is tide utility | yes - `getTideMetaData`, `TideDatasetSchema`, and forecast tab tide subtab | not fetched - companion link only | not fetched - no source-chip contract | not fetched | partial - detail client can expose tabs after hydration | partial - beach-specific tide context | partial - `AlertCaptureCta`, StickySignupBar, companion links |
| beach water-temp subpage | partial - reuses `BeachDetailClient` conditions tab but page purpose is water-temp utility | not fetched - companion link only | yes - `getWaterTempMetaData`, `WaterTempDatasetSchema`, and conditions subtab | not fetched - no source-chip contract | not fetched | partial - detail client can expose tabs after hydration | partial - beach-specific water-temp context | partial - `AlertCaptureCta`, StickySignupBar, companion links |
| forecast-accuracy page | not applicable - trust/proof page, not a surf-window surface | not applicable | not applicable | yes - backed by ML/baseline views when enough data exists | not applicable | not applicable | not applicable | partial - forecast and comparison CTAs |
| /for-surf-schools | not fetched - marketing/static page | not fetched | not fetched | not fetched | not fetched | not fetched | not fetched | partial - marketing CTAs only |

## Source-Claim Rules

- Future UI must not display `buoy + model`, `model + tide`, `cam`, or
  `user report` source chips unless the template has that source in the Data
  Availability Matrix.
- Unavailable sources must be omitted or labelled as `model only` or
  `sparse data` instead of inferred from data that exists elsewhere.
- Source copy must distinguish "this template fetches it" from "the platform has
  a related source somewhere else."
- Water-temp and tide utility pages keep their utility intent and must not claim
  a full surf report unless a later approved phase renders full forecast data on
  those pages.
- If a later phase adds source chips, it must test absent buoy, tide, cam, and
  user report states before broad rollout.

## Reusable Primitives

- `getSpotSurfReportPublic` - cookie-free anonymous spot surf-call primitive for
  ISR spot pages; Phase 15 should inspect it before adding beach-window logic.
- `computeSurfCall` - current surf-call verdict builder; Phase 15 should reuse or
  deliberately map its scoring inputs before creating a new recommendation shape.
- `selectBestWindow` - existing window selector used by the spot surf call path;
  Phase 15 should inspect its horizon and beach-fit behavior first.
- `getIntentForecastSummary` - city/intent summary helper for top beaches and
  Magic Hour windows; Phase 15 should account for its today/tomorrow behavior.
- `BestSurfWindow` - existing beach detail UI for best-window style display;
  Phase 16 should inspect it before adding `BestSurfWindows`.
- `ForecastDataSourceIndicator` - existing source-confidence and fallback UI;
  Phase 16 should reuse its source vocabulary or formally replace it.
- `TideDatasetSchema` - current tide utility-page dataset schema; later phases
  must preserve its utility-page semantics.
- `WaterTempDatasetSchema` - current water-temp utility-page dataset schema;
  later phases must not retarget these pages as surf reports.
- `IOS_APP_STORE_URL` - existing App Store fallback constant for web-to-native
  CTAs; Phase 16 and Phase 20 should reuse it for safe fallback behavior.
- `apple-app-site-association` - current universal-link contract in
  `app/.well-known/apple-app-site-association/route.ts`; Phase 20 owns any new
  session-window path additions.

No new utility or component should be proposed before these existing primitives
are inspected.

## Performance Risk Register

| Risk | Current owner/file | Why it matters | Phase 14 disposition | Later-phase gate |
| --- | --- | --- | --- | --- |
| `/for-surf-schools` | `app/for-surf-schools/page.tsx` | Marketing page does not fetch forecast, tide, water-temp, buoy, cam, or intel data today. | avoid for v1 | Do not add Session Intelligence UI unless a separate brief proves user value and route timing. |
| dedicated tide city pages | `app/[intent]/[city]/page.tsx`, `getCityTideDataExpanded` | Renders heavy tide hero, chart, seven-day extrema, beach tide cards, map, and CTAs. | profile before UI | Measure render and fetch timing on a high-beach-count city before adding any recommendation module. |
| dedicated water-temp city pages | `app/[intent]/[city]/page.tsx`, `getCityWaterTempExpanded` | Renders water-temp history, comparisons, gear context, map, and CTAs; surf-window claims can blur page intent. | profile before UI | Measure route timing and preserve water-temp utility intent before adding live surf-window UI. |
| spot pages | `app/[intent]/[city]/[beachSlug]/page.tsx`, `lib/services/spot-surf-report-service.ts` | Strong pilot surface, but already fetches surf report, reviews, nearby beaches, amenities, camera URL, and imagery in parallel. | profile before UI | Add the first pilot only after confirming the shared primitive does not duplicate existing spot-page work. |
| regional forecast hub | `app/forecast/page.tsx`, `lib/utils/forecast-hub-utils.ts` | Aggregates regional 7-day forecasts and top spots; page value depends on fast regional overview loading. | profile before UI | Profile `getRegionalSummaries()` and cache freshness before rendering per-window recommendations. |
| forecast fetch | `actions/forecast/intent-forecast-actions.ts`, `lib/services/spot-surf-report-service.ts` | Live surf-window UI could add redundant forecast reads or widen existing query horizons. | document only | Phase 15 must reuse existing today/tomorrow and 168-hour fetch paths or justify a measured query change. |
| tide fetch | `lib/utils/beach-sub-page-utils.tsx`, `getCityTideDataExpanded` | Tide utility pages already depend on tide metadata and seven-day tide rows. | profile before UI | Validate added UI does not introduce a second tide query for the same page request. |
| water-temp fetch | `lib/utils/beach-sub-page-utils.tsx`, `getCityWaterTempExpanded` | Water-temp utility pages and city pages carry supplemental temperature data, not full surf-report payloads. | profile before UI | Validate added UI keeps water-temp as supplemental and does not force full surf-report fetches. |
| cache hit/miss behavior | `lib/utils/forecast-hub-utils.ts`, `lib/services/spot-surf-report-service.ts` | Recommendation modules can look cheap on warm cache and expensive on cold cache. | document only | Later phases must record warm-cache and cold-cache behavior for pilot routes before rollout. |
| recommendation runtime | Phase 15 shared primitive, Phase 16 UI components | The scoring helper and rendering path do not exist yet, so Phase 14 cannot measure them. | document only | Define the primitive first, then profile deterministic scoring and render cost before broad template adoption. |

## Structured Data Sampling Checklist

| Sample | Route pattern | Expected schema components | Existing unit tests | Sampling instruction |
| --- | --- | --- | --- | --- |
| one tide page | `/[intent]/[city]/[beachSlug]/tides` | `TideDatasetSchema`, `WebPageSchema`, `BreadcrumbStructuredData` | `__tests__/components/seo/tide-dataset-schema.test.tsx` | Confirm utility-page semantics stay intact. If schema breaks, fix shared helpers rather than one URL. |
| one water-temp page | `/[intent]/[city]/[beachSlug]/water-temp` | `WaterTempDatasetSchema`, `WebPageSchema`, `BreadcrumbStructuredData` | `__tests__/components/seo/water-temp-dataset-schema.test.tsx` | Confirm water-temp pages are not retargeted as surf reports. If schema breaks, fix shared helpers rather than one URL. |
| one US spot page | `/[intent]/[city]/[beachSlug]` | `BeachPageStructuredData`, `WebPageSchema`, `ItemListSchema`, `BreadcrumbStructuredData` | `__tests__/lib/seo/structured-data.test.ts` | Confirm US spot-page JSON-LD preserves beach identity, breadcrumbs, and related spot lists. If schema breaks, fix shared helpers rather than one URL. |
| one non-US/Baja spot page | `/mexico/[region]/[city]/[beachSlug]` | `BeachPageStructuredData`, `WebPageSchema`, `ItemListSchema`, `BreadcrumbStructuredData` | `__tests__/lib/seo/structured-data.test.ts` | Confirm Baja coverage keeps Mexico route context and does not inherit US-only assumptions. If schema breaks, fix shared helpers rather than one URL. |

## Local Validation Commands

Run these after Phase 14 inventory edits:

```bash
rg -n "Performance Risk Register|for-surf-schools|dedicated tide city pages|dedicated water-temp city pages|spot pages|regional forecast hub|forecast fetch|tide fetch|water-temp fetch|cache hit/miss|recommendation runtime|profile before UI|avoid for v1|document only" docs/session-intelligence/phase-14-template-inventory.md
rg -n "Structured Data Sampling Checklist|one tide page|one water-temp page|one US spot page|one non-US/Baja spot page|TideDatasetSchema|WaterTempDatasetSchema|BeachPageStructuredData|WebPageSchema|ItemListSchema|BreadcrumbStructuredData|shared helpers rather than one URL" docs/session-intelligence/phase-14-template-inventory.md
rg -n "Local Validation Commands|git diff -- app/layout.tsx lib/constants/seo.ts|npx playwright test --list e2e/beach-detail.spec.ts e2e/forecast-hub.spec.ts e2e/beginner-page.spec.ts e2e/guest-intent-state-city-routes.spec.ts|Do not add full E2E" docs/session-intelligence/phase-14-template-inventory.md
git diff -- app/layout.tsx lib/constants/seo.ts
npx playwright test --list e2e/beach-detail.spec.ts e2e/forecast-hub.spec.ts e2e/beginner-page.spec.ts e2e/guest-intent-state-city-routes.spec.ts
```

Do not add full E2E run requirements unless implementation edits a browser
behavior file.

## App Link And Analytics Checklist

### App links

- iOS universal links are served by
  `app/.well-known/apple-app-site-association/route.ts` through the AASA
  response.
- The canonical path policy lives in `config/app-link-contract.json`. The AASA
  route derives exact/prefix rules from that contract for invite, beach,
  sessions, profile, auth, settings, map, alerts, `/app/handoff`,
  `/app/spot/*`, and `/app/forecast`. Bare `/app` stays on the web/store
  handoff; `/app/handoff` is the exact controllable acquisition path.
- Android asset links are served by
  `app/.well-known/assetlinks.json/route.ts`; the response delegates
  `delegate_permission/common.handle_all_urls` to configured Android packages
  and SHA-256 fingerprints.
- Web-to-native fallback CTAs should reuse `IOS_APP_STORE_URL` from
  `lib/constants/app-store.ts` unless a later native-app phase defines a more
  specific destination.
- Invite landing uses the native scheme `quiver://invite/{token}` and web
  fallback `/invite/start?token=...`.
- `e2e/push-deeplink-routing.spec.ts` includes skipped bug-quarantine coverage
  for legacy `/beach/[slug]` error behavior. Treat a Playwright `--list` pass as
  registration evidence, not proof that every quarantined flow is fixed.
- Later window-specific deep links may require separate native-app routing,
  AASA path updates, Android assetlinks validation, and App Store fallback
  review. Do not assume Phase 14 covers those links.

### Analytics

- Reuse existing event names before adding Session Intelligence events:
  `page_view`, `beach_view`, `forecast_interaction`, `cta_click`,
  `ios_app_cta_click`, `share_started`, `share_completed`, and
  `horizon_strip_day_selected`.
- `ios_app_cta_click` is currently an external-analytics event, not a
  `/api/events` `VALID_EVENTS` write. Later phases must decide whether web DB
  persistence is needed before moving it into the user-events path.
- Any new Session Intelligence event must update `VALID_EVENTS`,
  anonymous/pre-auth allowlists as applicable, database check constraints,
  TypeScript event unions, event weights, and taxonomy/DB sync tests together.
- Authenticated users must not fire pre-auth CTA events. Keep
  `signup_cta_view`, `signup_cta_click`, and `auth_modal_opened` guarded
  client-side and blocked server-side through `PRE_AUTH_ONLY_EVENTS`.
- Prefer existing `page_view`, `beach_view`, `forecast_interaction`, and
  `horizon_strip_day_selected` instrumentation for initial recommendation
  adoption measurement before adding a new event.

## Scope Exclusions

- Phase 14 does not create `SurfWindowRecommendation`; that belongs to Phase 15.
- Phase 14 does not add `BestSurfWindows`, `WhyThisCall`,
  `SourceConfidenceBadge`, or `AppDeepLinkCTA`; those belong to Phase 16.
- Phase 14 does not change metadata/canonicals and does not change metadata.
- Phase 14 does not edit schemas.
- Phase 14 does not change production data fetching.
- Phase 14 does not add app-link routes, analytics events, database migrations,
  package dependencies, or production mutations.

## Handoff To Later Phases

- Phase 15 should use this inventory before creating the shared
  `SurfWindowRecommendation` model and deterministic helper.
- Phase 16 should use this inventory before introducing `BestSurfWindows`,
  `WhyThisCall`, `SourceConfidenceBadge`, or `AppDeepLinkCTA`.
- Later rollout phases must preserve page intent, current route shape,
  structured data semantics, auth CTA guardrails, and source-claim truthfulness.
