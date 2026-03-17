# CLAUDE.md - Quiver

## Agent-First Mandate

The main session is a **coordinator**, not an implementer. Use subagents for all work.

| Situation | Action |
|-----------|--------|
| Multi-step task | `@agents-orchestrator` FIRST, then follow its routing map |
| Single-domain task | Use the specialist agent directly (see `docs/AGENT_ROSTER.md`) |
| Unsure which agent | Ask `@agents-orchestrator` anyway |
| "This is simple, I'll just..." | STOP. Use an agent. Always. |

Workflow: `@agents-orchestrator` -> specialist agents -> `@engineering-code-reviewer` for QA.
Full roster: `docs/AGENT_ROSTER.md`

---

## Mission & Stack

**Mission:** Growth-first. Prioritize social sharing, session photos, referrals/challenges/leaderboards, viral loops, and community features over monetization.

**Stack:**
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS, Radix UI, Framer Motion, Mapbox GL
- **Backend:** Supabase (PostgreSQL 15+ with PostGIS, RLS, Edge Functions, Realtime, Storage), Next.js API Routes
- **Mobile (Web Wrapper):** Capacitor 8 (iOS/Android), Firebase Cloud Messaging
- **Mobile (Native):** Expo 55 / React Native 0.83 — separate repo `../quiver-native` (see its own `CLAUDE.md`)
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

### Event Tracking

Pre-auth funnel events (`signup_cta_view`, `signup_cta_click`, `signup_form_submitted`, `auth_modal_opened`, `auth_modal_closed_without_action`) must **never fire for authenticated users**. Guard client-side with `if (!user)` and server-side in `/api/events/route.ts` with `PRE_AUTH_ONLY_EVENTS` blocklist. Events during auth transition (`signup_started`, `signup_success`, `login_success`) are allowed for both.

### CTA Components (Defense-in-Depth)

Every CTA component that shows to anonymous users must **independently check auth state** via `useAuth()` and hide/transform for logged-in users. Never rely solely on a parent's `publicMode` prop — auth state may propagate at different speeds. Components: `PublicContentGate`, `InlineSignupCta`, `MatchScoreTeaser`, `PersonalizedForecastTeaser`, `StickySignupBar`.

### OAuth Testing

Always test OAuth signup flows (Apple, Google) on **real iOS Safari** — cookie handling during cross-origin OAuth redirects differs from Chrome. The auth context at `context/auth-context.tsx` uses `onAuthStateChange` which may not fire if session cookies aren't immediately visible after redirect.

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
- **Coverage areas:** Full US coasts (ME, NH, MA, RI, NY, NJ, NC, SC, GA, FL, CA, OR, WA, TX), HI, PR, Baja — never show "out of area" messaging for these. Source of truth: `lib/constants/coverage-areas.ts`
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
- [ ] `engineering-code-reviewer` agent review
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
- Don't fire pre-auth funnel events (`signup_cta_view`, `auth_modal_opened`, etc.) for authenticated users
- Don't rely on parent `publicMode` prop alone for hiding CTAs — always self-guard with `useAuth()`

---

## Design Context

### Users
Surfers checking conditions, logging sessions, and connecting with their local crew. They open Quiver before dawn to decide whether to paddle out, mid-session to log conditions, and post-session to share with friends. The job: **make the call confidently and feel part of something**.

### Brand Personality
**Chill, Reliable, Smart.** Quiet confidence — not trying to impress, just knows its stuff. Like the local who always knows when the swell is hitting. No hype, no corporate polish, just trustworthy data wrapped in surf culture.

### Aesthetic Direction
- **Visual tone**: Retro 80s-90s surf culture. Deep Twilight navy (`#252D6B`) base, Charming Orange (`#F78E42`) primary accent. Always-dark theme.
- **Typography**: Space Grotesk for personality (headings), DM Sans for data clarity (body), Space Mono for technical values.
- **Texture**: Sticker aesthetic — rotated badges (1-3deg), asymmetric border radius, scan lines, noise overlays. Sparse accents for impact.
- **References**: Stussy/Palace streetwear energy, Magic Seaweed-era data-first rawness, local shop zine vibes.
- **Anti-references**: Corporate SaaS (Stripe/Linear blue-gray), generic AI slop (cyan-on-dark, purple gradients, glassmorphism), overly polished Apple-minimalism. If it looks like a template, it's wrong.

### Emotional Goal
**Belonging + identity.** This is MY surf app. Local pride. Part of a crew. The interface should feel like it was made by surfers, for surfers — not by a product team chasing metrics.

### Design Principles
1. **Data is sacred** — Forecast numbers, tide charts, and conditions must be crisp and instantly scannable. Never sacrifice readability for aesthetics.
2. **Personality over polish** — A slightly rough sticker rotation is better than pixel-perfect corporate alignment. Charm > cleanliness.
3. **Sparse accents hit harder** — Use Charming Orange and neon glows sparingly. When everything glows, nothing does.
4. **Surf culture, not surf cliche** — No generic wave illustrations, no "hang loose" clip art, no teal-and-white Surfline palette. Reference the culture through typography, texture, and attitude.
5. **Respect reduced motion** — All animations must honor `prefers-reduced-motion`. Data-first users shouldn't need motion to use the app.

---

## Post-Implementation

1. Update `CHANGELOG.md` under `[Unreleased]` with a brief bullet (Added/Changed/Fixed/Performance/Removed)
2. Run affected tests — blast radius check (search for imports from changed modules)
3. Validate with Playwright MCP for UI changes (screenshot or smoke test)
4. All tests green before committing
