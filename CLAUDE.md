# CLAUDE.md - Quiver

## Agent-First Mandate

The main session is a **coordinator**, not an implementer. Use subagents for all work.

| Situation | Action |
|-----------|--------|
| Multi-step task | `@tech-lead-orchestrator` FIRST, then follow its routing map |
| Single-domain task | Use the specialist agent directly (see roster below) |
| Unsure which agent | Ask `@tech-lead-orchestrator` anyway |
| "This is simple, I'll just..." | STOP. Use an agent. Always. |

Workflow: `@tech-lead-orchestrator` -> specialist agents -> `@code-reviewer` for QA.

---

## Mission & Stack

**Mission:** Growth-first. Prioritize social sharing, session photos, referrals/challenges/leaderboards, viral loops, and community features over monetization.

**Stack:**
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS, Radix UI, Framer Motion, Mapbox GL
- **Backend:** Supabase (PostgreSQL 15+ with PostGIS, RLS, Edge Functions, Realtime, Storage), Next.js API Routes
- **Mobile:** Capacitor 8 (iOS/Android), Firebase Cloud Messaging
- **Testing:** Playwright (E2E), Jest (unit/integration), Testing Library
- **Infra:** Vercel, Sentry, Firebase | **Build:** Yarn, `next.config.mjs`

**MCP Servers** (configured in `.mcp.json`):
- **Playwright** - E2E testing and browser automation (preferred tool for UI validation)
- **Supabase** - Database inspection
- **Sentry** - Error tracking and performance monitoring

---

## Agent Roster

| Task | Agent |
|------|-------|
| Orchestration & Planning | `tech-lead-orchestrator` |
| Next.js / App Router / SSR / SEO | `nextjs-developer` |
| React Components / Hooks | `react-nextjs-expert` |
| Supabase / Schema / RLS / Migrations | `supabase-db-expert` |
| API Design | `api-designer` |
| Tailwind Styling | `tailwind-frontend-expert` |
| Performance | `performance-optimizer` |
| Code Review (finish every task here) | `code-reviewer` |
| E2E Testing | `test-automator` |
| Full-Stack Features | `fullstack-engineer` |
| Code Archaeology / Impact Analysis | `code-archaeologist` |
| Refactoring / Tech Debt | `refactoring-specialist` |
| Documentation | `documentation-specialist` |
| Architecture Review | `architect-reviewer` |
| QA Strategy | `qa-expert` |
| Design Review | `quiver-design-reviewer` |
| Data Research | `data-researcher` |
| Mobile (Capacitor) | `fullstack-engineer` |

---

## Core Patterns

### Data Fetching

Use `useDataFetcher` with a memoized fetch function for client-side data access:

```tsx
const fetchData = useCallback(async () => {
  return await myActionOrApi();
}, [myActionOrApi]);
const { data, loading, error, refetch } = useDataFetcher(fetchData);
```

Note: Some specialized hooks use SWR or TanStack Query directly. Check existing patterns in the directory before adding new data fetching.

### Server Actions

Use `withAuthenticatedAction` from `lib/server-action-utils.ts` for all protected server actions:

```ts
import { withAuthenticatedAction } from "@/lib/server-action-utils";

export async function doProtectedThing(arg: string) {
  return withAuthenticatedAction(async (user, supabase) => {
    const { data, error } = await supabase
      .from("some_table")
      .select("*")
      .eq("owner_id", user.id);
    if (error) throw new Error(error.message);
    return data;
  });
}
```

Also available: `makeAuthenticatedAction` (curried version), `withValidation` (Zod), `createServerAction` (combined auth + validation).

### API Routes (Preferred: `withAuth` wrapper)

Use `withAuth` from `lib/middleware/api-wrappers/` for authenticated API routes. This is the standard pattern used in 40+ routes:

```ts
import { withAuth } from "@/lib/middleware/api-wrappers";
import { createSuccessResponse } from "@/lib/middleware/api-wrappers";

export const GET = withAuth(async (request, { user, supabase }) => {
  const data = await fetchBusinessLogic(user.id, supabase);
  return createSuccessResponse(data);
}, { errorMessage: "Failed to load data" });
```

Also available from `lib/middleware/api-wrappers/`: `withErrorHandler`, `withRateLimit`, `withBotBlockingAndRateLimit`, `withFullProtection`, `validateUuidParam`, `requireOwnership`.

### API Routes (Legacy: `lib/api-utils.ts`)

Some older routes use `createSuccessResponse` / `handleApiError` directly from `lib/api-utils.ts`. When editing these, prefer migrating to `withAuth` unless the scope is small.

### Realtime Subscriptions

Always clean up channels:

```tsx
useEffect(() => {
  const channel = supabase
    .channel("changes")
    .on("postgres_changes", { event: "*", schema: "public", table: "table" }, handleChange)
    .subscribe();
  return () => supabase.removeChannel(channel);
}, [supabase]);
```

### Coordinate Naming (prevents mapping bugs)

**Allowed names:** `lat`, `lon`, `latitude`, `longitude`. **Never use** `lng` in new code.

| Layer | Convention |
|-------|-----------|
| Database (legacy) | `center_lat`, `center_lng` (don't rename without migration) |
| Database (new tables) | `latitude`, `longitude` |
| Component props | `latitude`, `longitude` |
| API parameters | `lat`, `lon` |

**Critical pitfall** - database fields don't match component props:
```tsx
// WRONG: beach.latitude doesn't exist
<Component latitude={beach.latitude} />
// CORRECT: explicit mapping from DB columns
<Component latitude={beach.center_lat} longitude={beach.center_lng} />
```

Validate with `assertValidCoordinates(lat, lon, "context")` from `lib/coordinate-validation.ts`.
See `/docs/COORDINATE_CONVENTIONS.md` for the full guide.

### Forecast Timestamps

- **Use**: `forecast_at` (timestamptz) -- canonical forecast time column
- **Deprecated**: `forecast_date` + `forecast_time` -- ambiguous bare text fields, do not use in new code
- **Adapter**: `lib/utils/forecast-at-adapter.ts` for timezone conversions
- **Query pattern**: `.gte("forecast_at", startISO).lt("forecast_at", endISO).order("forecast_at")`

---

## Git Workflow

**One-way flow:** `feature/* → main → prod`. Never merge prod back into main.
See `docs/GIT_WORKFLOW.md` for the full branching strategy, hotfix process, and CI gate details.

---

## Architecture Documentation

**49 `ARCHITECTURE.md` files exist.** Always read the relevant one before editing a directory.

- **Start here:** `docs/ARCHITECTURE.md` (top-level index)
- **Key docs:** `app/ARCHITECTURE.md`, `app/api/ARCHITECTURE.md`, `components/ARCHITECTURE.md`, `hooks/ARCHITECTURE.md`, `lib/services/ARCHITECTURE.md`, `supabase/ARCHITECTURE.md`, `e2e/ARCHITECTURE.md`, `types/ARCHITECTURE.md`

Follow existing patterns. No duplicate implementations. DRY.

---

## Routing Patterns

- **Beach pages:** `app/[intent]/[city]/[beachSlug]/page.tsx` - accepts 2-letter state slugs for all states
- **California shortcut:** `/ca/[city]/[beachSlug]` (legacy, still active)
- **Intent pages:** `app/[intent]/[city]/page.tsx` - match `LocationPage` layout (Breadcrumbs, Header, Container)
- **State slug validation:** `getValidStateSlugs()` / `isValidStateSlug()` from `lib/utils/beach-url-utils.ts`
- **Coverage areas:** CA, OR, WA, HI, Baja are in-coverage - never show "out of area" messaging for these
- **Session log templates:** link to `/features` (not `/app`)

---

## Database & Migration Safety

### Migration Rules

All migrations go in `supabase/migrations/` with naming `YYYYMMDDHHMMSS_descriptive_name.sql`.

**PROHIBITED in migrations:**
- `DELETE FROM auth.users` without WHERE clause
- `DELETE FROM profiles` based on name/email matching
- `TRUNCATE` on user tables
- `DROP TABLE` for core user tables
- Deleting by user-provided strings (names, emails)

**REQUIRED for all migrations:**
1. Wrap in `BEGIN;` ... `COMMIT;`
2. Add `WHERE NOT EXISTS` for inserts
3. Create rollback migrations for destructive changes
4. Test locally first: `supabase db reset`
5. Document schema changes in migration comments

**Before applying to prod:**
1. Fresh `pg_dump` backup within 24 hours
2. Review SQL for any DELETE/TRUNCATE/DROP
3. Test on a branch database if available

### Production Execution Protocol

- **Role:** Use `claude_migrator` role only
- **Default:** Read-only. Mutations require two-step protocol:
  1. **PLAN** - Output: exact SQL, target role, tables affected, backup artifact name
  2. **APPROVAL** - Maintainer replies with `APPROVE: <sha>` of the plan text
- **No approval = no changes.** Refuse mutations without the approval token.

---

## Testing Rules

- Run tests after every change. If tests don't run, the update is not complete.
- Always run a **subset** of Playwright tests (not the full suite): `npx playwright test path/to/spec.spec.ts`
- Prefer **Playwright MCP** for quick UI validation before shelling out to CLI
- Use pragmatic waits (`waitForLoadState("load")`) per `e2e/ARCHITECTURE.md`
- Test across mobile AND desktop breakpoints
- Write/adjust tests when adding behavior: unit, integration, component, and E2E for critical flows

**E2E required patterns:**
- All browser specs use `setupErrorDetection(page)` in `beforeEach` and `assertNoErrors(page, errorCapture)` in `afterEach` (see `e2e/utils/error-detection.ts`)
- Use proper HTTP status codes in assertions (400, 401, 403, 404, 405) — 500 indicates a bug, not expected behavior
- Throw informative errors for unimplemented features instead of `test.skip()` — e.g., `throw new Error('Not implemented: <reason>')`
- Use `isVisibleSafe()` from `e2e/utils/strict-helpers.ts` for environment-dependent visibility checks
- Annotate every `waitForTimeout` with `// eslint-disable-next-line playwright/no-wait-for-timeout -- <reason>`

---

## Quality Standards

### Performance Targets
- Lighthouse: >90 (Performance, Accessibility, Best Practices, SEO)
- LCP <2.5s, FID <100ms, CLS <0.1
- API P95 <500ms, DB queries <100ms

### Security
- RLS policies on all tables with user data
- Input validation at system boundaries
- Rate limiting on API endpoints (`withRateLimit` / `withFullProtection`)
- No sensitive data in client-side code

### Code Style
- TypeScript-first, explicit function signatures, meaningful names
- Early returns, guard error cases first, no empty catches
- Minimal comments - explain **why** when non-obvious
- Preserve existing formatting and indentation exactly
- Don't reformat unrelated code

### Pre-Merge Checklist
- [ ] Code reviewed by `code-reviewer` agent
- [ ] All tests passing (unit + E2E)
- [ ] Performance targets met
- [ ] Security review completed
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

---

## Post-Implementation

1. Update `CHANGELOG.md` under `[Unreleased]` with a brief bullet (Added/Changed/Fixed/Performance/Removed)
2. Validate with Playwright MCP (screenshot or smoke test)
3. TDD loop: write/commit a failing test, implement, iterate until green
4. Don't modify tests unless the spec truly changes
