## Quiver Architecture (Top-Level)

This document is the canonical, high-level overview of Quiver’s architecture and an index to detailed docs. It summarizes core patterns and policies and points to directory-specific `ARCHITECTURE.md` files and primary references in `docs/`.

Keep this doc concise. Put details in the linked documents.

---

### Stack & System Overview

- Next.js 14 App Router (React, Server Actions)
- Supabase (PostgreSQL, Auth, RLS, Realtime)
- Tailwind CSS + shadcn/ui
- TypeScript across frontend and backend

App status: Production-ready foundation with comprehensive tests; current focus is growth (0 → 1,000 users).

---

### Mobile Architecture

**Status**: Phase 1 Complete - Ready for Native Build Generation

**Approach**: Capacitor shell wrapping the Next.js web app for iOS/Android distribution

**Key Components**:
- **PWA Foundation**: `public/manifest.json` with shortcuts, icons, protocol handlers
- **Service Worker**: `public/sw.js` with forecast caching, 6-hour TTL, anti-stale-data policy
- **Capacitor Config**: `capacitor.config.ts` with production URL, push config, splash settings
- **Native Bridge**: `lib/mobile/` adapters for share, push notifications, platform detection
- **Push Infrastructure**: Device token management, `hooks/use-native-push-registration.ts`
- **Deep Links**: `app/.well-known/` routes for Android `assetlinks.json` and iOS `apple-app-site-association`
- **Build Scripts**: `mobile:sync`, `mobile:build:ios`, `mobile:build:android`, `mobile:assets`

**Next Steps**: Run `npm run mobile:sync` to generate iOS/Android projects, configure domain verification

---

### Codebase Layout (Index)

- `app/` — Next.js routes and API routes (see `app/ARCHITECTURE.md`)
- `components/` — Reusable UI, DRY form components (see `components/ARCHITECTURE.md`)
- `hooks/` — Custom React hooks (see `hooks/ARCHITECTURE.md`)
- `lib/` — Utilities, services, auth, Supabase clients (see `lib/ARCHITECTURE.md`)
- `supabase/` — DB migrations, RLS, performance (see `supabase/ARCHITECTURE.md`)
- `types/` — TypeScript domain models (see `types/ARCHITECTURE.md`)
- `test-utils/` — Testing helpers (see `test-utils/ARCHITECTURE.md`)
- `e2e/` — Playwright tests (see `e2e/ARCHITECTURE.md`)

Primary references:

- `docs/ARCHITECTURE_REVIEW.md` — PRIMARY reference for system architecture and current status
- `docs/STYLE_GUIDE.md` — Brand, typography, color, iconography, motion, accessibility, DRY component patterns

### Design Principles

See `docs/DESIGN_PRINCIPLES.md` for the canonical principles that govern implementation across the codebase. Highlights:

- Simplicity & Consistency: standard React data fetching, centralized API utils, no business logic in render paths
- DRY & Modularity: reusable form/layout components, small focused modules, shared utilities
- Performance by Design: efficient fetching/rendering, indexed queries, fail-fast on stale data
- Security & Privacy by Default: RLS on all tables, authenticated actions, least-privilege access
- Transparency & Trust: forecast source indicators and confidence, contextual snapshots for sessions
- Comprehensive Testing & QA: unit/integration/component/E2E with realistic thresholds
- AI-Augmented Automation (aspirational): Playwright MCP and agent loops governed by human review
- Growth-Driven Product Focus: social sharing, viral mechanics, community features

---

### Core Architecture Patterns

- Data fetching in React

  - Always memoize the fetcher and use the standard hook:

    ```ts
    const fetchData = useCallback(async () => {
      return await someAction();
    }, [dependencies]);

    const { data, loading, error, refetch } = useDataFetcher(fetchData);
    ```

  - Never inline async functions inside hooks; avoid manual loading flags.

- API routes

  - Use centralized utilities for consistent responses and error handling.
  - Pattern:

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

- Server actions

  - Wrap with authenticated action helpers to enforce auth consistently.
  - See `lib/server-action-utils.ts` (documented via `lib/ARCHITECTURE.md`).

- DRY form components

  - Use `components/ui/form-layout` and `components/ui/form-fields` for forms.
  - Keep business logic out of UI; follow DRY component patterns in `docs/STYLE_GUIDE.md`.

- Realtime subscriptions (Supabase)

  - Subscribe with cleanup in `useEffect`; remove channel on unmount.

- Centralized error handling
  - Use `lib/api-utils.ts` and error helpers; prefer typed errors over ad-hoc handling.

---

### Data Layer, Security, and Performance

- PostgreSQL schema managed via `supabase/migrations/` with RLS on all tables.
- Follow established patterns for RLS performance (wrap `auth.*` calls in `SELECT` to avoid InitPlan overhead).
- Use proper indexes for foreign keys and frequent predicates; see performance migrations.
- Anti-stale-data policy: never return stale forecast or domain data; fail fast instead.
- See: `supabase/ARCHITECTURE.md`, `lib/services/*`, and `docs/ARCHITECTURE_REVIEW.md` for details.

---

### Forecasting & Transparency (Domain Highlights)

- Enhanced forecast system with data source transparency (NOAA vs fallback, nearest buoy indicators).
- Confidence scoring and visual indicators; prefer clear user-facing transparency.
- Session snapshots should capture forecast context for logged/planned sessions.
- See: `components/forecast/ARCHITECTURE.md`, `lib/services/enhanced-forecast-service.ts`, and docs.

---

### Testing Strategy

- Test types: unit (utils), integration (actions/API), component (UI), e2e (critical flows).
- Playwright guidance: prefer `waitForLoadState("load")` over `networkidle`.
- Performance thresholds tuned for dev environments (e.g., loadTime 15000ms).
- API tests validate flexible status ranges (200/400/401/403/404/405/500) where appropriate.
- See: `test-utils/ARCHITECTURE.md` and `e2e/ARCHITECTURE.md`.

---

### Growth-First Focus (Non-Functional Priorities)

- Social sharing (session summaries for Instagram/TikTok)
- Session photo integration
- Viral mechanics (referrals, challenges, leaderboards)
- Community features (surf buddies, crews)

All feature decisions should ask: does this help users invite friends and share content?

---

### Contribution Workflow & Quality Gates

1. Start with analysis and planning; check relevant directory `ARCHITECTURE.md` and `docs/ARCHITECTURE_REVIEW.md`.
2. Propose an implementation plan; get approval before coding.
3. Implement following core patterns (no new ad-hoc patterns).
4. Write/adjust tests (unit/integration/component/e2e) and ensure they pass.
5. Update `CHANGELOG.md` (Added/Changed/Fixed/Performance) for all changes.
6. Update directory architecture docs if introducing new patterns.

---

### AI Agents & MCP Integration

- Agents: Fullstack Engineer and Design Review personas for Cursor
- Docs: `docs/CURSOR_AGENTS.md`
- MCP: Playwright server configured in `.cursor/mcp.json`

---

### Quick Links

- App router & API routes: `app/ARCHITECTURE.md`
- Components & DRY forms: `components/ARCHITECTURE.md`, `docs/STYLE_GUIDE.md` (DRY patterns section)
- Hooks & data fetching: `hooks/ARCHITECTURE.md`
- Utilities, services, auth: `lib/ARCHITECTURE.md`
- Database & RLS: `supabase/ARCHITECTURE.md`
- Domain types: `types/ARCHITECTURE.md`
- Testing utilities: `test-utils/ARCHITECTURE.md`, `e2e/ARCHITECTURE.md`
- System overview: `docs/ARCHITECTURE_REVIEW.md`
