# Quiver Design Principles

This document outlines Quiver's core design principles and best practices. It reflects our current architecture and patterns while also highlighting aspirational directions. These principles guide development so Quiver remains robust, maintainable, user-focused, and growth-ready.

---

## Simplicity & Consistency

- Standard data fetching: Always memoize async fetchers with `useCallback` and use `useDataFetcher`. Do not inline async logic in components or manage ad-hoc loading flags. See `hooks/ARCHITECTURE.md` and root `ARCHITECTURE.md` Core Architecture Patterns.

```ts
const fetchData = useCallback(async () => {
  return await someAction();
}, [dependencies]);

const { data, loading, error, refetch } = useDataFetcher(fetchData);
```

- Uniform API handling: Use centralized API utilities to standardize success and error responses.

```ts
import { createSuccessResponse, handleApiError } from "@/lib/api-utils";

export async function POST(request: Request) {
  try {
    const result = await processRequest();
    return createSuccessResponse(result);
  } catch (error) {
    return handleApiError(error);
  }
}
```

- No surprises in components: Keep business logic and complex async work out of render paths. Put data/state in hooks or `lib/services/*`. Follow `components/ARCHITECTURE.md` and `hooks/ARCHITECTURE.md`.

References: `ARCHITECTURE.md`, `hooks/ARCHITECTURE.md`, `docs/ARCHITECTURE_REVIEW.md`

---

## Modularity & Reusability (DRY)

- DRY components: Reuse `components/ui/form-layout` and `components/ui/form-fields` for forms. Avoid one-off implementations.
- Small, focused modules: Break large features into cohesive components/hooks. The landing page refactor split a monolith into smaller sections and removed 400+ duplicate lines.
- Shared utilities: Place common code in `lib/*` and follow `lib/ARCHITECTURE.md` patterns.

References: `components/ARCHITECTURE.md`, `docs/DRY_COMPONENT_USAGE.md`, `docs/ARCHITECTURE_REVIEW.md`

---

## Performance by Design

- Efficient rendering/fetching: Memoize expensive work and avoid redundant requests. The memoized fetcher pattern eliminated infinite loops and cut server load drastically.
- Optimized queries: Add indexes for frequent predicates; structure RLS and queries to avoid planner overhead (e.g., wrap `auth.*` calls in `SELECT`).
- Fail-fast on stale data: Never serve known-stale data; fail and prompt refresh.

References: `supabase/ARCHITECTURE.md`, `docs/ARCHITECTURE_REVIEW.md`, `ARCHITECTURE.md`

---

## Security & Privacy by Default

- Strong data layer security: RLS on all tables by default; enforce FKs; least-privilege roles.
- Authenticated actions: Wrap server actions with auth helpers; prefer typed errors and uniform 401/403 handling.
- Privacy: Respect profile visibility and content privacy; secure media with signed URLs and RLS.

References: `lib/ARCHITECTURE.md`, `lib/auth/ARCHITECTURE.md`, `supabase/ARCHITECTURE.md`, `ARCHITECTURE.md`

---

## Transparency & User Trust

- Explainable forecasts: Show data sources (NOAA vs fallback) and nearest buoy details in UI.
- Confidence indicators: Display confidence scores/ranges with clear visual cues.
- Consistent context: Snapshot forecast/conditions for plan/log sessions.

References: `components/forecast/ARCHITECTURE.md`, `docs/ARCHITECTURE_REVIEW.md`, `ARCHITECTURE.md`

---

## Comprehensive Testing & QA

- Multi-layered testing: Unit (utils), integration (actions/API), component (UI), E2E (critical flows). See `test-utils/ARCHITECTURE.md` and `e2e/ARCHITECTURE.md`.
- Reliability: Prefer `waitForLoadState("load")`, realistic performance thresholds, and flexible API status ranges where appropriate.
- Coverage: Extensive suite covering realtime behavior and cleanup; CI requires green runs.

References: `test-utils/ARCHITECTURE.md`, `e2e/ARCHITECTURE.md`, `docs/ARCHITECTURE_REVIEW.md`

---

## AI-Augmented Automation (Aspirational)

- Playwright MCP integration: Use the Playwright MCP server to let agents run tests and inspect traces from Cursor. See `.cursor/mcp.json` and `docs/CURSOR_AGENTS.md`.
- Agent loops for testing: Explore agent-driven navigation and auto-generated tests.
- Guardrails: All AI-generated changes must conform to these principles and be human-reviewed.

Further reading: [Playwright MCP Server is here](https://hackernoon.com/playwright-mcp-server-is-here-lets-integrate-it), [Letting Playwright MCP explore your site and write your tests](https://dev.to/debs_obrien/letting-playwright-mcp-explore-your-site-and-write-your-tests-mf1)

---

## Growth-Driven Product Focus

- Social sharing: One-click session summary exports optimized for Instagram/TikTok.
- Viral mechanics: Referrals, challenges, leaderboards; prioritize network effects.
- Community & collaboration: Crews/buddies, session invitations, collaborative planning.

References: `ARCHITECTURE.md`, `docs/ARCHITECTURE_REVIEW.md`

---

## Documentation & Continuous Improvement

- Living architecture docs: Keep directory `ARCHITECTURE.md` files current when patterns change.
- Changelog discipline: Update `CHANGELOG.md` for all notable changes.
- Quality gates: Planning → approval → implementation using established patterns → tests green → docs updated.

References: `ARCHITECTURE.md`, `docs/ARCHITECTURE_REVIEW.md`

---

## Quick Links

- Overview: `ARCHITECTURE.md`
- System review: `docs/ARCHITECTURE_REVIEW.md`
- Agents & MCP: `docs/CURSOR_AGENTS.md`
- DRY components: `docs/DRY_COMPONENT_USAGE.md`
- Database & RLS: `supabase/ARCHITECTURE.md`
- Testing: `test-utils/ARCHITECTURE.md`, `e2e/ARCHITECTURE.md`

Last updated: January 2025
