# Repository Guidelines — Quiver Web

## Project Structure & Module Organization

Quiver web app: Next.js 16, React 19, TypeScript, Tailwind, Radix UI, Supabase, Playwright. App Router code in `app/`; shared UI in `components/`; server actions in `actions/`; business logic in `lib/`; hooks in `hooks/`; types in `types/`; assets in `public/`; migrations in `supabase/migrations/`; Jest tests in `__tests__/`; Playwright specs in `e2e/`.

**58 `ARCHITECTURE.md` files exist throughout the codebase.** Read the nearest relevant one before editing a directory; use `docs/ARCHITECTURE.md` as the top-level index.

## Build, Test, and Development Commands

Yarn 1 with Node 22. `yarn dev` runs on `localhost:3000`. `yarn build` for production; `yarn build:clean` clears `.next` first. `yarn typecheck` runs `tsc --noEmit`. `yarn lint` runs ESLint — for focused work prefer `npx eslint --max-warnings=0 <files>` (full lint OOMs without `NODE_OPTIONS="--max-old-space-size=8192"`). `yarn test:unit` runs Jest, `yarn test` and `yarn test:e2e` run Playwright. Use `npx playwright test path/to/spec.ts` for targeted E2E.

## Optional Tools and Context

`.mcp.json` exposes optional Figma, Supabase, Vercel, and Playwright integrations. Local skills may provide useful workflows for SEO, CRO, copy, design, audit, hardening, or performance work. Use them when relevant and available; no integration, skill, plugin, or named agent is required to complete ordinary work. The canonical project skill root is `.agents/skills`; `.claude/skills` and `.agent/skills` are compatibility symlinks and must not contain divergent copies. Use `.claude/product-marketing-context.md` for positioning, SEO, and copy. Treat dated memory as context and verify it against current code or data.

## Model and Usage Efficiency

- Default to the least expensive model that can complete the work reliably; honor explicit user model choices.
- Use lower-cost models for search, mechanical edits, documentation, summaries, and routine test triage.
- Reserve stronger reasoning models for high-risk architecture, security, migrations, production incidents, difficult cross-cutting debugging, and high-risk final review.
- Escalate only when risk demands it or a focused cheaper attempt leaves material uncertainty, then downgrade after the difficult reasoning is complete.
- Avoid overlapping agents and repeated context. Delegate only bounded, independent work, and prefer deterministic local tools and checks over extra model calls.

## Default Workflow

Keep the process proportional to the task: inspect → implement → validate → review.

- Inspect the affected code, nearest relevant architecture documentation, and nearby tests before editing. Use a written plan when complexity or risk warrants one.
- Follow existing Quiver patterns and keep changes within the user's requested scope.
- Run the smallest meaningful checks first, then broaden based on the touched surface and release risk.
- Review the final diff for regressions, weak tests, user-data risk, and unrelated churn. Fix issues introduced by the change and rerun affected checks.
- Never claim tests passed unless you actually ran the command and it passed.

## Coding Style & Naming Conventions

TypeScript, 2-space indentation, PascalCase components, camelCase variables/functions, kebab-case route segments.

- **Server actions**: use `withAuthenticatedAction` from `lib/server-action-utils.ts` for protected actions. Also available: `makeAuthenticatedAction`, `withValidation` (Zod), `createServerAction`.
- **API routes**: use `withAuth` from `lib/middleware/api-wrappers/` (40+ routes). Legacy routes using `lib/api-utils.ts` should migrate when edited. Also: `withErrorHandler`, `withRateLimit`, `withBotBlockingAndRateLimit`, `withFullProtection`, `validateUuidParam`, `requireOwnership`.
- **Data fetching**: prefer `useDataFetcher` with a memoized fetch fn. Some hooks use SWR or TanStack Query — check existing patterns before adding new ones.
- **Realtime**: subscribe in `useEffect`, return `() => supabase.removeChannel(channel)` cleanup.
- **Coordinates**: prefer `lat`/`lon` for beach rows and `lon`/`longitude` in new API/component shapes. `beach.latitude` does NOT exist — use `beach.lat`/`beach.lon`.
- **Timestamps**: use `forecast_at` (timestamptz). Adapter at `lib/utils/forecast-at-adapter.ts`. Query: `.gte("forecast_at", startISO).lt("forecast_at", endISO).order("forecast_at")`.
- **User reference**: use `user_id`. Never `profile_id` — dropped Feb 2026. `sessions.profile_id` does not exist.

## Auth & Event Tracking

### Pre-auth event guards
Pre-auth funnel events (`signup_cta_view`, `signup_cta_click`, `signup_form_submitted`, `auth_modal_opened`, `auth_modal_closed_without_action`) must **never fire for authenticated users**. Guard client-side with `if (!user)` and server-side in `/api/events/route.ts` with the `PRE_AUTH_ONLY_EVENTS` blocklist. Events during auth transition (`signup_started`, `signup_success`, `login_success`) are allowed for both.

### `user_events` allowlists (4 layers)
The system has VALID + ANONYMOUS_ALLOWED + PRE_AUTH_ONLY + DB CHECK constraint + TS `ImplicitEventType` union. Audit emitted analytics events against the server allowlist (`grep trackEvent` + diff against `VALID_EVENTS`) — past sessions had 7 paywall events silently dropping for weeks.

### CTA defense-in-depth
Every CTA component shown to anonymous users must **independently check auth state** via `useAuth()` and hide/transform for logged-in users. Never rely solely on a parent's `publicMode` prop — auth state propagates at different speeds. Components: `PublicContentGate`, `InlineSignupCta`, `MatchScoreTeaser`, `PersonalizedForecastTeaser`, `StickySignupBar`.

### OAuth testing
OAuth signup changes (Apple, Google) require validation on **real iOS Safari** before release — cookie handling during cross-origin redirects differs from Chrome. If that environment is unavailable, complete the available checks and report the validation gap. `context/auth-context.tsx` uses `onAuthStateChange`, which may not fire if session cookies are not immediately visible after redirect. Apple Sign-In creates orphan Supabase users (≥11 affected as of 2026-05-03) — privaterelay or shared-email Apple signins create duplicates instead of linking. Permanent fix needed before iOS marketing push.

### Native ↔ web boundary
**Native cannot call `"use server"` actions.** Server actions re-auth via cookies and silently drop native Bearer writes. Inline DB queries in the API route instead.

**Mobile-consumed API routes are versioned contracts** (ratchet policy 2026-07-31, counterpart: `../quiver-native/AGENTS.md` §Architecture Ratchet). Installed native binaries live for months, so old JS keeps calling old shapes:

- Shape changes must be **additive** — never rename, remove, or repurpose a response/request field in place. Add a field, or add a new route.
- Failures must return real HTTP error statuses. Never wrap an error state in a 200 payload — native retry/error UI keys off status codes (the `/api/surf/call` `hold_state_unavailable` incident shipped errors as 200s).
- Before changing any `/api/*` route, grep `../quiver-native/src` for the path to know whether native consumes it; if it does, verify both consumers.
- Remember the blanket 60s `/api/*` cache in `next.config.mjs` — mutation routes native depends on need explicit no-store behavior.

## Routing & Coverage

- Beach pages: `app/[intent]/[city]/[beachSlug]/page.tsx` — accepts 2-letter state slugs.
- Coverage: full US coasts (ME, NH, MA, RI, NY, NJ, NC, SC, GA, FL, CA, OR, WA, TX), HI, PR, Baja. Never show "out of area" messaging for these. Source of truth: `lib/constants/coverage-areas.ts`.
- Full details: `docs/ROUTING_PATTERNS.md`.

## Testing Guidelines

`yarn test` runs Playwright (E2E); `yarn test:unit` runs Jest. Don't confuse them. Update tests in the same commit as behavior changes. Search `__tests__/` and `e2e/` for imports/routes touched by your change, then run the smallest relevant subset.

**CI is live.** Verified 2026-08-13 via `gh run list`, superseding the "Actions disabled as of 2026-05-06" note that stood here. `.github/workflows/main-gate.yml` runs `yarn typecheck` and `yarn lint` on every PR into `main`; `prod-gate.yml` gates `prod`. Both were green through 2026-08-11.

`yarn lint` runs with `--max-warnings=0`, so **a new lint rule must land in the same commit as the fixes for its existing violations** — the rule on its own turns Main Gate red.

Still run the local gate before pushing and report exact commands/results; CI should confirm your result, not discover it. Do not push if local checks fail. Do not disable, re-enable, or rerun GitHub Actions unless the user explicitly asks. Check CI state with `gh run list` rather than trusting any doc, this one included.

Local push gate: `source ~/.nvm/nvm.sh && nvm use 22`, then `yarn typecheck` and `yarn test:unit --bail=0`. Add scoped ESLint for touched files, targeted Playwright, and `VERCEL_ENV=preview yarn build` when the change affects browser behavior, routing, Next config, env-gated build behavior, or release readiness.

Dead-code ratchet: when adding or removing components/hooks/lib modules, also run `yarn deadcode` (knip; needs the unit-test env vars). It is a ratchet, not a hard gate: do not introduce NEW unused files or exports beyond the recorded baseline (6 unused files as of 2026-08-07 — all deliberate holds: the map prototype trio kept for quiver#489, check-in-form, and the personalization-milestones hook + its messaging dependency; see `dev/handoffs/cleanup-20260807/`). Scripts are declared as knip entries; if you add a new CLI script it is covered automatically.

The prod-gate workflow mirrors TypeScript, lint, Jest, build, and Playwright smoke coverage: `yarn tsc --noEmit`, `yarn lint`, `yarn test:unit --bail=5`, `yarn build`, and `npx playwright test --grep @smoke --project=guest`. It does run — reproduce the relevant parts locally anyway so you find failures before the gate does, not because the gate is unavailable.

### E2E required patterns
- `setupErrorDetection(page)` in `beforeEach`, `assertNoErrors(page, errorCapture)` in `afterEach`
- Proper HTTP status codes (400/401/403/404/405). 500 is always a bug.
- `throw new Error('Not implemented: <reason>')` instead of `test.skip()`
- `isVisibleSafe()` for environment-dependent checks; `waitForLoadState("load")` for waits
- Annotate `waitForTimeout` with `// eslint-disable-next-line playwright/no-wait-for-timeout -- <reason>`
- `BASE_URL=http://localhost:3000` for local; anon tests must be `guest-*.spec.ts`
- Don't run parallel `yarn test:e2e:dev` — global-setup writes `state.json` and they corrupt each other. Run ONE command with multiple specs.
- Before adding E2E tests, inspect the nearby specs and the relevant portions of `e2e/README.md`, `e2e/ARCHITECTURE.md`, helpers, fixtures, and `e2e/TEST_DEBT.md`.
- Prefer stable user-facing selectors and accessibility labels. Avoid arbitrary sleeps; use explicit waits tied to UI, app, network, or auth state.
- Verify each assertion would fail if the feature broke. Avoid false positives, weak assertions, brittle selectors, overbroad mocks, and tests that only prove a page rendered.
- Isolate test data, mark generated data clearly, and clean it up. Prevent leakage through auth state, shared accounts, or persistent rows.
- Diagnose failures as product bug, test bug, flaky timing issue, missing setup, or environment issue. Fix actionable failures and rerun targeted E2E; report anything still unresolved.
- Use `npx playwright test --list <files...>` for a cheap syntax/registration check before expensive runs on large touched E2E sets.
- If localhost Playwright conflicts with another Next dev server, use `BASE_URL=https://dev.quiversurf.app` so `playwright.config.ts` skips the local `webServer`.

### Final response requirements
- Report the files changed, checks run with pass/fail status, unresolved findings, and remaining risks. For E2E work, state the specs reviewed or changed and the final E2E status.
- If relevant tests were not run, say so clearly.

### Pre-flight before release PRs
Run `yarn test:unit --bail=0` on main before opening release PRs. The prod gate runs jest only on release PRs to prod, so regressions accumulate silently on main between releases. Local `.env` and CI also diverge on warn-as-error tests — reproduce CI's env when they disagree.

### No wall-clock perf budgets
"100 calls in 50ms"-style tests flake on shared CI. Delete on sight; don't loosen thresholds.

## Operational Context (verify before relying)

- **Vercel project**: `v0-prd-design-concept` (legacy v0.dev name). Aliases `dev.quiversurf.app` (Preview) and `www.quiversurf.app` (Production).
- **Vercel crons run on Production only**, not Preview. Push to main = dev UI; cron data stays on old prod until release.
- **Vercel Ignored Build Step checks `HEAD^..HEAD` only** — fixture/scripts/CHANGELOG-only final commit cancels the deploy. CHANGELOG must NOT be the last commit on a branch.
- **Prod gate runs only on release PRs to prod** — main pushes don't trigger lint/typecheck/jest.
- **SEO metadata edits frozen until 2026-05-14** — don't touch `lib/constants/seo.ts` or `app/layout.tsx`.
- `.env` has localhost stubs, not prod. Prod creds live in `.env.local` / `.env.playwright` / `.env.production.local`.
- Internal accounts flagged `is_mock=true` (since 2026-04-24). 6 Steven test dupes + Quiver Surf Forecast bot are excluded from real-user signal.
- Steven owns 2 auth users: `610a5745` (stcha0004 / `is_mock=true` "Johnny Utah") and `73040cff` (omg.its.thefuture / `is_mock=false` real).

## Schema & Database Gotchas

- The basic `forecasts` table does NOT exist in production (confirmed 42P01 2026-04-25). Any code with a `.from("forecasts")` fallback is dead.
- `enhanced_forecasts.wave_direction` is a STRING ("WSW") + numeric `_om` siblings (`wave_direction_om`, `swell_direction_om`, `*_period_om`). 14d retention.
- `ml_predictions_log` error columns (`raw_error_m`, `corrected_error_m`) are ABSOLUTE values, not signed. Recompute bias from `forecast_m - observed_m`.
- DB function subqueries inserting into NOT NULL need `COALESCE` — empty `array_agg` / `jsonb_object_agg` returns NULL.
- `app.allow_destructive=on` to bypass profiles protection trigger: `BEGIN; SET LOCAL app.allow_destructive=on; ...; COMMIT;`.
- `supabase-js` `upsert(ignoreDuplicates) + .single()` retries forever. Use `maybeSingle()` or drop `.single()`.

## Migration Safety

Place in `supabase/migrations/` named `YYYYMMDDHHMMSS_descriptive_name.sql`. Wrap in `BEGIN;`...`COMMIT;`.

**PROHIBITED:** bulk `DELETE`/`TRUNCATE` on user tables, `DROP TABLE` for core tables, deleting by user-provided strings.
**REQUIRED:** `WHERE NOT EXISTS` for inserts, rollback migrations for destructive changes, carry forward `WITH (security_invoker = true)` when recreating views.
**Production:** use the production owner connection required by Supabase CLI migration tracking; do not use `claude_migrator`. Read-only by default. Mutations require PLAN → APPROVAL two-step protocol.
Full rules: `docs/MIGRATION_SAFETY.md`.

MCP `apply_migration` query is whitespace-sensitive — multi-line SQL fails with `syntax error at or near "</"`; collapse to single-line statements, drop comments.

## Build / Framework Notes

- Next 16.2.6 builds with Turbopack by default; the `--turbopack` flag is a no-op. `@ducanh2912/next-pwa` may silently no-op under Turbopack (sw.js not regenerated).
- Next 16 webpack config requires `turbopack: {}` sibling. Gating Sentry off on Preview breaks build — always test `VERCEL_ENV=preview yarn build`.
- `next.config.mjs` blanket-caches `/api/*` for 60s. NSURLCache (native) honors it. Set `cache: no-store` per-route for mutations.
- Don't propose pnpm/Yarn Berry. Yarn 1.22.17 stays.
- Don't propose `ignoreBuildErrors` + parallel-CI tsc. Keep TypeScript on the Vercel build path as a hard gate.

## Commit & Pull Request Guidelines

Scoped Conventional Commit subjects: `feat(map): add geolocate fallback`, `fix(forecast): handle missing corrected data`. PRs describe the user-visible change, list verification commands, mention migration/env impacts, include screenshots for UI changes. **Never commit without being asked.**

## Security & Configuration

Never commit secrets. Don't hand-edit `types/database.generated.ts`. RLS on all user-data tables. Input validation at system boundaries. Rate limiting via `withRateLimit` / `withFullProtection`. No secrets in client code.

## Quality Standards

- **Performance**: Lighthouse >90 all categories. LCP <2.5s, FID <100ms, CLS <0.1. API P95 <500ms, DB <100ms.
- **Pre-merge**: final diff reviewed, relevant checks passing, user-visible changes documented when appropriate, and no new console errors or warnings.

## Critical Don'ts

- Don't invent data fetching patterns (use `useDataFetcher`)
- Don't skip `withAuthenticatedAction` for protected server actions
- Don't skip `withAuth` wrapper for authenticated API routes
- Don't add monetization or non-growth features without direction
- Don't assume `beach.latitude` exists (it's `beach.lat`)
- Don't use `lng` in new code (use `lon`)
- Don't use `forecast_date` + `forecast_time` in new queries (use `forecast_at`)
- Don't reference `sessions.profile_id` (dropped Feb 2026 — use `user_id`)
- Don't `DROP VIEW` + `CREATE VIEW` without carrying forward `WITH (security_invoker = true)`
- Don't fire pre-auth funnel events for authenticated users
- Don't rely on parent `publicMode` prop alone for hiding CTAs — always self-guard with `useAuth()`
- Don't parallelize redirect-critical awaits (`Promise.all` is fire-and-forget only)

## Calibration & Failure Modes

- **Verify release claims in the current workspace** with the required local gates, `git status`, and the final diff.
- **If delegated work is used**, verify its result with relevant tests and the actual worktree diff.
- **Verify env values, not CHANGELOG comments** — verify via downstream traffic before claiming a kill switch is on/off.
- **Audit full delivery chain before schema change** — `alert_queue` isn't the leaf; chain is queue → `delivery_attempts` FK → `notification_events` → registry channels.
- **Audit existing primitives before proposing new utils/components** — grep ALL producers + check for an existing display primitive (e.g. `WaveHeightDisplay`) first.
- **100% NULL FK columns reveal lift bugs**, not "users not sending" — e.g., `beach_view.beach_id` NULL on 22/22 = `insertEvent` didn't lift it from metadata.
- **Visual evidence over strong user language** — "legacy/kill it" often = hydration flash; check signed-in + throttle in screenshots first.
- **Distinguish bootstrap from real empty state** — empty branch must gate on composed `isBootstrapped`; null data ≠ empty.
- **User questions are not consent for production-impact actions.** "Can we skip X" is an inquiry, not approval.
