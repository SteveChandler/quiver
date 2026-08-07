# Phase 13 Research: Controlled Refactor Completion

Gathered: 2026-05-31
Status: Ready for planning

## Objective

Answer what is needed to plan Phase 13 safely: finish the remaining controlled
refactor slices that remove production `@/lib/api-utils` imports outside wrapper
internals while preserving route behavior and keeping validation focused.

## Inputs Reviewed

- `.planning/PROJECT.md`, `.planning/ROADMAP.md`, `.planning/STATE.md`, `.planning/REQUIREMENTS.md`
- `.planning/phases/13-controlled-refactor-completion/13-CONTEXT.md`
- `docs/refactor-roadmap.md`
- `CLAUDE.md`, `docs/ARCHITECTURE.md`, `app/ARCHITECTURE.md`, `app/api/ARCHITECTURE.md`
- `package.json`, `jest.config.js`, `eslint.config.mjs`, `next.config.mjs`, `tsconfig.json`
- `app/session/confirm/route.ts`
- `lib/cron/observability.ts`
- `lib/validation/middleware.ts`
- `lib/middleware/bot-blocker.ts`
- `lib/api-utils.ts`
- `lib/middleware/api-wrappers.ts`
- `lib/middleware/api-wrappers/index.ts`
- `lib/middleware/api-wrappers/response-utils.ts`
- `lib/middleware/api-wrappers/validation-helpers.ts`
- `lib/middleware/api-wrappers/types.ts`
- `__tests__/app/session/confirm/route.test.ts`
- `__tests__/lib/cron/observability.test.ts`
- `__tests__/lib/middleware/api-wrappers.test.ts`

## Current Import Inventory

The remaining production imports found by:

```bash
rg -n "@/lib/api-utils" app lib proxy.ts --glob '!lib/middleware/api-wrappers.ts' --glob '!lib/middleware/api-wrappers/**'
```

are:

- `app/session/confirm/route.ts` imports `isValidUuid`.
- `lib/cron/observability.ts` imports `validateCronRequest`.
- `lib/validation/middleware.ts` imports `createValidationError`.
- `lib/middleware/bot-blocker.ts` imports `DEFAULT_SECURITY_HEADERS`.
- `app/api/ARCHITECTURE.md` still contains a historical direct `@/lib/api-utils` example.

The first four are production code. The architecture document is not production
code, but it will make broad guard commands noisy unless it is updated or the
guard excludes Markdown.

## Export Availability

`@/lib/middleware/api-wrappers` already re-exports these helpers through
`index.ts` and `response-utils.ts`:

- `isValidUuid`
- `validateCronRequest`
- `createValidationError`
- `DEFAULT_SECURITY_HEADERS`

`lib/middleware/api-wrappers.ts` is the deprecated compatibility shim. It
re-exports many types from the modular barrel, but currently omits
`OptionalAuthContext` and `ResolvedParams` even though the modular index exports
them. Some app API routes still import `OptionalAuthContext` directly from
`@/lib/middleware/api-wrappers/types`.

## Slice Findings

### Slice 82: `app/session/confirm/route.ts`

The route validates `beach_id`, verifies an email token, checks duplicate
session logs, and inserts a minimal `session_logs` row via the service-role
client. The planned behavior-preserving change is only:

- Replace `import { isValidUuid } from '@/lib/api-utils';`
- With `import { isValidUuid } from '@/lib/middleware/api-wrappers';`

Existing coverage in `__tests__/app/session/confirm/route.test.ts` already
covers missing params, invalid UUID, token failure, date bounds, duplicate
detection, DB-check failure, successful insert, and insert failure. It should
gain a source guard that reads `app/session/confirm/route.ts` and asserts it
does not contain `@/lib/api-utils`.

### Cron observability import cleanup

`lib/cron/observability.ts` uses `validateCronRequest` only to decide whether
the wrapper should write `cron_runs` rows and Sentry check-ins for authorized
cron requests. Existing direct coverage in `__tests__/lib/cron/observability.test.ts`
covers authorized/unauthorized branches, DB fail-open behavior, Sentry check-in
success/error handling, stale row sweeping, and thrown handler errors.

The safe migration is:

- Import `validateCronRequest` from `@/lib/middleware/api-wrappers`.
- Add a source guard in `__tests__/lib/cron/observability.test.ts`.

### Validation middleware import cleanup

`lib/validation/middleware.ts` uses `createValidationError` to return consistent
400 responses from `parseAndValidateJson`. It is used by API routes such as
`app/api/reports/route.ts`, `app/api/intel/route.ts`,
`app/api/intel/[id]/report/route.ts`, `app/api/intel/[id]/vote/route.ts`,
`app/api/boards/route.ts`, `app/api/sessions/[id]/route.ts`, and
`app/api/sessions/[id]/comments/route.ts`.

There is no focused unit test for this utility. Add
`__tests__/lib/validation/middleware.test.ts` covering:

- valid JSON and `application/json` returns `{ data }`
- missing or wrong content type returns a 400 validation error with
  `Invalid Content-Type. Expected application/json`
- invalid JSON returns a 400 validation error with
  `Invalid JSON in request body`
- source guard: no `@/lib/api-utils` import in `lib/validation/middleware.ts`

Then migrate the import to `@/lib/middleware/api-wrappers`.

### Bot blocker import cleanup

`lib/middleware/bot-blocker.ts` returns a 403 JSON envelope with
`DEFAULT_SECURITY_HEADERS` when `detectBot(req).shouldBlock` is true, otherwise
it calls the wrapped handler.

Do not import `DEFAULT_SECURITY_HEADERS` from the top-level
`@/lib/middleware/api-wrappers` barrel inside `bot-blocker.ts`, because
`api-wrappers/index.ts` re-exports `withBotBlocking` from `bot-blocker.ts`.
That would create an avoidable runtime cycle. The safe path is:

- Import `DEFAULT_SECURITY_HEADERS` from
  `@/lib/middleware/api-wrappers/response-utils`.
- Keep the `RouteContext` type import from `@/lib/middleware/api-wrappers/types`.
- Add focused direct coverage for blocked and pass-through requests in
  `__tests__/lib/middleware/bot-blocker.test.ts`.
- Add a source guard for `lib/middleware/bot-blocker.ts`.

## Wrapper Compatibility Ownership

After direct non-wrapper imports are gone, the remaining `@/lib/api-utils`
imports should be wrapper-internal by design:

- `lib/middleware/api-wrappers/response-utils.ts`
- `lib/middleware/api-wrappers/validation-helpers.ts`
- `lib/middleware/api-wrappers/error-handler.ts`
- `lib/middleware/api-wrappers/auth-wrapper.ts`
- `lib/middleware/api-wrappers/admin-auth-wrapper.ts`
- `lib/middleware/api-wrappers/ownership-helpers.ts`
- `lib/middleware/api-wrappers/rate-limit-wrapper.ts`

This phase should not rewrite all wrapper internals. The lower-risk closure is
to document that ownership in `docs/refactor-roadmap.md`, update the stale API
architecture example, and make the compatibility shim export the missing route
types needed by app API callers.

Known direct type imports to review:

- `app/api/intel/route.ts`
- `app/api/users/[id]/sessions/route.ts`
- `app/api/forecasts/bulk/route.ts`

## Validation Architecture

Use Jest 29, scoped ESLint, TypeScript, and preview build gates.

Suggested focused commands:

```bash
source ~/.nvm/nvm.sh && nvm use 22
yarn test:unit --runInBand __tests__/app/session/confirm/route.test.ts
yarn test:unit --runInBand __tests__/lib/cron/observability.test.ts
yarn test:unit --runInBand __tests__/lib/validation/middleware.test.ts
yarn test:unit --runInBand __tests__/lib/middleware/bot-blocker.test.ts __tests__/lib/middleware/api-wrappers.test.ts
npx eslint --max-warnings=0 app/session/confirm/route.ts __tests__/app/session/confirm/route.test.ts lib/cron/observability.ts __tests__/lib/cron/observability.test.ts lib/validation/middleware.ts __tests__/lib/validation/middleware.test.ts lib/middleware/bot-blocker.ts __tests__/lib/middleware/bot-blocker.test.ts lib/middleware/api-wrappers.ts app/api/intel/route.ts app/api/users/[id]/sessions/route.ts app/api/forecasts/bulk/route.ts app/api/ARCHITECTURE.md docs/refactor-roadmap.md
yarn typecheck
VERCEL_ENV=preview yarn build
rg -n "@/lib/api-utils" app lib proxy.ts --glob '!lib/middleware/api-wrappers.ts' --glob '!lib/middleware/api-wrappers/**'
```

If Markdown docs are intentionally not updated, the final guard must exclude
Markdown:

```bash
rg -n "@/lib/api-utils" app lib proxy.ts --glob '!**/*.md' --glob '!lib/middleware/api-wrappers.ts' --glob '!lib/middleware/api-wrappers/**'
```

## Risks

- Importing from the top-level wrapper barrel inside `bot-blocker.ts` can create
  a circular dependency because the barrel re-exports `withBotBlocking`.
- `withObservedCron` must keep unauthorized requests from touching DB writes or
  Sentry check-ins.
- Session confirm route uses service-role writes for unauthenticated email link
  clicks; its validation and token order must stay unchanged.
- Updating wrapper type exports is safe, but migrating route type imports should
  remain type-only and behavior-neutral.
- `VERCEL_ENV=preview yarn build` remains required because the touched surface
  includes route/runtime/build-sensitive modules.

## Recommended Plan Shape

1. Plan 13-01: migrate only `app/session/confirm/route.ts` `isValidUuid`.
2. Plan 13-02: migrate remaining non-route helper imports one at a time with
   focused tests/source guards.
3. Plan 13-03: fix wrapper compatibility type exports, migrate direct route type
   imports, and document wrapper-internal ownership.
4. Plan 13-04: run final import guard, targeted Jest sweep, scoped ESLint,
   typecheck, and preview build.
5. Plan 13-05: update `docs/refactor-roadmap.md` and planning state with
   Slice 82+ closeout, residual risks, rollback notes, and the next future
   candidate.

## RESEARCH COMPLETE
