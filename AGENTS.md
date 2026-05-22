# Repository Guidelines — Quiver Web

## Project Structure & Module Organization

Quiver web app: Next.js 16, React 19, TypeScript, Tailwind, Radix UI, Supabase, Playwright. App Router code in `app/`; shared UI in `components/`; server actions in `actions/`; business logic in `lib/`; hooks in `hooks/`; types in `types/`; assets in `public/`; migrations in `supabase/migrations/`; Jest tests in `__tests__/`; Playwright specs in `e2e/`.

**49 `ARCHITECTURE.md` files exist throughout the codebase.** Always read the nearest one before editing a directory. Start at `docs/ARCHITECTURE.md`.

## Build, Test, and Development Commands

Yarn 1 with Node 22. `yarn dev` runs on `localhost:3000`. `yarn build` for production; `yarn build:clean` clears `.next` first. `yarn typecheck` runs `tsc --noEmit`. `yarn lint` runs ESLint — for focused work prefer `npx eslint --max-warnings=0 <files>` (full lint OOMs without `NODE_OPTIONS="--max-old-space-size=8192"`). `yarn test:unit` runs Jest, `yarn test` and `yarn test:e2e` run Playwright. Use `npx playwright test path/to/spec.ts` for targeted E2E.

## MCP, Skills, Workflows & Memory

`.mcp.json` exposes Figma, Supabase, Vercel, and Playwright. `.agent/mcp_recommendations.md` adds optional PostgreSQL, GitHub, and Sentry MCPs. Before SEO, CRO, copy, design, audit, hardening, or performance work, read the relevant `SKILL.md` in `.claude/skills/` or `.agent/skills/`. Use `.claude/product-marketing-context.md` for positioning/SEO/copy and `.claude/projects/*/memory/*.md` for retained strategy notes. Treat dated memory as context; verify against current code/data.

## Default Codex Workflow

For every non-trivial code task, use inspect → plan → review → execute → test → review → iterate.

- Inspect first: read this file, `CLAUDE.md`, the nearest `ARCHITECTURE.md`, relevant README/docs, `package.json`, test config, and affected code before editing.
- In inspect/plan, decide which local instructions, skills, and plugins apply. Use local repo files, scripts, package commands, `.mcp.json` tools, and existing helpers before external plugins, web search, or new tooling.
- Create a concise execution plan, review it for gaps, risky assumptions, missing tests, and unnecessary scope, then revise before implementation when needed.
- Execute minimal, high-confidence changes that follow existing Quiver patterns. Do not add unrelated features, refactors, or abstractions.
- Run the smallest relevant tests first, then broaden to local push gates or build/E2E checks based on touched surface and risk.
- Review the diff like a PR before finalizing. Fix every actionable finding, rerun relevant tests, and repeat review → fix → test until clean. Stop after 5 full cycles if findings remain and report them clearly.
- Never claim tests passed unless you actually ran the command and it passed.

## Coding Style & Naming Conventions

TypeScript, 2-space indentation, PascalCase components, camelCase variables/functions, kebab-case route segments.

- **Server actions**: use `withAuthenticatedAction` from `lib/server-action-utils.ts` for protected actions. Also available: `makeAuthenticatedAction`, `withValidation` (Zod), `createServerAction`.
- **API routes**: use `withAuth` from `lib/middleware/api-wrappers/` (40+ routes). Legacy routes using `lib/api-utils.ts` should migrate when edited. Also: `withErrorHandler`, `withRateLimit`, `withBotBlockingAndRateLimit`, `withFullProtection`, `validateUuidParam`, `requireOwnership`.
- **Data fetching**: prefer `useDataFetcher` with a memoized fetch fn. Some hooks use SWR or TanStack Query — check existing patterns before adding new ones.
- **Realtime**: subscribe in `useEffect`, return `() => supabase.removeChannel(channel)` cleanup.
- **Coordinates**: prefer `lon`/`longitude` in new code. DB legacy fields are `center_lat`/`center_lng`. `beach.latitude` does NOT exist — use `beach.center_lat`/`beach.center_lng`. Component props use `latitude`/`longitude`.
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
Test OAuth signup flows (Apple, Google) on **real iOS Safari** — cookie handling during cross-origin OAuth redirects differs from Chrome. `context/auth-context.tsx` uses `onAuthStateChange` which may not fire if session cookies aren't immediately visible after redirect. Apple Sign-In creates orphan Supabase users (≥11 affected as of 2026-05-03) — privaterelay or shared-email Apple signins create duplicates instead of linking. Permanent fix needed before iOS marketing push.

### Native ↔ web auth boundary
**Native cannot call `"use server"` actions.** Server actions re-auth via cookies and silently drop native Bearer writes. Inline DB queries in the API route instead.

## Routing & Coverage

- Beach pages: `app/[intent]/[city]/[beachSlug]/page.tsx` — accepts 2-letter state slugs.
- Coverage: full US coasts (ME, NH, MA, RI, NY, NJ, NC, SC, GA, FL, CA, OR, WA, TX), HI, PR, Baja. Never show "out of area" messaging for these. Source of truth: `lib/constants/coverage-areas.ts`.
- Full details: `docs/ROUTING_PATTERNS.md`.

## Testing Guidelines

`yarn test` runs Playwright (E2E); `yarn test:unit` runs Jest. Don't confuse them. Update tests in the same commit as behavior changes. Search `__tests__/` and `e2e/` for imports/routes touched by your change, then run the smallest relevant subset.

GitHub Actions minutes are exhausted and repo Actions are disabled as of 2026-05-06. Treat remote CI as unavailable. Before pushing to `main`, run the local gate and report exact commands/results. Do not push if local checks fail, and do not re-enable or rerun GitHub Actions unless the user explicitly asks.

Local push gate: `source ~/.nvm/nvm.sh && nvm use 22`, then `yarn typecheck` and `yarn test:unit --bail=0`. Add scoped ESLint for touched files, targeted Playwright, and `VERCEL_ENV=preview yarn build` when the change affects browser behavior, routing, Next config, env-gated build behavior, or release readiness.

The configured prod-gate workflow mirrors TypeScript, lint, Jest, build, and Playwright smoke coverage: `yarn tsc --noEmit`, `yarn lint`, `yarn test:unit --bail=5`, `yarn build`, and `npx playwright test --grep @smoke --project=guest`. Because remote CI is not reliable here, reproduce the relevant parts locally before claiming release readiness.

### E2E required patterns
- `setupErrorDetection(page)` in `beforeEach`, `assertNoErrors(page, errorCapture)` in `afterEach`
- Proper HTTP status codes (400/401/403/404/405). 500 is always a bug.
- `throw new Error('Not implemented: <reason>')` instead of `test.skip()`
- `isVisibleSafe()` for environment-dependent checks; `waitForLoadState("load")` for waits
- Annotate `waitForTimeout` with `// eslint-disable-next-line playwright/no-wait-for-timeout -- <reason>`
- `BASE_URL=http://localhost:3000` for local; anon tests must be `guest-*.spec.ts`
- Don't run parallel `yarn test:e2e:dev` — global-setup writes `state.json` and they corrupt each other. Run ONE command with multiple specs.
- Before adding E2E tests, inspect existing nearby specs, `e2e/README.md`, `e2e/ARCHITECTURE.md`, helpers, fixtures, and `e2e/TEST_DEBT.md`.
- Prefer stable user-facing selectors and accessibility labels. Avoid arbitrary sleeps; use explicit waits tied to UI, app, network, or auth state.
- Verify each assertion would fail if the feature broke. Avoid false positives, weak assertions, brittle selectors, overbroad mocks, and tests that only prove a page rendered.
- Isolate test data, mark generated data clearly, and clean it up. Prevent leakage through auth state, shared accounts, or persistent rows.
- Diagnose failures as product bug, test bug, flaky timing issue, missing setup, or environment issue. Fix actionable failures and rerun targeted E2E until passing or until the 5-cycle limit is reached.
- Use `npx playwright test --list <files...>` for a cheap syntax/registration check before expensive runs on large touched E2E sets.
- If localhost Playwright conflicts with another Next dev server, use `BASE_URL=https://dev.quiversurf.app` so `playwright.config.ts` skips the local `webServer`.

### Final response requirements
- Include files changed, E2E tests reviewed, tests added or modified, production files changed, exact commands run, pass/fail status for each command, final E2E pass/fail status, unresolved findings, and remaining risks.
- State clearly when tests were not run. Never claim tests passed unless they actually ran successfully.

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
**Production:** `claude_migrator` role only. Read-only by default. Mutations require PLAN → APPROVAL two-step protocol.
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
- **Pre-merge**: code review, all tests passing (unit + E2E), CHANGELOG updated under `[Unreleased]`, no console errors/warnings.

## Critical Don'ts

- Don't invent data fetching patterns (use `useDataFetcher`)
- Don't skip `withAuthenticatedAction` for protected server actions
- Don't skip `withAuth` wrapper for authenticated API routes
- Don't add monetization or non-growth features without direction
- Don't assume `beach.latitude` exists (it's `beach.center_lat`)
- Don't use `lng` in new code (use `lon`)
- Don't use `forecast_date` + `forecast_time` in new queries (use `forecast_at`)
- Don't reference `sessions.profile_id` (dropped Feb 2026 — use `user_id`)
- Don't `DROP VIEW` + `CREATE VIEW` without carrying forward `WITH (security_invoker = true)`
- Don't fire pre-auth funnel events for authenticated users
- Don't rely on parent `publicMode` prop alone for hiding CTAs — always self-guard with `useAuth()`
- Don't parallelize redirect-critical awaits (`Promise.all` is fire-and-forget only)

## Calibration & Failure Modes

- **Run `yarn typecheck` yourself** — never trust agent claims.
- **Verify subagent "DONE"** with tests + `git status` + `git diff --cached`.
- **Verify env values, not CHANGELOG comments** — verify via downstream traffic before claiming a kill switch is on/off.
- **Audit full delivery chain before schema change** — `alert_queue` isn't the leaf; chain is queue → `delivery_attempts` FK → `notification_events` → registry channels.
- **Audit existing primitives before proposing new utils/components** — grep ALL producers + check for an existing display primitive (e.g. `WaveHeightDisplay`) first.
- **100% NULL FK columns reveal lift bugs**, not "users not sending" — e.g., `beach_view.beach_id` NULL on 22/22 = `insertEvent` didn't lift it from metadata.
- **Visual evidence over strong user language** — "legacy/kill it" often = hydration flash; check signed-in + throttle in screenshots first.
- **Distinguish bootstrap from real empty state** — empty branch must gate on composed `isBootstrapped`; null data ≠ empty.
- **User questions are not consent for production-impact actions.** "Can we skip X" is an inquiry, not approval.
