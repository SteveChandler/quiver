---
phase: 13-controlled-refactor-completion
plan: 13-02
subsystem: api
tags: [api-wrappers, cron-observability, validation-middleware, bot-blocker, import-cleanup]
requires:
  - phase: 13-controlled-refactor-completion
    provides: Plan 13-01 session-confirm source guard and wrapper-barrel import pattern
provides:
  - Remaining non-route direct production `@/lib/api-utils` imports removed
  - Focused source guards and unit coverage for cron observability, validation middleware, and bot blocking
  - Slice 83 roadmap evidence and wrapper-compatibility next-slice guidance
affects: [controlled-refactor-completion, api-utils-migration, api-wrappers]
tech-stack:
  added: []
  patterns: [source-guard import topology test, focused utility behavior tests, response-utils cycle avoidance]
key-files:
  created:
    - __tests__/lib/validation/middleware.test.ts
    - __tests__/lib/middleware/bot-blocker.test.ts
    - .planning/phases/13-controlled-refactor-completion/13-02-SUMMARY.md
  modified:
    - lib/cron/observability.ts
    - __tests__/lib/cron/observability.test.ts
    - lib/validation/middleware.ts
    - lib/middleware/bot-blocker.ts
    - docs/refactor-roadmap.md
key-decisions:
  - "Keep `bot-blocker.ts` pointed at `api-wrappers/response-utils` instead of the top-level wrapper barrel to avoid an import cycle."
  - "Use direct unit tests where the behavior surface is utility-level rather than route-level."
patterns-established:
  - "Non-route helper imports should move through the public wrapper surface unless doing so creates a barrel cycle."
requirements-completed: [REF-01, REF-03, REF-04, REF-05]
duration: about 35min
completed: 2026-05-31
---

# Phase 13-02: Non-Route Import Cleanup Summary

**Cron observability, validation middleware, and bot blocking no longer import production helpers directly from `@/lib/api-utils`.**

## Performance

- **Duration:** About 35 min
- **Started:** 2026-05-31
- **Completed:** 2026-05-31T16:11:39-0700
- **Tasks:** 4
- **Files modified:** 8

## Accomplishments

- Migrated `validateCronRequest`, `createValidationError`, and `DEFAULT_SECURITY_HEADERS` import sources.
- Added source guards for all three production files.
- Added focused behavior tests for `parseAndValidateJson` and `withBotBlocking`.
- Recorded Slice 83 completion and the next wrapper compatibility slice in `docs/refactor-roadmap.md`.

## Task Commits

No commits were created. Repository instructions prohibit committing without explicit user approval.

## Files Created/Modified

- `lib/cron/observability.ts` - Changed only the `validateCronRequest` import source.
- `__tests__/lib/cron/observability.test.ts` - Added source guard.
- `lib/validation/middleware.ts` - Changed only the `createValidationError` import source.
- `__tests__/lib/validation/middleware.test.ts` - Added JSON parsing/error response tests and source guard.
- `lib/middleware/bot-blocker.ts` - Changed only the `DEFAULT_SECURITY_HEADERS` import source.
- `__tests__/lib/middleware/bot-blocker.test.ts` - Added blocked/allowed request tests and source guard.
- `docs/refactor-roadmap.md` - Recorded Slice 83 validation, rollback, risks, and next slice.
- `.planning/phases/13-controlled-refactor-completion/13-02-SUMMARY.md` - Created this execution summary.

## Decisions Made

`bot-blocker.ts` imports `DEFAULT_SECURITY_HEADERS` from `api-wrappers/response-utils`, not from the top-level `api-wrappers` barrel, because the barrel re-exports `withBotBlocking` from `bot-blocker.ts`.

## Deviations from Plan

The validation middleware test needed the repo's `next/server` test mock because real `NextRequest`/`NextResponse.json` are not reliable in this Jest environment. The test still exercises the real middleware code and the exact response messages required by the plan.

## Issues Encountered

Scoped ESLint rejected conditional expectations in the new validation middleware test. A small `requireValidationError` helper replaced the conditional `expect` calls.

## Verification

- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/cron/observability.test.ts` failed before migration on the new source guard, then passed after migration: 16 tests passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 lib/cron/observability.ts __tests__/lib/cron/observability.test.ts` passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/validation/middleware.test.ts` failed before migration on the new source guard after test-environment fixes, then passed after migration: 5 tests passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 lib/validation/middleware.ts __tests__/lib/validation/middleware.test.ts` passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/middleware/bot-blocker.test.ts __tests__/lib/middleware/api-wrappers.test.ts` failed before migration on the new source guard, then passed after migration: 40 tests passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 lib/middleware/bot-blocker.ts __tests__/lib/middleware/bot-blocker.test.ts` passed.
- `rg -n "@/lib/api-utils" lib/cron/observability.ts lib/validation/middleware.ts lib/middleware/bot-blocker.ts || true` returned no matches.

## User Setup Required

None. No external services, migrations, deploys, or environment changes are required.

## Next Phase Readiness

Plan 13-03 is ready. It should export missing compatibility types, migrate route type imports to the public wrapper surface, and update stale API import guidance.

---
*Phase: 13-controlled-refactor-completion*
*Completed: 2026-05-31*
