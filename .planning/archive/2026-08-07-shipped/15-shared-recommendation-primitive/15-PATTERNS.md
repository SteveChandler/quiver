# Phase 15 Pattern Map: Shared Recommendation Primitive

Gathered: 2026-06-01

## Purpose

Map the existing Quiver patterns the Phase 15 executor should reuse while
creating the shared `SurfWindowRecommendation` data model and deterministic
top-window helper.

## Type Contract Patterns

### Runtime constants plus TypeScript unions

Analogs:

- `types/personalization.ts`
- `types/api/recommendations.ts`
- `lib/services/discovery/recommendations-v2.ts`

Pattern:

- Define literal arrays with `as const`.
- Derive union types from those arrays.
- Export narrow runtime guards only when tests or callers need to validate
  external strings.
- Keep persisted/API schemas separate from pure in-memory domain types.

Phase 15 should use this for verdicts, best-for tags, wind quality, tide trend,
source flags, and confidence levels.

### Recommendation candidate to response item

Analog: `lib/services/discovery/recommendations-v2.ts`

Pattern:

- Normalize and clamp scores at the response boundary.
- Filter invalid dates before ranking.
- Sort deterministically with explicit tie-breakers.
- Return an explicit empty/no-good-window state instead of `undefined`.

Phase 15 should use score descending, confidence descending, start time
ascending, and beach id/window id tie-breakers.

## Window Selection Patterns

### Preserve existing single-window API

Analogs:

- `lib/services/discovery/window-selector/window-selector-core.ts`
- `__tests__/lib/services/discovery/window-selector.test.ts`
- `actions/spot/spot-surf-report-actions.ts`

Pattern:

- Keep existing exports stable.
- Add new exported helper(s) beside the existing API.
- Make `selectBestWindow` call the new shared selector and return the first
  candidate so existing callers retain behavior.
- Inject `now?: Date` into the options object for deterministic tests while
  defaulting to `new Date()`.

Phase 15 should not rewrite the spot surf-call action unless a compatibility
test proves a narrow adapter change is needed.

### Domain scoring engine reuse

Analogs:

- `lib/services/discovery/window-selector/window-scorer.ts`
- `lib/domains/scoring/discovery-adapter.ts`
- `lib/domains/scoring/scoring-engine.ts`

Pattern:

- Convert `Beach` and `EnhancedForecastEntity` through
  `beachToSpotProfile` and `forecastToSnapshot`.
- Use the existing scoring engine and scorer weights.
- Expose a composite-score helper if the recommendation builder needs reasons
  and warnings; keep `scoreWindowWithEngine` as the numeric compatibility
  wrapper.

Do not use deprecated legacy session-window scorers for Phase 15.

## Source Claim Patterns

### Evidence only when thresholds are met

Analog: `lib/services/discovery/recommendation-evidence.ts`

Pattern:

- Emit session-history, condition-pattern, and board-fit evidence only when the
  supporting counts/data exist.
- Fall back to current-condition proof when personal evidence is absent.
- Avoid turning missing evidence into positive claims.

Phase 15 should use the same posture for buoy, tide, cam, user-report, and local
intel source flags.

### Data source display conservatism

Analogs:

- `docs/session-intelligence/phase-14-template-inventory.md`
- `components/forecast/ForecastDataSourceIndicator` references in the Phase 14
  inventory

Pattern:

- "Model only" and "sparse data" are valid fallback states.
- `buoy + model`, `model + tide`, `cam`, and `user report` labels require
  direct supporting data.
- Optional sources are omitted from source chips when unavailable.

Phase 15 source flags should be pure booleans plus data notes so Phase 16 UI can
render honest copy.

## Link Patterns

### Beach URL generation

Analog: `lib/utils/beach-url-utils.ts`

Pattern:

- Use `buildBeachUrl` or `getBeachHrefSafe` for crawlable canonical web URLs.
- Fall back to `/beach/{slug}` only when hierarchical pieces are missing.
- Keep canonical URLs free of tracking/window query params.

### App-compatible link path

Analogs:

- `app/.well-known/apple-app-site-association/route.ts`
- `__tests__/lib/services/forecast-alerts-deeplink.test.ts`
- `docs/session-intelligence/phase-14-template-inventory.md`

Pattern:

- Current AASA support includes `/beach/*`.
- Existing forecast-alert links use `/beach/{beach_slug}`.
- Future window-specific native routes are Phase 20 scope.

Phase 15 should generate an app-compatible path with a window query, for
example `/beach/{slug}?window={windowId}`, and an absolute universal link using
the configured/base URL.

## Test Patterns

### Pure forecast helper factories

Analogs:

- `__tests__/lib/services/discovery/window-selector.test.ts`
- `__tests__/lib/utils/surf-call-logic.test.ts`
- `__tests__/actions/spot/spot-surf-report-actions.test.ts`

Pattern:

- Use typed `makeBeach` and `makeForecast` factories.
- Use fake timers or an injected `now` for time-dependent selection.
- Assert behavior, not implementation details, except where protecting a
  compatibility boundary.
- Include missing/null field cases for tide, buoy/source, and confidence.

### Link contract tests

Analog: `__tests__/lib/services/forecast-alerts-deeplink.test.ts`

Pattern:

- Validate relative app paths are relative.
- Validate universal links are absolute.
- Validate canonical URLs omit the window query.
- Validate slugs are encoded through the helper contract and do not invent new
  route patterns.

## Recommended File Map

| Purpose | File |
|---------|------|
| Shared model contract | `types/session-intelligence.ts` |
| Top-window selection | `lib/services/discovery/window-selector/window-selector-core.ts` |
| Window selector types/exports | `lib/services/discovery/window-selector/types.ts`, `lib/services/discovery/window-selector/index.ts` |
| Composite score helper | `lib/services/discovery/window-selector/window-scorer.ts` |
| Recommendation builder | `lib/recommendations/surf-window-recommendations.ts` |
| Source flags | `lib/recommendations/surf-window-source-flags.ts` |
| Link generation | `lib/recommendations/surf-window-links.ts` |
| Type tests | `__tests__/types/session-intelligence.test.ts` |
| Selector tests | `__tests__/lib/services/discovery/window-selector.test.ts` |
| Recommendation tests | `__tests__/lib/recommendations/surf-window-recommendations.test.ts` |
| Link/source tests | `__tests__/lib/recommendations/surf-window-links.test.ts` |

## Scope Guard

Phase 15 must not edit:

- `app/layout.tsx`
- `lib/constants/seo.ts`
- `app/[intent]/*` route files
- UI components
- migrations
- package manifests

If an executor finds one of those edits is required, stop and re-plan instead of
folding it into this phase.
