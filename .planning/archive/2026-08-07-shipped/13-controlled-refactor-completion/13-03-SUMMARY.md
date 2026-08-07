---
phase: 13-controlled-refactor-completion
plan: 13-03
subsystem: api
tags: [api-wrappers, compatibility-shim, type-imports, architecture-docs]
requires:
  - phase: 13-controlled-refactor-completion
    provides: Plan 13-02 non-route direct import cleanup
provides:
  - Compatibility shim exports for `ResolvedParams` and `OptionalAuthContext`
  - App API route type imports migrated to the public wrapper surface
  - API architecture guidance updated away from direct `@/lib/api-utils` imports
affects: [controlled-refactor-completion, api-wrappers, app-api-routes]
tech-stack:
  added: []
  patterns: [public wrapper type imports, wrapper-internal ownership documentation]
key-files:
  created:
    - .planning/phases/13-controlled-refactor-completion/13-03-SUMMARY.md
  modified:
    - lib/middleware/api-wrappers.ts
    - app/api/intel/route.ts
    - app/api/users/[id]/sessions/route.ts
    - app/api/forecasts/bulk/route.ts
    - app/api/profile/[id]/route.ts
    - app/api/surf/insights/route.ts
    - app/api/sessions/[id]/photos/route.ts
    - app/api/events/route.ts
    - app/api/sessions/public/route.ts
    - app/api/ARCHITECTURE.md
    - docs/refactor-roadmap.md
key-decisions:
  - "Route files should import `OptionalAuthContext` from `@/lib/middleware/api-wrappers`, not the internal `types` module."
  - "Remaining `api-wrappers/types` import in `lib/middleware/bot-blocker.ts` is wrapper-adjacent and intentionally left for now."
patterns-established:
  - "The deprecated compatibility shim remains a re-export-only file."
requirements-completed: [REF-02, REF-03, REF-04, REF-05]
duration: about 25min
completed: 2026-05-31
---

# Phase 13-03: Wrapper Compatibility Summary

**The public wrapper surface now carries route context types used by app API routes, and stale API helper import guidance is updated.**

## Performance

- **Duration:** About 25 min
- **Started:** 2026-05-31
- **Completed:** 2026-05-31
- **Tasks:** 3
- **Files modified:** 11

## Accomplishments

- Added `ResolvedParams` and `OptionalAuthContext` to `lib/middleware/api-wrappers.ts`.
- Migrated all discovered `app/api/**/route.ts` `OptionalAuthContext` imports from `api-wrappers/types` to the public wrapper surface.
- Updated `app/api/ARCHITECTURE.md` to recommend `@/lib/middleware/api-wrappers`.
- Recorded wrapper-internal ownership and `bot-blocker.ts` cycle-avoidance rationale in `docs/refactor-roadmap.md`.

## Task Commits

No commits were created. Repository instructions prohibit committing without explicit user approval.

## Files Created/Modified

- `lib/middleware/api-wrappers.ts` - Added missing type re-exports.
- `app/api/intel/route.ts` - Migrated `OptionalAuthContext` type import.
- `app/api/users/[id]/sessions/route.ts` - Migrated `OptionalAuthContext` type import.
- `app/api/forecasts/bulk/route.ts` - Migrated `OptionalAuthContext` type import.
- `app/api/profile/[id]/route.ts` - Migrated `OptionalAuthContext` type import.
- `app/api/surf/insights/route.ts` - Migrated `OptionalAuthContext` type import.
- `app/api/sessions/[id]/photos/route.ts` - Migrated `OptionalAuthContext` type import.
- `app/api/events/route.ts` - Migrated `OptionalAuthContext` type import.
- `app/api/sessions/public/route.ts` - Migrated `OptionalAuthContext` type import.
- `app/api/ARCHITECTURE.md` - Updated helper import guidance.
- `docs/refactor-roadmap.md` - Recorded Slice 84 validation, rollback, risks, and next validation slice.

## Decisions Made

The final type-import guard found additional `app/api` routes beyond the three named in the plan. They were migrated because the Phase 13 final guard requires no app API route matches outside wrapper internals.

## Deviations from Plan

Expanded Task 2 from three route files to eight route files after running the planned guard. This was required to satisfy the plan's final source-topology verification.

## Issues Encountered

Including markdown docs in the scoped ESLint command produced ignored-file warnings with `--max-warnings=0`. TypeScript scoped lint passed after running the command against code files only; the ignored-doc warning is recorded in `docs/refactor-roadmap.md`.

## Verification

- `rg -n "type ResolvedParams|type OptionalAuthContext" lib/middleware/api-wrappers.ts` returned both type exports.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/api/intel-route.test.ts __tests__/api/users/user-sessions-route.test.ts __tests__/app/api/forecasts/bulk/route.test.ts` passed: 55 tests passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/api/profile/profile-by-id.test.ts __tests__/api/profile/profile-by-id-homebeach.test.ts __tests__/api/surf-insights-route.test.ts __tests__/api/sessions/session-photos.test.ts __tests__/api/sessions/public-sessions-route.test.ts __tests__/api/events-taxonomy-characterization.test.ts __tests__/api/events-allowlist-db-sync.test.ts` passed: 36 tests passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 app/api/intel/route.ts 'app/api/users/[id]/sessions/route.ts' app/api/forecasts/bulk/route.ts 'app/api/profile/[id]/route.ts' app/api/surf/insights/route.ts 'app/api/sessions/[id]/photos/route.ts' app/api/events/route.ts app/api/sessions/public/route.ts lib/middleware/api-wrappers.ts` passed.
- `rg -n "@/lib/middleware/api-wrappers/types" app/api lib --glob '!lib/middleware/api-wrappers/**' || true` returned only `lib/middleware/bot-blocker.ts`.

## User Setup Required

None. No external services, migrations, deploys, or environment changes are required.

## Next Phase Readiness

Plan 13-04 is ready for final import guards, focused Jest sweep, scoped ESLint, typecheck, and preview build.

---
*Phase: 13-controlled-refactor-completion*
*Completed: 2026-05-31*
