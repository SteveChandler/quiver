# Quiver Soul

This file is the single source of truth for repository-level AI coding guidance in Quiver.
`AGENTS.md` and `CLAUDE.md` are compatibility entry points and must only point here.
Do not duplicate this guidance in model-specific files.

## Authority and truth

- Follow the user's explicit task, scope, and constraints.
- For the current state of the system, source code, database schemas, generated types, `package.json`, tests, and CI configuration outrank prose documentation.
- This file contains durable repository-wide rules. Focused documentation may add domain detail but must not contradict it.
- Dated plans, reports, investigations, changelog entries, `.planning/`, archives, handoffs, and retained model memory are historical context unless the task names them directly.
- Product priorities come from the current task, current roadmap or issue, and live evidence. Do not infer a permanent growth, monetization, or feature priority from an old document.
- When documentation conflicts with implementation, verify the behavior in code or data, follow the verified behavior, and update or flag the stale document.
- Never treat a question, suggestion, or hypothetical as approval for a production-impacting action.

## Product soul

Quiver helps surfers make a confident call, log what happened, and feel part of a local surf community.
The product should feel made by surfers for surfers: trustworthy, useful before dawn, fast at the beach, and worth sharing afterward.

Core principles:

1. **Data is sacred.** Forecast numbers, tides, conditions, scores, and status must remain clear and scannable.
2. **Trust beats hype.** State uncertainty, return real failures, and say no when evidence does not support a positive call.
3. **One product across surfaces.** Web and native should preserve compatible contracts, domain models, analytics, and user expectations.
4. **Surf culture without cliché.** Use typography, texture, language, and local identity rather than generic wave art or corporate polish.
5. **Personality over template polish.** Quiver can feel handmade, but roughness must never reduce readability or accessibility.

## Stack and repository map

Package manifests and configuration are authoritative for exact versions.

- Web: Next.js App Router, React, TypeScript, Tailwind, Radix UI, Supabase, Mapbox, Jest, and Playwright.
- Runtime and package manager: Node 22 and Yarn 1 unless repository configuration changes.
- Native: separate Expo/React Native repository at `../quiver-native`.
- App routes and API routes: `app/`
- Shared UI: `components/`
- Server actions: `actions/`
- Business logic and services: `lib/`
- Hooks: `hooks/`
- Domain types: `types/`
- Database migrations: `supabase/migrations/`
- Unit and integration tests: `__tests__/`
- Browser tests: `e2e/`
- Canonical local skill root: `.agents/skills`; `.agent/skills` and `.claude/skills` are compatibility symlinks and must not diverge.

## Default workflow

Keep the process proportional to the task: **inspect -> implement -> validate -> review**.

1. Inspect the affected code, its direct consumers and producers, nearby tests, and the nearest relevant `ARCHITECTURE.md` before editing.
2. Search for an existing component, utility, wrapper, schema, or pattern before creating another one.
3. Make the smallest coherent change that fully satisfies the requested behavior.
4. Preserve existing user work and avoid unrelated refactors, formatting churn, generated artifacts, or cross-repository edits.
5. Run the smallest meaningful checks first, then broaden according to blast radius and release risk.
6. Review the final diff for regressions, weak assertions, user-data risk, contract drift, and unrelated changes.
7. Never claim a check passed unless the exact command was run successfully.
8. Do not commit, push, open a pull request, or mutate production unless the user explicitly asks.

Work directly by default. Named agents, orchestration frameworks, MCP servers, plugins, and local skills are optional aids, not prerequisites. Delegate only bounded independent work with a clear benefit, and verify delegated results against the actual diff and tests.

## Context routing

Load only the references relevant to the task:

- Repository architecture and directory map: `docs/ARCHITECTURE.md`, then the nearest local `ARCHITECTURE.md`
- Documentation index: `docs/README.md`
- API wrappers and route conventions: `docs/API_MIDDLEWARE.md`
- Database and production mutations: `docs/MIGRATION_SAFETY.md` and `docs/SUPABASE_GUIDE.md`
- Routing and geographic coverage: `docs/ROUTING_PATTERNS.md`
- Coordinate naming: `docs/COORDINATE_CONVENTIONS.md`
- Test strategy and commands: `docs/TEST_ARCHITECTURE.md`, `docs/guides/TESTING_GUIDE.md`, and `e2e/README.md`
- Git and release flow: `docs/GIT_WORKFLOW.md`
- Brand and visual design: `docs/STYLE_GUIDE.md`, `app/styles/zine.css`, and `components/zine/`
- Marketing, positioning, SEO, and copy: `.claude/product-marketing-context.md`
- Scripts and dependency versions: `package.json`

Do not load broad archives, historical plans, reports, or large implementation records by default.

## Core engineering invariants

### TypeScript and code style

- Use TypeScript-first patterns, explicit boundaries, meaningful names, early returns, and no empty catches.
- Use 2-space indentation, PascalCase components, camelCase functions and variables, and kebab-case route segments.
- Preserve local formatting and avoid reformatting unrelated code.
- Comments should explain why, not restate what the code already says.

### Data fetching

- Prefer the established `useDataFetcher` pattern with a memoized fetch function.
- Some existing surfaces use SWR or TanStack Query; inspect the local pattern before adding or changing a dependency.
- Do not invent another fetching abstraction without evidence that existing primitives cannot support the requirement.

### Server actions

- Protected server actions use `withAuthenticatedAction` from `lib/server-action-utils.ts`.
- Use the established validation and action helpers where appropriate: `makeAuthenticatedAction`, `withValidation`, and `createServerAction`.

### API routes

- Authenticated API routes use `withAuth` from `lib/middleware/api-wrappers/`.
- Prefer the established response, error, rate-limit, bot-protection, parameter-validation, and ownership helpers.
- Legacy routes using `lib/api-utils.ts` should migrate to the current wrapper pattern when they are edited and the migration is safe.
- Mutation routes must explicitly avoid unintended caching. Check `next.config.mjs` and set no-store behavior where required.

### Realtime

- Subscribe inside `useEffect` and always remove the Supabase channel during cleanup.

### Coordinates

- Beach rows use `lat` and `lon`.
- `beach.latitude` does not exist.
- Do not introduce new `lng` fields; use `lon` or `longitude` according to the local external contract.

### Forecast timestamps

- Use `forecast_at` (`timestamptz`) for new forecast queries and ordering.
- Do not introduce new `forecast_date` plus `forecast_time` query paths.
- Use `lib/utils/forecast-at-adapter.ts` where an adapter is required.

### User ownership

- Use `user_id` for user-owned records.
- Do not introduce `profile_id`; `sessions.profile_id` does not exist.

## Authentication and analytics

- Pre-auth funnel events must never fire for authenticated users. Guard on the client and enforce the server-side pre-auth blocklist.
- Keep analytics event emitters, server allowlists, anonymous/pre-auth rules, TypeScript unions, and database constraints aligned.
- Anonymous CTA components must independently inspect auth state with `useAuth()`; never rely only on a parent's `publicMode` or similar prop.
- OAuth changes require real iOS Safari validation before release because cross-origin cookie behavior differs from desktop Chrome. When unavailable, run all other relevant checks and report the validation gap.

## Web and native contract boundary

Web and native are separate repositories but one installed product.

- Native clients cannot call `"use server"` actions; cookie re-authentication can silently drop Bearer-authenticated native writes. Implement native writes in API routes or another supported contract.
- Before changing an `/api/*` route, search `../quiver-native/src` for the route path and inspect all consumers.
- Mobile-consumed request and response changes are additive. Do not rename, remove, repurpose, or narrow an existing field in place; add a field or a new route.
- Return real HTTP error statuses. Never encode a failure inside a successful 200 response.
- Preserve compatibility with installed binaries that may remain active for months.
- For shared visible behavior, inspect the native counterpart and available canonical design reference before inventing a divergent implementation.
- Do not make opportunistic cross-repository edits unless they are required by the task and covered by appropriate tests.

## Database and migration safety

- Migrations belong in `supabase/migrations/` and use `YYYYMMDDHHMMSS_descriptive_name.sql`.
- Wrap migrations in `BEGIN;` and `COMMIT;` unless a documented PostgreSQL operation cannot run in a transaction.
- Prohibited without explicit, reviewed authorization: bulk `DELETE`, `TRUNCATE` on user tables, dropping core tables, and deletion keyed only by user-provided strings.
- Use idempotent guards such as `WHERE NOT EXISTS` for inserts where appropriate.
- Provide a rollback path for destructive changes.
- Preserve `WITH (security_invoker = true)` when recreating protected views.
- Production database access is read-only by default. A production mutation requires an explicit plan and separate approval.
- Use the production owner connection required by migration tracking; do not use an ad hoc migrator identity.
- Do not hand-edit `types/database.generated.ts`.
- RLS is required on user-data tables, with validation and authorization at system boundaries.

## Testing and validation

Behavior changes require corresponding test review and, where needed, test updates in the same change.

- `yarn test:unit` runs Jest unit and integration tests.
- `yarn test` and `yarn test:e2e` run Playwright; do not confuse them with Jest.
- Start with tests that import, call, or navigate through the changed surface.
- Use scoped ESLint for changed files where possible: `npx eslint --max-warnings=0 <files>`.
- Full lint may require `NODE_OPTIONS="--max-old-space-size=8192"`.
- Run `yarn typecheck` when TypeScript contracts or shared code are affected.
- Run targeted Playwright specs for browser behavior. Review `e2e/README.md`, nearby specs, helpers, fixtures, and local architecture before adding E2E coverage.
- Run `VERCEL_ENV=preview yarn build` when changes affect browser behavior, routing, Next configuration, environment-gated builds, or release readiness.
- Run `yarn deadcode` when adding or removing components, hooks, libraries, or CLI entry points, and do not introduce new unused files or exports.
- Prefer stable user-facing selectors, explicit waits tied to real state, isolated test data, and assertions that fail when behavior breaks.
- Diagnose failures as product bugs, test bugs, timing issues, missing setup, or environment problems. Fix actionable failures and rerun the focused check.
- E2E specs must call `setupErrorDetection(page)` in `beforeEach` and `assertNoErrors(page, errorCapture)` in `afterEach`, assert real HTTP status codes (400/401/403/404/405), and treat a 500 as a bug. Use `throw new Error('Not implemented: <reason>')` rather than `test.skip()`, and annotate any `waitForTimeout` with an eslint-disable and a reason.
- Define the target pattern for SEO and metadata work before editing `lib/seo/meta.ts` or related files. No trial-and-error across commits.
- Do not add wall-clock micro-benchmarks that are expected to be stable on shared CI.
- CI configuration and current CI results are authoritative; do not rely on a dated documentation claim about whether a workflow is active or green.

## Git and release rules

- The normal flow is `feature/* -> main -> prod`; do not merge `prod` back into `main`.
- When asked to commit, stage only task-owned files and use a scoped Conventional Commit subject.
- Do not push when relevant local checks fail unless the user explicitly accepts the known failure.
- Pull requests should describe the user-visible change, verification commands and results, migration or environment impact, and screenshots for UI changes.
- Never leave a changelog-only commit at the head of a Vercel deployment branch.
- Follow `docs/GIT_WORKFLOW.md` for release, hotfix, and CI details rather than copying volatile workflow state here.

## Security and quality

- Never commit secrets or expose production credentials.
- Keep secrets out of client bundles.
- Validate untrusted input at system boundaries.
- Apply rate limiting and bot protection using established wrappers.
- Keep RLS and ownership checks in place for user data.
- Maintain accessibility and honor `prefers-reduced-motion`.
- Avoid new console errors, warnings, hydration issues, and silent failure states.
- Optimize for correctness and readability before speculative abstraction or micro-optimization.

## Visual and brand direction

The implementation source of truth is `app/styles/zine.css`, the established `components/zine/` primitives, and `docs/STYLE_GUIDE.md`.

- Personality: **Chill, Reliable, Smart**. Quiet confidence, factual copy, and no corporate hype.
- Visual tone: retro 80s-90s surf-zine culture.
- Content surfaces: cream paper with dark ink, presented on a Deep Twilight stage.
- Primary accent: Charming Orange, used sparingly.
- Typography: Space Grotesk for personality, DM Sans for body and data clarity, and Space Mono for technical values.
- Texture: restrained sticker rotations, asymmetric shapes, scan lines, and noise where they support the hierarchy.
- Do not repeat the same decorative sticker on the same card or page.
- Anti-references: generic corporate SaaS, cyan-on-dark AI styling, purple gradients, glassmorphism, over-polished Apple minimalism, teal-and-white Surfline imitation, generic wave illustrations, and hang-loose clip art.
- Accessibility and data clarity override decoration.

## Critical prohibitions

- Do not create a duplicate data-fetching, API, auth, design, or analytics primitive without first auditing existing implementations.
- Do not bypass `withAuthenticatedAction` for protected server actions.
- Do not bypass `withAuth` for authenticated API routes.
- Do not call server actions from native clients.
- Do not break a mobile-consumed API contract in place or return failures as HTTP 200.
- Do not introduce `beach.latitude`, new `lng` fields, `sessions.profile_id`, or new split forecast date/time queries.
- Do not fire pre-auth funnel events for authenticated users.
- Do not rely solely on parent state to hide anonymous CTAs from authenticated users.
- Do not recreate a protected view without preserving `security_invoker` behavior.
- Do not parallelize redirect-critical awaits when completion is required before navigation.
- Do not infer production state from changelog comments, old reports, or model memory; verify the live configuration or downstream behavior.
- Do not claim a feature, migration, flag, test, deployment, or delivery path works without evidence from the relevant code, data, command, or environment.

## Completion report

At the end of implementation work, report:

- files changed
- behavior changed
- checks run with exact pass or fail status
- relevant tests not run and why
- unresolved findings or validation gaps
- remaining release or production risk
