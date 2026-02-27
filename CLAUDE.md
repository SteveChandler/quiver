# CLAUDE.md - Quiver

## Agent-First Mandate

The main session is a **coordinator**, not an implementer. Use subagents for all work.

| Situation | Action |
|-----------|--------|
| Multi-step task | `@tech-lead-orchestrator` FIRST, then follow its routing map |
| Single-domain task | Use the specialist agent directly (see `docs/AGENT_ROSTER.md`) |
| Unsure which agent | Ask `@tech-lead-orchestrator` anyway |
| "This is simple, I'll just..." | STOP. Use an agent. Always. |

Workflow: `@tech-lead-orchestrator` -> specialist agents -> `@code-reviewer` for QA.
Full roster: `docs/AGENT_ROSTER.md`

---

## Mission & Stack

**Mission:** Growth-first. Prioritize social sharing, session photos, referrals/challenges/leaderboards, viral loops, and community features over monetization.

**Stack:**
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS, Radix UI, Framer Motion, Mapbox GL
- **Backend:** Supabase (PostgreSQL 15+ with PostGIS, RLS, Edge Functions, Realtime, Storage), Next.js API Routes
- **Mobile:** Capacitor 8 (iOS/Android), Firebase Cloud Messaging
- **Testing:** Playwright (E2E), Jest (unit/integration), Testing Library
- **Infra:** Vercel, Sentry, Firebase | **Build:** Yarn, `next.config.mjs`

**MCP Servers** (`.mcp.json`): Playwright (UI validation), Supabase (DB inspection), Sentry (error tracking)

---

## Core Patterns

### Data Fetching

Use `useDataFetcher` with a memoized fetch function: `const { data, loading, error, refetch } = useDataFetcher(fetchFn)`. Some hooks use SWR or TanStack Query — check existing patterns before adding new fetching.

### Server Actions

Use `withAuthenticatedAction` from `lib/server-action-utils.ts` for all protected server actions:

```ts
export async function doProtectedThing(arg: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data, error } = await supabase.from("some_table").select("*").eq("owner_id", user.id);
    if (error) throw new Error(error.message);
    return data;
  });
}
```

Also available: `makeAuthenticatedAction`, `withValidation` (Zod), `createServerAction` (combined auth + validation).

### API Routes

Use `withAuth` from `lib/middleware/api-wrappers/` for authenticated API routes (40+ routes use this). Legacy routes using `lib/api-utils.ts` directly should migrate to `withAuth` when edited.

```ts
import { withAuth, createSuccessResponse } from "@/lib/middleware/api-wrappers";
export const GET = withAuth(async (request, { user, supabase }) => {
  return createSuccessResponse(await fetchBusinessLogic(user.id, supabase));
}, { errorMessage: "Failed to load data" });
```

Also available: `withErrorHandler`, `withRateLimit`, `withBotBlockingAndRateLimit`, `withFullProtection`, `validateUuidParam`, `requireOwnership`.

### Realtime Subscriptions

Always clean up channels — subscribe in `useEffect`, return `() => supabase.removeChannel(channel)` in cleanup.

### Coordinate Naming

**Never use `lng` in new code** — use `lon` or `longitude`. DB legacy fields are `center_lat`/`center_lng` (don't rename without migration). Component props use `latitude`/`longitude`. **Critical pitfall:** `beach.latitude` doesn't exist — use `beach.center_lat`/`beach.center_lng`.
Full guide: `docs/COORDINATE_CONVENTIONS.md`

### Forecast Timestamps

Use `forecast_at` (timestamptz), not deprecated `forecast_date` + `forecast_time`. Adapter: `lib/utils/forecast-at-adapter.ts`. Query: `.gte("forecast_at", startISO).lt("forecast_at", endISO).order("forecast_at")`

---

## Git Workflow

**One-way flow:** `feature/* → main → prod`. Never merge prod back into main.
See `docs/GIT_WORKFLOW.md` for the full branching strategy, hotfix process, and CI gate details.

---

## Architecture Documentation

**49 `ARCHITECTURE.md` files exist.** Always read the relevant one before editing a directory. Start at `docs/ARCHITECTURE.md`. Follow existing patterns. No duplicate implementations. DRY.

---

## Routing Patterns

- **Beach pages:** `app/[intent]/[city]/[beachSlug]/page.tsx` - accepts 2-letter state slugs for all states
- **Coverage areas:** CA, OR, WA, HI, Baja are in-coverage - never show "out of area" messaging for these
- Full details: `docs/ROUTING_PATTERNS.md`

---

## Database & Migration Safety

Migrations go in `supabase/migrations/` named `YYYYMMDDHHMMSS_descriptive_name.sql`. Wrap in `BEGIN;`...`COMMIT;`.

**PROHIBITED:** bulk `DELETE`/`TRUNCATE` on user tables, `DROP TABLE` for core tables, deleting by user-provided strings.
**REQUIRED:** `WHERE NOT EXISTS` for inserts, rollback migrations for destructive changes, carry forward `WITH (security_invoker = true)` when recreating views.
**Production:** `claude_migrator` role only. Read-only by default. Mutations require PLAN → APPROVAL two-step protocol.
Full rules: `docs/MIGRATION_SAFETY.md`

---

## Testing Rules

### Same-Commit Rule

When changing behavior, update affected tests in the **same commit**. Feature + broken tests = incomplete work. A feature commit that breaks existing tests is a process failure — the fix belongs in the original commit, not a follow-up.

### Blast Radius Check

Before committing, identify test files that import or reference changed modules. Search `e2e/` and `__tests__/` for imports from modified files. Run those tests. If you changed it, you own verifying it.

### Running Tests

- Run tests after every change. If tests don't run, the update is not complete.
- Always run a **subset** of Playwright tests (not the full suite): `npx playwright test path/to/spec.spec.ts`
- Prefer **Playwright MCP** for quick UI validation before shelling out to CLI
- Test across mobile AND desktop breakpoints

### E2E Required Patterns

- `setupErrorDetection(page)` in `beforeEach`, `assertNoErrors(page, errorCapture)` in `afterEach`
- Proper HTTP status codes (400/401/403/404/405) — 500 is always a bug
- `throw new Error('Not implemented: <reason>')` instead of `test.skip()`
- `isVisibleSafe()` for environment-dependent checks, `waitForLoadState("load")` for waits
- Annotate `waitForTimeout` with `// eslint-disable-next-line playwright/no-wait-for-timeout -- <reason>`

### SEO/Meta Changes

Before touching `lib/seo/meta.ts` or related SEO files, define the target pattern in the PR description or a brief spec. No iterative trial-and-error across multiple commits.

---

## Quality Standards

### Performance
- Lighthouse >90 all categories. LCP <2.5s, FID <100ms, CLS <0.1. API P95 <500ms, DB queries <100ms.

### Security
- RLS on all user-data tables. Input validation at system boundaries. Rate limiting (`withRateLimit` / `withFullProtection`). No secrets in client code.

### Code Style
- TypeScript-first, explicit signatures, meaningful names. Early returns, no empty catches. Minimal comments (explain **why**). Preserve existing formatting. Don't reformat unrelated code.

### Pre-Merge Checklist
- [ ] `code-reviewer` agent review
- [ ] All tests passing (unit + E2E)
- [ ] CHANGELOG.md updated under `[Unreleased]`
- [ ] No console errors or warnings

---

## Critical Don'ts

- Don't invent data fetching patterns (use `useDataFetcher`)
- Don't skip `withAuthenticatedAction` for protected server actions
- Don't skip `withAuth` wrapper for authenticated API routes
- Don't add monetization or non-growth features without direction
- Don't assume `beach.latitude` exists (it's `beach.center_lat`)
- Don't use `lng` in new code (use `lon`)
- Don't use `forecast_date` + `forecast_time` in new queries (use `forecast_at`)
- Don't reference `sessions.profile_id` (dropped Feb 2026 -- use `user_id`)
- Don't `DROP VIEW` + `CREATE VIEW` without carrying forward `WITH (security_invoker = true)`

---

## Post-Implementation

1. Update `CHANGELOG.md` under `[Unreleased]` with a brief bullet (Added/Changed/Fixed/Performance/Removed)
2. Run affected tests — blast radius check (search for imports from changed modules)
3. Validate with Playwright MCP for UI changes (screenshot or smoke test)
4. All tests green before committing
