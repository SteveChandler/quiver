# Quiver Refactor Roadmap

## Current Goal

Finish the controlled refactor that removes remaining production `@/lib/api-utils` imports outside wrapper internals without changing runtime behavior.

## Current Status

Status: Active
Last compressed: 2026-05-31
Full pre-cleanup history: [docs/archive/history-2026-05-31/refactor-roadmap-full-history.md](archive/history-2026-05-31/refactor-roadmap-full-history.md)

The controlled refactor has completed 81 slices. All `app/api/**/route.ts` legacy `@/lib/api-utils` imports are migrated. The next work is small non-route cleanup plus wrapper compatibility ownership.

## Active Requirements

- Preserve behavior for every slice unless the slice explicitly documents a behavior change.
- Keep each slice PR-sized, independently revertible, and backed by focused characterization or source-guard coverage.
- Do not touch generated DB types, broad route behavior, analytics semantics, forecast logic, or auth behavior without targeted tests first.
- Keep wrapper internals and compatibility exports clear: route files should import through `lib/middleware/api-wrappers`, while wrapper internals may temporarily depend on `lib/api-utils`.
- Update this roadmap after each completed slice with validation, risks, and the next recommended slice.

## Open Gaps

- Remaining production `@/lib/api-utils` imports outside wrapper internals:
  - `app/session/confirm/route.ts`
  - `lib/cron/observability.ts`
  - `lib/validation/middleware.ts`
  - `lib/middleware/bot-blocker.ts`
- Wrapper compatibility shim does not export every modular wrapper type; routes needing `OptionalAuthContext` still import from `lib/middleware/api-wrappers/types`.
- `social_share` is emitted to `/api/events` by share UI code but is not accepted by `VALID_EVENTS`; Slice 3 documented this, but did not change behavior.
- Several focused Jest suites still print expected log output from mocked error paths. Tests pass, but logs create validation noise.

## Decisions Already Made

- API route migration proceeds one import/helper slice at a time.
- Source-guard tests are useful before each import cleanup because the intended behavior is often "no legacy import remains."
- `lib/middleware/api-wrappers` is the public compatibility barrel for route-level response, validation, auth, rate-limit, and security-header helpers.
- Wrapper internals can keep legacy helper dependencies until the route migration is complete.
- `VERCEL_ENV=preview yarn build` is required for slices touching route/runtime/build-sensitive surfaces.
- Static analysis findings are leads, not proof; no deletion happens from analyzer output alone.

## Next Actions

- Inspect `app/session/confirm/route.ts`, nearest architecture docs, and existing session-confirm coverage.
- Verify `isValidUuid` can come from `@/lib/middleware/api-wrappers` without behavior changes.
- Add or extend a focused source guard that fails on direct `@/lib/api-utils` import.
- Migrate only that import.
- Run focused Jest for session-confirm coverage, scoped ESLint for touched files, `yarn typecheck`, and `VERCEL_ENV=preview yarn build`.
- Record Slice 82 results here, then stop for review before selecting the next slice.

## Historical Notes

The full pre-cleanup roadmap contained the architecture summary, ranked refactor inventory, first five planned slices, and detailed progress rows for Slices 1-81. That detail is archived because it is useful for audit but too large for future Codex sessions to load by default.

Completed work covered event taxonomy characterization, typed event registry extraction, client gateway board typing, and route-by-route helper import migration through proxy/security-header cleanup. The latest completed slice was Slice 81: `proxy.ts` migrated `DEFAULT_SECURITY_HEADERS` to the shared wrapper barrel while preserving public/protected/admin route behavior, canonical redirects/rewrites, middleware skip rules, and security headers.
