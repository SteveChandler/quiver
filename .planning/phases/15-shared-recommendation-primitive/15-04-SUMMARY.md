---
phase: 15-shared-recommendation-primitive
plan: 15-04
subsystem: recommendations
tags: [session-intelligence, surf-window-recommendations, source-flags, links]
requires:
  - phase: 15-shared-recommendation-primitive
    provides: "15-03 pure surf-window recommendation builder"
provides:
  - "Conservative surf-window source flag derivation"
  - "Recommendation app, universal, and canonical link helpers"
  - "Source/link helper integration in buildSurfWindowRecommendations"
affects: [phase-15, phase-16, phase-20, session-intelligence]
tech-stack:
  added: []
  patterns: [pure-helper, conservative-source-claims, canonical-link-separation]
key-files:
  created:
    - lib/recommendations/surf-window-source-flags.ts
    - lib/recommendations/surf-window-links.ts
    - __tests__/lib/recommendations/surf-window-links.test.ts
  modified:
    - lib/recommendations/surf-window-recommendations.ts
    - __tests__/lib/recommendations/surf-window-recommendations.test.ts
key-decisions:
  - "Optional tide, buoy, cam, and user-report sources default false unless directly evidenced."
  - "Window-specific app/universal links are generated separately from canonical beach URLs."
patterns-established:
  - "Recommendation source flags are produced by a pure helper before UI rendering."
  - "Canonical URLs omit `window=` even when app and universal links include it."
requirements-completed: [SI-02, SI-07]
duration: 25min
completed: 2026-06-02
---

# Phase 15-04: Source and Link Helper Summary

**Conservative source flags and separated app/universal/canonical links for shared surf-window recommendations**

## Performance

- **Duration:** 25 min
- **Started:** 2026-06-02T01:30:00Z
- **Completed:** 2026-06-02T01:55:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added `buildSurfWindowSourceFlags` and `buildSurfWindowDataNotes` so missing optional data cannot be presented as available evidence.
- Added `buildSurfWindowLinks` for relative app deep links, absolute universal links, and canonical web URLs without window queries.
- Rewired `buildSurfWindowRecommendations` to use the shared source and link helpers.
- Added direct helper tests plus a builder integration test for source hints and generated links.

## Task Commits

Not committed - repository instructions require explicit user approval before commits.

## Files Created/Modified

- `lib/recommendations/surf-window-source-flags.ts` - Pure source flag and sparse-data note derivation.
- `lib/recommendations/surf-window-links.ts` - Pure app, universal, and canonical recommendation link generation.
- `lib/recommendations/surf-window-recommendations.ts` - Builder integration with the shared source/link helpers.
- `__tests__/lib/recommendations/surf-window-links.test.ts` - Source flag and link helper coverage.
- `__tests__/lib/recommendations/surf-window-recommendations.test.ts` - Builder integration coverage for helper output.

## Decisions Made

- Kept cam and user-report flags explicit-hint only to avoid source overclaiming.
- Treated buoy evidence as explicit hints, CDIP raw data, or source strings containing CDIP/buoy.
- Used `/beach/{slug}?window={windowId}` as the app-compatible link when a slug exists, while preserving hierarchical beach URLs for canonical web links.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Self-review found `raw_forecast.data_sources` assumed an array. Updated the helper to tolerate a single raw source value and added a regression assertion for string source metadata.

## User Setup Required

None - no external service configuration required.

## Verification

- `rg -n "buildSurfWindowSourceFlags|buildSurfWindowLinks|appDeepLink|universalLink|canonicalWebUrl" lib/recommendations` - passed.
- `! rg -n "createSupabase|\\.from\\(|OpenAI|Claude|LLM|fetch\\(" types/session-intelligence.ts lib/recommendations/surf-window-recommendations.ts lib/recommendations/surf-window-source-flags.ts lib/recommendations/surf-window-links.ts` - passed.
- `git diff -- app/layout.tsx lib/constants/seo.ts` - passed with no output.
- `yarn test:unit __tests__/types/session-intelligence.test.ts __tests__/lib/services/discovery/window-selector.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/lib/recommendations/surf-window-links.test.ts --runInBand` - passed.
- `npx eslint --max-warnings=0 types/session-intelligence.ts lib/services/discovery/window-selector/types.ts lib/services/discovery/window-selector/window-selector-core.ts lib/services/discovery/window-selector/window-scorer.ts lib/services/discovery/window-selector/index.ts lib/recommendations/surf-window-recommendations.ts lib/recommendations/surf-window-source-flags.ts lib/recommendations/surf-window-links.ts __tests__/types/session-intelligence.test.ts __tests__/lib/services/discovery/window-selector.test.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts __tests__/lib/recommendations/surf-window-links.test.ts` - passed.
- `yarn typecheck` - passed.

## Next Phase Readiness

Phase 16 can consume one shared recommendation contract and helper output without duplicating scoring, source claims, or link construction.

---
*Phase: 15-shared-recommendation-primitive*
*Completed: 2026-06-02*
