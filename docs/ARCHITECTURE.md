## Quiver Architecture (Top-Level)

This document is the canonical, high-level overview of Quiver’s architecture and an index to detailed docs. It summarizes core patterns, policies, and the current product strategy.

**Last Updated:** December 2025

---

### Stack & System Overview

- **Next.js 14 App Router** (React, Server Actions)
- **Supabase** (PostgreSQL, Auth, RLS, Realtime)
- **Tailwind CSS + shadcn/ui**
- **TypeScript** across frontend and backend

**App Status**: Production-ready foundation with comprehensive tests.
**Current Focus**: User acquisition and viral growth (7 → 1,000 users).

---

### Product Vision & Growth Strategy

**Mission**: A community-driven, trail-style surf app where surfers can plan sessions, share experiences, and build meaningful connections.

**Critical Challenge**: Technical excellence achieved (performance, features, testing), but 7 active users.
**Strategic Pivot**: Shift from feature perfection to **Growth Engineering**.

- **Phase 3A (Weeks 1-8)**: Viral Foundation (Social sharing, summary generation).
- **Phase 3B (Weeks 9-16)**: Network Effects (Community features, buddy finder).
- **Phase 3C (Weeks 17-24)**: Viral Acceleration (Referrals, challenges).

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

**Primary Reference**: `docs/STYLE_GUIDE.md` (Brand, patterns, accessibility).

---

### Design Principles

See `docs/DESIGN_PRINCIPLES.md`. Highlights:

- **Simplicity & Consistency**: Standard React data fetching, centralized API utils.
- **DRY & Modularity**: Reusable components, shared utilities.
- **Performance by Design**: Fail-fast on stale data, efficient fetching.
- **Security by Default**: RLS on all tables, authenticated actions.
- **Growth-Driven**: All features must drive sharing/referrals.

---

### Core Architecture Patterns

**1. Data Fetching (React)**
Always memoize fetchers and use `useDataFetcher`:

```ts
const fetchData = useCallback(async () => {
  return await someAction();
}, [dependencies]);

const { data, loading, error } = useDataFetcher(fetchData);
```

**2. API Routes**
Use centralized utilities:

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

**3. Server Actions**
Wrap with authentication helpers (`lib/server-action-utils.ts`):

```ts
export const myAction = withAuthenticatedAction(async (userId, ...args) => { ... });
```

**4. Realtime**
Subscribe with cleanup in `useEffect`.

---

### Feature Status Highlights

- **Personalization**: "Single User Experience" engine with affinity/history learning.
- **Social Platform**: Follows, feeds, likes, comments, real-time updates.
- **Forecasting**: 10-day NOAA integration with confidence scoring.
- **Media**: Photo upload, galleries, optimized storage.
- **Session Management**: Logging, planning, rich metadata.
- **Attribution**: UTM tracking and referral system for growth analytics.
- **Coverage**: California, Oregon, Washington, Hawaii, Baja California.

---

### Documentation Index

| Category | Document | Description |
|----------|----------|-------------|
| **API** | [API Overview](api/README.md) | REST API architecture and endpoints |
| **API** | [Server Actions](api/SERVER_ACTIONS.md) | Next.js server action reference |
| **API** | [RPC Functions](api/RPC_FUNCTIONS.md) | Supabase stored procedures |
| **Architecture** | [URL Routing](architecture/URL_ROUTING.md) | Hierarchical URL patterns |
| **Architecture** | [Forecast Scoring](architecture/FORECAST_SCORING.md) | Surf scoring algorithm |
| **Architecture** | [Cache Strategy](architecture/CACHE_STRATEGY.md) | Multi-tier caching patterns |
| **Features** | [Attribution Tracking](features/ATTRIBUTION_TRACKING.md) | UTM and referral tracking |
| **Features** | [City Editorial](features/CITY_EDITORIAL_CONTENT.md) | City page content system |
| **Guides** | [Adding States](guides/ADDING_NEW_STATES.md) | Regional expansion guide |
| **Reference** | [Coverage Areas](COVERAGE_AREAS.md) | Geographic coverage details |

---

### Mobile Architecture

**Status**: Phase 1 Complete - Ready for Native Build Generation

- **Approach**: Capacitor shell wrapping Next.js web app.
- **Key Components**: PWA manifest, Service Worker (forecast caching), Capacitor bridge.
- **Next Steps**: Run `npm run mobile:sync` to generate iOS/Android projects.

---

### Testing Strategy

- **Test Types**: Unit (utils), Integration (actions), Component (UI), E2E (critical flows).
- **Playwright**: Prefer `waitForLoadState("load")`.
- **Performance**: Thresholds tuned for dev environments (e.g., loadTime 15000ms).
- **API**: Validate flexible status ranges (200/400/401/etc).

---

### Supabase Access (Remote → Local)

Project ref: `vawdnbbgawichorsjiwe` (quiverDB).

```bash
# Auth & link
export SUPABASE_ACCESS_TOKEN="<YOUR_PAT>"
supabase login --token "$SUPABASE_ACCESS_TOKEN"
supabase link --project-ref vawdnbbgawichorsjiwe

# Pull schema
supabase db pull --schema public

# Reset local
supabase db reset --local
supabase start
```

---

### Contribution Workflow

1. **Plan**: Check `ARCHITECTURE.md`, propose plan, get approval.
2. **Implement**: Follow core patterns (DRY, `useDataFetcher`).
3. **Verify**: Run tests (Unit/Integration/E2E).
4. **Document**: Update `CHANGELOG.md` under `[Unreleased]`.
