# Quiver Refactor Roadmap

## Current Goal

Finish the controlled refactor that removes remaining production `@/lib/api-utils` imports outside wrapper internals without changing runtime behavior.

## Current Status

Status: Complete for Phase 13 checkpoint
Last compressed: 2026-05-31
Full pre-cleanup history: [docs/archive/history-2026-05-31/refactor-roadmap-full-history.md](archive/history-2026-05-31/refactor-roadmap-full-history.md)

The controlled refactor has completed 85 slices. Remaining production `@/lib/api-utils` imports outside wrapper internals are closed, wrapper compatibility ownership is documented, and the final Phase 13 local validation gate passed.

## Active Requirements

- Preserve behavior for every slice unless the slice explicitly documents a behavior change.
- Keep each slice PR-sized, independently revertible, and backed by focused characterization or source-guard coverage.
- Do not touch generated DB types, broad route behavior, analytics semantics, forecast logic, or auth behavior without targeted tests first.
- Keep wrapper internals and compatibility exports clear: route files should import through `lib/middleware/api-wrappers`, while wrapper internals may temporarily depend on `lib/api-utils`.
- Update this roadmap after each completed slice with validation, risks, and the next recommended slice.

## Open Gaps

- `social_share` is emitted to `/api/events` by share UI code but is not accepted by `VALID_EVENTS`; Slice 3 documented this, but did not change behavior.
- Several focused Jest suites still print expected log output from mocked error paths. Tests pass, but logs create validation noise.
- Wrapper-internal helper collapse is future work; Phase 13 intentionally left wrapper internals as the compatibility boundary.

## Decisions Already Made

- API route migration proceeds one import/helper slice at a time.
- Source-guard tests are useful before each import cleanup because the intended behavior is often "no legacy import remains."
- `lib/middleware/api-wrappers` is the public compatibility barrel for route-level response, validation, auth, rate-limit, and security-header helpers.
- Wrapper internals can keep legacy helper dependencies until a separate internal-collapse phase; route files and route-adjacent production callers should use `lib/middleware/api-wrappers`.
- `lib/middleware/bot-blocker.ts` imports `DEFAULT_SECURITY_HEADERS` from `lib/middleware/api-wrappers/response-utils` instead of the top-level barrel to avoid a `bot-blocker.ts` -> barrel -> `bot-blocker.ts` cycle.
- `VERCEL_ENV=preview yarn build` is required for slices touching route/runtime/build-sensitive surfaces.
- Static analysis findings are leads, not proof; no deletion happens from analyzer output alone.

## Recent Progress

### Slice 82 - Session Confirm UUID Import (Complete 2026-05-31)

Files changed:

- `app/session/confirm/route.ts` now imports `isValidUuid` from `@/lib/middleware/api-wrappers`.
- `__tests__/app/session/confirm/route.test.ts` adds a source guard that fails on direct `@/lib/api-utils` imports and requires the wrapper barrel.
- `docs/refactor-roadmap.md` records the completed slice and next target.

Validation:

- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/app/session/confirm/route.test.ts` failed before the import migration as expected, proving the new source guard caught the legacy import.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/app/session/confirm/route.test.ts` passed after the import migration: 17 tests passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 app/session/confirm/route.ts __tests__/app/session/confirm/route.test.ts` passed.
- `rg -n "@/lib/api-utils" app/session/confirm/route.ts || true` returned no matches.

Rollback:

- Revert the `isValidUuid` import source in `app/session/confirm/route.ts`.
- Remove the source guard/imports added to `__tests__/app/session/confirm/route.test.ts`.
- Revert this Slice 82 roadmap entry.

Residual risks:

- The wrapper barrel still re-exports UUID validation through compatibility internals that depend on `lib/api-utils`.
- Broader `yarn typecheck` and `VERCEL_ENV=preview yarn build` validation are deferred to the final Phase 13 import-guard/build slice.
- The focused session-confirm Jest suite still prints expected console errors for mocked DB failure paths, though the assertions pass.

Next recommended slice: migrate the remaining non-route helper imports in order, starting with `lib/cron/observability.ts`, then `lib/validation/middleware.ts`, then `lib/middleware/bot-blocker.ts`.

### Slice 83 - Non-Route Helper Import Cleanup (Complete 2026-05-31)

Files changed:

- `lib/cron/observability.ts` now imports `validateCronRequest` from `@/lib/middleware/api-wrappers`.
- `lib/validation/middleware.ts` now imports `createValidationError` from `@/lib/middleware/api-wrappers`.
- `lib/middleware/bot-blocker.ts` now imports `DEFAULT_SECURITY_HEADERS` from `@/lib/middleware/api-wrappers/response-utils` to avoid a top-level wrapper barrel cycle.
- `__tests__/lib/cron/observability.test.ts` adds a source guard for cron observability import topology.
- `__tests__/lib/validation/middleware.test.ts` adds direct behavior coverage for valid JSON, invalid content type, missing content type, invalid JSON, and a source guard.
- `__tests__/lib/middleware/bot-blocker.test.ts` adds direct behavior coverage for blocked and allowed requests plus a source guard.

Validation:

- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/cron/observability.test.ts` failed before the import migration as expected on the new source guard, then passed after migration: 16 tests passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 lib/cron/observability.ts __tests__/lib/cron/observability.test.ts` passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/validation/middleware.test.ts` failed before the import migration as expected on the new source guard, then passed after migration: 5 tests passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 lib/validation/middleware.ts __tests__/lib/validation/middleware.test.ts` passed after replacing conditional expectations with a test helper.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/lib/middleware/bot-blocker.test.ts __tests__/lib/middleware/api-wrappers.test.ts` failed before the import migration as expected on the new source guard, then passed after migration: 40 tests passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 lib/middleware/bot-blocker.ts __tests__/lib/middleware/bot-blocker.test.ts` passed.
- `rg -n "@/lib/api-utils" lib/cron/observability.ts lib/validation/middleware.ts lib/middleware/bot-blocker.ts || true` returned no matches.

Rollback:

- Revert the import source in `lib/cron/observability.ts` and remove its source guard.
- Revert the import source in `lib/validation/middleware.ts` and remove `__tests__/lib/validation/middleware.test.ts`.
- Revert the import source in `lib/middleware/bot-blocker.ts` and remove `__tests__/lib/middleware/bot-blocker.test.ts`.
- Revert this Slice 83 roadmap entry.

Residual risks:

- Wrapper internals still intentionally re-export compatibility helpers from `lib/api-utils`.
- Broader typecheck and preview build validation are deferred to the final Phase 13 validation slice.
- Existing API-wrapper Jest coverage prints expected error-path logs while passing.

Next recommended slice: wrapper compatibility shim/type ownership and stale API documentation cleanup.

### Slice 84 - Wrapper Compatibility Ownership (Complete 2026-05-31)

Files changed:

- `lib/middleware/api-wrappers.ts` now re-exports `ResolvedParams` and `OptionalAuthContext` from the modular wrapper index.
- `app/api/intel/route.ts`, `app/api/users/[id]/sessions/route.ts`, `app/api/forecasts/bulk/route.ts`, `app/api/profile/[id]/route.ts`, `app/api/surf/insights/route.ts`, `app/api/sessions/[id]/photos/route.ts`, `app/api/events/route.ts`, and `app/api/sessions/public/route.ts` now import `OptionalAuthContext` from the public wrapper surface.
- `app/api/ARCHITECTURE.md` now recommends `@/lib/middleware/api-wrappers` for route helpers and cron validation.
- `docs/refactor-roadmap.md` records the wrapper-internal ownership boundary and `bot-blocker.ts` `response-utils` cycle-avoidance rationale.

Validation:

- `rg -n "type ResolvedParams|type OptionalAuthContext" lib/middleware/api-wrappers.ts` returned both type exports.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/api/intel-route.test.ts __tests__/api/users/user-sessions-route.test.ts __tests__/app/api/forecasts/bulk/route.test.ts` passed: 55 tests passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/api/profile/profile-by-id.test.ts __tests__/api/profile/profile-by-id-homebeach.test.ts __tests__/api/surf-insights-route.test.ts __tests__/api/sessions/session-photos.test.ts __tests__/api/sessions/public-sessions-route.test.ts __tests__/api/events-taxonomy-characterization.test.ts __tests__/api/events-allowlist-db-sync.test.ts` passed: 36 tests passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 app/api/intel/route.ts 'app/api/users/[id]/sessions/route.ts' app/api/forecasts/bulk/route.ts 'app/api/profile/[id]/route.ts' app/api/surf/insights/route.ts 'app/api/sessions/[id]/photos/route.ts' app/api/events/route.ts app/api/sessions/public/route.ts lib/middleware/api-wrappers.ts` passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 app/api/intel/route.ts 'app/api/users/[id]/sessions/route.ts' app/api/forecasts/bulk/route.ts 'app/api/profile/[id]/route.ts' app/api/surf/insights/route.ts 'app/api/sessions/[id]/photos/route.ts' app/api/events/route.ts app/api/sessions/public/route.ts lib/middleware/api-wrappers.ts app/api/ARCHITECTURE.md docs/refactor-roadmap.md` failed because both markdown files are intentionally ignored/no matching configuration; TypeScript scoped lint passed without those ignored docs.
- `rg -n "@/lib/middleware/api-wrappers/types" app/api lib --glob '!lib/middleware/api-wrappers/**' || true` returned only `lib/middleware/bot-blocker.ts`, which is wrapper-adjacent and intentionally still imports `RouteContext` from the type module.
- `rg -n "@/lib/api-utils" app/api/ARCHITECTURE.md docs/refactor-roadmap.md || true` is expected to show only explicitly historical or wrapper-internal references in the roadmap, and no stale API architecture recommendation.
- `rg -n "@/lib/middleware/api-wrappers|wrapper-internal|response-utils" app/api/ARCHITECTURE.md docs/refactor-roadmap.md` returned current guidance and ownership rationale.

Rollback:

- Remove `ResolvedParams` and `OptionalAuthContext` from the compatibility shim re-export list.
- Revert the eight route type imports back to `@/lib/middleware/api-wrappers/types`.
- Revert the API architecture guidance and Slice 84 roadmap entry.

Residual risks:

- Wrapper internals still intentionally re-export compatibility helpers from `lib/api-utils`; collapsing those internals is future work, not part of this checkpoint.
- Final typecheck and preview build validation are still pending in the next slice.

Next recommended slice: final Phase 13 source guards, focused Jest sweep, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build`.

### Slice 85 - Final Phase 13 Validation Gate (Complete 2026-05-31)

Final source guards:

- `rg -n "@/lib/api-utils" app lib proxy.ts --glob '!lib/middleware/api-wrappers.ts' --glob '!lib/middleware/api-wrappers/**'` returned no matches.
- `rg -n "@/lib/middleware/api-wrappers/types" app/api lib --glob '!lib/middleware/api-wrappers/**' || true` returned only `lib/middleware/bot-blocker.ts`, a wrapper-adjacent internal that still imports `RouteContext` from the type module.

Focused validation:

- `source ~/.nvm/nvm.sh && nvm use 22 && yarn test:unit --runInBand __tests__/app/session/confirm/route.test.ts __tests__/lib/cron/observability.test.ts __tests__/lib/validation/middleware.test.ts __tests__/lib/middleware/bot-blocker.test.ts __tests__/lib/middleware/api-wrappers.test.ts __tests__/api/intel-route.test.ts __tests__/api/users/user-sessions-route.test.ts __tests__/app/api/forecasts/bulk/route.test.ts __tests__/api/profile/profile-by-id.test.ts __tests__/api/profile/profile-by-id-homebeach.test.ts __tests__/api/surf-insights-route.test.ts __tests__/api/sessions/session-photos.test.ts __tests__/api/sessions/public-sessions-route.test.ts __tests__/api/events-taxonomy-characterization.test.ts __tests__/api/events-allowlist-db-sync.test.ts` passed: 15 suites, 169 tests.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --max-warnings=0 app/session/confirm/route.ts __tests__/app/session/confirm/route.test.ts lib/cron/observability.ts __tests__/lib/cron/observability.test.ts lib/validation/middleware.ts __tests__/lib/validation/middleware.test.ts lib/middleware/bot-blocker.ts __tests__/lib/middleware/bot-blocker.test.ts lib/middleware/api-wrappers.ts app/api/intel/route.ts 'app/api/users/[id]/sessions/route.ts' app/api/forecasts/bulk/route.ts 'app/api/profile/[id]/route.ts' app/api/surf/insights/route.ts 'app/api/sessions/[id]/photos/route.ts' app/api/events/route.ts app/api/sessions/public/route.ts` passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && npx eslint --no-warn-ignored --max-warnings=0 app/session/confirm/route.ts __tests__/app/session/confirm/route.test.ts lib/cron/observability.ts __tests__/lib/cron/observability.test.ts lib/validation/middleware.ts __tests__/lib/validation/middleware.test.ts lib/middleware/bot-blocker.ts __tests__/lib/middleware/bot-blocker.test.ts lib/middleware/api-wrappers.ts app/api/intel/route.ts 'app/api/users/[id]/sessions/route.ts' app/api/forecasts/bulk/route.ts 'app/api/profile/[id]/route.ts' app/api/surf/insights/route.ts 'app/api/sessions/[id]/photos/route.ts' app/api/events/route.ts app/api/sessions/public/route.ts app/api/ARCHITECTURE.md docs/refactor-roadmap.md` passed; ignored markdown docs were suppressed with `--no-warn-ignored`.
- `source ~/.nvm/nvm.sh && nvm use 22 && yarn typecheck` passed.
- `source ~/.nvm/nvm.sh && nvm use 22 && VERCEL_ENV=preview yarn build` passed.

Validation notes:

- Running ESLint against ignored markdown docs without `--no-warn-ignored` fails under `--max-warnings=0` because ESLint reports ignored-file warnings, not code issues.
- Focused Jest still prints expected error-path logs from existing tests while exiting 0.

Rollback:

- Use Slice 82, Slice 83, and Slice 84 rollback notes for code-level rollback.
- Revert this Slice 85 validation entry if any final gate is rerun and fails.

Residual risks:

- `social_share` remains a documented analytics taxonomy gap from Slice 3.
- Wrapper-internal helper collapse is future work; the final guard intentionally excludes wrapper internals.

## Next Actions

- Keep deploy, production mutation, outbound send, payment, and entitlement actions approval-gated.
- Treat wrapper-internal helper collapse and the `social_share` taxonomy gap as future candidates, not part of this completed checkpoint.
- Wait for user review or select the next future phase.

## Historical Notes

The full pre-cleanup roadmap contained the architecture summary, ranked refactor inventory, first five planned slices, and detailed progress rows for Slices 1-81. That detail is archived because it is useful for audit but too large for future Codex sessions to load by default.

Completed work covered event taxonomy characterization, typed event registry extraction, client gateway board typing, and route-by-route helper import migration through proxy/security-header cleanup. Slice 81 migrated `proxy.ts` `DEFAULT_SECURITY_HEADERS` usage to the shared wrapper barrel while preserving public/protected/admin route behavior, canonical redirects/rewrites, middleware skip rules, and security headers. Slice 82 migrated the session confirmation route UUID helper import with focused behavior coverage plus a source guard. Slice 83 migrated the remaining non-route helper imports in cron observability, validation middleware, and bot blocking. Slice 84 completed wrapper compatibility shim type ownership and refreshed API architecture import guidance. Slice 85 passed the final local source-guard, focused Jest, scoped ESLint, typecheck, and preview build gate.
