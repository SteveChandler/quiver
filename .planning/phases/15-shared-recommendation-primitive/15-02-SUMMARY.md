---
phase: 15-shared-recommendation-primitive
plan: 15-02
subsystem: services
tags: [window-selector, surf-windows, scoring, jest]
requires:
  - phase: 15-shared-recommendation-primitive
    provides: "15-01 shared Session Intelligence model"
provides:
  - "Deterministic selectBestWindows helper"
  - "Composite scoring export for recommendation explanations"
  - "selectBestWindow compatibility wrapper"
affects: [phase-15, surf-call, discovery, session-intelligence]
tech-stack:
  added: []
  patterns: [injected-now, ranked-non-overlapping-windows, compatibility-wrapper]
key-files:
  created: []
  modified:
    - lib/services/discovery/window-selector/types.ts
    - lib/services/discovery/window-selector/window-scorer.ts
    - lib/services/discovery/window-selector/window-selector-core.ts
    - lib/services/discovery/window-selector/index.ts
    - __tests__/lib/services/discovery/window-selector.test.ts
key-decisions:
  - "selectBestWindows preserves the existing adjusted-score ranking path before non-overlap filtering."
  - "selectBestWindow now returns the first selected ranked window or null."
patterns-established:
  - "Time-dependent selector tests use injected now instead of wall-clock time."
  - "Top-window selection skips overlapping windows after refinement."
requirements-completed: [SI-02, SI-07]
duration: 35min
completed: 2026-06-02
---

# Phase 15-02: Top-Window Selector Summary

**Deterministic top-window selector built on the existing discovery scoring engine with single-window compatibility preserved**

## Performance

- **Duration:** 35 min
- **Started:** 2026-06-02T00:15:00Z
- **Completed:** 2026-06-02T00:50:00Z
- **Tasks:** 3
- **Files modified:** 5

## Accomplishments

- Added `now?: Date` and `maxWindows?: number` selector options.
- Added `scoreWindowWithComposite` while keeping `scoreWindowWithEngine` as the numeric compatibility wrapper.
- Added `selectBestWindows` for ranked, non-overlapping windows and routed `selectBestWindow` through it.
- Extended selector tests for max-window limits, injected time, horizon filtering, non-overlap, and compatibility.

## Task Commits

Not committed - repository instructions require explicit user approval before commits.

## Files Created/Modified

- `lib/services/discovery/window-selector/types.ts` - Added deterministic selector options.
- `lib/services/discovery/window-selector/window-scorer.ts` - Added composite score helper.
- `lib/services/discovery/window-selector/window-selector-core.ts` - Added ranked multi-window selection.
- `lib/services/discovery/window-selector/index.ts` - Exported new selector and scorer helpers.
- `__tests__/lib/services/discovery/window-selector.test.ts` - Added top-window and composite-score coverage, and cleaned touched-file lint warnings.

## Decisions Made

- Preserved the existing time-adjusted ranking path for compatibility, then applied deterministic tie-breakers and overlap filtering.
- Kept positional `selectBestWindow` callers working while adding object-based deterministic options for new callers.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

- Scoped ESLint failed on existing warnings in the touched selector test file. Cleaned those assertions so the required `--max-warnings=0` verification passes.

## User Setup Required

None - no external service configuration required.

## Verification

- `rg -n "now\\?: Date|maxWindows\\?: number|scoreWindowWithComposite|scoreWindowWithEngine" lib/services/discovery/window-selector/types.ts lib/services/discovery/window-selector/window-scorer.ts` - passed.
- `rg -n "selectBestWindows|selectBestWindow|overlap|maxWindows|now" lib/services/discovery/window-selector/window-selector-core.ts lib/services/discovery/window-selector/index.ts` - passed.
- `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts --runInBand` - passed.
- `npx eslint --max-warnings=0 lib/services/discovery/window-selector/types.ts lib/services/discovery/window-selector/window-scorer.ts lib/services/discovery/window-selector/window-selector-core.ts lib/services/discovery/window-selector/index.ts __tests__/lib/services/discovery/window-selector.test.ts` - passed.

## Next Phase Readiness

The recommendation builder can request up to three deterministic selected windows and can use composite score reasons/confidence without duplicating scoring logic.

---
*Phase: 15-shared-recommendation-primitive*
*Completed: 2026-06-02*
