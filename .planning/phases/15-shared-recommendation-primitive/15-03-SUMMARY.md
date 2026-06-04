---
phase: 15-shared-recommendation-primitive
plan: 15-03
subsystem: recommendations
tags: [session-intelligence, surf-window-recommendations, horizon, source-claims]
requires:
  - phase: 15-shared-recommendation-primitive
    provides: "15-01 shared recommendation model and 15-02 top-window selector"
provides:
  - "Pure buildSurfWindowRecommendations helper"
  - "Beach and region recommendation input support"
  - "7-day vs 14-day supplied-row horizon resolution"
affects: [phase-15, phase-16, session-intelligence]
tech-stack:
  added: []
  patterns: [pure-helper, supplied-rows-only, deterministic-ranking]
key-files:
  created:
    - lib/recommendations/surf-window-recommendations.ts
    - __tests__/lib/recommendations/surf-window-recommendations.test.ts
  modified: []
key-decisions:
  - "The helper resolves horizon from supplied forecast rows rather than widening production fetches."
  - "Recommendation output is always an explicit result object with `recommendations: []` for empty states."
patterns-established:
  - "Recommendation builders consume prepared rows and do not instantiate Supabase clients or network calls."
  - "Region ranking sorts by score, confidence, start time, beach id, and window id."
requirements-completed: [SI-02, SI-07]
duration: 40min
completed: 2026-06-02
---

# Phase 15-03: Recommendation Builder Summary

**Pure supplied-row recommendation builder that maps selected surf windows into ranked SurfWindowRecommendation results**

## Performance

- **Duration:** 40 min
- **Started:** 2026-06-02T00:50:00Z
- **Completed:** 2026-06-02T01:30:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Added `buildSurfWindowRecommendations` and `buildBeachSurfWindowRecommendations`.
- Added deterministic horizon resolution: 14 days when week-two rows are supplied, otherwise 7 days.
- Converted selected windows into serializable recommendation objects with scores, verdicts, summaries, reasons, confidence, source flags, and temporary link derivation.
- Added tests for normal ranking, region inputs, sparse rows, 7-day and 14-day horizons, low confidence, empty output, and default top-3 limiting.

## Task Commits

Not committed - repository instructions require explicit user approval before commits.

## Files Created/Modified

- `lib/recommendations/surf-window-recommendations.ts` - Pure recommendation builder for beach and region forecast groups.
- `__tests__/lib/recommendations/surf-window-recommendations.test.ts` - Focused behavior coverage for ranking, horizons, sparse rows, low confidence, empty states, and determinism.

## Decisions Made

- Kept source/link derivation small and internal for this plan; Phase 15-04 extracts and hardens those helpers.
- Used existing selector and composite scoring instead of adding a new scoring model.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Source guard initially matched `Array.from(...)` as `.from(`. Replaced those with spread syntax so the guard remains precise for database-query detection.
- Sparse-row test fixtures initially retained default fallback fields. Cleared them to exercise the intended sparse-data path.

## User Setup Required

None - no external service configuration required.

## Verification

- `rg -n "buildSurfWindowRecommendations|horizonDays|14|7|forecast_at|now|baseUrl|maxRecommendations|selectBestWindows|SurfWindowRecommendation|windowId|rank|verdict|headline|bestFor|positives|watchouts|dataNotes|confidence" lib/recommendations/surf-window-recommendations.ts` - passed.
- `! rg -n "createSupabase|\\.from\\(|fetch\\(|OpenAI|Claude|LLM" lib/recommendations/surf-window-recommendations.ts` - passed.
- `yarn test:unit __tests__/lib/recommendations/surf-window-recommendations.test.ts --runInBand` - passed.
- `npx eslint --max-warnings=0 lib/recommendations/surf-window-recommendations.ts __tests__/lib/recommendations/surf-window-recommendations.test.ts` - passed.

## Next Phase Readiness

Source-flag and link derivation can now be extracted into separately tested helpers and re-integrated into the builder.

---
*Phase: 15-shared-recommendation-primitive*
*Completed: 2026-06-02*
