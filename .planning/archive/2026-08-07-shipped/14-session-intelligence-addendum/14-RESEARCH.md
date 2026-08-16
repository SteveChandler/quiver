# Phase 14 Research: Guardrails, Data Inventory, And Template Safety

Gathered: 2026-06-01
Status: Ready for planning

## Objective

Answer what is needed to plan Phase 14 safely: create the guardrail and
template/data inventory foundation for Session Intelligence without adding
recommendation UI, changing canonicals, mass-editing metadata, or making source
claims the code cannot support.

## Inputs Reviewed

- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`
- `.planning/phases/14-session-intelligence-addendum/14-CONTEXT.md`
- `.planning/phases/13-controlled-refactor-completion/13-CONTEXT.md`
- `.planning/phases/13-controlled-refactor-completion/13-RESEARCH.md`
- `docs/refactor-roadmap.md`
- `AGENTS.md`, `CLAUDE.md`, `docs/ARCHITECTURE.md`, `app/ARCHITECTURE.md`
- `components/ARCHITECTURE.md`
- `components/beach-detail/ARCHITECTURE.md`
- `components/intent/ARCHITECTURE.md`
- `components/forecast/ARCHITECTURE.md`
- `components/home-screen/ARCHITECTURE.md`
- `app/beaches/[country]/[state]/[city]/ARCHITECTURE.md`
- `app/page.tsx`, `app/client-app.tsx`
- `app/[intent]/[city]/page.tsx`
- `app/[intent]/[city]/[beachSlug]/page.tsx`
- `app/[intent]/[city]/[beachSlug]/tides/page.tsx`
- `app/[intent]/[city]/[beachSlug]/water-temp/page.tsx`
- `app/best-time-to-surf/[city]/page.tsx`
- `app/forecast/page.tsx`
- `app/forecast-accuracy/page.tsx`
- `app/.well-known/apple-app-site-association/route.ts`
- `actions/forecast/intent-forecast-actions.ts`
- `actions/spot/spot-surf-report-actions.ts`
- `actions/city/best-time-actions.ts`
- `lib/utils/beach-sub-page-utils.tsx`
- `lib/utils/forecast-hub-utils.ts`
- `components/beach-detail/best-surf-window.tsx`
- `lib/constants/app-store.ts`
- `__tests__/app/well-known-app-links.test.ts`
- `__tests__/lib/services/forecast-alerts-deeplink.test.ts`
- `e2e/push-deeplink-routing.spec.ts`
- Relevant existing route/component tests discovered under `__tests__/` and `e2e/`

## Phase Boundary Findings

Phase 14 should produce documentation, source inventory, lightweight guards, and
sample validation. It should not implement `SurfWindowRecommendation`, add new
recommendation UI, introduce a new ML model, or change canonical metadata. Those
belong to later phases.

The roadmap marks Phase 14 as MVP mode, but `UI hint: no`; there is no UI-SPEC
requirement for this planning pass. The plans should still account for future UI
impact by documenting template readiness and slow-risk profiling targets.

## Existing Primitives To Reuse Later

- Spot pages already call `getSpotSurfReportPublic(beach)` and pass
  `surfCallReport` plus `forecastContext` into `BeachDetailClient`.
- `actions/spot/spot-surf-report-actions.ts` already wraps the discovery window
  selector and `computeSurfCall`; it reads `enhanced_forecasts` for today and
  tomorrow with a 48-row limit and a 15-minute cache.
- `components/beach-detail/best-surf-window.tsx` already renders a surf-window
  style experience and supports windows, board picks, relative context, share,
  and forecast fallback data.
- `actions/forecast/intent-forecast-actions.ts` already has a city-level
  `getIntentForecastSummary()` that queries top city beaches for today/tomorrow
  and runs Magic Hour scoring.
- `components/forecast` already owns confidence/source transparency primitives,
  including `ForecastDataSourceIndicator`, `ForecastAccuracyCard`, tide charts,
  and best-days/regional forecast modules.
- Universal/app link support exists through App Store metadata, AASA,
  forecast-alert deeplinks, invite deeplinks, and push-routing tests.

Later phases should map to these primitives before creating new abstractions.

## Eligible Template Inventory Targets

| Template | Entry Point | Current Data | Structured Data | CTA / Link Support | Phase 14 Notes |
|----------|-------------|--------------|-----------------|--------------------|----------------|
| Homepage / landing | `app/page.tsx`, `components/landing-page/*`, authed `components/home-screen/index.tsx` | Landing SSR featured beaches; authed discovery via `useSurfDiscovery` 24h horizon | Root metadata and home schemas | App Store metadata and landing CTAs; authed quick actions/share | Inventory as two surfaces: anonymous landing and authenticated home. |
| Spot page | `app/[intent]/[city]/[beachSlug]/page.tsx`, legacy `app/beach/[slug]/*` | Surf report, nearby beaches, reviews, best-time URL, amenities, water quality, camera, photo | Beach, Breadcrumb, FAQ, Review, WebPage, LiveCam | Inline signup, sticky signup, beach URL utilities | Strong pilot candidate later; Phase 14 should document all data and performance risks. |
| Beach tide subpage | `app/[intent]/[city]/[beachSlug]/tides/page.tsx`, `lib/utils/beach-sub-page-utils.tsx` | Tide metadata via `getTideMetaData`, nearby enrichment, shared beach detail forecast tab | Beach, Breadcrumb, Tide FAQ, TideDataset | AlertCaptureCta, StickySignupBar, related next steps | Required structured-data sample target. |
| Beach water-temp subpage | `app/[intent]/[city]/[beachSlug]/water-temp/page.tsx`, `lib/utils/beach-sub-page-utils.tsx` | Water-temp metadata via `getWaterTempMetaData`, nearby enrichment, shared beach detail conditions tab | Beach, Breadcrumb, WaterTemp FAQ, WaterTempDataset | AlertCaptureCta, StickySignupBar, related next steps | Required structured-data sample target. Do not retarget as surf-report page. |
| Regional forecast hub | `app/forecast/page.tsx`, `lib/utils/forecast-hub-utils.ts` | Regional summaries from all beaches + batched 7-day forecasts + approved photos | Breadcrumb and WebPage | StickySignupBar, regional guide links | Strong pilot candidate later; inventory 7-day horizon and batch cost. |
| City/region page | `app/beaches/[country]/[state]/[city]/page.tsx` | Location data, stats, beaches, editorial content, map | Place, ItemList, FAQ | Intent links and map handoff | Inventory both editorial and standard layout branches. |
| State/city intent pages | `app/[intent]/[city]/page.tsx` | Intent-filtered beaches, city metadata, optional intent data, forecast summary | Breadcrumb, ItemList, Place, WebPage, FAQ | StickySignupBar and intent-guide cross-links | Separate state-level and city-level behavior; state pages can noindex empty skill/crowd intents. |
| Dedicated tide city page | `app/[intent]/[city]/page.tsx`, `TidePageContent` | Representative-beach tide schedule, 7-day hourly tide, extrema, beach preferences | Place, ItemList, WebPage, Breadcrumb, FAQ | InlineSignupCta, StickySignupBar, continue links | Slow-risk target: service-role tide queries and chart payload. |
| Dedicated water-temp city page | `app/[intent]/[city]/page.tsx`, `WaterTempPageContent` | 7-day temp history, per-beach temps, monthly averages when enough data | Place, ItemList, WebPage | StickySignupBar, continue links | Slow-risk target: 12-month historical temp query. Avoid unsupported source claims. |
| Dedicated dawn-patrol / sunset city pages | `app/[intent]/[city]/page.tsx`, `DawnPatrolPageContent`, `SunsetPageContent` | Representative-beach sun times today + 7 days | Place, ItemList, WebPage | StickySignupBar, continue links | Data is sun-time driven, not surf-window driven yet. |
| Beginner / longboard pages | `app/[intent]/[city]/page.tsx`, `components/beginner/*`, generic longboard branch | Beginner conditions, editorial beaches, intent-filtered beaches, forecast summary | Place, ItemList, WebPage, FAQ | Signup CTAs and best-time links | Beginner has dedicated path; longboard uses generic intent branch. |
| Least-crowded pages | `app/[intent]/[city]/page.tsx` | Intent-filtered beaches by crowd; generic forecast summary | Place, ItemList, WebPage, FAQ | Signup CTAs and intent links | City page 404s when no light/moderate beaches; inventory this as intentional. |
| Best-time pages | `app/best-time-to-surf/[city]/page.tsx`, `actions/city/best-time-actions.ts` | `best_months`, state monthly profile, regional water-temp/wetsuit, top beaches | Breadcrumb, FAQ, ItemList | InlineSignupCta, StickySignupBar, live handoff links | Seasonal guide, not live recommendation surface. |
| Forecast accuracy page | `app/forecast-accuracy/page.tsx`, `actions/ml/forecast-accuracy-actions.ts` | ML baseline materialized views and daily time series | Breadcrumb and WebPage | Forecast link and related CTAs | Phase 19 handles improvements; Phase 14 should inventory current backed-claim guards. |
| `/for-surf-schools` | `app/for-surf-schools/page.tsx` | Marketing/static page | Metadata only unless schemas present | Marketing CTAs | Mentioned as slow-risk blocker to profile or explicitly avoid before heavy UI. |

## Data Availability Notes

- Forecast data source for live surf decisions is `enhanced_forecasts`; new code
  must query `forecast_at`, not `forecast_date` + `forecast_time` for windows.
- Tide city pages combine `enhanced_forecasts.raw_forecast.tide_schedule` with
  `tide_forecasts` for expanded hourly/extrema views.
- Water-temp city pages use `enhanced_forecasts.water_temp` for 7-day history,
  current per-beach comparisons, and optional 12-month monthly averages.
- Sun-time pages use `sun_times` by representative beach.
- Buoy/source confidence is available indirectly through enhanced forecast
  source/quality fields and forecast transparency components; Phase 14 should
  inventory where source flags can be truthfully inferred before later UI claims
  "buoy + model" or "model only".
- Camera support is fetched per beach through `getBeachCameraUrl` and rendered
  through `LiveCamSchema` only when a camera URL exists.
- User reports/intel/reviews exist on spot pages through reviews, sessions, and
  intel tabs; most SEO intent pages only link or summarize beaches and should
  not claim user-report support unless the data is fetched for that template.
- App-deep-link support is not a single primitive yet. Current web support is
  App Store CTA constants, AASA paths, invite app scheme links, and push-alert
  `/beach/{slug}` deeplinks. Phase 14 should document current link coverage and
  gaps, not create new links.

## Performance / Slow-Risk Findings

- `app/[intent]/[city]/page.tsx` can run multiple service-role calls for tide,
  water-temp, sun-times, best-time URLs, editorial beaches, city exclude-intents,
  and forecast summaries. Dedicated tide and water-temp branches are the highest
  profiling priority before adding heavier components.
- `getCityWaterTempExpanded()` may scan 12 months of `enhanced_forecasts` for a
  representative beach. This should be measured or guarded before broad rollout.
- `getCityTideDataExpanded()` reads a seven-day tide window from
  `tide_forecasts`, detects extrema in JS, and fetches all city beach tide
  preferences. This should be measured on a high-beach-count city.
- Spot pages use `Promise.all()` for surf report, nearby beaches, reviews,
  best-time URL, amenities, water quality, camera URL, and photo. Heavy UI later
  should avoid serializing more data on this path without measurement.
- `getRegionalSummaries()` batch-fetches seven days of forecasts for all regions
  and attaches photos in one batched query. It is designed to keep cost flat, but
  should be documented as a regional forecast hub dependency.
- `/for-surf-schools` is named in phase context as a slow-risk surface; Phase 14
  can either profile it with the same route timing method or explicitly mark it
  avoided for Session Intelligence v1.

## Structured Data Sampling Targets

Phase 14 should validate, or at least add documented sampling instructions for:

1. One tide page, for example `/ca/san-diego/ocean-beach/tides`.
2. One water-temp page, for example `/ca/san-diego/ocean-beach/water-temp`.
3. One US spot page, for example `/ca/san-diego/blacks` or another confirmed
   existing hierarchical URL.
4. One non-US/Baja spot page, using the Mexico route
   `app/mexico/[region]/[city]/[beachSlug]/page.tsx` once a known indexed Baja
   beach slug is selected.

Existing schema components to inspect or test:

- `components/seo/structured-data.tsx`
- `components/seo/breadcrumb-schema.tsx`
- `components/seo/web-page-schema.tsx`
- `components/seo/item-list-schema.tsx`
- `components/seo/tide-dataset-schema.tsx`
- `components/seo/water-temp-dataset-schema.tsx`
- `components/seo/live-cam-schema.tsx`
- `components/seo/review-schema.tsx`
- `lib/seo/location-structured-data.ts`

Existing tests include `__tests__/lib/seo/structured-data.test.ts`,
`__tests__/components/seo/tide-dataset-schema.test.tsx`,
`__tests__/components/seo/water-temp-dataset-schema.test.tsx`,
`__tests__/components/seo/structured-data.test.tsx`,
`__tests__/app/sitemap.test.ts`, and route-specific sitemap/redirect tests.

## Analytics / Link Validation Findings

- Internal event taxonomy lives in `lib/analytics/event-taxonomy.ts` and
  `/api/events/route.ts`. Any new event in later phases must be added to all
  allowlist layers; Phase 14 can add an inventory note for existing events to
  reuse (`page_view`, `beach_view`, `forecast_interaction`, `cta_click`,
  `ios_app_cta_click`, share events).
- Pre-auth event guards remain critical: CTA components must self-guard with
  `useAuth()` and `/api/events` blocks pre-auth-only events for authenticated
  users.
- AASA currently includes `/auth/*`, `/sessions/*`, `/beach/*`, `/profile/*`,
  `/map*`, `/invite/*`, and `/settings*`. New session-window links in later
  phases may need AASA updates, but Phase 14 should only record the current
  contract and tests.
- Existing deeplink tests are partially quarantined in
  `e2e/push-deeplink-routing.spec.ts`; do not assume full E2E health for beach
  deeplinks without reviewing skipped tests and TODOs.

## Recommended Artifacts

Create one durable documentation artifact for Phase 14:

- `docs/session-intelligence/phase-14-template-inventory.md`

Suggested sections:

1. Guardrail note: Ahrefs is sampled, crawl cap fixed, confirm against GSC,
   Vercel, PostHog, direct template review, or code inspection.
2. Scope fence: no new ML, no canonical changes, no metadata mass edits, no
   duplicate SEO pages, no unsupported source claims.
3. Template inventory table with the Phase 14 template list and file paths.
4. Data availability matrix by template: forecast horizon, tide, water-temp,
   buoy/source confidence, cam, user reports/intel, local spot intel, CTA/link
   support.
5. Performance risk register with profiling or "avoid for v1" disposition.
6. Structured data sampling checklist and commands.
7. App link / analytics validation checklist.

## Validation Architecture

Use Jest 29, scoped ESLint, route/source guards, and a small E2E registration
check. This phase mostly changes planning docs and possibly documentation tests;
it should avoid broad E2E unless a route test is added.

Suggested focused commands:

```bash
source ~/.nvm/nvm.sh && nvm use 22
npx eslint --max-warnings=0 docs/session-intelligence/phase-14-template-inventory.md .planning/phases/14-session-intelligence-addendum/14-*.md
rg -n "Ahrefs|fixed crawl cap|GSC|Vercel|PostHog|canonical URLs are unchanged|new ML model|unsupported data-source claims" docs/session-intelligence/phase-14-template-inventory.md
rg -n "app/\\[intent\\]/\\[city\\]/page.tsx|app/\\[intent\\]/\\[city\\]/\\[beachSlug\\]/page.tsx|app/forecast/page.tsx|app/forecast-accuracy/page.tsx|app/best-time-to-surf/\\[city\\]/page.tsx" docs/session-intelligence/phase-14-template-inventory.md
rg -n "TideDatasetSchema|WaterTempDatasetSchema|BeachPageStructuredData|WebPageSchema|ItemListSchema" docs/session-intelligence/phase-14-template-inventory.md
npx playwright test --list e2e/push-deeplink-routing.spec.ts e2e/beach-detail.spec.ts e2e/forecast-hub.spec.ts e2e/beginner-page.spec.ts
```

If Phase 14 adds a script/test to parse the inventory table, keep it small and
run it with Jest or Node. Do not add a new dependency.

## Risks

- Treating all intent pages as one template would hide important differences:
  tide, water-temp, dawn-patrol, sunset, beginner, least-crowded, state-level,
  and generic city pages have different data and fallback behavior.
- Source-confidence UI can overclaim quickly. The inventory must distinguish
  "data exists somewhere in the system" from "this template fetches it."
- Water-temp and tide pages are SEO utilities; retargeting them as surf-report
  pages violates the phase guardrails.
- Canonical metadata is sensitive and explicitly frozen from mass changes in
  the user instructions; plans should add guards that verify no canonical edits.
- Existing push deeplink E2E contains skipped bug-quarantine tests. Later app-link
  confidence needs real validation, not only historical test references.
- `.planning/ROADMAP.md`, `.planning/STATE.md`, and Phase 14-20 contexts are
  already dirty before planning; do not revert or overwrite unrelated changes.

## Recommended Plan Shape

1. Plan 14-01: create the Session Intelligence guardrail and template inventory
   document with exact file-path references and scope fences.
2. Plan 14-02: fill the data availability matrix and source-claim rules by
   template, including forecast horizon, tide, water temp, buoy/source
   confidence, cams, user reports/intel, local spot intel, and CTA/link support.
3. Plan 14-03: add performance and structured-data validation instructions,
   including route profiling targets, schema sample targets, and no-canonical
   change guards.
4. Plan 14-04: close the validation surface with link/analytics review,
   targeted command evidence, and planning-state updates.

## RESEARCH COMPLETE
