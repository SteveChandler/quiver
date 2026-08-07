# Phase 13: Controlled Refactor Completion - Context

**Gathered:** 2026-05-30
**Status:** Added to roadmap, not planned

<domain>
## Phase Boundary

This phase finishes the remaining controlled refactor work from
`docs/refactor-roadmap.md` without a big-bang rewrite. The immediate starting
point is the post-Slice-81 API utility wrapper cleanup.

This phase is not a product feature phase. It should preserve behavior, keep
each implementation slice PR-sized, and update `docs/refactor-roadmap.md` after
each completed slice.
</domain>

<current_state>
## Refactor State At Handoff

- `docs/refactor-roadmap.md` records Slice 81 as complete.
- All `app/api/**/route.ts` legacy `@/lib/api-utils` imports are migrated.
- Remaining production `@/lib/api-utils` imports outside wrapper internals:
  - `app/session/confirm/route.ts`
  - `lib/cron/observability.ts`
  - `lib/validation/middleware.ts`
  - `lib/middleware/bot-blocker.ts`
- Wrapper internals intentionally still depend on `lib/api-utils` while the
  compatibility migration is in progress.
- The recommended next slice is Slice 82:
  `app/session/confirm/route.ts` UUID validation import cleanup.
</current_state>

<decisions>
## Implementation Decisions

- Keep refactor work behavior-preserving unless the user explicitly approves a
  behavior change.
- Do not combine multiple unrelated helper migrations in one slice.
- Add or extend a source guard before changing imports when existing coverage
  can cheaply prove the migration.
- Preserve route response shapes, auth timing, redirect behavior, cache
  headers, and error semantics unless a slice explicitly documents otherwise.
- Run focused Jest, scoped ESLint, `yarn typecheck`, and
  `VERCEL_ENV=preview yarn build` when runtime, route, middleware, or
  build-sensitive files change.
- Do not delete code solely because static analysis says it is unused.
</decisions>

<canonical_refs>
## Canonical References

- `docs/refactor-roadmap.md` - controlled refactor inventory, progress, risks,
  validation strategy, and next slice.
- `AGENTS.md` - repository workflow, validation, and final-report rules.
- `CLAUDE.md` - Quiver API wrapper and testing patterns.
- `docs/ARCHITECTURE.md` - top-level architecture overview.
- `app/ARCHITECTURE.md` - App Router conventions.
- `app/api/ARCHITECTURE.md` - API route patterns and migration guidance.
- `lib/middleware/api-wrappers.ts` - compatibility wrapper barrel.
- `lib/middleware/api-wrappers/index.ts` - modular wrapper exports.
- `lib/middleware/api-wrappers/validation-helpers.ts` - UUID and validation
  helper exports.
</canonical_refs>

<first_slice>
## Recommended First Slice

Slice 82: migrate only the `isValidUuid` import in
`app/session/confirm/route.ts`.

Execution outline:

1. Inspect `app/session/confirm/route.ts`, nearest architecture docs, and
   existing tests covering session confirmation.
2. Verify `isValidUuid` is exported from `@/lib/middleware/api-wrappers`.
3. Add or extend a focused source guard before the production edit.
4. Migrate only the `isValidUuid` import.
5. Run focused Jest for session confirmation coverage, scoped ESLint for
   touched files, `yarn typecheck`, and `VERCEL_ENV=preview yarn build`.
6. Update `docs/refactor-roadmap.md` with Slice 82 progress and the next slice.
</first_slice>

<validation>
## Default Validation

Use the smallest meaningful set first:

```bash
npx eslint --max-warnings=0 <touched files>
yarn test:unit <targeted tests>
yarn typecheck
VERCEL_ENV=preview yarn build
```

Add import-guard searches after each wrapper cleanup:

```bash
rg -n "@/lib/api-utils" app lib proxy.ts --glob '!lib/middleware/api-wrappers.ts' --glob '!lib/middleware/api-wrappers/**'
```
</validation>

<rollback>
## Rollback

Rollback one slice at a time by reverting only the touched production file,
focused test file, and `docs/refactor-roadmap.md` progress entry for that
slice. Do not revert unrelated dirty worktree changes.
</rollback>

---

*Phase: 13-Controlled Refactor Completion*
*Context gathered: 2026-05-30*
