---
phase: 16-reusable-session-intelligence-ui-components
plan: 16-02
subsystem: ui-components
tags: [session-intelligence, disclosure, accessibility, jest]
requires:
  - phase: 16-reusable-session-intelligence-ui-components
    plan: 16-01
provides:
  - "Reusable WhyThisCall disclosure"
affects: [phase-16, phase-17, session-intelligence]
tech-stack:
  added: []
  patterns: [radix-accordion, honest-source-display]
key-files:
  created:
    - components/session-intelligence/why-this-call.tsx
    - __tests__/components/session-intelligence/why-this-call.test.tsx
  modified: []
requirements-completed: [SI-03, SI-07]
completed: 2026-06-02
---

# Phase 16-02: Accessible WhyThisCall Disclosure Summary

## Accomplishments

- Added `WhyThisCall` with the existing accordion wrapper.
- Rendered positives, watchouts, confidence reasons, and source chips as labeled sections.
- Reused `getSurfWindowSourceLabels` so unavailable buoy, cam, tide, and user-report sources are omitted.
- Added tests for collapsed content, expanded content, and missing-source behavior.

## Task Commits

Not committed - repository instructions require explicit user approval before commits.

## Files Created/Modified

- `components/session-intelligence/why-this-call.tsx`
- `__tests__/components/session-intelligence/why-this-call.test.tsx`

## Decisions Made

- Used accordion instead of modal/drawer to avoid escape-key and focus-trap complexity for the reusable card surface.
- Kept the trigger label visible and added an aria label with beach/time context.

## Deviations from Plan

None.

## Issues Encountered

- The first component test used a single `getByRole("region")` assertion and failed because expanding the disclosure creates multiple labeled regions. The assertion was changed to verify at least one region exists.

## Verification

- `yarn test:unit __tests__/components/session-intelligence/why-this-call.test.tsx --runInBand` - failed once on the over-specific region assertion, then passed after fixing the test.
- `npx eslint --max-warnings=0 components/session-intelligence/why-this-call.tsx __tests__/components/session-intelligence/why-this-call.test.tsx` - passed.

## Next Phase Readiness

`BestSurfWindows` can compose the disclosure into each recommendation card.

