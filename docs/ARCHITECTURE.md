## Quiver Architecture (Top-Level)

This document is the canonical, high-level overview of Quiver's architecture and an index to detailed docs. It summarizes core patterns, policies, and the current product strategy.

**Last Updated:** August 18, 2026

---

### Stack and System Overview

- **Next.js 16 App Router** (React 19, Server Actions)
- **Supabase** (PostgreSQL, Auth, RLS, Realtime)
- **Tailwind CSS + shadcn/ui**
- **TypeScript** across frontend and backend
- **Python/FastAPI** (ML Service on Fly.io)

**App Status**: Production-ready foundation with comprehensive tests.
**Current Focus**: User acquisition and sustainable growth.

---

### Product Vision and Growth Strategy

**Mission**: A community-driven, trail-style surf app where surfers can plan sessions, share experiences, and build meaningful connections.

**Strategic Focus**: Continue improving the product while prioritizing sustainable user growth.

- **Phase 3A (Weeks 1-8)**: Viral Foundation (Social sharing, summary generation).
- **Phase 3B (Weeks 9-16)**: Network Effects (Community features, buddy finder).
- **Phase 3C (Weeks 17-24)**: Viral Acceleration (Referrals, challenges).

---

### Codebase Layout (Index)

- `app/` - Next.js routes and API routes (see `app/ARCHITECTURE.md`)
- `components/` - Reusable UI, DRY form components (see `components/ARCHITECTURE.md`)
- `hooks/` - Custom React hooks (see `hooks/ARCHITECTURE.md`)
- `actions/` - Web-only server actions (see `actions/ARCHITECTURE.md`)
- `lib/` - Utilities, services, auth, Supabase clients (see local `ARCHITECTURE.md` files under `lib/`)
- `supabase/` - DB migrations, RLS, performance (see `supabase/ARCHITECTURE.md`)
- `types/` - TypeScript domain models (see `types/ARCHITECTURE.md`)
- `test-utils/` - Testing helpers (see `test-utils/ARCHITECTURE.md`)
- `e2e/` - Playwright tests (see `e2e/ARCHITECTURE.md`)
- `scripts/terrain/` - Terrain analysis for geometry scoring (see `scripts/terrain/ARCHITECTURE.md`)

**Primary Reference**: `docs/STYLE_GUIDE.md` (Brand, patterns, accessibility).

**Session Funnel Telemetry**: [`SESSION_FUNNEL_TELEMETRY.md`](SESSION_FUNNEL_TELEMETRY.md)
documents the active web/native event-correlation contract, canonical joins,
platform coverage, and post-release verification.

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
Use the public API wrapper surface for authentication, validation, responses, and
error handling:

```ts
import {
  createSuccessResponse,
  withAuth,
} from "@/lib/middleware/api-wrappers";

export const POST = withAuth(async (request, { user, supabase }) => {
  const result = await processRequest(request, user, supabase);
  return createSuccessResponse(result);
});
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

**Active scheduled email delivery (UTC):**

| Email Type | Vercel Schedule | Purpose |
|------------|-----------------|---------|
| Welcome fallback | `0 */6 * * *` | Deliver a delayed welcome to eligible users missed by the immediate signup path |
| Weekly recap | `0 2 * * 1` | Summarize the prior week's sessions and stats |
| Session prompt | `30 18 * * *` | Prompt eligible users to log a recent session |
| First-session nudge | `30 */6 * * *` | Help new users log their first session |
| Condition-alert delivery | `0 * * * *` | Deliver canonical queued surf-condition alerts |

Immediate welcome delivery is initiated by
`app/api/internal/send-welcome-email/route.ts`; the scheduled welcome job is
its fallback. Forecast Digest is not an active send. Re-engagement and the
legacy `conditions-alert-email` path are retired historical systems and have
no Vercel cron entries. `condition-alert-deliver` is the canonical live
condition-alert sender.

**Components:**
- **Cron Routes**: The five scheduled delivery routes listed above, configured in `vercel.json`
- **Email Templates** (`lib/mailer/templates/`): React Email components
- **Mailer Client** (`lib/mailer/client.ts`): Resend wrapper and unsubscribe-header handling
- **Provider Webhook** (`app/api/webhooks/resend/route.ts`): Signed Svix/Resend provider-event consumer
- **Send Ledger** (`email_send_log`): Outbound send records, provider message IDs, summary delivery timestamps, deduplication, and send analytics
- **Delivery Events** (`email_delivery_events`): Durable delivered, opened, clicked, and bounced provider events, idempotent by Svix webhook message ID
- **Click Events** (`email_click_events`): First-party clicked-link and user-agent records; raw IP addresses are not stored

**Rate Limiting:**
- Active routes apply their route-specific candidate, suppression, cooldown,
  and deduplication rules.
- Canonical condition-alert delivery atomically claims queued work before send.
- Welcome and engagement sends use `email_send_log` for delivery logging and
  deduplication.

### ML System

**Status**: Production (Fly.io)

The ML bias correction pipeline improves NOAA wave height forecast accuracy using XGBoost v3 with terrain-aware features.

**Components:**
- **External ML Service**: Seaside service on Fly.io at `https://quiver-ml.fly.dev`
- **Forecast Data**: Forecast and observation data are stored in Supabase for serving and evaluation

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

Single flat sitemap at `/sitemap.xml` combining route groups for static pages, beaches, locations, intents, guides, forecasts, cams, SEO funnel pages, best-time pages, learn articles, blog posts, and tools via `Promise.all()`. Reverted from segmented `generateSitemaps()` pattern due to a Next.js 16 bug ([#77304](https://github.com/vercel/next.js/issues/77304)) where the sitemap index at `/sitemap.xml` returns 404.

**Implementation:** `app/sitemap.ts` (single flat generator)

The XML emits only `<loc>` and verifiable `<lastmod>` metadata. [Google ignores
`<priority>` and `<changefreq>`](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap),
so Quiver does not emit them. Row-backed routes use row/editorial timestamps,
blog and learn routes use authored publication metadata, and template-backed
route families use the named `SITEMAP_CONTENT_VERSIONS` constants. Update a
family constant only after a significant shared content or template change.

---

### Intent Pages System

**Status**: Production

The intent pages system serves programmatic SEO landing pages at `/[intent]/[city]` for 7 surf intent types: beginner, least-crowded, tide, water-temp, longboard, dawn-patrol, and sunset.

**URL Pattern**: `/[intent]/[city]` (e.g., `/beginner/san-diego`, `/tide/santa-cruz`)

**Architecture:**
- **Unified Route** (`app/[intent]/[city]/page.tsx`): Single dynamic route handles all 7 intents plus legacy redirects
- **City Resolution**: Batched DB queries via `findCityBySlug()` with state abbreviation fallback
- **Dedicated Intent Pages**: Beginner (`BeginnerPageContent`) and Tide (`TidePageContent`) have fully custom layouts; other intents use a generic template
- **Dynamic Rendering**: Pages use `force-dynamic` and render on-demand (no build-time static generation)
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

### Health Monitoring

**Status**: Production (Feb 2026)

Service health monitoring via `/api/health` with optional deep checks.

**Endpoints:**
- `GET /api/health` -- Basic liveness check (Supabase connectivity)
- `GET /api/health?deep=true` -- Deep check including ML pipeline health, forecast freshness, and IOOS station status

**CI Integration:** Service health assertions can be run in CI to catch regressions before deploy. The deep health check validates that ML prediction pipelines, ground truth backfill, and forecast data are within healthy thresholds (see `supabase/ARCHITECTURE.md` for threshold values).

---

### Feature Status Highlights

- **Personalization**: "Single User Experience" engine with affinity/history learning, time slot filtering (Jan 2026).
- **Social Platform**: Follows, feeds, likes, comments, real-time updates.
- **Forecasting**: 10-day NOAA integration with confidence scoring; timezone-correct via `forecast_at` timestamptz column (Feb 2026), replacing legacy text-based `forecast_date`/`forecast_time`.
- **ML Bias Correction**: XGBoost-corrected wave height forecasts.
- **Terrain-Aware Scoring**: Beach-specific wind shelter and swell access factors.
- **Email Engagement**: Welcome, weekly recap, session prompt, first-session nudge, and canonical condition-alert delivery.
- **Media**: Photo upload, galleries, optimized storage.
- **Session Management**: Logging, planning, rich metadata.
- **Attribution**: UTM tracking and referral system for growth analytics.
- **Coverage**: California, Oregon, Washington, Hawaii, Baja California.
- **Intent Pages**: 7 intent types with dedicated beginner and tide experiences across 50+ cities.
- **Forecast Hub**: 7-day regional forecast aggregation across 6 regions with animated UI.
- **City Content Hub**: Editorial-driven beginner and tide pages with live conditions data.
- **Health Monitoring**: Deep service health checks (`/api/health?deep=true`) covering ML pipeline, forecast freshness, and IOOS stations (Feb 2026).

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
| **API** | [API Middleware](API_MIDDLEWARE.md) | Protection wrappers and technical reference appendix |
| **Architecture** | [URL Routing](architecture/URL_ROUTING.md) | Hierarchical URL patterns |
| **Architecture** | [Forecast Scoring](architecture/FORECAST_SCORING.md) | Surf scoring algorithm |
| **Operations** | [Forecast Monitoring](forecast/README.md) | Forecast freshness, recovery, deployment, and cron runbooks |
| **Architecture** | [Cache Strategy](architecture/CACHE_STRATEGY.md) | Multi-tier caching patterns |
| **Architecture** | [Terrain Analysis](../scripts/terrain/ARCHITECTURE.md) | Terrain-aware geometry scoring |
| **Features** | [Attribution Tracking](features/ATTRIBUTION_TRACKING.md) | UTM and referral tracking |
| **Features** | [City Editorial](features/CITY_EDITORIAL_CONTENT.md) | City page content system |
| **Features** | [ML Bias Correction](features/ML_BIAS_CORRECTION.md) | Wave forecast ML correction |
| **Features** | [Re-engagement Email](archive/REENGAGEMENT_EMAIL.md) | Historical design for the retired re-engagement system |
| **Guides** | [Adding States](guides/ADDING_NEW_STATES.md) | Regional expansion guide |
| **Components** | [Intent Components](../components/intent/ARCHITECTURE.md) | Tide intent page components |
| **Components** | [Beginner Components](../components/beginner/ARCHITECTURE.md) | Beginner page components |
| **Features** | [Forecast Hub Utils](../lib/utils/REGIONAL_FORECAST_UTILS_README.md) | Regional forecast aggregation |
| **Features** | [City Editorial](features/CITY_EDITORIAL_CONTENT.md) | City content hub design |
| **Reference** | [Coverage Areas](COVERAGE_AREAS.md) | Geographic coverage details |

---

### Mobile Architecture

Two mobile surfaces coexist:

#### PWA Web App (this repo)
- **Approach**: Next.js web app installable as a PWA
- **Key Components**: PWA manifest, service worker, and web push APIs
- **Use case**: Full web feature parity on mobile browsers and installed PWAs

#### Expo Native App (`../quiver-native`)
- **Repo**: Separate Git repo — `quiver-native`
- **Stack**: Expo 55, React Native 0.83, TanStack Query, Zustand, React Navigation 7
- **Backend**: Shares same Supabase instance (DB + Auth + Storage). Also calls this repo's Next.js API routes for forecasts/surf calls.
- **Docs**: Has its own `AGENTS.md`, model context, `docs/ARCHITECTURE.md`, and inline `ARCHITECTURE.md` files
- **Build**: EAS Build (dev/preview/production profiles) or local `npx expo run:ios/android`
- **Bundle ID**: `app.quiversurf.native`

**Key differences from web:**
| Aspect | Web (PWA) | Native (Expo) |
|--------|----------------|---------------|
| Data fetching | `useDataFetcher` / SWR | TanStack Query |
| Styling | Tailwind + Radix UI | React Native styling |
| State | React Context | Zustand (auth) + TanStack Query (server) |
| Coordinates | `lat`/`lon` for beach rows; `lon`/`longitude` in new API/component shapes | `lat`/`lon` |
| Auth | Supabase Auth | Supabase Auth + SecureStore |

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

---

### Current-Location Weekend Scout

The Expo app's Weekend Scout uses a foreground device fix as its only geographic authority. Native sends fixes captured within 15 minutes to `POST /api/user/location-snapshot`; the server derives the IANA timezone, rounds coordinates to two decimals, and replaces the user's single row. Deleting permission state calls the matching `DELETE` endpoint, so no location history accumulates.

The Friday planning job accepts only location rows no older than 24 hours. It evaluates every eligible beach inside the user's configured drive range, applies canonical Week Scout scoring plus distance friction, and stores an immutable top-three snapshot. Home and saved beaches are labels only and receive no ranking bonus. Stored alert results and live refreshes are exposed separately so notification content remains reproducible when forecasts change.

The cron runs hourly Thursday through Saturday UTC (`0 * * * 4-6`) and filters to exactly Friday 12 PM in each stored location timezone. Rollout preserves the existing `WEEKEND_WINDOW_ENABLED` and `WEEKEND_WINDOW_TEST_USER_IDS` controls. Migration `20260719120000_create_weekend_scout_location_snapshots.sql` is committed but requires a separately approved database application.

---

### Current System Boundaries and Decisions

This section captures durable architecture guidance that was previously only in
the archived system architecture guide. Claims from that guide about retired
Capacitor mobile clients, old dependency choices, historical capacity numbers,
and unverified cost or performance targets are intentionally not carried
forward.

#### Runtime containers

- **Web application**: Next.js 16 App Router with React 19, TypeScript, Tailwind
  CSS, Radix UI, Framer Motion, and Mapbox GL. The web app is installable as a
  PWA.
- **API layer**: Next.js API routes run in the same repository and are protected
  with the shared middleware wrappers in `lib/middleware/api-wrappers/`.
- **Native application**: Expo 55 / React Native 0.83 in the separate
  `../quiver-native` repository. It shares Supabase Auth, database, and storage
  and calls versioned web API routes where required. It is not a Capacitor shell.
- **Backend platform**: Supabase provides PostgreSQL, Auth, RLS, Realtime, and
  Storage. Vercel hosts the web application and serverless routes.

#### Durable architecture decisions

1. **Next.js App Router** is the web application boundary, providing route
   rendering, API routes, and server actions in one codebase.
2. **Supabase** is the shared data and authentication platform. User-data access
   is enforced with RLS, and realtime consumers remove their channels on
   cleanup.
3. **Web/native contracts are additive.** Native-consumed API routes are
   versioned contracts: fields are added rather than renamed, removed, or
   repurposed in place, and failures use real HTTP error statuses.
4. **Server actions are web-only.** Native clients use API routes for writes so
   Bearer authentication is re-established at the route boundary.
5. **Forecasting is service-oriented within the monolith.** Forecast ingestion,
   transformation, storage, scoring, correction, and health monitoring remain
   in the repository's forecast services and cron/API boundaries.

#### Security boundary

The active request path is defense in depth:

1. HTTPS/Vercel edge delivery.
2. Bot blocking and rate limiting where configured.
3. Supabase cookie or Bearer authentication through API middleware.
4. Route-level authorization and ownership checks.
5. Supabase RLS for user-data access.

The canonical middleware behavior, including Next.js 15+ Promise route-param
resolution, is documented in [API Middleware](API_MIDDLEWARE.md). Coordinate
validation is documented in [Coordinate Conventions](COORDINATE_CONVENTIONS.md).

#### Deployment and verification boundary

The repository uses Yarn 1.22.17 and Node 22. The normal local verification
surface is TypeScript, Jest, scoped ESLint, and Playwright as appropriate to the
change. Production deployment is Vercel-backed; remote GitHub Actions are not a
substitute for the local gate because repository Actions are unavailable.
