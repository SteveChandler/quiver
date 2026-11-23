# Selection primitive — Stage 2

Date: 2026-08-13

## Status and policy

Stage 2 converts Quiver-owned recommendation and selection boundaries to the
branded `rankBeaches` / `selectBeach` primitive. The primitive remains the only
place that resolves water-quality holds for a recommendation. No
`includeHeld`/`allowHeld` escape hatch was added.

No commit was created. `quiver-native/` was not touched. The migration in the
worktree was not applied, and generated database types were not edited.

## Converted sites and regression guards

Each listed test contains a held-beach fixture or an explicit selection-boundary
assertion. Removing the corresponding primitive call makes that guard fail.

### Public selection surfaces

- Featured: `lib/data/server/featured-beaches.ts` ranks the complete enriched
  source before deriving nearby/global/skill lists and before the cache write.
  Guard: `__tests__/lib/data/server/featured-beaches.test.ts` — “does not
  return a held beach from featured ranking”.
- Popular: `app/api/beaches/popular/route.ts` ranks both RPC and fallback
  results before applying the limit. Guard: `__tests__/api/beaches/beaches-popular.test.ts`
  — “does not return a held beach from the popularity ranking”.
- Coach picks: `app/api/coach-picks/route.ts` ranks picks before canonical
  selection. Guard: `__tests__/api/coach-picks.test.ts` — “filters
  water-quality-held coach picks before canonical selection”.
- Nearby: `lib/services/nearby-beach-service.ts` ranks RPC and bounded-fallback
  candidates before slicing. Guards: `__tests__/lib/nearby-beach-service.test.ts`
  — “does not return a held beach from nearby recommendations”, plus the
  nearby API selection-boundary assertion in
  `__tests__/api/beaches/beaches-nearby.test.ts`.
- Legacy coordinate surf results: `app/api/surf/utils.ts` filters the public
  cache before storing it. Guard: `__tests__/app/api/surf/utils.test.ts`
  asserts the cache population passes through `rankBeaches`. The direct beach
  name path remains an exact user lookup.
- Surf discovery: `lib/services/discovery/candidate-pool-builder.ts` ranks the
  ordered candidate pool, and `lib/services/discovery/surf-discovery-orchestrator.ts`
  ranks final scored recommendations before hold evaluation and truncation.
  Guards: `__tests__/lib/services/discovery/candidate-pool-builder.test.ts` —
  “should remove held beaches before discovery pool ordering”, and
  `__tests__/lib/services/discovery/major-event-hold-integration.test.ts` —
  “removes a water-quality-held beach from discovery before truncation”. The
  `/api/surf/discover` route consumes this safe service boundary.
- Week Scout: `lib/services/discovery/week-scout.ts` ranks candidate windows
  and filters the response to safe beach IDs before compacting it. Guard:
  `__tests__/lib/services/discovery/week-scout.test.ts` — “removes a
  water-quality-held beach from Week Scout recommendations”.
- Regional / best-days surfaces: `lib/utils/forecast-hub-utils.ts` ranks the
  all-beach universe before regional aggregation, best windows, current
  conditions, and hero-photo selection. Guards:
  `__tests__/lib/utils/forecast-hub-utils.test.ts` — “filters held beaches
  before regional aggregation” and “selects hero photos only after held
  beaches are removed”. City best-time and best-right-now data are also ranked
  in `actions/city/best-time-actions.ts` and
  `actions/city/city-conditions-actions.ts`; guard:
  `__tests__/actions/city/city-conditions-actions.test.ts` — “removes a held
  beach before selecting the city best-right-now beach”.
- Intent/location pages: `actions/beach/beach-query-actions.ts` ranks intent,
  city, state, and intent/state query results; `actions/beach/beach-location-list-actions.ts`
  ranks metro and city RPC rows; and `app/[intent]/page.tsx` ranks its public
  state list. Guards: `__tests__/actions/beach/beach-query-actions.test.ts`
  — “removes held beaches from intent and regional beach lists”, and
  `__tests__/actions/beach-location-list-actions.test.ts` — “city path ranks
  beaches” / “metro path ranks beaches”.
- City editorial rows: `actions/city/city-metadata-actions.ts` ranks the
  beach rows used for editorial city content. Guard:
  `__tests__/actions/city/city-metadata-actions.test.ts` — the editorial-row
  selection coverage.
- Guides and state map: `actions/beach/beach-state-actions.ts` ranks
  `getStateMapBeaches`; the guide-facing state query uses the same safe
  `getBeachesByState` cache source. Guard: `__tests__/app/state-root-page.test.tsx`
  — “filters held beaches before rendering the ranked state list”.
- Beginner editorial: `actions/beginner/beginner-actions.ts` ranks beginner
  candidates, editorial rows, and the enriched final candidate set. Guards:
  `__tests__/actions/beginner-actions.test.ts` — “uses the ranked sandy
  beginner spot for the right-now badge” and the held-candidate assertions.
- Intent forecast: `actions/forecast/intent-forecast-actions.ts` ranks the
  input candidates before truncation, ranks confidence-scored results, and
  uses `selectBeach` for representative tide/water-temperature picks. Guard:
  `__tests__/actions/forecast/intent-forecast-actions.test.ts` — “filters all
  confidence-sorted candidates before truncating and source-binds rank one”.
- Coast Pulse: `lib/services/coast-pulse/coast-pulse-service.ts` ranks the
  beach cache, forecast-derived nearest beach, daily intel, and joined intel
  rows. `fetchRecentIntel` now selects joined `beaches` fields and runs
  `selectBeach` before the pagination limit. The summary route also ranks the
  closest-beach cache before selecting its first row. Guards:
  `__tests__/services/coast-pulse-service.test.ts` — “filters held joined
  intel beaches before pagination consumes the limit”, and
  `__tests__/api/coast-pulse-summary.test.ts` — the selection-boundary
  assertion.
- OG recommendation image: `app/api/og/weekend-wave-check/route.tsx` runs
  both server-provided weekend rows through `selectBeach` and renders a
  neutral card if either is unsafe. Guard:
  `__tests__/app/api/og/major-event-hold.test.tsx` — “renders weekend
  spot/window copy from exact allowed server rows...” with two `selectBeach`
  calls.
- Session decision / canonical recommendation: `lib/recommendations/canonical-decision/service.ts`
  ranks canonical decision recommendations before the decision engine;
  `/api/surf/session-decision` therefore receives a branded selection boundary.
  Guard: `__tests__/app/api/surf/session-decision-route.test.ts` — the seeded
  held high-score / safe lower-score case, which must return the safe choice
  and preserve the discovery call shape.

### Notification producers

- Weekend Scout delivery: `lib/cron/weekend-scout-runner.ts` uses `selectBeach`
  for the stored lead and persists the exact beach, forecast window, and
  positive-session policy context in the payload. Guard:
  `__tests__/lib/cron/weekend-scout-runner.test.ts` — “enqueues only the stored
  snapshot summary...” including the exact `selectBeach` input and payload.
- Session-prompt email and daily call-streak reminder: the producers rank
  their candidate rows before naming or selecting a deliverable candidate.
  Guards: `__tests__/app/api/cron/session-prompt-email.test.ts` — “does not
  send a session-prompt email naming a held home beach”, and the streak
  reminder candidate-selection coverage in
  `__tests__/app/api/cron/streak-reminder.test.ts`.
- Similarity alerts: the configured home beach remains available as the
  user-configured anchor, while favorite/nearby alternatives are ranked and
  held alternatives are removed before scoring. Guards:
  `__tests__/api/cron/similarity-alerts.test.ts` — “removes a held alternative
  from the similarity candidate pool before scoring” and “suppresses held or
  unresolved similarity picks before the queue RPC”.
- Stage 1 carry-forward notification boundary: `home-morning-call` still
  uses `selectBeach` after canonical decision resolution, and the notification
  adapter evaluates the exact candidate/policy context. Its Stage 1 guard is
  `__tests__/api/cron/home-morning-call.test.ts`.

## Cache filtering

Caches are safe before the write, rather than filtered after a cache read:

- Intent/city, state, and intent/state caches in
  `actions/beach/beach-query-actions.ts` rank inside their uncached database
  functions. The cached wrappers now return that already-safe value directly;
  they do not post-filter a previously populated raw cache.
- `lib/data/server/featured-beaches.ts` ranks the complete source inside the
  cached producer before derived lists are returned or stored.
- `app/api/surf/utils.ts` ranks `getCachedBeaches()` before assigning the
  module-level four-hour legacy cache.
- Coast Pulse ranks the beach cache before derived forecast/intel data is
  written to its cached response path.

## Tests rewritten for integrity

- `__tests__/notifications/worker.test.ts` no longer mocks the resolver to an
  empty held set and no longer forces `applyWaterQualityHolds: false`. It seeds
  a valid held UUID and exercises the real resolver path for the feedback
  nudge.
- `__tests__/services/coast-pulse-service.test.ts` no longer replaces the
  visibility filter with an identity function. Its joined `intel_posts`
  fixture contains a held row and a safe row and verifies the held row is
  removed before the limit is consumed.
- `__tests__/app/api/surf/session-decision-route.test.ts` no longer asserts
  only a mocked resolver call shape. It uses the real canonical service with a
  seeded held set and verifies a held high-score candidate cannot win over the
  safe candidate.
- `__tests__/lib/recommendations/major-event-hold/notification.test.ts` adds
  explicit water-quality and exact-weekend-snapshot cases, including fail
  closed behavior when the snapshot context is incomplete.
- New or strengthened held-set guards cover featured, popular, coach picks,
  nearby, intent/state/location, city conditions, regional aggregation, state
  map rendering, discovery, Week Scout, Coast Pulse, session decision, OG,
  cron producers, and notification boundaries. Existing assertions were kept;
  behavior changes are called out below.

## `water_quality` notification decision

`water_quality` is deliberately allowed to name the configured affected beach.
It is a safety warning whose purpose is to identify the water-quality problem,
not a recommendation to visit or surf there. This is an explicit
`USER_CONFIGURED_SAFETY_NOTIFICATION_TYPES` exception in
`lib/recommendations/major-event-hold/adapters/notification.ts`, covered by
`__tests__/lib/recommendations/major-event-hold/notification.test.ts` and the
real-resolver integration test. Quiver positive recommendations, similarity
alternatives, weekend windows, and other recommendation types remain
water-quality-gated. No primitive bypass flag was introduced.

## Deliberately not converted

- Beach detail pages and their forecast pages, including
  `app/[intent]/[city]/[beachSlug]/page.tsx`, `app/beach/[slug]/page.tsx`, and
  `app/forecast/[beachId]/page.tsx`: these are exact slug/ID user-selected
  surfaces and must preserve the requested beach.
- Search and matching utilities (`lib/utils/beach-search-utils.ts`,
  `lib/utils/beach-lookup-utils.ts`): they resolve the user's query or exact
  slug/ID; they do not recommend a beach.
- Sitemap and SEO metadata/content generation: sitemap rows and city metadata
  are coverage/linkage or pure formatting. City/location page beach data is
  safe because it comes from `getLocationPageData`; the formatter itself does
  not own the candidate universe.
- User sessions, comments, check-ins, profile home beach, favorites, and
  weekly recap history: these are user-owned provenance, not Quiver selection.
- User-configured alert delivery (`lib/alerts/best-days.ts`, condition-alert
  evaluation/delivery, and the configured home-beach side of similarity
  alerts): the configured beach is intentionally retained even when a
  current hold exists. Similarity alternatives are the separate Quiver-owned
  recommendation pool and are converted.
- Shared forecast-window, beach, and surf-call OG/detail paths: each is keyed
  by a supplied slug/ID/window. The weekend recommendation OG path is the
  exception and is converted above because it selects from server-owned
  recommendation rows.
- `lib/npc/beach-selection.ts` / `lib/npc/npc-selection.ts`: NPC/editorial
  content chooses from a deterministic content roster, not a user-facing
  Quiver recommendation. Forecast refresh, daily-intel generation, camera
  selection, and other operational batch selectors likewise select work to
  process, not a beach to recommend.
- `actions/beach/beach-location-actions.ts` city aggregation and
  `getCityMetadata` city-slug/metadata resolution: their beach-adjacent sorts
  are location metadata, while the actual location beach list and editorial
  rows are ranked at their recommendation/list boundaries.

## Remaining beach selection outside the primitive

The remaining beach-like selectors are intentional provenance or operational
selectors, not missed Quiver recommendations:

- exact user-selected beach lookups and forecast rows;
- search/fuzzy matching and user-submitted intel nearest-beach normalization;
- profile/session/comment/check-in/history-derived beach names;
- configured alert and configured home-beach delivery;
- NPC/editorial roster selection;
- forecast/camera/intel maintenance batches;
- pure formatters that receive an already-safe ranked list, such as city SEO
  content and the location-page layouts.

The one approved safety-notification exception is `water_quality`, described
above. No remaining Quiver-owned recommendation producer was left with a raw
candidate-to-user selection boundary.

## Validation

Exact requested gate, with the requested Node 22 path and environment:

```text
export PATH="$HOME/.nvm/versions/node/v22.22.0/bin:$PATH"
export NEXT_PUBLIC_SUPABASE_URL=https://example.supabase.co
export NEXT_PUBLIC_SUPABASE_ANON_KEY=test-anon-key
export SUPABASE_SERVICE_ROLE_KEY=test-service-role-key
export NEXT_PUBLIC_SITE_URL=http://localhost:3000
yarn typecheck && yarn lint && npx jest --ci
```

Result: PASS.

```text
Test Suites: 16 skipped, 1285 passed, 1285 of 1301 total
Tests:       195 skipped, 1 todo, 16699 passed, 16895 total
Snapshots:   3 passed, 3 total
```

`git diff --check`: PASS. No E2E tests were added or run. Existing relevant
E2E coverage reviewed: `e2e/api/recommendations.spec.ts`,
`e2e/guest-api-recommendations.spec.ts`, `e2e/alerts.spec.ts`, and the
water-quality seed/helper coverage.

The Jest run still prints existing console warnings/errors from tests that
intentionally exercise error paths and React `act(...)` warnings; none failed
the gate. No unresolved Stage 2 findings remain. Remaining risk is that the
database migration is intentionally unapplied, so the primitive's documented
`42P01` pre-migration tolerance remains required until deployment ordering is
complete.
