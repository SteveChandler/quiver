# App Directory Architecture

## Overview

The `/app` directory follows Next.js 16 App Router conventions, implementing a modern, scalable architecture for the Quiver surf community platform. This directory contains both client-side pages and server-side API routes, providing a comprehensive full-stack application structure.

## Directory Structure & Functions

### 📁 Root Files

#### `page.tsx`

- **Function**: Main landing page/homepage
- **Type**: Server page with an SSR landing shell and client auth-aware wrapper
- **Behavior**: Renders crawlable beach content alongside the authenticated/unauthenticated client experience
- **Implementation**: Delegates auth-aware routing to `AuthAwareLandingWrapper`

#### `AuthAwareLandingWrapper`

- **Function**: Client-side authentication-aware home router
- **Type**: Client component with lazy loading
- **Features**:
  - Authentication-based routing
  - `OracleHomeScreen` for authenticated users
  - `QuiverFieldGuideLanding` for unauthenticated users
  - Signup confirmation handling and loading states
  - Performance optimizations (lazy loading, preloading)
  - Web Vitals tracking
  - Memory usage monitoring (development)

#### `layout.tsx`

- **Function**: Root layout wrapper for entire application
- **Features**:
  - Font optimization (DM Sans with display swap)
  - SEO metadata configuration
  - Performance optimizations (resource hints, prefetching)
  - Auth context provider
  - Global styles and viewport settings

#### `globals.css`

- **Function**: Global styles and CSS variables
- **Features**:
  - Responsive design breakpoints
  - Container utilities
  - Dark/light theme variables
  - Performance-optimized layouts

---

### 📁 `/about`

- **Function**: Company information and mission page
- **Type**: Static marketing page
- **Content**: Company story, values, team information, future roadmap
- **Features**: SEO optimized with structured data

### 📁 `/admin`

- **Function**: Administrative interface for platform management
- **Access**: Admin-only routes
- **Features**:
  - Forecast management dashboard
  - Beach data administration
  - System monitoring tools

#### `/admin/forecasts/page.tsx`

- **Function**: Forecast management interface
- **Features**:
  - Bulk forecast updates
  - Individual beach forecast management
  - Status monitoring and error handling

---

### 📁 `/api` - Server-Side API Routes

#### `/api/admin/`

- **Function**: Administrative API endpoints
- **Security**: Admin authentication required
- **Endpoints**:
  - `cleanup-inactive-buoys/` - Buoy maintenance operations
  - `sync-buoys/` - NOAA buoy data synchronization
  - `update-buoy-conditions/` - Real-time conditions updates

#### `/api/analytics/`

- **Function**: User analytics and session data
- **Features**:
  - Session analytics aggregation
  - Calendar heatmap data
  - Privacy controls for session data

#### `/api/auth/`

- **Function**: Authentication system integration
- **Provider**: Supabase Auth
- **Endpoints**:
  - `[...supabase]/` - Supabase auth callbacks
  - `check-session/` - Session validation
  - `refresh-session/` - Token refresh
  - `supabase/resend-confirmation/` - Email confirmation

#### `/api/beaches/`

- **Function**: Beach location data management
- **Features**:
  - Nearby beach queries with geospatial search
  - Beach CRUD operations (admin)
  - Location-based filtering

#### `/api/boards/`

- **Function**: User surfboard management
- **Features**:
  - Board creation and management
  - Session count tracking
  - User-specific board data

#### `/api/buoys/`

- **Function**: Real-time buoy data access
- **Data Source**: NOAA NDBC (National Data Buoy Center)
- **Endpoints**:
  - `conditions/` - Current buoy conditions
  - `nearby/` - Geospatial buoy search

#### `/api/cron/`

- **Function**: Scheduled job endpoints
- **Security**: Cron authentication required
- **Jobs**:
  - `enhanced-forecast-sync/` - Comprehensive NOAA + CDIP data sync

#### `/api/forecasts/`

- **Function**: Surf forecast system
- **Data Sources**: NOAA WaveWatch III, CO-OPS, Weather Service
- **Endpoints**:
  - `update/` - Forecast update management
  - `update-enhanced/` - Advanced forecast generation with CDIP integration

#### `/api/health/`

- **Function**: System health monitoring
- **Usage**: Load balancer health checks, monitoring systems

#### `/api/intel/`

- **Function**: Community intelligence system
- **Features**:
  - Location-based intel posts (parking, hazards, conditions)
  - Community confirmation system
  - Geospatial filtering and tagging

#### `/api/journal/`

- **Function**: Session journaling and export
- **Features**:
  - PDF export generation
  - Session analytics
  - Data portability

#### `/api/recent-posts/`

- **Function**: Social feed data
- **Features**: Recent community activity aggregation

#### `/api/surf/`

- **Function**: Core surf forecast API
- **Features**:
  - Multi-source forecast aggregation
  - Smart beach resolution
  - Confidence scoring
- **Documentation**: Comprehensive API documentation in README.md

---

### 📁 `/auth` - Authentication Pages

#### `/auth/sign-in/page.tsx`

- **Function**: User sign-in interface
- **Features**:
  - Email/password authentication
  - Responsive design
  - Error handling and validation
  - Link to sign-up page

#### `/auth/sign-up/page.tsx`

- **Function**: User registration interface
- **Features**:
  - Account creation flow
  - Email verification
  - Terms acceptance
  - Link to sign-in page

---

### 📁 `/beach/[id]`

- **Function**: Dynamic beach detail pages
- **Type**: Server-side rendered with dynamic routing
- **Features**:
  - Beach-specific information
  - Forecast data integration
  - Community features (reviews, intel)
  - Real-time conditions

### 📁 `/beaches/[country]/[state]/[city]`

- **Function**: Location listing pages (AllTrails-style city pages)
- **Type**: Server-side rendered with dynamic routing
- **Features**:
  - Ranked list of beaches in a city with composite scoring
  - City/metro aggregate statistics
  - Editorial content when available (curated descriptions, session timing advice)
  - Interactive map with beach markers
  - SEO-optimized with JSON-LD structured data
- **Canonical URL**:
  - Location pages are canonical at `/beaches/{country}/{state}/{city}` (e.g., `/beaches/usa/ca/san-diego`).
  - The USA-only shortcut `/beaches/{state}/{city}` redirects to the canonical URL for convenience and legacy inbound links.
- **Behavior**:
  - **Valid city with data**: Renders full city page with ranked beaches
  - **Valid city without data**: Redirects to `/map?search={cityName}` (e.g., Oceanside, Honolulu)
  - **Invalid city**: Renders 404 "Location Not Found" page
- **Related Files**:
  - `actions/beach/beach-location-list-actions.ts` - Data fetching with city existence check
  - `not-found.tsx` - 404 fallback page

---

### 📁 `/features`

- **Function**: Product features showcase page
- **Type**: Static marketing page
- **Content**: Platform capabilities, feature explanations
- **Purpose**: User education and conversion

---

### 📁 `/forecast/[beachId]`

- **Function**: Beach-specific forecast pages
- **Type**: Server-side rendered with dynamic routing
- **Features**:
  - 10-day forecast display
  - Multi-source data integration
  - Confidence scoring
  - Historical data comparison

---

### 📁 `/log-session`

- **Function**: Session logging interface
- **Type**: Protected route (authentication required)
- **Features**:
  - Session data capture
  - Photo uploads
  - Condition recording
  - Board selection

---

### 📁 `/map`

- **Function**: Interactive map interfaces

#### `/map/page.tsx`

- **Function**: Basic map view
- **Features**: Beach location display, basic interactivity

#### `/map/enhanced-page.tsx`

- **Function**: Advanced map interface
- **Features**:
  - Real-time buoy data overlay
  - Advanced filtering
  - Performance optimizations
  - Loading states and error handling

---

### 📁 `/privacy`

- **Function**: Privacy policy page
- **Type**: Static legal page
- **Content**: Data handling policies, user rights
- **Compliance**: GDPR, CCPA requirements

---

### 📁 `/profile`

- **Function**: User profile management

#### `/profile/page.tsx`

- **Function**: Profile display page
- **Features**:
  - User statistics
  - Session history
  - Social features

#### Profile editing

- **Function**: Profile editing is handled via `EditProfileModal` on `/profile`.
- **Deep Link**: Use `/profile?edit=true` to auto-open the modal.
- **Note**: Legacy `/profile/edit` route has been removed.

---

### 📁 `/sessions`

- **Function**: Session management system

#### `/sessions/page.tsx`

- **Function**: Session list/history view
- **Features**:
  - Session filtering and search
  - Analytics dashboard
  - Export capabilities

#### `/sessions/[id]/page.tsx`

- **Function**: Individual session detail pages
- **Features**:
  - Detailed session information
  - Photo galleries
  - Social sharing
  - Edit capabilities

---

## Architecture Patterns

### 🔒 Authentication Strategy

- **Provider**: Supabase Auth
- **Pattern**: Hybrid authentication:
  1. **Traditional Protected Routes** (`/profile`, `/journal`, `/discover`): Server-side middleware redirects unauthenticated users to sign-in
  2. **Public Pages** (`/map`, `/beach/[slug]`, `/forecast`): Fully open for SEO and user acquisition — no auth gate
- **Routes**:
  - Protected routes use middleware to check authentication before rendering
  - Public pages are fully accessible to anonymous users to drive top-of-funnel growth
- **Session Management**: Automatic token refresh and persistence
- **OAuth Flow**: Google OAuth and Email Magic Link via `/auth/callback` route handler
- **Return URL Preservation**: Auth flows preserve exact page location including query params

### 🎯 Routing Strategy

- **Pattern**: File-based routing with Next.js App Router
- **Dynamic Routes**: Parameterized routes for beaches, sessions, users
- **Nested Layouts**: Consistent UI patterns across route groups
- **Loading States**: Suspense boundaries for smooth UX

### 📊 Data Fetching

- **Server Components**: Default for static/server-rendered content
- **Client Components**: Interactive features requiring state
- **API Routes**: Internal API for complex operations
- **External APIs**: NOAA, Supabase integration

### 🚀 Performance Optimizations

- **Lazy Loading**: Component-level code splitting
- **Resource Hints**: DNS prefetch, preconnect, prefetch
- **Image Optimization**: Next.js Image component
- **Font Optimization**: Display swap strategy
- **Caching**: API response caching and client-side state management

### 🔧 Development Features

- **Hot Reload**: Fast development iteration
- **TypeScript**: Full type safety
- **Error Boundaries**: Graceful error handling
- **Performance Monitoring**: Web Vitals tracking
- **Memory Monitoring**: Development-mode resource tracking

## Security Considerations

### 🛡️ API Security

- **Authentication**: JWT token validation
- **Authorization**: Role-based access control (admin routes)
- **Rate Limiting**: API request throttling
- **Input Validation**: Request sanitization and validation

### 🔐 Route Protection

- **Middleware**: Authentication checks at route level
- **Server-Side Validation**: Double verification for sensitive operations
- **CSRF Protection**: Built-in Next.js protections

### 📱 Client Security

- **XSS Prevention**: React's built-in protections
- **Secure Headers**: CSP, HSTS configuration
- **Environment Variables**: Secure API key management

## Integration Points

### 🌊 External Services

- **NOAA APIs**: Weather and ocean data
- **Supabase**: Database and authentication
- **Mapbox/Google Maps**: Mapping services
- **CDIP**: California wave monitoring

### 📊 Internal Services

- **Database**: PostgreSQL via Supabase
- **Storage**: Supabase Storage for media
- **Caching**: In-memory and database caching
- **Analytics**: Session tracking and user analytics

## Deployment Considerations

### 🚀 Build Process

- **Static Generation**: Pre-rendered pages where possible
- **Server-Side Rendering**: Dynamic content with fresh data
- **API Routes**: Serverless function deployment
- **Asset Optimization**: Automatic image and code optimization

### 📈 Scalability

- **Serverless Architecture**: Auto-scaling API routes
- **CDN Integration**: Global content delivery
- **Database Optimization**: Query optimization and indexing
- **Caching Strategy**: Multi-level caching implementation
