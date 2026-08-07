# Phase 15 Research: Shared Recommendation Primitive

Gathered: 2026-06-01
Status: Ready for planning

## Objective

Plan the shared `SurfWindowRecommendation` model and deterministic helper that
returns the top surf windows from existing forecast rows. Phase 15 should create
the reusable data primitive only. It should not add UI, routes, metadata,
schemas, migrations, new ML, or production fetch integrations.

## Inputs Reviewed

- `.planning/STATE.md`, `.planning/ROADMAP.md`, `.planning/REQUIREMENTS.md`
- `.planning/phases/15-shared-recommendation-primitive/15-CONTEXT.md`
- `docs/ARCHITECTURE.md`
- `docs/session-intelligence/phase-14-template-inventory.md`
- `actions/ARCHITECTURE.md`
- `actions/spot/spot-surf-report-actions.ts`
- `lib/services/ARCHITECTURE.md`
- `lib/services/discovery/window-selector/ARCHITECTURE.md`
- `lib/services/discovery/window-selector/*`
- `lib/domains/ARCHITECTURE.md`
- `lib/domains/scoring/*`
- `lib/services/discovery/recommendation-evidence.ts`
- `lib/services/discovery/response-formatter.ts`
- `lib/services/discovery/recommendations-v2.ts`
- `lib/services/forecast-recommendation-context.ts`
- `lib/recommendations/session-context.ts`
- `lib/utils/beach-url-utils.ts`
- `lib/constants/app-store.ts`
- `app/.well-known/apple-app-site-association/route.ts`
- `types/ARCHITECTURE.md`
- `types/forecast.ts`
- `types/personalization.ts`
- `types/api/recommendations.ts`
- `__tests__/actions/spot/spot-surf-report-actions.test.ts`
- `__tests__/lib/services/discovery/window-selector.test.ts`
- `__tests__/lib/services/discovery/recommendation-evidence.test.ts`
- `__tests__/lib/utils/surf-call-logic.test.ts`
- `__tests__/lib/services/forecast-alerts-deeplink.test.ts`

## Existing Scoring And Window Selection

The spot surf-call path already has the key pieces Phase 15 needs:

- `getSpotSurfReportPublic(beach)` and `getSpotSurfReport(beach)` fetch
  existing `enhanced_forecasts` rows, call `selectBestWindow`, and pass the
  selected window to `computeSurfCall`.
- `selectBestWindow` lives in
  `lib/services/discovery/window-selector/window-selector-core.ts`. It selects a
  single `PersonalizedForecastWindow`, applies daylight, time-slot, sunset,
  tide-boundary, minimum-session, confidence, and past-window rules, and uses
  `scoreWindowWithEngine`.
- `scoreWindowWithEngine` uses the domain scoring engine through
  `beachToSpotProfile` and `forecastToSnapshot`, so Phase 15 can reuse existing
  deterministic v1 scoring rather than creating another scorer.
- The scoring domain already covers wave height, swell alignment and
  interference, wind quality, tide fit, tide direction, setup risk, window
  stability, and trend preference.
- `computeSurfCall` already maps score bands into user-facing surf-call outcomes
  and enforces low-confidence and short-window downgrades. Phase 15 needs the
  shared `Worth it` / `Maybe` / `Skip` vocabulary from
  `getRecommendationLabel` and `getRecommendationLabelGated`, not the legacy
  `YES` / `MAYBE` / `NO` output.

The main gap is that `selectBestWindow` returns only one window and uses
`new Date()` internally. Phase 15 should add a deterministic top-window helper
with an injectable `now` while preserving the existing single-window API.

## Existing Recommendation Shapes

Useful analogs already exist:

- `types/personalization.ts` defines `PersonalizedForecastWindow` and discovery
  recommendation shapes used by home/discovery surfaces.
- `lib/services/discovery/recommendations-v2.ts` builds deterministic response
  state from candidates, clamps scores, ranks items, and handles no-good-window
  fallback state.
- `lib/services/discovery/recommendation-evidence.ts` turns supported evidence
  into reason types and proof summaries without overclaiming personal, board, or
  source history.
- `lib/recommendations/session-context.ts` uses a typed payload plus a Zod
  schema when data crosses a persistence boundary. Phase 15 does not persist
  rows, so TypeScript types and runtime constants are enough unless a later
  route/API is added.

## Link And Source Findings

- AASA currently includes `/beach/*`, but not a dedicated session-window route.
  Phase 15 can generate a safe app-compatible path such as
  `/beach/{slug}?window={windowId}` and an absolute universal link for that path.
  Phase 20 owns any native route or AASA expansion.
- Canonical web URLs should use `buildBeachUrl` or `getBeachHrefSafe` and must
  omit the window query so Phase 15 does not alter canonical behavior.
- Existing forecast-alert deeplink tests validate `/beach/{slug}` style paths.
- `IOS_APP_STORE_URL` remains a fallback constant for later UI; Phase 15 should
  not render an App Store CTA.
- Tide, buoy, cam, user-report, and local-intel source claims must come from data
  actually present in the helper input or selected row. Missing sources should
  set source flags to false and optionally produce data notes; they must not
  appear as available sources.

## Implementation Boundary

Recommended production surface:

- `types/session-intelligence.ts`: shared type contract, constants, and narrow
  runtime type guards for verdicts/tags/source flags/confidence levels.
- `lib/services/discovery/window-selector/*`: add deterministic
  `selectBestWindows`/top-window support by reusing existing candidate/scoring
  logic and preserving `selectBestWindow`.
- `lib/recommendations/surf-window-recommendations.ts`: compose beaches,
  forecast rows, selected windows, scoring explanations, source flags, and link
  fields into `SurfWindowRecommendation[]`.
- `lib/recommendations/surf-window-source-flags.ts` and
  `lib/recommendations/surf-window-links.ts`: keep source-claim and link logic
  small and directly testable.

Avoid these scopes:

- No new ML model or paid API.
- No forecast database fetch widening in this phase; the helper consumes rows
  supplied by callers.
- No UI components (`BestSurfWindows`, `WhyThisCall`, `SourceConfidenceBadge`,
  `AppDeepLinkCTA`) and no route integration.
- No metadata/canonical edits, no schema edits, no migration, and no package
  installs.
- Do not use deprecated `lib/scorers/session-window-scorer.ts` or
  `lib/utils/recommendation-scorer.ts` for the new primitive.

## Horizon Strategy

Phase 15 should implement horizon selection over supplied forecast rows:

- Resolve a local horizon of 14 days when any valid future forecast row exists
  beyond the seventh day and within day 14.
- Fall back to a 7-day horizon when rows only cover the first seven days.
- Ignore rows outside the resolved horizon.
- Return no recommendation when no valid future daylight candidate remains.

This keeps the helper deterministic and testable without adding a new database
query. Later integration phases can decide which surfaces fetch 7-day or 14-day
rows.

## Required Test Coverage

Unit tests should cover:

- Normal scoring and ranking returns the top 3 recommendations.
- Missing tide data does not set tide as an available source and does not throw.
- Missing buoy data does not set buoy as an available source and does not throw.
- Sparse rows still produce a recommendation when a valid window exists.
- Only 7-day data resolves a 7-day horizon.
- Rows with 14-day data resolve a 14-day horizon and can rank later windows.
- Low confidence output downgrades confidence copy/level without inventing
  source support.
- No valid future rows returns an empty recommendation state.
- `selectBestWindow` behavior remains compatible while top-window selection is
  added.
- Link fields include an app-compatible `/beach/{slug}?window=...` path, an
  absolute universal link, and a canonical web URL without a window query.

## Validation Architecture

Use Jest 29 node/jsdom tests, scoped ESLint, TypeScript, and source guards. No
Playwright E2E is required for Phase 15 because the phase adds no UI or route
behavior.

Focused verification:

```bash
yarn test:unit __tests__/types/session-intelligence.test.ts __tests__/lib/services/discovery/window-selector.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/lib/recommendations/surf-window-links.test.ts --runInBand
npx eslint --max-warnings=0 types/session-intelligence.ts lib/services/discovery/window-selector/types.ts lib/services/discovery/window-selector/window-selector-core.ts lib/services/discovery/window-selector/window-scorer.ts lib/services/discovery/window-selector/index.ts lib/recommendations/surf-window-recommendations.ts lib/recommendations/surf-window-source-flags.ts lib/recommendations/surf-window-links.ts __tests__/types/session-intelligence.test.ts __tests__/lib/services/discovery/window-selector.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/lib/recommendations/surf-window-links.test.ts
yarn typecheck
git diff -- app/layout.tsx lib/constants/seo.ts
```

Broaden to `yarn test:unit --bail=0` only after targeted tests pass or if the
implementation changes shared scoring behavior in a way that could affect other
recommendation tests.

## Planning Recommendation

Split implementation into four plans:

1. Add the shared model contract and vocabulary constants.
2. Add deterministic top-window selection on top of the existing window selector.
3. Build the recommendation helper for beach and region inputs.
4. Add source-flag/link helpers and final no-overclaim validation.
