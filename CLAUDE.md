# Quiver AI Coding Context

## Model Compatibility

This file is shared project context for Claude, SOL, Fable, Codex, and other coding models.

- Work directly by default. Delegation and parallel agents are optional when the runtime supports them and the task benefits from them.
- Do not require a named agent, orchestrator, skill, MCP server, or model-specific command to complete work.
- Use available local tools and repository scripts. If an optional integration is unavailable, continue with the best local alternative.
- Keep process proportional to the task: inspect relevant code and documentation, make a focused change, validate it, and review the result.
- Follow the user's requested scope. Do not add unrelated features, refactors, commits, or cross-repo changes.

## Model Selection and Usage Efficiency

- Use the least expensive model that can complete the task reliably. Honor an explicit user model choice.
- Use fast, lower-cost models for repository search, file discovery, mechanical edits, documentation, formatting, summaries, and routine test triage.
- Use stronger reasoning models for architecture decisions, security-sensitive work, migrations, production incidents, ambiguous cross-cutting bugs, and final review of high-risk changes.
- Escalate only when the task's risk clearly warrants it or a focused lower-cost attempt leaves material uncertainty. Return to a lower-cost model after the difficult reasoning is complete.
- Avoid duplicate model work. Parallelize only independent subtasks with a clear latency benefit, and pass concise findings instead of replaying full context.
- Prefer local search, repository scripts, deterministic checks, and cached results over additional model calls.

---

## Mission & Stack

**Mission:** Growth-first. Prioritize social sharing, session photos, referrals/challenges/leaderboards, viral loops, and community features over monetization.

**Stack:**
- **Frontend:** Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS, Radix UI, Framer Motion, Mapbox GL
- **Backend:** Supabase (PostgreSQL 15+ with PostGIS, RLS, Edge Functions, Realtime, Storage), Next.js API Routes
- **Mobile (Native):** Expo 55 / React Native 0.83 — separate repo `../quiver-native` (see `../quiver-native/AGENTS.md` and its local project instructions)
- **Testing:** Playwright (E2E), Jest (unit/integration), Testing Library
- **Infra:** Vercel, Sentry, Firebase | **Build:** Yarn, `next.config.mjs`

## Cross-App Product Unity

Quiver web and Quiver Native are separate repos but one product. Keep UI, UX, surf-condition displays, API contracts, domain models, and analytics events aligned when a change affects both surfaces.

Before visible or contract changes shared with native, inspect the relevant counterpart in `../quiver-native` and the canonical design reference in `../Brand-Vault/style-guide/source-docs/DESIGN_SYSTEM.md`. Reuse established patterns instead of inventing duplicates. Classify cross-app findings as `P0` bug/regression, `P1` product drift, or `P2` cleanup, with file references.

Do not make opportunistic cross-repo changes unless required for the requested task and covered by the relevant web/native tests.

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

**Mobile-consumed API routes are versioned contracts** (ratchet policy 2026-07-31). Before changing any `/api/*` route, grep `../quiver-native/src` for the path. If native consumes it: shape changes must be additive (never rename/remove/repurpose fields in place — add a field or a new route), and failures must return real HTTP error statuses, never a 200-wrapped error payload. Installed binaries live for months. Full rules: `AGENTS.md` §Native ↔ web boundary and `../quiver-native/AGENTS.md` §Architecture Ratchet.

### Realtime Subscriptions

Always clean up channels — subscribe in `useEffect`, return `() => supabase.removeChannel(channel)` in cleanup.

### Coordinate Naming

**Never use `lng` in new code** — use `lon` or `longitude`. Beach rows use `lat`/`lon`. **Critical pitfall:** `beach.latitude` doesn't exist — use `beach.lat`/`beach.lon`.
Full guide: `docs/COORDINATE_CONVENTIONS.md`

### Forecast Timestamps

Use `forecast_at` (timestamptz), not deprecated `forecast_date` + `forecast_time`. Adapter: `lib/utils/forecast-at-adapter.ts`. Query: `.gte("forecast_at", startISO).lt("forecast_at", endISO).order("forecast_at")`

### Event Tracking

Pre-auth funnel events (`signup_cta_view`, `signup_cta_click`, `signup_form_submitted`, `auth_modal_opened`, `auth_modal_closed_without_action`) must **never fire for authenticated users**. Guard client-side with `if (!user)` and server-side in `/api/events/route.ts` with `PRE_AUTH_ONLY_EVENTS` blocklist. Events during auth transition (`signup_started`, `signup_success`, `login_success`) are allowed for both.

### CTA Components (Defense-in-Depth)

Every CTA component that shows to anonymous users must **independently check auth state** via `useAuth()` and hide/transform for logged-in users. Never rely solely on a parent's `publicMode` prop — auth state may propagate at different speeds. Components: `PublicContentGate`, `InlineSignupCta`, `MatchScoreTeaser`, `PersonalizedForecastTeaser`, `StickySignupBar`.

### OAuth Testing

OAuth signup changes (Apple, Google) require validation on **real iOS Safari** before release — cookie handling during cross-origin redirects differs from Chrome. If that environment is unavailable, complete the available checks and report the remaining validation gap. The auth context at `context/auth-context.tsx` uses `onAuthStateChange`, which may not fire if session cookies are not immediately visible after redirect.

---

## Git Workflow

**One-way flow:** `feature/* → main → prod`. Never merge prod back into main.
See `docs/GIT_WORKFLOW.md` for the full branching strategy, hotfix process, and CI gate details.

---

## Architecture Documentation

**58 `ARCHITECTURE.md` files exist.** Read the nearest relevant one before editing a directory; use `docs/ARCHITECTURE.md` as the top-level index. Follow existing patterns and avoid duplicate implementations.

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
**Production:** use the production owner connection required by Supabase CLI migration tracking; do not use `claude_migrator`. Read-only by default. Mutations require PLAN → APPROVAL two-step protocol.
Full rules: `docs/MIGRATION_SAFETY.md`

---

## Testing Rules

### Behavior and Test Changes

When changing behavior, update affected tests in the same change. Do not leave tests knowingly broken.

### Blast Radius Check

Identify test files that import or reference changed modules. Search `e2e/` and `__tests__/` for the affected surface, then run the smallest meaningful set of checks.

### Running Tests

- **`yarn test` runs Playwright (E2E), `yarn test:unit` runs Jest** — don't confuse them
- Prefer targeted Playwright coverage: `npx playwright test path/to/spec.spec.ts`
- For responsive UI changes, validate the affected mobile and desktop breakpoints using available browser tooling or Playwright
- **`yarn lint` OOMs without `NODE_OPTIONS="--max-old-space-size=8192"`** — scope lint to your files with `npx eslint --max-warnings=0 <files>` instead
- `.worktrees/` is not excluded from eslint — pre-existing lint errors there are not your problem

### Review and Verification

- Review the final diff for logic bugs, regressions, missing tests, user-data risk, and unrelated churn.
- Run checks proportional to the touched surface: targeted tests first, scoped ESLint for changed source files, then `yarn typecheck` or broader gates when warranted.
- Fix issues introduced by the change and rerun the relevant failed check.
- Do not commit unless the user asks. If committing, stage only task-owned files and use a scoped Conventional Commit subject.
- Never leave a CHANGELOG-only commit at `HEAD` on a Vercel branch.

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
- [ ] Final diff reviewed
- [ ] Relevant checks passing
- [ ] User-visible changes documented when appropriate
- [ ] No new console errors or warnings

---

## Critical Don'ts

- Don't invent data fetching patterns (use `useDataFetcher`)
- Don't skip `withAuthenticatedAction` for protected server actions
- Don't skip `withAuth` wrapper for authenticated API routes
- Don't add monetization or non-growth features without direction
- Don't assume `beach.latitude` exists (it's `beach.lat`)
- Don't use `lng` in new code (use `lon`)
- Don't use `forecast_date` + `forecast_time` in new queries (use `forecast_at`)
- Don't reference `sessions.profile_id` (dropped Feb 2026 -- use `user_id`)
- Don't `DROP VIEW` + `CREATE VIEW` without carrying forward `WITH (security_invoker = true)`
- Don't fire pre-auth funnel events (`signup_cta_view`, `auth_modal_opened`, etc.) for authenticated users
- Don't rely on parent `publicMode` prop alone for hiding CTAs — always self-guard with `useAuth()`
- Don't change a mobile-consumed API response shape in place or return errors as 200s — additive only, real HTTP statuses (see API Routes)

---

## Design Context

### Users
Surfers checking conditions, logging sessions, and connecting with their local crew. They open Quiver before dawn to decide whether to paddle out, mid-session to log conditions, and post-session to share with friends. The job: **make the call confidently and feel part of something**.

### Brand Personality
**Chill, Reliable, Smart.** Quiet confidence — not trying to impress, just knows its stuff. Like the local who always knows when the swell is hitting. No hype, no corporate polish, just trustworthy data wrapped in surf culture.

### Aesthetic Direction
- **Visual tone**: Retro 80s-90s surf-zine culture. Cream paper (`#F4EBD8`) content surfaces with ink (`#11100D`) text, set on a Deep Twilight (`#252D6B → #1A1535 → #0D1020`) stage. Charming Orange (`#F78E42`) is the single primary accent. The twilight stage is the backdrop only — content lives on cream paper, not on dark cards. Canonical token source: `app/styles/zine.css`; canonical page shell: `ZineSurface` (`components/zine/`).
- **Typography**: Space Grotesk for personality (headings), DM Sans for data clarity (body), Space Mono for technical values.
- **Texture**: Sticker aesthetic — rotated badges (1-3deg), asymmetric border radius, scan lines, noise overlays. Sparse accents for impact. **Never repeat the same sticker on a single card or page** — each surface uses a given sticker (decorative zine sticker or beach badge) at most once; reusing a sticker on a *different* card/page is fine.
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
