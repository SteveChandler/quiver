# API Directory Architecture

## Overview

The `/app/api` directory implements a comprehensive REST API layer using Next.js 13+ App Router conventions. This API serves as the backend for the Quiver surf community platform, providing data access, authentication, real-time integrations, and automated services across multiple domains.

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

---

### 📊 `/analytics` - User Analytics & Insights

#### `/analytics/sessions/route.ts`

- **Methods**: `GET`, `PATCH`
- **Authentication**: User session validation
- **Function**: Provides session analytics and privacy controls
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

### 💾 `/cache` - Caching System Management

#### `/cache/status/route.ts`

- **Methods**: `GET`
- **Function**: Cache health monitoring
- **Features**:
  - Pacific Beach cluster cache status
  - Forecast data freshness tracking
  - Performance metrics
- **Usage**: System monitoring and debugging

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
- Authorization uses centralized validator `validateCronRequest(request)` from `lib/api-response-utils.ts`
  - Accepts `x-vercel-cron` header (added by Vercel) OR `Authorization: Bearer <CRON_SECRET>`
  - Keep `CRON_SECRET`/`CRON_SECRET_TOKEN` in Vercel env if you need to trigger manually

#### `/cron/enhanced-forecast-sync-offset/route.ts`

- **Methods**: `POST`, `GET`
- **Function**: Alias entrypoint for the enhanced forecast sync job.
- **Why it exists**: Enables an effective **90-minute** cron cadence without relying on multiple cron entries targeting the same path.
  - Scheduled alongside `/api/cron/enhanced-forecast-sync` in `vercel.json` (staggered schedules).

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

---

### 🎯 `/plan-session` - Session Planning

#### `/plan-session/route.ts`

- **Methods**: `POST`
- **Function**: Future session planning with forecast integration
- **Features**:
  - Forecast data integration
  - Session scheduling
  - User preference tracking

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

### 🗓️ `/session-planner` - Advanced Planning Tools

#### `/session-planner/gear-suggestions/route.ts`

- **Methods**: `GET`
- **Function**: AI-powered surfboard recommendations
- **Features**:
  - Historical session analysis
  - Condition-based board matching
  - Confidence scoring
  - User preference learning
- **Algorithm**: Machine learning-based recommendation engine

#### `/session-planner/invitations/route.ts`

- **Methods**: `POST`, `GET`, `PATCH`
- **Function**: Session buddy system
- **Features**:
  - Email and user-based invitations
  - Status tracking (pending, accepted, declined, revoked)
  - Invitation management
  - Idempotency via optional `Idempotency-Key` header persisted on invitations
  - In-app activity created on invite (`user_activities` → `session_invite.created`)
  - Email via Resend when invitee has `email_session_invites` enabled
  - Per-invitee uniqueness enforced: `unique(session_id, invitee_id)` and `unique(session_id, invitee_email)`
  - Profile preferences extended: `inapp_session_invites`, `email_session_invites`, `digest_session_invites`
  - Acceptance auto-adds participant (trigger)
  - **Scope**: Notifications are only generated from plan-session tagging flow
  - **Social Features**: Community building and session coordination

#### `/session-planner/optimal-times/route.ts`

- **Methods**: `GET`
- **Function**: Forecast-based optimal timing analysis
- **Features**:
  - Multi-factor condition analysis
  - Quality scoring (poor/fair/good/excellent)
  - Time window optimization
  - Confidence-based recommendations
- **Data Integration**: Real-time forecast analysis

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
- `lat`, `lng`: Geographic coordinates (alternative to beach name)

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
} from "@/lib/api-utils";
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

### 🌅 `/recommendations/morning` - Near-Term Session Picks

#### `/recommendations/morning/route.ts`

- **Methods**: `POST`, `GET`
- **Function**: Returns the best near-term 2-hour surf windows around a user-provided location.
- **Inputs**:
  - `POST` JSON: `{ lat: number, lon: number, radius_km?: number = 25, tz?: string = 'America/Los_Angeles', horizon_hours?: number = 5 }`
  - `GET` query: `lat`, `lon`, optional `radius_km`, `date_local`, `tz`, `horizon_hours` (validated via `zod`)
- **Time Window Logic**:
  - If current local time is dark: use tomorrow's sunrise → up to 5 hours or 11:00 local, whichever is earlier
  - Else: from now (clamped to sunrise) → min(sunset, now + `horizon_hours`)
- **Data Sources** (see `lib/surf/`):
  - `getBeachesNear(lat, lon, radius_km)`
  - `getMarineForecastRange(beachId, startUtc, endUtc)`
  - `getTideForecastRange(beachId, startUtc, endUtc)`
  - Warms `sun_times` via `getSunTimes(beachId, localDateStr, lat, lon)`
- **Scoring**:
  - Limits candidate beaches to top 8 by distance before scoring to reduce load
  - Computes top windows per-beach using `topWindowsInRange` (120-minute windows)
  - Sorts by `meanScore` descending; returns top 3 cards via `windowBlurbDetailed`
  - Ensures non-overlapping windows in final selection to avoid double-booking
- **Outputs**:
  - `{ mode: 'tomorrow_morning' | 'next_windows', title, range_local: { start, end, tz }, picks: Card[] }`
- **Usage**:
  - Warmed on mount by `HomeScreen` and `PlanSessionPage` when `useGeo` yields coordinates
- **Caching**:
  - Thin in-memory cache via `apiCache` keyed by `geohash(lat,lon,4)|localDate|radius|horizon|tz`
  - TTL ~12 minutes (10–15 min window) to avoid hammering DB while staying fresh
- **SQL Precompute**:
  - Materialized view `public.mv_beach_hourly_scores` pre-joins `marine_forecasts` and `tide_forecasts` at exact timestamps for rapid reads
  - Columns: `beach_id, ts_utc, hs_m, tp_s, swell_dir_deg, wind_spd_kts, wind_dir_deg, tide_ft, score_0_100`
  - Indexed by `(beach_id, ts_utc)`; refreshed via `public.refresh_mv_beach_hourly_scores()`
  - Periodic refresh scheduled every ~2h with `refresh_mv_beach_hourly_scores_and_analyze()` (pg_cron when available)

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
     - Primary: NOAA Tides & Currents hourly predictions (start → +5 days) into `tide_forecasts`
     - Fallback: If hourly empty, fetch CO-OPS hilo extremes and interpolate to hourly heights; source `noaa_hilo_interpolated`
  4. Sun:
     - Compute sunrise/sunset for the next 5 days using `SunCalc` and upsert into `sun_times` with `source='computed'`
- **Upsert Keys**: `onConflict` by `(beach_id, ts, source)` for marine/tide; `(beach_id, date, source)` for sun
- **Returns**: `{ totals: { marine, tides, sun, beaches } }`
- **Notes**: No Open‑Meteo dependency; prioritizes observed data and fills short-term gaps to improve Best Times coverage

---

### 🏠 `/home/personalized-forecast` - Personalized Home Screen Recommendations

#### `/home/personalized-forecast/route.ts`

- **Methods**: `GET`
- **Authentication**: Required (user session)
- **Function**: Returns personalized surf recommendation for home screen
- **Features**:
  - Builds candidate pool from user's home beach and favorites
  - Scores beaches using personalized-scoring-service (affinity, preferences)
  - Selects optimal time window (next 48 hours)
  - Generates human-readable summary and reasons
  - Returns best opportunity with forecast details
- **Query Parameters**:
  - `homeBeachId` (optional): UUID to override user's profile home beach
- **Rate Limit**: 10 requests/minute
- **Caching**: Private per-user cache (5 minutes)
- **Response**: `PersonalizedForecastRecommendation | null`
  - `beach`: Beach details with coordinates
  - `window`: Optimal 3-hour time window (start, end, conditions)
  - `forecast`: Full forecast data for the window
  - `score`: Personalized score (0-100)
  - `personalized`: Whether personalization was applied
  - `breakdown`: Score breakdown (base, onboarding prefs, learned prefs, affinity)
  - `summary`: Human-readable recommendation (e.g., "Best conditions at Ocean Beach tomorrow morning: 3-4 ft waves, 10 wind")
  - `reasons`: 2-4 personalization factors (e.g., "You've surfed here frequently", "Matches your preferred wave size")
  - `generated_at`: ISO timestamp
- **Service Layer**: `lib/services/personalized-home-forecast-service.ts`
- **Performance**: 3 DB queries total, parallel forecast fetching with timeout
- **Usage**: Home screen "Where to Surf" card, personalized notifications

**Design Notes**:

- v1 does not support lat/lon coordinates - uses profile data only
- Candidate pool limited to home beach + favorites for performance
- Graceful degradation: returns null if no viable windows or forecast data unavailable
- Future enhancement: geo-based candidate selection for current location
