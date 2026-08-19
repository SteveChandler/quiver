# API Directory Architecture

## Overview

The `/app/api` directory implements a comprehensive REST API layer using Next.js 16 App Router conventions. This API serves as the backend for the Quiver surf community platform, providing data access, authentication, real-time integrations, and automated services across multiple domains.

## Android Install Attribution

- `POST /api/install-attribution/issue` creates a 30-day Google Play referrer token after the guided Android beta handoff unlocks. The database stores only the token's SHA-256 hash and bounded acquisition dimensions.
- `POST /api/install-attribution/redeem` is intentionally public so Android can resolve the Play Install Referrer before authentication. It ignores optional bearer credentials, uses only the static rate limiter, and atomically consumes tokens through the service-role RPC.
- `INSTALL_ATTRIBUTION_ISSUANCE_ENABLED` and `INSTALL_ATTRIBUTION_REDEMPTION_ENABLED` are independent, exact-`true`, default-off controls. Issuance-off returns the ordinary Play listing. Redemption-off returns a retryable unattributed response before any RPC so active tokens remain drainable later.
- Both routes and their explicit Next.js header override use `private, no-store, no-cache, must-revalidate`.
- Schema, replay behavior, rollout approval, and production monitoring are documented in [`docs/install-attribution-runbook.md`](../../docs/install-attribution-runbook.md).

## Android Private Tester Roster

- `POST /api/android-tester-roster/join` is an authenticated, no-store,
  analytics-consent-independent native join. Its strict body contains only the
  native install UUID and a 43-character idempotency key.
- `POST /api/android-tester-roster/first-open` records an explicit server-time
  first-open receipt. `POST /api/android-tester-roster/install` separately
  records bounded install attribution when it exists. Both are authenticated,
  no-store, strict, idempotent, and remain retryable until account join.
- Admin-only no-store routes provide aggregate summary, manual Directory sync,
  one-row audited identity reveal, non-PII export, and explicit manual Play
  evidence. Manual Play evidence is a bounded code plus opaque internal UUID;
  free-form or raw external identity references are rejected. Mandatory audit
  failure blocks the underlying read or change.
- Direct active USER membership in the fixed Google Group is the only automatic
  eligibility source. Directory sync is fail-closed, complete-snapshot-only,
  and database-claimed before Directory fetch through atomic apply.
- See [`docs/android-tester-roster-runbook.md`](../../docs/android-tester-roster-runbook.md)
  for encryption, retention, provisioning, monitoring, and rollout.

## Core Architecture Patterns

### 🔧 **Response Utilities**

- **Centralized Error Handling**: All endpoints use standardized error response utilities
- **Success Response Patterns**: Consistent JSON response structure across all endpoints
- **Validation Helpers**: Reusable validation functions for common patterns
- **Status Code Standards**: HTTP status codes follow REST conventions

### 🔒 **Authentication Strategies**

- **User Authentication**: Supabase JWT token validation for protected routes
- **Admin Authentication**: Role-based access control for administrative endpoints
- **Service Role Authentication**: Internal service-to-service communication
- **Cron Authentication**: Secure token-based authentication for scheduled jobs

### 🚀 **Performance Optimizations**

- **Rate Limiting**: External API rate limiting (NOAA, CDIP) with request tracking
- **Batch Processing**: Optimized batch operations for bulk data updates
- **Caching Strategies**: Multi-level caching for forecast and beach data
- **Database Optimization**: Timeout handling and connection pooling

---

## API Middleware Wrappers

All API routes should use the centralized middleware wrappers from `lib/middleware/api-wrappers/`. These provide authentication, rate limiting, bot blocking, and error handling in a composable pattern.

### Next.js 16 Async Params (CRITICAL)

**Breaking Change:** In Next.js 16, route `params` is a **Promise** that must be awaited before accessing properties like `params.id`.

The API wrappers handle this automatically. When using `withAuth`, `withProtection`, or `createApiHandler`:

- **Handler functions receive already-resolved params** (not a Promise)
- **You can safely access `params.id`** directly in your handler
- **No manual awaiting required** - the wrapper does this for you

```typescript
// CORRECT - params are pre-resolved by the wrapper
export const GET = withAuth(async (request, { user, supabase, params }) => {
  const sessionId = params.id; // Safe - already resolved
  // ...
});

// INCORRECT - DO NOT access params outside the wrapper
export async function GET(request: NextRequest, { params }: RouteContext) {
  const id = params.id; // DANGER: params.id may be undefined in Next.js 16
  // ...
}
```

**Implementation Details:**

The wrappers detect Promise params and resolve them before passing to handlers:

```typescript
// In withAuth and createApiHandler (lib/middleware/api-wrappers/auth-wrapper.ts)
const resolvedParams = context?.params
  ? typeof context.params === "object" && "then" in context.params
    ? await context.params
    : (context.params as Record<string, string>)
  : {};
```

**Type Definitions:**

```typescript
// RouteContext accepts both formats for Next.js compatibility
interface RouteContext {
  params: Record<string, string> | Promise<Record<string, string>>;
}

// Handler context always has resolved params
interface AuthenticatedContext {
  params: ResolvedParams; // Record<string, string> - already resolved
  user: User;
  supabase: SupabaseClient<Database>;
}
```

### Recommended Pattern

```typescript
import { withAuth, type AuthenticatedContext } from "@/lib/middleware/api-wrappers";

async function handler(
  request: NextRequest,
  { user, supabase, params }: AuthenticatedContext
) {
  // params.id is safe to use - already resolved by wrapper
  const { data } = await supabase
    .from("sessions")
    .select("*")
    .eq("id", params.id)
    .eq("user_id", user.id)
    .single();

  return createSuccessResponse({ session: data });
}

export const GET = withAuth(handler);
```

**See Also:**
- `/docs/API_MIDDLEWARE.md` - Developer guide with patterns and usage
- `/docs/API_MIDDLEWARE.md#technical-reference-appendix` - Technical architecture and type definitions

---

## Directory Structure & Endpoint Mapping

### 📁 `/admin` - Administrative Operations

**Access Level**: Admin-only
**Authentication**: Role-based admin verification

#### `/admin/cleanup-inactive-buoys/route.ts`

- **Methods**: `POST`, `GET`
- **Function**: Maintains buoy data quality through automated cleanup
- **Features**:
  - Dry-run mode for testing
  - Configurable removal vs deactivation
  - Batch processing with progress tracking
- **Security**: Development mode bypass, Bearer token authentication
- **Usage**: Scheduled maintenance operations

#### `/admin/sync-buoys/route.ts`

- **Methods**: `POST`, `GET`
- **Function**: Synchronizes NOAA buoy data for beach coverage areas
- **Features**:
  - Geographic filtering (200km radius from beaches)
  - Service role and admin authentication support
  - Configurable distance parameters
- **Data Source**: NOAA NDBC (National Data Buoy Center)
- **Performance**: Rate limiting integration

#### `/admin/update-buoy-conditions/route.ts`

- **Methods**: `POST`, `GET`
- **Function**: Updates real-time buoy conditions
- **Features**:
  - Development mode authentication bypass
  - Batch condition updates
  - Success/failure tracking
- **Data Source**: NOAA real-time feeds
- **Scheduling**: Designed for cron job integration

#### `/admin/test-push/route.ts`

- **Methods**: `GET`, `POST`
- **Access Level**: Admin-only
- **Function**: Sends a test push notification to the currently authenticated admin user (end-to-end verification).
- **Service Layer**: `lib/services/push-notifications.ts` (`sendPushNotification()`)

---

### 📊 `/analytics` - User Analytics & Insights

#### `/analytics/sessions/route.ts`

- **Methods**: `GET`, `PATCH`
- **Authentication**: User session validation
- **Function**: Provides session analytics and privacy controls
- **Implementation**: Reads analytics and calendar data from `lib/analytics/session-analytics.ts`
- **Features**:
  - User-specific data isolation (`userId=me` pattern)
  - Calendar heatmap data generation
  - Session privacy controls
  - Aggregated statistics

**Query Parameters**:

- `userId`: User identifier (`me` for current user)
- `type`: `analytics` | `calendar`
- `year`, `month`: For calendar data filtering

---

### 🔐 `/auth` - Authentication System

**Provider**: Supabase Auth
**Runtime**: Edge functions for optimal performance

**Cookie Migration (February 2026)**: All auth routes have been migrated from the deprecated `get`/`set`/`remove` cookie interface to `getAll`/`setAll` per `@supabase/ssr` v0.8.0. This ensures atomic read/write of chunked session cookies and prevents silent session corruption. See `lib/supabase/ARCHITECTURE.md` for the full migration inventory.

#### `/auth/[...supabase]/route.ts`

- **Methods**: `GET`, `POST`, `DELETE`
- **Function**: Core authentication operations
- **Features**:
  - Session management with secure cookies
  - Sign-in/sign-out operations
  - Token refresh handling
- **Edge Runtime**: Optimized for global distribution

#### `/auth/check-session/route.ts`

- **Methods**: `GET`
- **Function**: Session validation endpoint
- **Usage**: Client-side authentication state verification
- **Response**: Session existence and basic user data

#### `/auth/refresh-session/route.ts`

- **Methods**: `POST`
- **Function**: Automatic token refresh
- **Features**:
  - Graceful session restoration
  - Error handling for expired sessions
  - Secure token rotation

#### `/auth/supabase/resend-confirmation/route.ts`

- **Methods**: `POST`
- **Function**: Email confirmation resend utility
- **Usage**: Account verification flows
- **Integration**: Supabase email service

---

### 🏖️ `/beaches` - Location Data Management

#### `/beaches/route.ts`

- **Methods**: `GET`, `POST`
- **Function**: Beach location CRUD operations
- **Features**:
  - Public beach listing (GET)
  - Admin-only creation/updates (POST)
  - Geospatial data management

#### `/beaches/nearby/route.ts`

- **Methods**: `GET`
- **Authentication**: Admin-only access
- **Function**: Geospatial beach queries
- **Features**:
  - Distance-based filtering
  - Configurable radius and limits
  - Geographic coordinate validation
- **Usage**: Internal API for location services

**Query Parameters**:

- `latitude`, `longitude`: Required coordinates
- `maxDistance`: Search radius (default: 30 miles)
- `limit`: Result count (default: 20)

---

### 🏄‍♂️ `/boards` - Surfboard Management

#### `/boards/route.ts`

- **Methods**: `POST`
- **Authentication**: User session required
- **Function**: User surfboard creation and management
- **Features**:
  - User-specific board data
  - Session count tracking
  - Automatic profile page revalidation
- **Integration**: Session logging system

---

### 🌊 `/buoys` - Real-time Oceanographic Data

#### `/buoys/conditions/route.ts`

- **Methods**: `GET`
- **Function**: Current buoy conditions lookup
- **Data Sources**: NOAA NDBC real-time feeds
- **Features**:
  - Wind direction calculation
  - Multi-parameter condition data
  - Geospatial fallback queries
- **Fallback Strategy**: PostGIS function compatibility handling

#### `/buoys/nearby/route.ts`

- **Methods**: `GET`
- **Function**: Geographic buoy discovery
- **Features**:
  - Distance-based filtering
  - Real-time condition integration
  - Configurable result limits
- **Query Parameters**:
  - `latitude`, `longitude`: Required coordinates
  - `limit`: Result count (default: 4)
  - `maxDistance`: Search radius (default: 100km)

---

### ⏰ `/cron` - Scheduled Job Management

**Authentication**: Vercel Cron header or cron token
**Usage**: Automated data synchronization

#### `/cron/enhanced-forecast-sync/route.ts`

- **Methods**: `POST`, `GET`
- **Function**: Comprehensive NOAA data synchronization
- **Features**:
  - Multi-source data integration (CDIP, NOAA)
  - Rate limiting compliance
  - Batch processing with delays
  - Geographic filtering (Southern California focus)
  - Health check endpoint
- **Performance**:
  - 2-beach batch size to prevent database timeouts
  - 2-second inter-batch delays
  - Timeout handling and recovery

**Invocation & Security**:

- Triggered exclusively via Vercel Cron as configured in `vercel.json`
- Authorization uses centralized validator `validateCronRequest(request)` from `@/lib/middleware/api-wrappers`
  - Accepts `x-vercel-cron` header (added by Vercel) OR `Authorization: Bearer <CRON_SECRET>`
  - Keep `CRON_SECRET` in Vercel env if you need to trigger manually

#### `/cron/enhanced-forecast-sync-offset/route.ts`

- **Methods**: `POST`, `GET`
- **Function**: Alias entrypoint for the enhanced forecast sync job.
- **Why it exists**: Enables an effective **90-minute** cron cadence without relying on multiple cron entries targeting the same path.
  - Scheduled alongside `/api/cron/enhanced-forecast-sync` in `vercel.json` (staggered schedules).

#### `/cron/first-session-nudge/route.ts`

- **Methods**: `GET`
- **Schedule**: Every 6 hours (`30 */6 * * *` per `vercel.json`)
- **Authentication**: Vercel Cron header (`x-vercel-cron`) OR `Authorization: Bearer <CRON_SECRET>`
- **Function**: Sends "Your first forecast is waiting" email to users who signed up 18-30h ago with zero sessions
- **Features**:
  - Deduplication via `email_send_log` table
  - 24h global email cooldown (no emails sent if user received any email in last 24h)
  - Batched auth queries (5 concurrent) for efficient email lookups
  - Rate-limited sending via `createResendRateLimiter()`
- **Email Type**: `first_session_nudge`
- **Template**: `FirstSessionNudgeEmail` with quick-log CTA
- **Service Layer**: `lib/services/email-logging-service.ts`, `lib/utils/email-rate-limiter.ts`

### 🔮 `/forecasts` - Surf Forecast System

**Data Sources**: NOAA WaveWatch III, CO-OPS, Weather Service, NDBC

#### `/forecasts/update/route.ts`

- **Methods**: `POST`, `GET`
- **Function**: Manual forecast update triggers
- **Features**:
  - Single beach or bulk updates
  - Enhanced forecast system integration
  - Success/failure reporting
- **Usage**: Administrative operations and manual refreshes

#### `/forecasts/update-enhanced/route.ts`

- **Methods**: `POST`, `GET`
- **Function**: Advanced forecast generation and retrieval
- **Features**:
  - Automatic staleness detection (6-hour threshold)
  - Fresh data generation when needed
  - CDIP integration for enhanced accuracy
  - Comprehensive error handling
- **Caching Strategy**: Intelligent refresh based on NOAA update cycles

---

### 🏥 `/health` - System Health Monitoring

#### `/health/route.ts`

- **Methods**: `GET`
- **Function**: Basic health check endpoint
- **Usage**: Load balancer health checks, uptime monitoring
- **Response**: Service status and timestamp

---

### 📹 `/hls-proxy` - HLS Video Stream Proxy

**Access Level**: Public (unauthenticated)
**Authentication**: None (rate limited by IP)

#### `/hls-proxy/[...path]/route.ts`

- **Methods**: `GET`
- **Function**: Server-side proxy for CORS-blocked HLS live cam streams
- **Why it exists**: Surfline's HLS CDN (`hls.cdn-surfline.com`) blocks cross-origin requests. Chrome and Firefox use hls.js which makes XHR/fetch calls subject to CORS policy. Safari plays HLS natively without CORS issues, so the proxy is only needed for non-Safari browsers.
- **Path Design**: URL encodes the upstream hostname and path: `/api/hls-proxy/<hostname>/<rest-of-path>`. This path-based design means relative segment URLs inside `.m3u8` manifests (e.g., `segment_001.ts`) resolve through the proxy automatically without rewriting manifest content.

**Security**:

- Strict hostname whitelist (`ALLOWED_HOSTS`) -- prevents use as an open proxy / SSRF vector. Currently allows only `hls.cdn-surfline.com`.
- Path traversal validation (rejects `..` and `.` segments)
- Request timeout: 15 seconds
- Response size limit: 10 MB (typical HLS segments are 2-6 MB)
- Rate limiting via `withRateLimit("hls-proxy")`: 120 req/min, 5000 req/hour, burst 60

**Upstream Request Headers**:

- Per-host header injection (e.g., `Referer: https://www.surfline.com/` for Surfline)
- Browser-like `User-Agent`
- Forwards `Range` header for partial segment loads

**Caching**:

| Resource Type | `Cache-Control` |
|---------------|-----------------|
| `.m3u8` manifests | `public, max-age=2, stale-while-revalidate=5` (live stream, must refresh frequently) |
| `.ts` / `.aac` segments | `public, max-age=3600, immutable` (immutable once written) |
| Other | `public, max-age=60` |

**Monitoring**:

- Structured `console.log("[hls-proxy]", { host, path, type, bytes, ms })` on every proxied request (visible in Vercel Logs)
- `X-HLS-Proxy-Host`, `X-HLS-Proxy-Bytes`, `X-HLS-Proxy-Ms` response headers for debugging
- Warnings logged for blocked hosts and upstream errors

**Error Responses**:

| Status | Condition |
|--------|-----------|
| 400 | Missing or invalid path, path traversal attempt |
| 403 | Hostname not in whitelist |
| 413 | Response exceeds 10 MB limit |
| 429 | Rate limit exceeded |
| 502 | Upstream fetch error |
| 504 | Upstream request timed out (15s) |

**Integration**: Called by `HLSVideoPlayer` component (`components/beach-detail/hls-video-player.tsx`). Proxy URL rewriting happens in `buildCamEmbed()` (`lib/media/cam-embed.ts`) which converts `https://hls.cdn-surfline.com/...` to `/api/hls-proxy/hls.cdn-surfline.com/...`.

**Adding a new HLS host**: Add an entry to `ALLOWED_HOSTS` in the route file with any required upstream headers. No other changes needed -- the proxy is host-agnostic by design.

---

### 🖼️ `/og` - Open Graph Image Generation

**Access Level**: Public (unauthenticated)
**Runtime**: Edge

#### `/og/beach/route.tsx`

- **Methods**: `GET`
- **Function**: Generates dynamic 1200x630 OG images for beach social sharing
- **Query Parameters**: `slug` (beach slug, lowercase alphanumeric with hyphens)
- **Features**:
  - Fetches beach data from Supabase (name, city, state, average_rating, review_count, break_type)
  - Renders styled PNG with dark gradient, star ratings, break type badge
  - Falls back to generic Quiver-branded image on any error
  - Input validation: slug format (`/^[a-z0-9-]+$/`), max length 200
  - Environment variable validation before Supabase client creation
- **Caching**: `public, max-age=86400, s-maxage=86400, stale-while-revalidate=604800`
- **Dependencies**: `next/og` (ImageResponse), `@supabase/supabase-js`

#### `/og/session/route.tsx`

- **Methods**: `GET`
- **Function**: Generates session share images (1080x1920 portrait)
- **Query Parameters**: `beach`, `rating`, `stars`, `size`, `board`, `date`, `windLabel`, `windSpeed`, `tagline`, `footer`, `bg`
- **Features**: Background image with overlay, star ratings, wave/wind info

---

### 📊 `/events` - User Engagement Tracking

#### `/events/route.ts`

- **Methods**: `POST`
- **Authentication**: Required (user session)
- **Function**: Records user behavioral events for implicit preference learning and analytics
- **Features**:
  - Privacy-aware: Reads `allow_implicit_tracking` through the owner-only `get_my_analytics_tracking_allowed` RPC
  - Per-user rate limiting (60 requests/minute)
  - LRU cache (5000 entries) for denials only; allowed consent is rechecked so revocation is immediate
  - Debounced event processing on client side

**Event Types:**

| Category | Events | Description |
|----------|--------|-------------|
| Implicit Preferences | `beach_view`, `discovery_click`, `discovery_skip`, `forecast_check`, `location_update` | Signals for preference learning |
| Engagement Tracking | `page_view`, `forecast_interaction`, `session_action`, `profile_update`, `onboarding_step`, `cta_click` | Analytics and funnel tracking |

**Request Body:**

```typescript
{
  eventType: ImplicitEventType;   // Required: one of the valid event types
  beachId?: string;               // Optional: associated beach UUID
  metadata?: Record<string, any>; // Optional: additional event context
}
```

**Response:**

```json
// Success
{ "ok": true }

// Tracking disabled by user
{ "ok": true, "status": "tracking_disabled" }

// Rate limited (429)
{
  "ok": false,
  "status": "rate_limited",
  "error": "Too many requests. Please try again later."
}
```

**Rate Limiting Headers (429 response):**

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Max requests per window (60) |
| `X-RateLimit-Remaining` | Remaining requests (0 when limited) |
| `X-RateLimit-Reset` | Unix timestamp when limit resets |
| `Retry-After` | Seconds until retry allowed |

**Database:**

| Table | Operation | Description |
|-------|-----------|-------------|
| `get_my_analytics_tracking_allowed` | RPC | Check the authenticated owner's private analytics-consent setting |
| `user_events` | INSERT | Store event with user_id, event_type, beach_id, metadata |

**Integration:**

- **PageTracker** component fires `page_view` events on navigation
- **useOnboardingTracking** hook fires `onboarding_step` events
- **useTrackEvent** hook provides debounced event firing

---

### 📍 `/intel` - Community Intelligence System

#### `/intel/route.ts`

- **Methods**: `GET`, `POST`
- **Function**: Location-based community intelligence
- **Features**:
  - Geospatial post discovery
  - Tag-based filtering (parking, hazards, conditions, etc.)
  - Community confirmation system
  - Auto-expiring posts (1-7 days based on type)
- **Validation**: Comprehensive input validation and sanitization

#### `/intel/[id]/confirm/route.ts`

- **Methods**: `POST`, `DELETE`
- **Function**: Community confirmation system
- **Features**:
  - User confirmation tracking
  - Duplicate prevention
  - Real-time confirmation counts
- **Security**: Users cannot confirm their own posts

**Intel Post Types**:

- `parking`: Parking availability/restrictions
- `hazard`: Safety hazards and warnings
- `crowd`: Current crowd conditions
- `conditions`: Real-time surf conditions
- `access`: Beach access information
- `other`: General community information

---

### 📓 `/journal` - Session Journaling & Export

#### `/journal/export/route.ts`

- **Methods**: `POST`
- **Function**: PDF export generation for user sessions
- **Features**:
  - Customizable export options
  - Analytics integration
  - Temporary download URL generation
- **Security**: User data isolation and authentication

### 📸 `/sessions/[id]/photos` - Session Photo Media

#### `/sessions/[id]/photos/route.ts`

- **Methods**: `GET`, `POST`
- **Authentication**: Optional for public-session reads; required for uploads and private-session reads
- **Function**: Lists session media and uploads owner-scoped session photos
- **Policy**: `lib/media/session-photo-policy.ts` owns the accepted MIME types, 10 MiB input limit, and 5 MiB storage limit
- **Behavior**: Upload failures return the established validation or stage-specific HTTP error responses and never return a successful response for a failed write

---

### 🎯 `/me` - Current User Data

**Authentication**: All endpoints require user session (via `withAuth` wrapper)
**Rate Limiting**: Applied via `withRateLimit` wrapper

#### `/me/milestones/route.ts`

- **Methods**: `GET`, `PATCH`
- **Authentication**: `withAuth` wrapper
- **Rate Limiting**: `withRateLimit` (10 req/min per user)
- **Function**: Manages personalization milestone notifications for toast display
- **Features**:
  - GET: Fetches unshown milestones for the current user
  - PATCH: Marks milestones as shown (sets `shown_at` timestamp)
  - Validates milestone keys against `PERSONALIZATION_MILESTONES` constant
  - Detection runs inline via fire-and-forget calls (no redundant home screen checks)
- **Used By**: `use-personalization-milestones` hook
- **Service Layer**: `lib/services/personalization-milestone-service.ts`

---

### 📱 `/recent-posts` - Social Feed

#### `/recent-posts/route.ts`

- **Methods**: `GET`
- **Function**: Recent community activity aggregation
- **Features**:
  - Social feed data compilation
  - Activity timeline generation
- **Usage**: Home screen social features

---

### 🏄‍♀️ `/surf` - Core Surf Forecast API

**Documentation**: Comprehensive README with examples

#### `/surf/route.ts`

- **Methods**: `GET`
- **Function**: Primary surf forecast endpoint
- **Features**:
  - Beach name or coordinate-based queries
  - Multi-source data aggregation
  - Smart data normalization
  - Confidence scoring
- **Flexibility**: Supports both named beaches and arbitrary coordinates

#### `/surf/utils.ts`

- **Function**: Core forecast processing utilities
- **Features**:
  - Beach resolution and caching
  - Distance calculations
  - Forecast data aggregation
- **Caching**: Optimized beach lookup with geographic indexing

**Query Parameters**:

- `beach`: Beach name (e.g., "Ocean Beach")
- `lat`, `lon`: Geographic coordinates (alternative to beach name)

#### `/surf/insights/route.ts`

- **Methods**: `GET`
- **Authentication**: Required (user session)
- **Function**: Returns personalized insights comparing current forecast to user's past high-rated sessions
- **Features**:
  - ML-powered session matching using bucket-based similarity scoring
  - Three response states: ready, onboarding, degraded
  - Board recommendations when pattern detected (≥60% of similar sessions used same board)
  - Cross-spot explanations when >50% of matches are from different beaches
  - Top 5 similar sessions ranked by similarity score
- **Query Parameters (Required)**:
  - `beachId`: Beach UUID
  - `beachName`: Beach name
  - `waveHeight`: Wave height in feet (0-50)
  - `wavePeriod`: Wave period in seconds (0-30)
  - `windSpeed`: Wind speed in mph (0-100)
- **Query Parameters (Optional)**:
  - `windDirection`: Wind direction in degrees (0-360)
  - `tideHeight`: Tide height in feet (-5 to 15)
  - `tideStatus`: Tide status (e.g., "Rising", "High Slack")
  - `windowStart`: ISO timestamp for forecast window
- **Rate Limit**: 10 requests/minute
- **Caching**: Private per-user cache (5 minutes)
- **Response**: `PersonalizedInsights`
  - `matchPercent`: Overall similarity percentage (0-100)
  - `label`: Match quality ("Perfect" ≥80%, "Great" 60-79%, "Good" 40-59%, "Low" <40%)
  - `reasonBullets`: 2-4 explanation bullets
  - `similarSessions`: Top 5 similar sessions with conditions and board info
  - `boardTip`: Board recommendation if majority pattern detected (≥60% threshold)
  - `sessionCount`: Total rated sessions in user's history
  - `state`: "ready" (≥3 sessions), "onboarding" (<3 sessions), or "degraded" (no forecast snapshots)
- **Service Layer**: `lib/services/similarity-insights-service.ts`
- **Algorithm Details**:
  - Weighted similarity scoring: wave height (35%), wave period (25%), wind speed (20%), wind direction (10%), tide (10%)
  - Bucket-based matching for robustness (e.g., 2-4 ft waves, 8-12s period)
  - Adjacent bucket matches receive 50% credit
  - Minimum similarity threshold: 60% to be included in results
  - Lookback period: 12 months of completed sessions rated ≥3 stars

---

## Cross-Cutting Concerns

### 🛡️ **Security Architecture**

#### Authentication Patterns

- **JWT Validation**: Supabase token verification for protected routes
- **Role-Based Access**: Admin role verification for sensitive operations
- **Service Authentication**: Internal service-to-service communication
- **Request Validation**: Comprehensive input sanitization and validation

#### Authorization Levels

- **Public**: No authentication required (health, some forecast data)
- **User**: Standard user authentication (sessions, boards, intel)
- **Admin**: Administrative privileges (beach management, system operations)
- **Service**: Internal service operations (cron jobs, data sync)

### 🚀 **Performance Architecture**

#### Rate Limiting

- **External API Protection**: NOAA and CDIP API rate limiting
- **Request Tracking**: API usage monitoring and throttling
- **Graceful Degradation**: Fallback strategies for rate limit scenarios

#### Caching Strategies

- **Multi-Level Caching**: Database, application, and browser caching
- **Cache Invalidation**: Smart cache refresh based on data staleness
- **Geographic Caching**: Location-based cache optimization

#### Database Optimization

- **Connection Pooling**: Efficient database connection management
- **Batch Processing**: Optimized bulk operations
- **Timeout Handling**: Graceful handling of long-running operations

### 📊 **Data Integration**

#### External Data Sources

- **NOAA APIs**: Weather, oceanographic, and forecast data
- **CDIP**: California Data Information Program wave monitoring
- **Supabase**: Authentication, database, and storage services

#### Data Synchronization

- **Scheduled Updates**: Automated data refresh cycles
- **Real-time Integration**: Live condition monitoring
- **Conflict Resolution**: Data consistency and conflict handling

### 🔧 **Error Handling Patterns**

#### Centralized Error Management

```typescript
// Standardized error response utilities
import {
  createSuccessResponse,
  createValidationError,
  createAuthError,
  handleApiError,
} from "@/lib/middleware/api-wrappers";
```

#### Error Categories

- **Validation Errors**: Input validation and sanitization failures
- **Authentication Errors**: Authorization and access control issues
- **Database Errors**: Data persistence and retrieval failures
- **External API Errors**: Third-party service integration issues
- **System Errors**: Internal server errors and exceptions

### 📈 **Monitoring & Observability**

#### Health Monitoring

- **Health Check Endpoints**: System status verification
- **Performance Metrics**: Response time and throughput tracking
- **Error Rate Monitoring**: Failure detection and alerting

#### Logging Strategies

- **Structured Logging**: Consistent log format across endpoints
- **Debug Information**: Development-mode enhanced logging
- **Error Tracking**: Comprehensive error capture and reporting

## Deployment Considerations

### 🌐 **Serverless Architecture**

- **Auto-Scaling**: Automatic scaling based on request volume
- **Cold Start Optimization**: Edge runtime for critical paths
- **Resource Management**: Efficient memory and CPU utilization

### 🔄 **Continuous Integration**

- **API Testing**: Comprehensive endpoint testing strategies
- **Performance Testing**: Load testing and optimization
- **Security Testing**: Vulnerability scanning and penetration testing

### 📱 **Mobile Optimization**

- **Response Size**: Optimized payload sizes for mobile networks
- **Offline Support**: Caching strategies for offline functionality
- **Progressive Enhancement**: Graceful degradation for limited connectivity

## Future Expansion

### 🎯 **Planned Enhancements**

- **GraphQL Integration**: Advanced query capabilities
- **WebSocket Support**: Real-time data streaming
- **Machine Learning**: Enhanced recommendation algorithms
- **Multi-Region Deployment**: Global content delivery optimization

### 🔧 **Scalability Roadmap**

- **Microservices Migration**: Service decomposition for scale
- **Event-Driven Architecture**: Asynchronous processing patterns
- **Advanced Caching**: Redis integration for high-performance caching
- **API Gateway**: Centralized API management and routing

---

### ⏰ `/cron/forecasts/refresh` - Forecast Table Refresh

#### `/cron/forecasts/refresh/route.ts`

- **Methods**: `GET`
- **Authentication**: `validateCronRequest(request)` accepts `x-vercel-cron` or `Authorization: Bearer <CRON_SECRET>`
- **Function**: Refreshes normalized forecast tables for all beaches (or a single beach via `?beachId=`)
- **Pipeline**:
  1. Beaches query: selects beaches with non-null `latitude/longitude`; optional filter by `beachId`
  2. Marine (Observed + Short-Horizon Persistence):
     - Primary: NDBC nearest station → latest observation upserted into `marine_forecasts` with `is_observed=true`
     - Fallback: CDIP nearest station (≤80km) → last 24h observations (feet→meters) upserted, `is_observed=true`
     - Persistence projection: carry-forward latest observed values hourly for the next 12h with source suffix `ndbc_persistence`/`cdip_persistence`, `is_observed=false`
  3. Tides:
     - Primary: NOAA Tides & Currents hourly predictions (start → +30 days) into `tide_forecasts`; refreshed twice weekly and read from cache by public tide tools
     - Fallback: If hourly empty, fetch CO-OPS hilo extremes and interpolate to hourly heights; source `noaa_hilo_interpolated`
  4. Sun:
     - Compute sunrise/sunset for the next 5 days using `SunCalc` and upsert into `sun_times` with `source='computed'`
- **Upsert Keys**: `onConflict` by `(beach_id, ts, source)` for marine/tide; `(beach_id, date, source)` for sun
- **Returns**: `{ totals: { marine, tides, sun, beaches } }`
- **Notes**: No Open-Meteo dependency; prioritizes observed data and fills short-term gaps to improve Best Times coverage

---


---

### Weekend Scout Native APIs

- `POST /api/user/location-snapshot` accepts only foreground fixes captured within 15 minutes, derives timezone server-side, rounds coordinates to two decimals, and replaces the authenticated user's one location row. `DELETE` removes that row.
- `POST /api/surf/week-scout/weekend` builds a non-persisted Saturday/Sunday ranking from the latest server location. Clients never send coordinates or candidate IDs to this route.
- `GET /api/surf/week-scout/snapshots/[snapshotId]` returns an immutable alert snapshot scoped by both snapshot ID and authenticated user ID.
- Successful responses are `private, no-store`; both Weekend Scout read routes preserve the existing `WEEKEND_WINDOW_ENABLED` gate and use the `surf-discovery` rate limit.
- `/api/cron/weekend-window` runs hourly Thursday through Saturday UTC and filters eligible users to local Friday at 12 PM. Its payload contains only snapshot ID, weekend dates, count, and lead summary—never coordinates or full ranking evidence.
