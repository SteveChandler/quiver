---
phase: 16-reusable-session-intelligence-ui-components
plan: 16-01
subsystem: ui-components
tags: [session-intelligence, source-confidence, app-links, jest]
requires:
  - phase: 15-shared-recommendation-primitive
    provides: "SurfWindowRecommendation link and source flag contract"
provides:
  - "Reusable SourceConfidenceBadge"
  - "Reusable AppDeepLinkCTA"
affects: [phase-16, phase-17, session-intelligence]
tech-stack:
  added: []
  patterns: [radix-shadcn-button, honest-source-display]
key-files:
  created:
    - components/session-intelligence/source-confidence-badge.tsx
    - components/session-intelligence/app-deep-link-cta.tsx
    - components/session-intelligence/index.ts
    - __tests__/components/session-intelligence/source-confidence-badge.test.tsx
    - __tests__/components/session-intelligence/app-deep-link-cta.test.tsx
  modified: []
requirements-completed: [SI-03, SI-07]
completed: 2026-06-02
---

# Phase 16-01: Source Badge And Deep-Link CTA Summary

## Accomplishments

- Added `SourceConfidenceBadge` with labels for high/medium/low confidence, model-only cases, and sparse data.
- Added `getSurfWindowSourceLabels` so downstream components reuse the same source truth.
- Added `AppDeepLinkCTA` with universal link, app deep link, and App Store fallback resolution.
- Added focused Jest tests for missing source omission and CTA href priority.

## Task Commits

Not committed - repository instructions require explicit user approval before commits.

## Files Created/Modified

- `components/session-intelligence/source-confidence-badge.tsx`
- `components/session-intelligence/app-deep-link-cta.tsx`
- `components/session-intelligence/index.ts`
- `__tests__/components/session-intelligence/source-confidence-badge.test.tsx`
- `__tests__/components/session-intelligence/app-deep-link-cta.test.tsx`

## Decisions Made

- Kept source labels derived from boolean source flags only.
- Preferred universal links over app-only links so web rendering remains safe.

## Deviations from Plan

None.

## Issues Encountered

None.

## Verification

- `yarn test:unit __tests__/components/session-intelligence/source-confidence-badge.test.tsx __tests__/components/session-intelligence/app-deep-link-cta.test.tsx --runInBand` - passed.
- `npx eslint --max-warnings=0 components/session-intelligence/source-confidence-badge.tsx components/session-intelligence/app-deep-link-cta.tsx components/session-intelligence/index.ts __tests__/components/session-intelligence/source-confidence-badge.test.tsx __tests__/components/session-intelligence/app-deep-link-cta.test.tsx` - passed.

## Next Phase Readiness

`WhyThisCall` and `BestSurfWindows` can consume the shared source labels and CTA primitive.

