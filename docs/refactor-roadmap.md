# Quiver Refactor Roadmap

Last updated: 2026-05-26

## Current Architecture Summary

Quiver is a Next.js 16 App Router application with React 19, TypeScript, Tailwind, Radix UI, Supabase, Jest, and Playwright. The main code surfaces are:

- `app/`: user-facing routes, SEO routes, and 162 API route files.
- `components/`: shared UI and feature components across beach detail, map, forecast, profile, onboarding, and SEO surfaces.
- `actions/`: server actions for authenticated and public database reads/mutations.
- `lib/`: services, domain logic, API middleware, Supabase clients, analytics, scoring, SEO data, and utilities.
- `hooks/`: React data fetching, auth-adjacent, location, social, and UI hooks.
- `types/`: hand-written domain types plus generated Supabase database types.
- `supabase/migrations/`: database evolution, RLS, indexes, functions, and operational fixes.
- `__tests__/` and `e2e/`: Jest unit/integration tests and Playwright browser/API tests.

Important existing architecture constraints:

- Protected server actions should use `withAuthenticatedAction`, `makeAuthenticatedAction`, or related helpers from `lib/server-action-utils.ts`.
- Authenticated API routes should use `withAuth` from `lib/middleware/api-wrappers/`.
- Client data fetching should prefer `useDataFetcher` and the client data gateway where appropriate.
- Forecast queries should prefer `forecast_at`; legacy `forecast_date` and `forecast_time` remain only as compatibility fields.
- New code should prefer `lon`/`longitude`; `lng` remains in legacy DB, Mapbox, and compatibility paths.
- Pre-auth funnel events must not fire for authenticated users.

## Refactor Goals

1. Preserve existing behavior while reducing drift between documented architecture and implementation.
2. Keep each change PR-sized, reviewable, and independently revertible.
3. Add safety nets before touching high-risk routes, analytics, forecast, auth, or scoring logic.
4. Centralize duplicated contracts where drift has already created user or developer risk.
5. Make future feature work faster by clarifying boundaries between routes, services, domain logic, and UI.

## Non-Goals

- No big-bang rewrite of the app, routing system, API layer, scoring engine, or design system.
- No broad UI redesign.
- No schema migration unless a later slice explicitly requires one and receives approval.
- No new dependencies unless a slice explains why existing tools cannot handle the job.
- No deletion based only on static analyzer output.
- No behavior changes hidden inside refactors.

## Refactor Inventory

Priority score uses:

`business impact x change frequency x pain / implementation risk`

Each factor is scored 1-5. Static analysis findings are treated as leads, not proof.

| ID | Candidate | Affected files/modules | Problem | Business or developer impact | Risk level | Suggested refactor direction | Safety net needed | Priority score | First small step |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| R01 | Event taxonomy registry | `app/api/events/route.ts`, `types/implicit-preferences.ts`, analytics callers, event allowlist tests | Event names are spread across server allowlists, TS unions, DB constraints, and emitters. Current characterization confirms preference weights align with `VALID_EVENTS`, but the constants still have multiple owners and static emitter classification remains unclear. | Growth funnel data can silently drop or become unqueryable; event work is frequent. | Medium | Create one typed event registry that exports event groups and derived unions while preserving the current runtime allowlist first. | Existing event route tests, allowlist tests, and a new parity test proving no event set changed unexpectedly. | 41.7 (5x5x5/3) | Add a characterization/parity test around current event groups before moving constants. |
| R02 | API wrapper migration | `app/api/**/route.ts`, `lib/middleware/api-wrappers`, legacy `lib/api-utils.ts` callers | API routes mix legacy helpers, direct Supabase clients, manual auth, and wrapper-based auth. Phase 1 found 74 route files importing legacy API utilities. | Reduces auth, error shape, and Next.js async params risk across web/native API usage. | High | Migrate one route at a time to wrapper patterns; start with read-only or already-tested endpoints. | Targeted API unit tests for each migrated route plus scoped lint/typecheck. | 31.3 (5x5x5/4) | Pick one low-risk read-only route with existing tests and migrate only its wrapper/error shape. |
| R03 | Intent route monolith | `app/[intent]/[city]/page.tsx`, intent components, SEO actions | The unified intent route combines city/state resolution, legacy redirects, metadata, SEO funnel pages, and page rendering in one 1264-line file. | SEO acquisition surface is business-critical; route logic changes are risky and frequent. | High | Extract pure resolver functions and rendering branches incrementally; do not change URLs or metadata output. | Characterization tests for metadata, state routes, city routes, invalid routes, and redirects. | 25.0 (5x4x5/4) | Extract a pure route-context resolver with tests and wire it back without JSX changes. |
| R06 | Client data gateway cleanup | `lib/data/client.ts`, direct client Supabase users, hooks/components using gateway | Gateway is useful but still broad and partially typed; a few client components still import Supabase directly. | Improves client data consistency and reduces duplicated fetch/auth retry behavior. | Medium | Type gateway methods one at a time and migrate direct client Supabase reads only where the gateway already has an equivalent API route. | Existing gateway tests, component/hook tests for migrated callers. | 21.3 (4x4x4/3) | Strengthen one gateway method type and add/adjust its unit tests. |
| R04 | Forecast timestamp migration | Forecast actions, components, services, utilities using `forecast_date`/`forecast_time` | `forecast_at` is canonical, but compatibility fallbacks remain widespread. Date boundary bugs are likely if callers parse legacy fields inconsistently. | Forecast correctness is core product value. | Very high | Migrate one pure utility or display path at a time to adapter-first handling; keep legacy fallback where data shape still requires it. | Unit tests around timezone/date-boundary behavior and existing forecast display tests. | 20.0 (5x4x5/5) | Pick one pure utility with existing tests and replace local parsing with `forecast-at-adapter`. |
| R05 | Beach detail monolith | `components/beach-detail.tsx`, beach-detail tabs/components | The main beach detail component mixes tab orchestration, telemetry, CTAs, dialogs, and view composition. | Beach pages are core conversion and forecast surfaces. | High | Extract one local component or hook at a time without changing UI output. | Existing beach detail component tests and targeted render tests. | 20.0 (5x4x4/4) | Extract `AlertNudge` to a focused component file with the same props and behavior. |
| R07 | Discovery/scoring boundary | `lib/domains/scoring`, `lib/scoring`, `lib/services/discovery`, surf call utilities | Multiple scoring entry points and singletons make it hard to know the canonical scoring path. | Recommendation quality and forecast trust are core product value. | High | Introduce a small facade only where duplicate engine creation exists; do not rewrite scoring. | Domain scoring tests, discovery orchestrator tests, snapshot trace tests. | 18.8 (5x3x5/4) | Centralize one scoring-engine singleton with tests proving equivalent output. |
| R08 | Cron route duplication | `app/api/cron/**`, cron services, email/push jobs | Cron routes repeat auth, observability, response, and summary patterns. | Operational jobs affect emails, alerts, forecasts, and sync reliability. | High | Extract cron helpers only after testing a representative route; migrate one route per slice. | Existing cron route tests plus dry-run/summary assertions. | 12.0 (4x3x4/4) | Inventory cron response/auth variants before extracting helpers. |
| R09 | Coordinate naming drift | Map, intel, NOAA, location utilities, API params | `lng` appears in Mapbox/legacy contexts while new code should use `lon`; conversion boundaries are not always explicit. | Location bugs affect map, recommendations, and nearby APIs. | High | Add explicit adapters around Mapbox/API legacy boundaries; avoid mechanical renames. | Coordinate parser/map utility tests and targeted map E2E when UI changes. | 12.0 (4x3x4/4) | Rename or wrap one internal non-Mapbox helper argument with tests. |
| R10 | Dead code/dependency cleanup | `scripts/**`, unused exports, `package.json`, static analyzer reports | `knip` reported unused files/exports/deps, but framework false positives are likely. | Reduces cognitive load and install/test noise. | Low | Prove unused items with static analysis plus repo search before tiny deletion batches. | `knip`, `ts-prune`, targeted tests for any touched area. | 12.0 (3x2x4/2) | Verify and remove one unused script that is not referenced by package scripts, docs, CI, or automation. |

## Top 5 Candidates

1. R01 event taxonomy registry.
2. R02 API wrapper migration.
3. R03 intent route monolith.
4. R06 client data gateway cleanup.
5. R04 forecast timestamp migration.

## Recommended First Pilot

Use R01, the event taxonomy registry, as the first pilot.

Why:

- Phase 1 flagged event taxonomy drift risk, and current characterization confirms the API event sets and preference weights are aligned before extraction.
- Event drift has direct growth-analysis impact.
- The first slice can be behavior-preserving and test-first.
- The blast radius can stay narrow: one event registry module, one API import, one type import, focused unit tests.

Pilot constraints:

- Do not add, remove, or rename events in the first implementation slice.
- Do not touch the DB CHECK constraint in the first slice.
- Do not change `/api/events` request behavior.
- Do not classify GA/PostHog-only events as internal events without explicit product/data review.

## Recommended Order Of Work

1. R01 event taxonomy registry.
2. R06 client data gateway cleanup.
3. R02 API wrapper migration, starting with low-risk read-only endpoints.
4. R03 intent route extraction, starting with pure route/metadata resolution.
5. R05 beach detail component extraction.
6. R04 forecast timestamp migration after focused date-boundary safety nets are in place.
7. R07 discovery/scoring boundary cleanup.
8. R08 cron route helper extraction.
9. R09 coordinate adapter cleanup.
10. R10 dead code/dependency cleanup in small verified batches.

## Risk Areas

- Analytics and event tracking: changes can silently break dashboards or funnel analysis even when UI tests pass.
- API auth wrappers: web cookie auth and native Bearer auth have different failure modes.
- Forecast timestamps: `forecast_at` migration can create timezone boundary regressions.
- SEO intent routes: metadata, canonical URLs, sitemap inclusion, and redirect behavior are fragile.
- Beach detail UI: anonymous/authenticated CTA gating and pre-auth event guards are business-critical.
- Cron jobs: Vercel crons run only on Production, so local validation cannot fully prove prod behavior.
- Generated DB types: do not hand-edit `types/database.generated.ts`.
- Existing dirty worktree: future slices must inspect file-level diffs before editing and avoid reverting unrelated user changes.

## Testing Strategy

Use the smallest meaningful validation first, then broaden by risk.

For R01 event taxonomy:

- Unit/parity tests:
  - `__tests__/app/api/events/route.test.ts`
  - `__tests__/api/events-allowlist-db-sync.test.ts`
  - `__tests__/events-allowlist-*.test.ts`
  - New registry parity test if needed.
- Static checks:
  - Scoped ESLint on touched files.
  - `yarn typecheck`.

For API route migrations:

- Run existing route unit tests for the changed endpoint.
- Add status-code/error-shape assertions before changing risky wrappers.
- Use `npx playwright test e2e/api/<spec>.ts --list` before expensive E2E runs.

For intent routes and SEO:

- Add characterization tests before extraction.
- Validate metadata, redirect/notFound behavior, and noindex behavior.
- Run targeted app/SEO Jest tests and `VERCEL_ENV=preview yarn build` when route/build behavior changes.

For UI component extractions:

- Run existing component tests importing the changed component.
- Add a focused render test if the extraction changes prop wiring.
- Use targeted Playwright only when browser behavior or user-visible layout changes.

For forecast/scoring:

- Add or extend unit tests for pure logic first.
- Include date/timezone boundary cases for forecast timestamp work.
- Run existing scoring/discovery snapshot tests before claiming equivalence.

## Validation Commands

Available commands from `package.json` and repo docs:

```bash
yarn typecheck
npx eslint --max-warnings=0 <files>
NODE_OPTIONS="--max-old-space-size=8192" yarn lint
yarn test:unit --bail=0
yarn test:integration
VERCEL_ENV=preview yarn build
npx playwright test --list <specs>
npx playwright test <spec>
yarn dead:knip
yarn dead:tsprune
yarn dead:deps
```

Default per-slice minimum:

```bash
npx eslint --max-warnings=0 <touched files>
yarn typecheck
yarn test:unit <targeted tests>
```

Broaden to `VERCEL_ENV=preview yarn build` for routing, Next config, API runtime, SEO, or build-time metadata work.

## Rollback Strategy

Each slice should be independently revertible.

- Keep refactors separate from feature changes.
- Preserve current exports until all callers have migrated.
- Prefer additive registries/adapters/facades before deleting old paths.
- For API and route work, keep old response shapes unless the slice explicitly documents a behavior change.
- For risky logic, keep characterization tests in the same slice so a revert removes both implementation and test assumptions.
- If validation fails and the failure is caused by the slice, fix before moving on.
- If validation fails for unrelated existing debt, document exact command/output and stop if confidence is not enough.

## Definition Of Done

A refactor slice is done only when:

- Behavior expected to remain unchanged is explicitly stated.
- Files changed are scoped to one logical change.
- Relevant tests were added or updated before risky behavior changes.
- Validation commands were run and results are documented.
- Diff was self-reviewed for accidental behavior changes, missing tests, broken imports, type-safety issues, security issues, and scope creep.
- `docs/refactor-roadmap.md` progress section is updated.
- Rollback plan is clear.
- Next recommended slice is identified.

## First 5 Implementation Slices

### Slice 1: Event Registry Characterization

Goal: Prove the current event taxonomy before moving constants.

Files likely changed:

- `__tests__/app/api/events/route.test.ts` or a new focused test under `__tests__/api/`.
- Possibly no production files.

Behavior expected to stay the same:

- `/api/events` accepts and rejects the same event types as before.
- Anonymous/pre-auth restrictions stay unchanged.

Validation:

```bash
npx eslint --max-warnings=0 __tests__/app/api/events/route.test.ts
yarn test:unit __tests__/app/api/events/route.test.ts
yarn typecheck
```

Rollback:

- Revert the test-only commit/slice.

### Slice 2: Add Typed Event Registry Module

Goal: Introduce a single source for event arrays without changing values.

Files likely changed:

- New `lib/analytics/event-taxonomy.ts`.
- `app/api/events/route.ts`.
- `types/implicit-preferences.ts`.
- Event allowlist tests.

Behavior expected to stay the same:

- `VALID_EVENTS`, `ANONYMOUS_ALLOWED_EVENTS`, and `PRE_AUTH_ONLY_EVENTS` contain the same strings in the same effective sets.
- `ImplicitEventType` becomes derived from the registry but does not narrow or widen runtime behavior unexpectedly.

Validation:

```bash
npx eslint --max-warnings=0 lib/analytics/event-taxonomy.ts app/api/events/route.ts types/implicit-preferences.ts __tests__/app/api/events/route.test.ts
yarn test:unit __tests__/app/api/events/route.test.ts __tests__/api/events-allowlist-db-sync.test.ts
yarn typecheck
```

Rollback:

- Revert registry module and imports; tests keep prior constants if needed.

### Slice 3: Classify Event Emitters

Goal: Document and test which literal emitted events are internal `/api/events` events versus GA/PostHog-only events.

Files likely changed:

- `lib/analytics/event-taxonomy.ts`.
- New or existing tests around event emitter parity.
- Possibly analytics helper comments/docs.

Behavior expected to stay the same:

- No event is newly sent to `/api/events`.
- No emitted event is renamed.

Validation:

```bash
npx eslint --max-warnings=0 lib/analytics/event-taxonomy.ts <changed tests>
yarn test:unit <changed tests>
yarn typecheck
```

Rollback:

- Revert classification-only changes.

### Slice 4: Type One Client Data Gateway Method

Goal: Reduce `any` in one `lib/data/client.ts` gateway path after the event pilot is complete.

Files likely changed:

- `lib/data/client.ts`.
- `__tests__/lib/data/client.gateway.test.ts`.

Behavior expected to stay the same:

- Same endpoint, cache behavior, error handling, and response handling.

Validation:

```bash
npx eslint --max-warnings=0 lib/data/client.ts __tests__/lib/data/client.gateway.test.ts
yarn test:unit __tests__/lib/data/client.gateway.test.ts
yarn typecheck
```

Rollback:

- Revert type and test changes.

### Slice 5: Migrate One Low-Risk API Route Wrapper

Goal: Move one read-only route with existing tests from legacy API helper usage toward `lib/middleware/api-wrappers`.

Candidate selection criteria:

- Existing unit test coverage.
- Read-only route.
- No native auth edge case.
- No cache/header behavior change.

Behavior expected to stay the same:

- Same status codes, response body shape, cache headers, and auth behavior.

Validation:

```bash
npx eslint --max-warnings=0 <route file> <route test>
yarn test:unit <route test>
yarn typecheck
```

Rollback:

- Revert the route wrapper change and associated test updates.

## Progress Tracking

| Slice | Status | Files changed | Validation status | Notes |
| --- | --- | --- | --- | --- |
| Phase 1 scan | Complete | None | `yarn dead:knip` found issues and exited 1; `yarn dead:tsprune` completed with findings; no app tests run | Baseline inventory created in chat report. |
| Phase 2 roadmap | Complete | `docs/refactor-roadmap.md` | `test -s docs/refactor-roadmap.md`, `! grep -n '[[:blank:]]$' docs/refactor-roadmap.md`, and `git diff --check -- docs/refactor-roadmap.md` passed | Roadmap creation only; no application code changes. |
| Slice 1 event registry characterization | Complete | `__tests__/api/events-taxonomy-characterization.test.ts`, `docs/refactor-roadmap.md` | `npx eslint --max-warnings=0 __tests__/api/events-taxonomy-characterization.test.ts`, targeted event Jest suite, and `yarn typecheck` passed | Added test-only safety net for current event sets and membership invariants. |
| Slice 2 typed event registry module | Complete | `lib/analytics/event-taxonomy.ts`, `app/api/events/route.ts`, `types/implicit-preferences.ts`, `__tests__/api/events-taxonomy-characterization.test.ts`, `__tests__/app/api/events/route.test.ts`, `docs/refactor-roadmap.md` | Red characterization test failed before module existed; scoped ESLint, targeted event Jest suite, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved event arrays into a shared typed registry without changing event values; fixed two weak route-test assertions that blocked scoped lint. |
| Slice 3 event emitter classification | Complete | `lib/analytics/event-taxonomy.ts`, `__tests__/api/events-emitter-classification.test.ts`, `docs/refactor-roadmap.md` | Red classification test failed before exports existed; scoped ESLint, targeted event Jest suite, `yarn typecheck`, `VERCEL_ENV=preview yarn build`, and whitespace check passed | Classified current GA/PostHog-only event names and documented `social_share` as the current rejected `/api/events` literal without changing emitters. |
| Validation noise cleanup | Complete | `package.json`, `__tests__/app/api/events/route.test.ts`, `docs/refactor-roadmap.md` | Event-focused Jest suite rerun passed without the previous intentional `console.error` print or Node `punycode` deprecation warning | Suppressed Node test-worker `DEP0040` noise through `test:unit` and asserted the expected DB insert error log in the route test. |
| Slice 4 client data gateway board typing | Complete | `lib/data/client.ts`, `__tests__/lib/data/client.gateway.test.ts`, `docs/refactor-roadmap.md` | Red `yarn typecheck` failed before `ClientBoard` existed; scoped ESLint, targeted gateway/event Jest suite, `yarn typecheck`, `VERCEL_ENV=preview yarn build`, JSON parse, and whitespace check passed | Typed `data.boards.list()` as `Promise<ClientBoard[]>` while preserving endpoint, cache behavior, and response handling. |
| Slice 5 beach daily intel wrapper migration | Complete | `app/api/beach-daily-intel/route.ts`, `__tests__/app/api/beach-daily-intel/route.test.ts`, `docs/refactor-roadmap.md` | Baseline route Jest suite passed before migration; added characterization assertion passed; scoped ESLint, targeted route Jest suite, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Replaced the route-local try/catch with `withErrorHandler` while keeping validation before Supabase client creation and preserving response shapes. |
| Slice 6 bulk forecast response helper migration | Complete | `app/api/forecasts/bulk/route.ts`, `__tests__/app/api/forecasts/bulk/route.test.ts`, `docs/refactor-roadmap.md` | Baseline route Jest suite passed before migration with expected error-path console output; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response/error helper imports to the shared wrapper module, preserved optional-auth/rate-limit behavior, and made expected error-path logs explicit in tests. |
| Slice 7 recommendations response helper migration | Complete | `app/api/v1/recommendations/route.ts`, `__tests__/app/api/v1/recommendations/route.test.ts`, `docs/refactor-roadmap.md` | Baseline route Jest suite passed before migration with expected degraded-service warning; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response/error helper imports to the shared wrapper module while preserving direct `createAPIServerClient` timing and rate-limit behavior; made the expected degraded PostGIS warning explicit in tests. |
| Slice 8 event link response helper migration | Complete | `app/api/events/link/route.ts`, `__tests__/app/api/events/link/route.test.ts`, `docs/refactor-roadmap.md` | Baseline route Jest suite passed before migration with expected structured/error logs; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response helper imports to the shared wrapper module, preserved `withAuth` and service-role RPC behavior, and made expected logs explicit/suppressed in tests. |
| Slice 9 embed impressions response helper migration | Complete | `lib/middleware/api-wrappers.ts`, `lib/middleware/api-wrappers/index.ts`, `lib/middleware/api-wrappers/response-utils.ts`, `app/api/embed-impressions/route.ts`, `__tests__/app/api/embed-impressions/route.test.ts`, `docs/refactor-roadmap.md` | Baseline route Jest suite passed before migration with expected error-path logs; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Re-exported `DEFAULT_SECURITY_HEADERS` through the wrapper module, migrated `embed-impressions` helper imports, preserved 204/429 security headers, and made expected insert/client error logs explicit in tests. |
| Slice 10 update-enhanced forecast response helper migration | Complete | `app/api/forecasts/update-enhanced/route.ts`, `__tests__/app/api/forecasts/update-enhanced.test.ts`, `docs/refactor-roadmap.md` | Baseline route Jest suite passed before migration; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response helper imports to the shared wrapper module while preserving `withAdminAuth`, GET forecast cache behavior, calibration stamping, cache headers, and response shapes. |
| Slice 11 coach picks response helper migration | Complete | `app/api/coach-picks/route.ts`, `__tests__/api/coach-picks.test.ts`, `docs/refactor-roadmap.md` | Baseline coach-picks Jest suites passed before migration; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response helper imports to the shared wrapper module while preserving `withRateLimit`, RPC argument forwarding, empty `beachId` behavior, and response shapes. |
| Slice 12 beach search response helper migration | Complete | `app/api/beaches/search/route.ts`, `__tests__/api/beaches/beaches-search.test.ts`, `lib/middleware/api-wrappers.ts`, `lib/middleware/api-wrappers/index.ts`, `lib/middleware/api-wrappers/response-utils.ts`, `docs/refactor-roadmap.md` | Baseline beach-search Jest suite passed with expected error-path logs; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Re-exported pagination helpers through the wrapper module, migrated `beaches/search` helper imports, preserved pagination/cache behavior, and made expected error-path logs explicit in tests. |
| Slice 13 nearby beaches response helper migration | Complete | `app/api/beaches/nearby/route.ts`, `__tests__/api/beaches/beaches-nearby.test.ts`, `docs/refactor-roadmap.md` | Baseline nearby-beaches Jest suite passed with expected DB error-path logs; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response helper imports to the shared wrapper module while preserving coordinate compatibility, rate limiting, distance filtering, validation errors, and response shapes; made expected error logs explicit in tests. |
| Slice 14 beach sources response helper migration | Complete | `app/api/beaches/[id]/sources/route.ts`, `__tests__/api/beaches-sources-native-fields.test.ts`, `docs/refactor-roadmap.md` | Baseline beach-sources Jest suite passed before migration; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response helper imports to the shared wrapper module while preserving async params handling, source merging, native camera fields, cache headers, and error response behavior. |
| Slice 15 beach detail response helper migration | Complete | `app/api/beaches/[id]/route.ts`, `__tests__/api/beaches/beach-detail.test.ts`, `docs/refactor-roadmap.md` | Baseline beach-detail Jest suite passed with expected error-path logs; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response helper imports to the shared wrapper module while preserving bot-blocking/rate-limit wrapping, cache headers, review-count fallback, and current 500 error behavior for missing beaches; made expected error logs explicit in tests. |
| Slice 16 beach sessions response helper migration | Complete | `app/api/beaches/[id]/sessions/route.ts`, `__tests__/api/beaches/sessions.test.ts`, `docs/refactor-roadmap.md` | Baseline beach-sessions Jest suite passed before migration; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response helper imports to the shared wrapper module while preserving async params handling, public-only filtering, limit capping, featured-photo enrichment, and response shapes. |
| Slice 17 beaches list response helper migration | Complete | `app/api/beaches/route.ts`, `__tests__/api/beaches/beaches-list.test.ts`, `lib/middleware/api-wrappers.ts`, `docs/refactor-roadmap.md` | Baseline beaches-list Jest suite passed with expected error-path logs; red source guard failed on legacy `@/lib/api-utils` import; first green attempt exposed missing shim exports for `createCachedResponse`/`checkNotModified`; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after the shim fix | Moved GET/POST response and cache helper imports to the shared wrapper module while preserving list caching, ETag handling, legacy schema fallback, admin POST validation, and response shapes; made expected error logs explicit in tests. |
| Slice 18 profile-by-id response helper migration | Complete | `app/api/profile/[id]/route.ts`, `__tests__/api/profile/profile-by-id.test.ts`, `__tests__/api/profile/profile-by-id-homebeach.test.ts`, `docs/refactor-roadmap.md` | Baseline profile-by-id Jest suites passed before migration; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved profile success/error helper imports to the shared wrapper module while preserving optional-auth behavior, block filtering, public profile response shape, home beach enrichment, and onboarding fields; made two helper-backed onboarding assertions explicit for lint/type safety. |
| Slice 19 public sessions pagination helper migration | Complete | `app/api/sessions/public/route.ts`, `__tests__/api/sessions/public-sessions-route.test.ts`, `docs/refactor-roadmap.md` | Baseline public-sessions Jest suite passed before migration; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved pagination/cache helper imports to the shared wrapper module while preserving optional-auth handling, authenticated `no-store` cache override, friends-feed filtering, blocked-author filtering, and paginated response shapes. |
| Slice 20 events response helper migration | Complete | `app/api/events/route.ts`, `__tests__/app/api/events/route.test.ts`, `docs/refactor-roadmap.md` | Baseline event route Jest suite passed before migration; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved event response helper imports to the shared wrapper module while preserving optional auth, bot filtering, anonymous session handling, pre-auth-only drops, rate-limit responses, and insert error behavior. |
| Slice 21 check-session response helper migration | Complete | `app/api/auth/check-session/route.ts`, `__tests__/api/auth/check-session.test.ts`, `docs/refactor-roadmap.md` | Baseline check-session Jest suite passed with expected error-path logs; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved security header/error helper imports to the shared wrapper module while preserving authenticated session responses, 401 unauthenticated responses, and 500 unexpected-error behavior; made expected error logs explicit in tests. |
| Slice 22 alert rules security-header migration | Complete | `app/api/alerts/rules/route.ts`, `__tests__/api/alerts/rules.test.ts`, `docs/refactor-roadmap.md` | Baseline alert-rules Jest suite passed before migration; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved the top-level alert-rules `DEFAULT_SECURITY_HEADERS` import to the shared wrapper module while preserving duplicate similarity-rule conflict responses, personalization denials, condition validation, and existing `[ruleId]` route behavior in the shared test suite. |
| Slice 23 alert rule detail security-header migration | Complete | `app/api/alerts/rules/[ruleId]/route.ts`, `__tests__/api/alerts/rules.test.ts`, `docs/refactor-roadmap.md` | Baseline alert-rules Jest suite passed before migration; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved the alert-rule detail `DEFAULT_SECURITY_HEADERS` import to the shared wrapper module while preserving auto-managed similarity-rule 403s, missing-rule 404s, condition update validation, PATCH success, and DELETE success behavior. |
| Slice 24 coast-pulse response helper migration | Complete | `app/api/coast-pulse/route.ts`, `__tests__/api/coast-pulse-pagination.test.ts`, `docs/refactor-roadmap.md` | Baseline coast-pulse pagination Jest suite passed before migration; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved coast-pulse validation/error helper imports to the shared wrapper module while preserving coordinate validation, cursor validation, public/private cache headers, rate limiting, and pagination contract expectations; tightened three weak matcher assertions in the touched pagination test. |
| Slice 25 cam-resolve security-header migration | Complete | `app/api/cam-resolve/route.ts`, `__tests__/api/cam-resolve.test.ts`, `docs/refactor-roadmap.md` | Baseline cam-resolve Jest suite passed before migration with expected error-branch logs; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved the cam-resolve `DEFAULT_SECURITY_HEADERS` import to the shared wrapper module while preserving URL validation, SSRF host allowlist behavior, HDOnTap and HDRelay extraction paths, upstream error handling, timeout behavior, cache headers, and response security headers. |
| Slice 26 user profile delegate response helper migration | Complete | `app/api/users/[id]/profile/route.ts`, `__tests__/api/users/user-profile-route.test.ts`, `docs/refactor-roadmap.md` | Baseline user-profile delegate Jest suite passed before migration; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved delegate-route validation/error helper imports to the shared wrapper module while preserving invalid-user validation, delegation to `app/api/profile/[id]/route.ts`, public profile response shape, onboarding fields, and canonical route wrapper mocks; added a direct status assertion to satisfy scoped lint. |
| Slice 27 user stats security-header migration | Complete | `app/api/users/[id]/stats/route.ts`, `__tests__/api/users/user-stats.test.ts`, `docs/refactor-roadmap.md` | Baseline user-stats Jest suite passed before migration with expected wrapper error logs; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved the stats route `DEFAULT_SECURITY_HEADERS` import into the existing shared wrapper import while preserving authentication, validation, self-only authorization, stats calculation, RPC fallback, error handling, and method-not-allowed behavior; tightened weak assertions in the touched suite for scoped lint. |
| Slice 28 forecast update security-header migration | Complete | `app/api/forecasts/update/route.ts`, `__tests__/api/forecasts/forecasts-update.test.ts`, `docs/refactor-roadmap.md` | Baseline forecast-update Jest suite passed before migration with expected admin-update logs; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved the forecast-update `DEFAULT_SECURITY_HEADERS` import into the existing shared wrapper import while preserving admin auth, non-admin 403s, all-beach and single-beach update paths, GET docs, logging, and response messages; tightened two unauthenticated-error assertions in the touched suite for scoped lint. |
| Slice 29 intel report validation helper migration | Complete | `app/api/intel/[id]/report/route.ts`, `__tests__/api/intel/intel-report.test.ts`, `docs/refactor-roadmap.md` | Baseline intel-report Jest suite passed before migration with expected database-error logs; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved `validateOrError` into the existing shared wrapper import while preserving report creation, optional reason parsing, invalid UUID handling, self-report prevention, duplicate-report prevention, database error paths, malformed JSON tolerance, and report reason variants; tightened helper-only status assertions in the touched suite for scoped lint. |
| Slice 30 intel vote validation helper migration | Complete | `app/api/intel/[id]/vote/route.ts`, `__tests__/api/intel/intel-vote.test.ts`, `docs/refactor-roadmap.md` | Baseline intel-vote Jest suite passed before migration with expected vote-count error logs; red source guard failed on legacy `@/lib/api-utils` import; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved `validateOrError` into the existing shared wrapper import while preserving vote validation, post-active/expired/own-post guards, insert/update/no-op vote paths, delete vote path, count-fetch failures, and auth handling; tightened helper-only status assertions in the touched suite for scoped lint. |
| Slice 31 user comments response helper migration | Complete | `app/api/users/[id]/comments/route.ts`, `__tests__/api/users/user-comments.test.ts`, `docs/refactor-roadmap.md` | Baseline user-comments Jest suite passed before migration with expected database-error logs; red source guard failed on legacy `@/lib/api-utils` import while 16 behavior tests passed; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response, error, method, and UUID helper imports into the shared wrapper import while preserving public access, bot/rate-limit wrapping, invalid user ID handling, comments query shape/order, null data fallback, database error handling, and method-not-allowed behavior; tightened helper-only status assertions in the touched suite for scoped lint. |
| Slice 32 session photos response helper migration | Complete | `app/api/sessions/[id]/photos/route.ts`, `__tests__/api/sessions/session-photos.test.ts`, `docs/refactor-roadmap.md` | Baseline session-photos Jest suite passed before migration with expected database/storage error logs; red source guard failed on legacy `@/lib/api-utils` import while 15 behavior tests passed; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved validation and security-header helper imports into the existing shared wrapper import while preserving optional auth, public/private session access rules, not-found and forbidden responses, photo retrieval, storage/database error handling, and method-not-allowed behavior. |
| Slice 33 intel collection response helper migration | Complete | `app/api/intel/route.ts`, `__tests__/api/intel-route.test.ts`, `docs/refactor-roadmap.md` | Baseline intel route Jest suite passed before migration with expected profile-fallback and database-error logs; red source guard failed on legacy `@/lib/api-utils` import while 38 behavior tests passed; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response and validation helper imports into the shared wrapper import while preserving optional-auth GET behavior, coordinate aliases, radius/tag/limit handling, profile enrichment fallback, POST auth, request validation, dedupe hash/window behavior, surf-condition normalization, service-role E2E path, and creation error handling; tightened three weak assertions in the touched suite for scoped lint. |
| Slice 34 delegated comment validation helper migration | Complete | `app/api/comments/[commentId]/route.ts`, `__tests__/api/sessions/session-comments.test.ts`, `docs/refactor-roadmap.md` | Baseline session-comments Jest suite passed before migration with expected auth/database error logs; red source guard failed on legacy `@/lib/api-utils` import while 12 behavior tests passed; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved standalone comment DELETE validation helpers into the shared wrapper import while preserving nested session comment delegation, auth requirements, invalid session/comment validation, idempotent own-user delete constraint, database error handling, and method-not-allowed behavior. |
| Slice 35 internal welcome-email response helper migration | Complete | `app/api/internal/send-welcome-email/route.ts`, `__tests__/api/internal/send-welcome-email.test.ts`, `docs/refactor-roadmap.md` | Baseline welcome-email Jest suite passed before migration with expected send/log/error output; red source guard failed on legacy `@/lib/api-utils` import while 13 behavior tests passed; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response/error helpers and rate-limit import through the shared wrapper entrypoint while preserving cookie-only auth, dedupe fail-closed behavior, already-sent no-op, missing-email 400, Resend failure 500, template failure handling, delivery logging, and response shapes. |
| Blocking validation fix: alerts activity route | Complete | `app/api/alerts/activity/route.ts`, `__tests__/api/alerts/activity.test.ts`, `docs/refactor-roadmap.md` | `yarn typecheck` exposed an untracked test importing missing `@/app/api/alerts/activity/route`; focused Jest and scoped ESLint passed after adding the route, then `yarn typecheck` and `VERCEL_ENV=preview yarn build` passed | Added the smallest authenticated alert-activity route to satisfy existing characterization coverage: reads recent `forecast_alert`/`similarity_match` notifications, clamps the window to 7 days, strips raw payloads, normalizes beach/title/body/window fields, and returns the standard success envelope. |
| Slice 36 health response helper migration | Complete | `app/api/health/route.ts`, `__tests__/api/health-route.test.ts`, `docs/refactor-roadmap.md` | No direct health route coverage existed, so a focused characterization suite was added; red source guard failed on legacy `@/lib/api-utils` import while shallow/deep/method behavior tests passed; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved health response, security-header, and method helpers into the shared wrapper import while preserving shallow health response, deep forecast-health mapping, critical 503 behavior, error fallback shape, and method-not-allowed headers. |
| Slice 37 coast-pulse summary response helper migration | Complete | `app/api/coast-pulse/summary/route.ts`, `__tests__/api/coast-pulse-summary.test.ts`, `docs/refactor-roadmap.md` | No direct coast-pulse summary route coverage existed, so focused characterization tests were added for validation short-circuit and wrapped setup failure; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved validation and error helpers into the shared wrapper import while preserving rate limiting, missing-coordinate 400 behavior, setup failure 500 behavior, direct summary response shape, and cache headers. |
| Slice 38 featured beaches response helper migration | Complete | `app/api/beaches/featured/route.ts`, `__tests__/api/beaches/beaches-featured.test.ts`, `docs/refactor-roadmap.md` | No direct featured-beaches route coverage existed, so focused characterization tests were added for cached no-coordinate response, coordinate response, and method-not-allowed behavior; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved cache, response, method, and rate-limit helpers into the shared wrapper import while preserving nearby-coordinate handling, forecast enrichment lookup, landing sort, cached anonymous response, uncached coordinate response, and method-not-allowed headers. |
| Slice 39 popular beaches response helper migration | Complete | `app/api/beaches/popular/route.ts`, `__tests__/api/beaches/beaches-popular.test.ts`, `docs/refactor-roadmap.md` | No direct popular-beaches route coverage existed, so focused characterization tests were added for RPC success, fallback query behavior, and wrapped fallback errors; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved cache/error and rate-limit helpers into the shared wrapper import while preserving limit clamping, RPC-first behavior, well-known beach fallback, cached response headers, and wrapped fallback query errors. |
| Slice 40 recent-posts response helper migration | Complete | `app/api/recent-posts/route.ts`, `__tests__/api/recent-posts.test.ts`, `docs/refactor-roadmap.md` | No direct recent-posts route coverage existed, so focused characterization tests were added for default pagination, cache headers, session-query fallback, and wrapped block-query errors; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved pagination/cache/error helpers and bot/rate-limit wrapper into the shared wrapper import while preserving default page/limit behavior, completed-session filters, deleted-media filtering, cached paginated response shape, session-query empty fallback, and fail-closed block-query errors. |
| Slice 41 e2e-login response helper migration | Complete | `app/api/e2e-login/route.ts`, `__tests__/api/e2e-login.test.ts`, `docs/refactor-roadmap.md` | No direct e2e-login route coverage existed, so focused characterization tests were added for dev-host gating, secret validation, missing-env handling, successful test-user login, and Supabase sign-in errors; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; targeted Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved response/security helpers into the shared wrapper import while preserving dev-only host gating, secret checks, required environment validation, cookie adapter wiring, Supabase credential login, success envelope, and sign-in error responses. |
| Slice 42 board-recommendations response helper migration | Complete | `app/api/board-recommendations/route.ts`, `__tests__/api/board-recommendations.test.ts`, `docs/refactor-roadmap.md` | No direct Jest route coverage existed, so focused characterization tests were added for validation short-circuits, auth requirements, board-catalog suggestions, and board-query errors; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; initial typecheck exposed an overly narrow mock return type in the new test, which was fixed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved success/error helpers into the shared wrapper import and removed unused imports while preserving pre-auth validation timing, auth failure responses, board/session query shape, catalog-only recommendation scoring, response envelope, and board-query error shape. |
| Slice 43 nearby buoys response helper migration | Complete | `app/api/buoys/nearby/route.ts`, `__tests__/api/buoys-nearby.test.ts`, `docs/refactor-roadmap.md` | No direct nearby-buoys Jest coverage existed, so focused characterization tests were added for missing coordinates, RPC argument mapping, buoy row normalization, RPC error fallback, and setup error wrapping; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; initial typecheck exposed a mocked Supabase return type issue in the new test, which was fixed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved success/error/validation helpers into the shared wrapper import and removed an unused import while preserving coordinate aliases, default limit/distance behavior, spatial RPC call shape, normalized buoy measurements, empty-success RPC fallback, and wrapped unexpected errors. |
| Slice 44 buoy conditions response helper migration | Complete | `app/api/buoys/conditions/route.ts`, `__tests__/api/buoys-conditions.test.ts`, `docs/refactor-roadmap.md` | No direct buoy-conditions Jest coverage existed, so focused characterization tests were added for missing coordinates, nearest-buoy RPC behavior, condition row normalization, plain 404 no-buoy responses, RPC fallback, and setup error wrapping; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved success/error/validation helpers into the shared wrapper import and removed an unused parsed limit while preserving coordinate aliases, spatial RPC call shape, wind direction naming, legacy plain 404 no-buoy response, mock fallback response, and wrapped unexpected errors. |
| Slice 45 surf route response helper migration | Complete | `app/api/surf/route.ts`, `__tests__/api/surf-route.test.ts`, `docs/refactor-roadmap.md` | No direct surf route Jest coverage existed, so focused characterization tests were added for missing input validation, coordinate normalization, beach forwarding, forecast-array normalization, no-data errors, and wrapped forecast failures; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved success/error/validation helpers into the shared wrapper import and removed an unused import while preserving forecast service inputs, logging behavior, response envelope, array-to-first-forecast normalization, no-data error behavior, and wrapped service failures. This did not touch parser, transform, scorer, ingestion, or forecast cron code paths, so no live forecast pipeline trace was needed for the slice. |
| Slice 46 surf insights response helper migration | Complete | `app/api/surf/insights/route.ts`, `__tests__/api/surf-insights-route.test.ts`, `docs/refactor-roadmap.md` | No direct surf-insights Jest route coverage existed, so focused characterization tests were added for query validation, anonymous onboarding responses, authenticated insight computation, cache headers, and the source guard; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; initial typecheck exposed a too-narrow mocked insight fixture, which was fixed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Moved `createSuccessResponse` and `validateOrError` into the existing shared wrapper import while preserving optional-auth wrapper usage, validation messages, anonymous short-cache onboarding response, authenticated compute inputs, private cache headers, and service response envelope. This did not touch parser, transform, scorer, ingestion, or forecast cron code paths, so no live forecast pipeline trace was needed for the slice. |
| Slice 47 wind cron response helper migration | Complete | `app/api/cron/wind/update/route.ts`, `__tests__/app/api/cron/wind/update.test.ts`, `lib/middleware/api-wrappers.ts`, `lib/middleware/api-wrappers/index.ts`, `lib/middleware/api-wrappers/response-utils.ts`, `docs/refactor-roadmap.md` | Existing wind-update cron Jest coverage was extended with a source guard and expected log suppression; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Re-exported `validateCronAuth`/`validateCronRequest` through the wrapper barrel, migrated wind cron auth/response helper imports, and preserved unauthorized handling, beach batching, Open-Meteo wind filtering, RPC payload shape, partial-error responses, and success summaries. This did not alter parser, transform, scorer, ingestion, or forecast cron refresh paths; no live forecast pipeline trace was needed for the import-only slice. |
| Slice 48 CCC sync cron response helper migration | Complete | `app/api/cron/ccc-sync/route.ts`, `__tests__/app/api/cron/ccc-sync.test.ts`, `docs/refactor-roadmap.md` | Existing CCC sync cron Jest coverage was extended with a source guard and expected log suppression; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated CCC cron auth/response/error helper imports to the shared wrapper barrel while preserving unauthorized handling, invalid/blank/missing phase skip behavior, scheduled import/match inference, import upsert flow, match radius flow, and observed-cron wrapping. |
| Slice 49 cleanup pending alert captures cron validation helper migration | Complete | `app/api/cron/cleanup-pending-alert-captures/route.ts`, `__tests__/api/cron/cleanup-pending-alert-captures.test.ts`, `docs/refactor-roadmap.md` | Existing cleanup cron Jest coverage was extended with a source guard and expected log suppression; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated cleanup cron request-validation import to the shared wrapper barrel while preserving unauthorized handling, expired/unconsumed delete filters, exact count reporting, and observed-cron wrapping. |
| Slice 50 condition alert evaluate cron validation helper migration | Complete | `app/api/cron/condition-alert-evaluate/route.ts`, `__tests__/api/cron/condition-alert-evaluate.test.ts`, `docs/refactor-roadmap.md` | Existing condition-alert evaluation cron Jest coverage was extended with a source guard and expected log suppression; red source guard failed on legacy `@/lib/api-utils` import while 15 behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated condition-alert evaluation cron request-validation import to the shared wrapper barrel while preserving rule fetch filtering, profile/beach/entitlement lookups, delivery dedupe, surfability gating, alert queue upsert behavior, and summary responses. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 51 condition alert deliver cron validation helper migration | Complete | `app/api/cron/condition-alert-deliver/route.ts`, `__tests__/api/cron/condition-alert-deliver.test.ts`, `__tests__/condition-alert-deliver-profiles-join.test.ts`, `docs/refactor-roadmap.md` | Existing condition-alert delivery cron Jest coverage was extended with a source guard and expected log suppression; red source guard failed on legacy `@/lib/api-utils` import while 22 behavior tests passed; focused delivery/profile-join Jest suites, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated condition-alert delivery cron request-validation import to the shared wrapper barrel while preserving kill switch and allowlist behavior, alert attempt recording, profile join regression coverage, stale forecast revalidation, email/push delivery branches, similarity partition handling, and queue marking semantics. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 52 conditions alert email cron response helper migration | Complete | `app/api/cron/conditions-alert-email/route.ts`, `__tests__/app/api/cron/conditions-alert-email.test.ts`, `docs/refactor-roadmap.md` | Existing conditions-alert email cron Jest coverage was extended with a source guard and cleaner mocks for re-score/beach URL dependencies; red source guard failed on legacy `@/lib/api-utils` import while 22 behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated conditions-alert email cron response/error/validation helper imports to the shared wrapper barrel while preserving auth responses, candidate RPC handling, slot-claim dedupe, email send/log behavior, rate limiting, summary statistics, and observed-cron wrapping. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 53 forecast alerts cron response helper migration | Complete | `app/api/cron/forecast-alerts/route.ts`, `__tests__/api/cron/forecast-alerts.test.ts`, `__tests__/app/api/cron/forecast-alerts/route.test.ts`, `docs/refactor-roadmap.md` | Existing forecast-alerts cron Jest coverage was extended with a source guard and expected error-log suppression; red source guard failed on legacy `@/lib/api-utils` import while 18 behavior tests passed; focused cron/route Jest suites, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated forecast-alerts cron response/error/validation helper imports to the shared wrapper barrel while preserving auth rejection, success summary envelopes, service error handling, idempotency expectations, and observed-cron wrapping. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 54 forecast digest email cron response helper migration | Complete | `app/api/cron/forecast-digest-email/route.ts`, `__tests__/api/cron/forecast-digest-email.test.ts`, `docs/refactor-roadmap.md` | Existing forecast-digest email cron static regression coverage was extended with a source guard; red source guard failed on legacy `@/lib/api-utils` import while 3 existing source-regression tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated forecast-digest email cron response/error/validation helper imports to the shared wrapper barrel while preserving source-guarded push ownership, canonical tide preference columns, CTA template markers, and observed-cron wrapping. This route still lacks executable behavior coverage; this import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 55 first-session nudge email cron response helper migration | Complete | `app/api/cron/first-session-nudge/route.ts`, `__tests__/app/api/cron/first-session-nudge.test.ts`, `docs/refactor-roadmap.md` | Existing first-session nudge email cron Jest coverage was extended with a source guard and expected log suppression; red source guard failed on legacy `@/lib/api-utils` import while 16 behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated first-session nudge email cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth, signup-window filtering, session/dedupe/cooldown filters, auth email lookup batching, personalized/generic template selection, rate limiting, email logging, and summary responses. The expected send-failure console error is now asserted without printing during the focused suite. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 56 first-session nudge push cron response helper migration | Complete | `app/api/cron/first-session-nudge-push/route.ts`, `__tests__/app/api/cron/first-session-nudge-push.test.ts`, `docs/refactor-roadmap.md` | Existing first-session nudge push cron Jest coverage was extended with a source guard and log suppression; red source guard failed on legacy `@/lib/api-utils` import while 15 behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated first-session nudge push cron response/error/validation helper imports to the shared wrapper barrel while preserving auth rejection, day-7 signup window filtering, idempotency/session/email-confirmed/push-token gates, cohort copy resolution, notification enqueue semantics, activation push logging, and summary responses. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 57 trial-ending push delivery cron response helper migration | Complete | `app/api/cron/trial-ending-push-deliver/route.ts`, `__tests__/app/api/cron/trial-ending-push-deliver.test.ts`, `docs/refactor-roadmap.md` | Existing trial-ending push delivery cron Jest coverage was extended with a source guard and log suppression; red source guard failed on legacy `@/lib/api-utils` import while 8 behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated trial-ending push delivery cron response/error/validation helper imports to the shared wrapper barrel while preserving auth rejection, trial-ending window selection, idempotency log filtering, push preference/device-token gates, notification enqueue semantics, trial push logging, multi-device metadata, and summary responses. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 58 update implicit preferences cron response helper migration | Complete | `app/api/cron/update-implicit-preferences/route.ts`, `__tests__/app/api/cron/update-implicit-preferences.test.ts`, `docs/refactor-roadmap.md` | Existing implicit-preference update cron Jest coverage was extended with a source guard; red source guard failed on legacy `@/lib/api-utils` import while 7 behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated implicit-preference update cron response/error/validation helper imports to the shared wrapper barrel while preserving production-only gating, cron auth, `userId`/`targetUserId` UUID validation, targeted and global RPC payloads, cleanup RPC execution, POST delegation, and detailed error responses. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 59 update user preferences cron response helper migration | Complete | `app/api/cron/update-user-preferences/route.ts`, `__tests__/app/api/cron/update-user-preferences.test.ts`, `docs/refactor-roadmap.md` | Existing user-preference update cron Jest coverage was extended with a source guard and expected log/error/warn suppression; red source guard failed on legacy `@/lib/api-utils` import while 23 behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated user-preference update cron response/validation helper imports to the shared wrapper barrel while preserving production-only gating, cron auth, rated-session user discovery, mock-user exclusion and manual inclusion, batching, partial failure collection, GET/POST parity, and summary responses. Removed a wall-clock performance-budget test in the touched suite per repo guidance; the structural batch-processing coverage remains. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 60 welcome email cron response helper migration | Complete | `app/api/cron/welcome-email/route.ts`, `__tests__/api/cron/welcome-email.test.ts`, `docs/refactor-roadmap.md` | Existing welcome-email cron Jest coverage was extended with a source guard and expected log/error suppression; red source guard failed on legacy `@/lib/api-utils` import while 22 behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated welcome-email cron response/error/validation helper imports to the shared wrapper barrel while preserving real cron auth validation, candidate RPC handling, unconfirmed/no-home-beach cases, email template generation, auto-confirmation, delivery logging, retry/idempotency expectations, and summary responses. The touched suite's existing weak assertion and assertion-count lint warnings were fixed. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 61 resolve YouTube cams cron response helper migration | Complete | `app/api/cron/resolve-youtube-cams/route.ts`, `__tests__/app/api/cron/resolve-youtube-cams.test.ts`, `docs/refactor-roadmap.md` | Existing resolve-youtube-cams cron config-missing Jest coverage was extended with a source guard; red source guard failed on legacy `@/lib/api-utils` import while the existing config-missing test passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated resolve-youtube-cams cron response/validation helper imports to the shared wrapper barrel while preserving cron auth, missing-`YOUTUBE_API_KEY` skip behavior, and response shape. This route still lacks executable coverage for database querying, channel resolution, stale clearing, live-stream matching, quota aborts, and per-channel error handling; this import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 62 reengagement email cron response helper migration | Complete | `app/api/cron/reengagement-email/route.ts`, `__tests__/app/api/cron/reengagement-email.test.ts`, `docs/refactor-roadmap.md` | Existing reengagement-email cron Jest coverage was extended with a source guard and expected log/error suppression; red source guard failed on legacy `@/lib/api-utils` import while 23 behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated reengagement-email cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth, candidate RPC payloads, delivery-slot claim dedupe, recent intel lookup, one-tap session token generation, email template payloads, send/log handling, rate limiter calls, and summary responses. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 63 session prompt email cron response helper migration | Complete | `app/api/cron/session-prompt-email/route.ts`, `__tests__/app/api/cron/session-prompt-email.test.ts`, `docs/refactor-roadmap.md` | Existing session-prompt email cron Jest coverage was extended with a source guard and expected log/error suppression; red source guard failed on legacy `@/lib/api-utils` import while 19 behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated session-prompt email cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth, candidate RPC payloads, delivery-slot claim dedupe, signed confirm/skip URL generation, email template payloads, send/log handling, rate limiter calls, and summary responses. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 64 IOOS sync cron response helper migration | Complete | `app/api/cron/ioos-sync/route.ts`, `__tests__/app/api/cron/ioos-sync-deactivation.test.ts`, `__tests__/app/api/cron/ioos-sync-observations.test.ts`, `docs/refactor-roadmap.md` | Existing IOOS sync cron deactivation/observation Jest coverage was extended with a source guard; red source guard failed on legacy `@/lib/api-utils` import while 18 behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated IOOS sync cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth, station discovery/upsert behavior, discovery-miss safety cap, observation reactivation, batch processing, observable-beach refresh, and 404/stale deactivation handling. The touched observation suite's weak reactivation assertion was tightened for scoped lint. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 65 NDBC direct sync cron response helper migration | Complete | `app/api/cron/ndbc-direct-sync/route.ts`, `__tests__/app/api/cron/ndbc-direct-sync.test.ts`, `docs/refactor-roadmap.md` | No focused NDBC direct sync route coverage existed, so a small characterization suite was added for source guard, invalid phase response, and empty observation summary behavior; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated NDBC direct sync cron response/error/validation helper imports to the shared wrapper barrel while preserving cron phase validation, empty observation summary behavior, and no-fetch behavior when no active stations exist. The new test documents current behavior that the empty-station observation branch returns before refreshing `observable_beaches`. This import-only slice did not touch forecast parser, transform, scorer, ingestion, or forecast refresh code paths, so no live forecast pipeline trace was needed. |
| Slice 66 sitemap health cron response helper migration | Complete | `app/api/cron/sitemap-health/route.ts`, `__tests__/app/api/cron/sitemap-health.test.ts`, `docs/refactor-roadmap.md` | No focused sitemap-health route coverage existed, so a small characterization suite was added for source guard, unauthorized response behavior, and empty-sitemap success summary behavior; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated sitemap-health cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth rejection, Sentry check-in wiring, empty-sitemap Sentry capture, and success-envelope empty summary behavior. This import-only slice did not touch SEO metadata constants or sitemap generation logic. |
| Slice 67 IndexNow submit cron response helper migration | Complete | `app/api/cron/indexnow-submit/route.ts`, `__tests__/app/api/cron/indexnow-submit.test.ts`, `docs/refactor-roadmap.md` | No focused IndexNow submit route coverage existed, so a small characterization suite was added for source guard, unauthorized response behavior, and missing-`INDEXNOW_KEY` short-circuit behavior; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated IndexNow submit cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth rejection, missing-key 500 behavior, and the guarantee that URL collection/submission is skipped when configuration is missing. This import-only slice did not touch SEO metadata constants, sitemap generation logic, or IndexNow service request logic. |
| Slice 68 resolve cam thumbnails cron response helper migration | Complete | `app/api/cron/resolve-cam-thumbnails/route.ts`, `__tests__/app/api/cron/resolve-cam-thumbnails.test.ts`, `docs/refactor-roadmap.md` | No focused resolve-cam-thumbnails route coverage existed, so a small characterization suite was added for source guard, unauthorized response behavior, default missing-thumbnail filtering, force-mode query behavior, and empty-queue success response; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated resolve-cam-thumbnails cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth rejection, default `thumbnail_url IS NULL` filtering, `force=true` query behavior, GET/POST parity, and empty-queue success response. This import-only slice did not touch camera thumbnail extraction or database update logic. |
| Slice 69 sync buoys cron response helper migration | Complete | `app/api/cron/sync-buoys/route.ts`, `__tests__/app/api/cron/sync-buoys.test.ts`, `docs/refactor-roadmap.md` | No focused cron sync-buoys route coverage existed, so a small characterization suite was added for source guard, unauthorized response behavior, default max-distance sync, query-param max-distance sync, and service failure mapping; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated sync-buoys cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth rejection, `maxDistanceKm` parsing/defaulting, NOAA sync service invocation, success summary envelope, and sync failure 500 response. This import-only slice did not touch NOAA sync service logic, buoy schemas, or admin sync behavior. |
| Slice 70 update buoy conditions cron response helper migration | Complete | `app/api/cron/update-buoy-conditions/route.ts`, `__tests__/app/api/cron/update-buoy-conditions.test.ts`, `docs/refactor-roadmap.md` | No focused cron update-buoy-conditions route coverage existed, so a small characterization suite was added for source guard, unauthorized response behavior, active-buoy query behavior, empty active-buoy summary, missing-observation no-data handling, and active-buoy query failure mapping; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated update-buoy-conditions cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth rejection, active buoy selection, no-active-buoy summary, no-data observation handling, database-error response behavior, and observed-cron wrapping. This import-only slice did not touch NDBC fetch logic, unit conversions, batching, update writes, or admin condition sync behavior. |
| Slice 71 water quality sync cron response helper migration | Complete | `app/api/cron/water-quality-sync/route.ts`, `__tests__/app/api/cron/water-quality-sync.test.ts`, `docs/refactor-roadmap.md` | No focused water-quality-sync route coverage existed, so a small characterization suite was added for source guard, unauthorized response behavior, invalid phase rejection, and stations/samples/evaluate phase dispatch; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated water-quality-sync cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth rejection, invalid phase 400 behavior, service-role client creation timing, stations/samples/evaluate dispatch, and phase-specific success envelopes. This import-only slice did not touch water-quality ingestion, CEDEN/PacIOOS parsing, EPA evaluation logic, or database writes. |
| Slice 72 water quality alerts cron response helper migration | Complete | `app/api/cron/water-quality-alerts/route.ts`, `__tests__/app/api/cron/water-quality-alerts.test.ts`, `docs/refactor-roadmap.md` | No focused water-quality-alerts route coverage existed, so a small characterization suite was added for source guard, unauthorized response behavior, and alert service invocation/response behavior; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated water-quality-alerts cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth rejection, service-role client creation timing, water quality alert service invocation, success envelope shape, and observed-cron wrapping. This import-only slice did not touch alert eligibility, notification enqueue behavior, dedupe, quiet-hours handling, or water-quality status logic. |
| Slice 73 notifications deliver cron validation helper migration | Complete | `app/api/cron/notifications-deliver/route.ts`, `__tests__/app/api/cron/notifications-deliver.test.ts`, `docs/refactor-roadmap.md` | No focused notifications-deliver route coverage existed, so a small characterization suite was added for source guard, unauthorized response behavior, cron observability delegation, and worker summary response behavior; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated notifications-deliver cron request-validation import to the shared wrapper barrel while preserving plain `NextResponse` response shapes, cron auth rejection, service-role client creation timing, cron observability wrapping, and `processPendingEvents` worker invocation. This import-only slice did not touch notification registry behavior, delivery attempts, FCM dispatch, in-app row writes, or worker internals. |
| Slice 74 daily intel cron response helper migration | Complete | `app/api/cron/daily-intel/route.ts`, `__tests__/app/api/cron/daily-intel.test.ts`, `docs/refactor-roadmap.md` | No focused daily-intel route coverage existed, so a characterization suite was added for source guard, unauthorized response behavior, missing Supabase configuration, eligible beach query shape, max-beach clamping, and one successful generation/save path; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated daily-intel cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth rejection, environment validation, beach selection filters/order/limit, generation time handling, timezone resolution, generation/save calls, and success summaries. This import-only slice did not touch `IntelGenerationService`, forecast/intel scoring, database write behavior, or daily-intel content logic. |
| Slice 75 weekly recap email cron response helper migration | Complete | `app/api/cron/weekly-recap-email/route.ts`, `__tests__/app/api/cron/weekly-recap-email.test.ts`, `docs/refactor-roadmap.md` | No focused weekly-recap-email route coverage existed, so a characterization suite was added for source guard, unauthorized response behavior, no-session summary behavior, and one successful send/log path; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated weekly-recap-email cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth rejection, session/profile selection, weekly stats calculation, best-days lookup fallback surface, rate-limited email send, delivery logging, and success summaries. This import-only slice did not touch email template rendering, Resend client behavior, best-days scoring, or email logging service internals. |
| Slice 76 morning forecast bot cron response helper migration | Complete | `app/api/cron/morning-forecast-bot/route.ts`, `__tests__/app/api/cron/morning-forecast-bot.test.ts`, `docs/refactor-roadmap.md` | No focused morning-forecast-bot route coverage existed, so a characterization suite was added for source guard, unauthorized response behavior, missing bot profile handling, and the three-region post path; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated morning-forecast-bot cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth rejection, forecast bot profile lookup, regional forecast formatter calls, representative beach lookup, intel post insertion payloads, per-region result summaries, and top-level error handling. This import-only slice did not touch regional forecast selection, formatter logic, scoring, ingestion, or forecast refresh paths. |
| Slice 77 NPC activity cron response helper migration | Complete | `app/api/cron/npc-activity/route.ts`, `__tests__/app/api/cron/npc-activity.test.ts`, `docs/refactor-roadmap.md` | No focused npc-activity route coverage existed, so a characterization suite was added for source guard, unauthorized response behavior, no-selected-NPC summary behavior, and one deterministic fallback intel insert; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; initial typecheck caught a too-narrow test mock signature, then focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after the test fix | Migrated npc-activity cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth rejection, eligible NPC selection, empty selected-NPC summaries, beach selection, fallback intel content, insert payloads, and success summaries. This import-only slice did not touch NPC selection weights, template hydration, random jitter logic, or database write semantics. |
| Slice 78 forecast refresh cron response helper migration | Complete | `app/api/cron/forecasts/refresh/route.ts`, `__tests__/app/api/cron/forecasts-refresh.tides.test.ts`, `docs/refactor-roadmap.md` | Existing tide backfill coverage passed before migration, then was extended with a source guard and expected log suppression; red source guard failed on legacy `@/lib/api-utils` import while the tide behavior test passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated forecast refresh cron response/error/validation helper imports to the shared wrapper barrel while preserving cron auth rejection, tide backfill beach filtering, station grouping, one-fetch-per-station behavior, tide fan-out/upsert totals, and response envelopes. This import-only slice did not touch forecast parser, transform, scorer, ingestion, selection, or live upstream request logic, so no forecast pipeline trace script was added. |
| Slice 79 enhanced forecast sync shared helper migration | Complete | `app/api/cron/enhanced-forecast-sync/_shared.ts`, `__tests__/app/api/cron/enhanced-forecast-sync.test.ts`, `docs/refactor-roadmap.md` | Existing enhanced forecast sync coverage was extended with a shared-source guard and Sentry check-in boundary mock to remove expected warning noise; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated enhanced forecast sync shared response/validation helper imports to the shared wrapper barrel while preserving production guard behavior, cron auth rejection, shard parameter forwarding, deadline propagation, Sentry check-in calls, updater invocation, and success/error response shapes. This import-only slice did not touch forecast parser, transform, scorer, ingestion, selection, or live upstream request logic, so no forecast pipeline trace script was added. |
| Slice 80 CDIP enhanced forecast sync shared helper migration | Complete | `app/api/cron/enhanced-forecast-sync-cdip/_shared.ts`, `__tests__/app/api/cron/enhanced-forecast-sync-cdip.test.ts`, `docs/refactor-roadmap.md` | Existing CDIP enhanced forecast sync coverage was extended with a shared-source guard, unauthorized characterization, and Sentry boundary mock; red source guard failed on legacy `@/lib/api-utils` import while behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated CDIP enhanced forecast sync shared response/validation helper imports to the shared wrapper barrel while preserving production guard behavior, cron auth rejection, deadline propagation, updater invocation, Sentry check-in calls, health response behavior, and success/error response shapes. This import-only slice did not touch CDIP parser, transform, scorer, ingestion, selection, or live upstream request logic, so no forecast pipeline trace script was added. |
| Slice 81 proxy security-header import cleanup | Complete | `proxy.ts`, `__tests__/middleware.integration.test.ts`, `docs/refactor-roadmap.md` | Existing middleware integration coverage was extended with a source guard; red source guard failed on legacy `@/lib/api-utils` import while 29 behavior tests passed; focused Jest, scoped ESLint, `yarn typecheck`, and `VERCEL_ENV=preview yarn build` passed after implementation | Migrated `DEFAULT_SECURITY_HEADERS` to the shared wrapper barrel while preserving public/protected/admin route behavior, canonical redirects and rewrites, middleware skip rules, and security header application. |

## Current Risks

- The worktree had many pre-existing modified and untracked files during Phase 1. Each implementation slice must inspect touched files before editing.
- Static analyzer output includes likely false positives for framework exports and generated/runtime entry points.
- Some event emitters not in `VALID_EVENTS` may intentionally target GA4/PostHog only.
- `social_share` is still emitted to `/api/events` by share UI code but is not accepted by `VALID_EVENTS`; this is documented, not fixed, in Slice 3.
- Documentation in README is stale relative to `AGENTS.md`, `CLAUDE.md`, and `package.json`.
- `beach-daily-intel` now uses the shared error wrapper, but it intentionally still creates its Supabase client inside the handler so invalid requests continue to short-circuit before DB setup.
- The compatibility shim at `lib/middleware/api-wrappers.ts` does not export every type from `lib/middleware/api-wrappers/index.ts`; routes that need `OptionalAuthContext` still import that type from `lib/middleware/api-wrappers/types`. A trailing-slash import to the modular index typechecked but failed in this Jest setup, so this needs a separate resolver/shim cleanup if standardized.
- The cam-resolve Jest suite still prints expected `console.warn` and `console.error` output from mocked no-stream, upstream-error, and network-error branches; tests pass and the output is validation noise rather than a new failure.
- The user-stats Jest suite still prints expected `console.error` output from wrapper-handled database error branches; tests pass and the output is validation noise rather than a new failure.
- The forecast-update Jest suite still prints expected admin-update `console.log` output from update-path tests; tests pass and the output is validation noise rather than a new failure.
- The intel-report Jest suite still prints expected `console.error` output from duplicate-check and insert database error branches; tests pass and the output is validation noise rather than a new failure.
- The intel-vote Jest suite still prints expected `console.error` output and stack traces from vote-count failure branches; tests pass and the output is validation noise rather than a new failure.
- The user-comments Jest suite still prints expected `console.error` output and stack traces from database and unexpected-error branches; tests pass and the output is validation noise rather than a new failure.
- The session-photos Jest suite still prints expected `console.error` output and stack traces from mocked database and storage failure branches; tests pass and the output is validation noise rather than a new failure.
- The intel route Jest suite still prints expected `console.warn`/`console.error` output from profile-fallback, fetch-error, and create-error branches; tests pass and the output is validation noise rather than a new failure.
- The session-comments Jest suite still prints expected `console.error` output and stack traces from mocked RLS, delete, and malformed insert branches; tests pass and the output is validation noise rather than a new failure.
- The welcome-email Jest suite still prints expected `console.log` and `console.error` output from mocked send, already-sent, dedupe-error, email-error, template-error, and log-error branches; tests pass and the output is validation noise rather than a new failure.
- The IOOS sync Jest suites still print expected cron progress logs and warning-capture output from mocked safety-cap branches; tests pass and the warning output is used by existing assertions.

## Remaining Work

- First eighty-one implementation slices are complete.
- All `app/api/**/route.ts` legacy `@/lib/api-utils` imports are migrated.
- Remaining production `@/lib/api-utils` imports outside wrapper internals are `app/session/confirm/route.ts`, `lib/cron/observability.ts`, `lib/validation/middleware.ts`, and `lib/middleware/bot-blocker.ts`.
- Wrapper internals intentionally still depend on `lib/api-utils` while this compatibility migration is in progress.
- One blocking validation fix is complete: `/api/alerts/activity` was added because an existing untracked test referenced it and `yarn typecheck` failed without it.
- Keep later slices independent and update this document after each completed slice.
- For the next API wrapper slice, inspect candidate routes and tests before choosing; do not assume all legacy `api-utils` callers can use `createApiHandler` without changing validation timing.

## Open Questions

- Which analytics destinations are authoritative for GA4/PostHog-only events that do not belong in `/api/events`?
- Should `social_share` be migrated to existing share event names or added to the internal allowlist in a behavior-change slice?
- Should event taxonomy ownership live under `lib/analytics/` or closer to `app/api/events/` long term?
- Should the backwards-compatible `lib/middleware/api-wrappers.ts` shim export `OptionalAuthContext`, or should routes consistently import types from the modular `types` file?
- Should the remaining non-route utility imports be migrated first, or should wrapper internals be collapsed behind the modular index first?

## Recommended Next Slice

Slice 82: Continue with the low-risk `app/session/confirm/route.ts` UUID validation import cleanup. Inspect the route and existing session-confirm coverage first, verify `isValidUuid` is available from `@/lib/middleware/api-wrappers`, add or extend a source guard, migrate only that import, and preserve token exchange, redirect, and invalid-token behavior.

## Pause Handoff

Paused after Slice 81 with validation passing for the completed proxy import cleanup.

Next safe task:

- Inspect `app/session/confirm/route.ts`, the nearest architecture docs, and existing tests that cover session confirmation.
- Verify the route can import `isValidUuid` from `@/lib/middleware/api-wrappers` without changing runtime behavior.
- Add or extend a focused source guard before the production edit.
- Migrate only the `isValidUuid` import.
- Run focused Jest for the session-confirm coverage, scoped ESLint for the touched files, `yarn typecheck`, and `VERCEL_ENV=preview yarn build`.
- Update this roadmap with Slice 82 progress and stop for review before taking the next slice.
