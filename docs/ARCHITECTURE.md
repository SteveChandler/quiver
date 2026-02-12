## Quiver Architecture (Top-Level)

This document is the canonical, high-level overview of Quiver's architecture and an index to detailed docs. It summarizes core patterns, policies, and the current product strategy.

**Last Updated:** February 2026

---

### Stack and System Overview

- **Next.js 16 App Router** (React 19, Server Actions)
- **Supabase** (PostgreSQL, Auth, RLS, Realtime)
- **Tailwind CSS + shadcn/ui**
- **TypeScript** across frontend and backend
- **Python/FastAPI** (ML Service on Fly.io)

**App Status**: Production-ready foundation with comprehensive tests.
**Current Focus**: User acquisition and viral growth (7 -> 1,000 users).

---

### Product Vision and Growth Strategy

**Mission**: A community-driven, trail-style surf app where surfers can plan sessions, share experiences, and build meaningful connections.

**Critical Challenge**: Technical excellence achieved (performance, features, testing), but 7 active users.
**Strategic Pivot**: Shift from feature perfection to **Growth Engineering**.

- **Phase 3A (Weeks 1-8)**: Viral Foundation (Social sharing, summary generation).
- **Phase 3B (Weeks 9-16)**: Network Effects (Community features, buddy finder).
- **Phase 3C (Weeks 17-24)**: Viral Acceleration (Referrals, challenges).

---

### Codebase Layout (Index)

- `app/` - Next.js routes and API routes (see `app/ARCHITECTURE.md`)
- `components/` - Reusable UI, DRY form components (see `components/ARCHITECTURE.md`)
- `hooks/` - Custom React hooks (see `hooks/ARCHITECTURE.md`)
- `lib/` - Utilities, services, auth, Supabase clients (see `lib/ARCHITECTURE.md`)
- `ml/` - Python ML service for bias correction (see `ml/ARCHITECTURE.md`)
- `supabase/` - DB migrations, RLS, performance (see `supabase/ARCHITECTURE.md`)
- `types/` - TypeScript domain models (see `types/ARCHITECTURE.md`)
- `test-utils/` - Testing helpers (see `test-utils/ARCHITECTURE.md`)
- `e2e/` - Playwright tests (see `e2e/ARCHITECTURE.md`)
- `scripts/terrain/` - Terrain analysis for geometry scoring (see `scripts/terrain/ARCHITECTURE.md`)

**Primary Reference**: `docs/STYLE_GUIDE.md` (Brand, patterns, accessibility).

---

### Design Principles

See `docs/DESIGN_PRINCIPLES.md`. Highlights:

- **Simplicity and Consistency**: Standard React data fetching, centralized API utils.
- **DRY and Modularity**: Reusable components, shared utilities.
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

### Email System

**Status**: Production

Quiver's email system drives the core engagement loop: sending targeted, valuable notifications that bring users back to the app.

**Philosophy:**
- Decision-first, not data-first
- Earn trust by saying "no" when conditions are bad
- One clear call per email
- Strict rate limiting to prevent fatigue

**Email Types:**

| Email Type | Schedule | Purpose |
|------------|----------|---------|
| Welcome | On signup | Capture preferences, set expectations |
| Forecast Digest | Mon/Thu 6 AM PT | Morning surf call with best windows |
| Weekly Recap | Mon 6 PM PT | Session summary and stats |
| Re-engagement | MWF 10 AM PT | Bring back inactive users when conditions are good |

**Components:**
- **Cron Routes** (`app/api/cron/*-email/`): Vercel cron-triggered endpoints
- **Email Templates** (`lib/mailer/templates/`): React Email components
- **Mailer Client** (`lib/mailer/client.ts`): Resend SDK wrapper
- **Delivery Tracking** (`forecast_alert_deliveries`): Rate limiting and deduplication

**Rate Limiting:**
- Per-type deduplication (24-72 hours depending on type)
- Global cooldown (48 hours between any emails)
- Atomic slot claiming prevents duplicate sends

**Documentation:**
| Document | Description |
|----------|-------------|
| [Email Core Loop Design](plans/completed/2026-01-20-email-core-loop-design.md) | Original design philosophy |
| [Re-engagement Email](features/REENGAGEMENT_EMAIL.md) | Inactive user re-engagement system |

---

### ML System

**Status**: Production (Fly.io)

The ML bias correction pipeline improves NOAA wave height forecast accuracy using XGBoost v3 with terrain-aware features.

**Components:**
- **Python ML Service** (`ml/`): FastAPI service on Fly.io at `https://quiver-ml.fly.dev`
- **TypeScript Parsers** (`lib/ml/`): NOAA text parsing utilities
- **Cron Jobs** (`app/api/cron/ml/`): Batch correction, ground truth backfill, and weekly retrain

**Key Features (v3):**
- **Terrain Factors**: `swell_access_factors` and `wind_exposure_factors` per-beach (72 directional bins)
- **Automated Retraining**: Weekly pipeline (Sundays 6am UTC) with validation gates
- **Training Data**: 90-day rolling window, max 50K samples

**Data Flow:**
```
NOAA Forecast -> Parse (TS) -> Correct (Python) -> Store (Supabase)
                                    |
                              Backfill Ground Truth
                                    |
                    Weekly Retrain -> Validation Gates -> Deploy
```

**Documentation:**
| Document | Description |
|----------|-------------|
| [ML Bias Correction](features/ML_BIAS_CORRECTION.md) | Feature overview, schema, integration |
| [ML Service](../ml/ARCHITECTURE.md) | Python FastAPI service, XGBoost model |
| [TypeScript Module](../lib/ml/ARCHITECTURE.md) | Parsing utilities |
| [Cron Jobs](../app/api/cron/ml/ARCHITECTURE.md) | Vercel cron configuration |

---

### Terrain Analysis System

**Status**: Implementation in progress

The terrain analysis system encodes beach-specific wind shelter and swell wrap behavior into Quiver's scoring algorithm. This captures surfer intuition like "Beach C fires when wind is SW because the hills block it."

**Components:**
- **Analysis Scripts** (`scripts/terrain/`): CLI pipeline for computing terrain factors
- **Type Definitions** (`types/terrain.ts`): TypeScript types and constants
- **Scoring Integration** (`lib/surf/scoring.ts`): Modified scoring formula

**Key Concepts:**
- 72 directional bins (5-degree resolution) for wind and swell
- Wind exposure: horizon angle analysis with sigmoid transform
- Swell access: direct access + wrap contribution from refraction
- Per-beach `terrain_enabled` flag for staged rollout

**Documentation:**
| Document | Description |
|----------|-------------|
| [Terrain Architecture](../scripts/terrain/ARCHITECTURE.md) | Full system documentation |
| [Surf Scoring](../lib/surf/ARCHITECTURE.md) | Scoring integration details |
| [Design Document](plans/2026-01-20-terrain-geometry-scoring-design.md) | Original design specification |
| [Type Definitions](../types/terrain.ts) | TypeScript types and constants |

**Data Flow:**
```
[DEM Data] --> [Wind Exposure Analysis] --> [wind_exposure_factors]
                                                    |
[Landmask]  --> [Swell Access Analysis]  --> [swell_access_factors]
                                                    |
                                                    v
[Forecast] --> [Modified Scoring] --> [terrain-aware scores]
```

---

### Sitemap

**Status**: Production

Single flat sitemap at `/sitemap.xml` combining all 6 route groups (static, beaches, locations, intents, guides, forecasts) via `Promise.all()`. Reverted from segmented `generateSitemaps()` pattern due to a Next.js 16 bug ([#77304](https://github.com/vercel/next.js/issues/77304)) where the sitemap index at `/sitemap.xml` returns 404.

**Implementation:** `app/sitemap.ts` (single file, ~330 lines)

---

### Intent Pages System

**Status**: Production

The intent pages system serves programmatic SEO landing pages at `/[intent]/[city]` for 7 surf intent types: beginner, least-crowded, tide, water-temp, longboard, dawn-patrol, and sunset.

**URL Pattern**: `/[intent]/[city]` (e.g., `/beginner/san-diego`, `/tide/santa-cruz`)

**Architecture:**
- **Unified Route** (`app/[intent]/[city]/page.tsx`): Single dynamic route handles all 7 intents plus legacy redirects
- **City Resolution**: Batched DB queries via `findCityBySlug()` with state abbreviation fallback
- **Dedicated Intent Pages**: Beginner (`BeginnerPageContent`) and Tide (`TidePageContent`) have fully custom layouts; other intents use a generic template
- **Static Generation**: `generateStaticParams()` produces ~350 pages (50+ cities x 7 intents) plus all 50 US states
- **Design Language**: Frosted glass (`bg-white/60 backdrop-blur-md`), ocean-tinted borders (`border-blue-100/50`), `rounded-2xl` cards
- **ISR**: 30-minute revalidation (`revalidate: 1800`)

**Data Flow:**
```
Route Params → City Resolution → Intent Router
                                      │
                    ┌─────────────────┼─────────────────┐
                    ▼                 ▼                  ▼
              Beginner Page     Tide Page          Generic Template
              (11 components)   (5 components)     (shared components)
```

**Documentation:**
| Document | Description |
|----------|-------------|
| [Intent Components](../components/intent/ARCHITECTURE.md) | Tide page components |
| [Beginner Components](../components/beginner/ARCHITECTURE.md) | Beginner page components |
| [City Editorial](features/CITY_EDITORIAL_CONTENT.md) | Editorial content system |

---

### Forecast Hub

**Status**: Production

The forecast hub provides 7-day regional surf forecast aggregation at `/forecast` (hub) and `/forecast/[region]` (detail pages) across 6 California regions plus Puerto Rico.

**URL Patterns**: `/forecast` (hub), `/forecast/[region]` (e.g., `/forecast/san-diego`)

**Architecture:**
- **Hub Page** (`app/forecast/page.tsx`): Regional forecast cards grid with "Best Conditions Today" highlight
- **Regional Pages** (`app/forecast/[beachId]/page.tsx`): Unified route handling both regional forecasts and beach ID redirects
- **Forecast Components** (`components/forecast/`): `BestDaysSection`, `SwellEventList`, `BeachConditionsGrid`, animated score gauge and wave chart
- **Home Integration**: Forecast outlook section on authenticated home screen

**Data Pipeline:**
```
getBatchFreshForecastsFromCache() → getBeachesForRegion() → aggregateRegionalForecast()
         │                                                            │
         ▼                                                            ▼
  Batch forecast data                                    DaySummary[], SwellEvent[],
  (2 queries for all beaches)                            BeachConditionSummary[]
```

**Documentation:**
| Document | Description |
|----------|-------------|
| [Regional Forecast Utils](../lib/utils/REGIONAL_FORECAST_UTILS_README.md) | Aggregation utilities and types |

---

### User Engagement Tracking

**Status**: Production

Tracks user behavior for implicit preference learning and analytics.

**Components:**
- **PageTracker** (`components/page-tracker.tsx`): Authenticated page view tracking
- **useOnboardingTracking** (`hooks/use-onboarding-tracking.ts`): Onboarding step completion tracking
- **useTrackEvent** (`hooks/use-track-event.ts`): Debounced event firing
- **Events API** (`app/api/events/`): Event ingestion with rate limiting

**Event Types:**
- `page_view`: Page navigation tracking
- `onboarding_step`: Onboarding funnel tracking
- `beach_view`, `discovery_click`: Implicit preference signals

**Privacy & Performance:**
- Respects `allow_implicit_tracking` profile setting
- Rate limited: 60 requests/minute per user
- LRU cache (5000 entries) for tracking permission lookups

---

### Feature Status Highlights

- **Personalization**: "Single User Experience" engine with affinity/history learning, time slot filtering (Jan 2026).
- **Social Platform**: Follows, feeds, likes, comments, real-time updates.
- **Forecasting**: 10-day NOAA integration with confidence scoring.
- **ML Bias Correction**: XGBoost-corrected wave height forecasts.
- **Terrain-Aware Scoring**: Beach-specific wind shelter and swell access factors.
- **Email Engagement**: Automated forecast digests, re-engagement, and weekly recaps (Feb 2026).
- **Media**: Photo upload, galleries, optimized storage.
- **Session Management**: Logging, planning, rich metadata.
- **Attribution**: UTM tracking and referral system for growth analytics.
- **Coverage**: California, Oregon, Washington, Hawaii, Baja California.
- **Intent Pages**: 7 intent types with dedicated beginner and tide experiences across 50+ cities.
- **Forecast Hub**: 7-day regional forecast aggregation across 6 regions with animated UI.
- **City Content Hub**: Editorial-driven beginner and tide pages with live conditions data.

---

### Personalization System

The personalization system provides tailored surf recommendations based on user preferences and conditions.

**Key Components:**
- **Surf Discovery Service** (`lib/services/surf-discovery-service.ts`): Main recommendation engine
- **Personalized Scoring Service** (`lib/services/personalized-scoring-service.ts`): Preference-based scoring
- **Preference Learning Service** (`lib/services/preference-learning-service.ts`): Session history analysis

**Recent Additions (January 2026):**
- **Time Slot Filtering**: Users can filter recommendations by time of day (dawn-patrol, morning, afternoon)
- **Time Slot Capping Algorithm**: Ensures recommended windows respect time slot boundaries

For detailed algorithm documentation, see `lib/services/ARCHITECTURE.md`.

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
| **Architecture** | [Terrain Analysis](../scripts/terrain/ARCHITECTURE.md) | Terrain-aware geometry scoring |
| **Features** | [Attribution Tracking](features/ATTRIBUTION_TRACKING.md) | UTM and referral tracking |
| **Features** | [City Editorial](features/CITY_EDITORIAL_CONTENT.md) | City page content system |
| **Features** | [ML Bias Correction](features/ML_BIAS_CORRECTION.md) | Wave forecast ML correction |
| **Features** | [Re-engagement Email](features/REENGAGEMENT_EMAIL.md) | Inactive user re-engagement emails |
| **Guides** | [Adding States](guides/ADDING_NEW_STATES.md) | Regional expansion guide |
| **Components** | [Intent Components](../components/intent/ARCHITECTURE.md) | Tide intent page components |
| **Components** | [Beginner Components](../components/beginner/ARCHITECTURE.md) | Beginner page components |
| **Features** | [Forecast Hub Utils](../lib/utils/REGIONAL_FORECAST_UTILS_README.md) | Regional forecast aggregation |
| **Features** | [City Editorial](features/CITY_EDITORIAL_CONTENT.md) | City content hub design |
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

### Supabase Access (Remote -> Local)

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
