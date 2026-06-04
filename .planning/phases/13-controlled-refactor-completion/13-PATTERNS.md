# Phase 13 Pattern Map: Controlled Refactor Completion

Gathered: 2026-05-31
Status: Ready for planning

## Public Wrapper Pattern

Route-level and route-adjacent callers should import public response,
validation, auth, rate-limit, and security helpers from:

```ts
import { createSuccessResponse, withAuth } from "@/lib/middleware/api-wrappers";
```

Current barrel exports in `lib/middleware/api-wrappers/index.ts` include:

- response utilities from `response-utils.ts`
- validation helpers from `validation-helpers.ts`
- wrapper functions from auth, admin auth, error handler, protection, and rate
  limit modules
- type exports from `types.ts`

## Compatibility Shim Pattern

`lib/middleware/api-wrappers.ts` is deprecated but exists for backwards
compatibility. It re-exports from `./api-wrappers/index`. When route callers
need a public type such as `OptionalAuthContext`, prefer exporting it from this
shim rather than forcing app routes to import from
`@/lib/middleware/api-wrappers/types`.

## Source-Guard Pattern

Several existing Jest suites pin route migration state by reading source files:

```ts
const routeSource = readFileSync(routePath, "utf8");
expect(routeSource).not.toContain("@/lib/api-utils");
```

Use this pattern for Phase 13 because the intended behavior is import topology,
not a runtime behavior change.

## File-Specific Patterns

### `app/session/confirm/route.ts`

Closest test analog: `__tests__/app/session/confirm/route.test.ts`.

The route is a plain App Router handler, not wrapped by `withAuth`, because
email links are clicked without an auth session and the route verifies a signed
email-action token. Keep response behavior via `renderEmailActionPage`.

### `lib/cron/observability.ts`

Closest test analog: `__tests__/lib/cron/observability.test.ts`.

`withObservedCron` is a response-level wrapper. It intentionally calls
`validateCronRequest(request)` before touching `cron_runs` or Sentry monitor
check-ins. This pre-handler authorization gate must remain unchanged.

### `lib/validation/middleware.ts`

Closest route consumers:

- `app/api/reports/route.ts`
- `app/api/intel/route.ts`
- `app/api/intel/[id]/report/route.ts`
- `app/api/intel/[id]/vote/route.ts`
- `app/api/boards/route.ts`
- `app/api/sessions/[id]/route.ts`
- `app/api/sessions/[id]/comments/route.ts`

The utility should stay small: content-type check, JSON parse, validation error
response. Add direct unit coverage rather than relying only on consumer route
tests.

### `lib/middleware/bot-blocker.ts`

Closest wrapper analogs:

- `lib/middleware/api-wrappers/rate-limit-wrapper.ts`
- `lib/middleware/api-wrappers/protection-wrappers.ts`
- `__tests__/lib/middleware/api-wrappers.test.ts`

Avoid importing from the top-level `@/lib/middleware/api-wrappers` barrel inside
`bot-blocker.ts` because that barrel re-exports `withBotBlocking` from
`bot-blocker.ts`. Import `DEFAULT_SECURITY_HEADERS` from
`@/lib/middleware/api-wrappers/response-utils` instead.

## Guard Commands

Use the production guard:

```bash
rg -n "@/lib/api-utils" app lib proxy.ts --glob '!lib/middleware/api-wrappers.ts' --glob '!lib/middleware/api-wrappers/**'
```

Expected final result: no output after the stale `app/api/ARCHITECTURE.md`
example is updated. If documentation is intentionally excluded, add
`--glob '!**/*.md'` and record the reason in `docs/refactor-roadmap.md`.

## PATTERN MAPPING COMPLETE
