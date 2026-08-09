---
phase: 15-shared-recommendation-primitive
plan: 15-01
subsystem: types
tags: [session-intelligence, recommendations, source-flags, jest]
requires:
  - phase: 14-session-intelligence-addendum
    provides: "Session Intelligence source-claim and template guardrails"
provides:
  - "Serializable SurfWindowRecommendation contract"
  - "Exact Phase 15 vocabulary constants and guards"
affects: [phase-15, phase-16, session-intelligence]
tech-stack:
  added: []
  patterns: [readonly-literal-vocabulary, pure-serializable-types]
key-files:
  created:
    - types/session-intelligence.ts
    - __tests__/types/session-intelligence.test.ts
  modified: []
key-decisions:
  - "Source flag runtime keys use URL-safe vocabulary while the model exposes camelCase booleans."
  - "Recommendation dates are ISO strings in the shared contract."
patterns-established:
  - "Session Intelligence model files stay framework-free and serializable."
  - "Vocabulary drift is protected by exact-value Jest assertions."
requirements-completed: [SI-02, SI-07]
duration: 15min
completed: 2026-06-02
---

# Phase 15-01: Shared Model Contract Summary

**Serializable SurfWindowRecommendation contract with exact verdict, source, confidence, tide, wind, and best-for vocabularies**

## Performance

- **Duration:** 15 min
- **Started:** 2026-06-02T00:00:00Z
- **Completed:** 2026-06-02T00:15:00Z
- **Tasks:** 3
- **Files modified:** 2

## Accomplishments

- Added `types/session-intelligence.ts` with the shared recommendation model.
- Added readonly vocabulary constants and narrow runtime guards.
- Added focused Jest coverage for exact vocabulary, source flags, and a representative recommendation object.

## Task Commits

Not committed - repository instructions require explicit user approval before commits.

## Files Created/Modified

- `types/session-intelligence.ts` - Shared Session Intelligence recommendation types, constants, and guards.
- `__tests__/types/session-intelligence.test.ts` - Contract tests for vocabulary, guards, source flags, links, and representative recommendation shape.

## Decisions Made

- Kept source key constants as stable display/runtime keys while modeling source booleans as camelCase TypeScript fields.
- Kept the result type explicit with `recommendations: []` support instead of `undefined`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Verification

- `rg -n "SURF_WINDOW_VERDICTS|SURF_WINDOW_WIND_QUALITIES|SURF_WINDOW_TIDE_TRENDS|SURF_WINDOW_BEST_FOR_TAGS|SURF_WINDOW_CONFIDENCE_LEVELS|SURF_WINDOW_SOURCE_FLAG_KEYS|isSurfWindowVerdict|isSurfWindowBestForTag|isSurfWindowConfidenceLevel" types/session-intelligence.ts` - passed.
- `rg -n "interface SurfWindowRecommendation|windowId|rank|startIso|endIso|peakIso|forecastAt|localTimeLabel|score|verdict|headline|wave|wind|tide|bestFor|positives|watchouts|dataNotes|confidence|sources|appDeepLink|universalLink|canonicalWebUrl" types/session-intelligence.ts` - passed.
- `yarn test:unit __tests__/types/session-intelligence.test.ts --runInBand` - passed.
- `npx eslint --max-warnings=0 types/session-intelligence.ts __tests__/types/session-intelligence.test.ts` - passed.

## Next Phase Readiness

The selector and builder plans can import the shared recommendation vocabulary and model.

---
*Phase: 15-shared-recommendation-primitive*
*Completed: 2026-06-02*
