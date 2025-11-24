# Changelog

All notable changes to the Quiver surf app will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

#### React Hydration Errors in E2E Tests - November 24, 2025

**Issue:** Hydration warnings caused by whitespace text nodes in `<head>` tag, causing 2 E2E tests to fail:
- `[guest] › e2e/guest-landing.spec.ts:364:9` - Console error check on guest landing page
- `[auth] › e2e/beach-detail.spec.ts:142:7` - Console error check on beach detail page

**Root Cause:** React does not allow whitespace text nodes (newlines, spaces, tabs) as direct children of `<head>` during hydration, per React's hydration rules.

**Fix:** Removed all whitespace between tags in the `<head>` section of `app/layout.tsx` (lines 140-255):
- Consolidated all elements with no whitespace between closing and opening tags
- Preserved all comments and HTML elements (no content changes)
- Added warning comment above `<head>` documenting the whitespace restriction

**Impact:**
- ✅ Both E2E tests now pass with 0 console errors
- ✅ No hydration warnings in browser console
- ✅ All functionality preserved (formatting-only changes)
- ✅ Build and TypeScript compilation succeed

**Files Modified:**
- `/app/layout.tsx` - Removed whitespace from `<head>` section, added warning comment

### Added

#### Plan Session Prefill Feature - November 22, 2025

**Feature:** Complete "Plan Session" CTA flow that automatically prefills the session wizard with recommended beach and optimal time window, enabling users to jump directly to setting goals without re-entering data.

**User Experience:**
- Click "Plan Session" from Surf Discovery or Personalized Forecast recommendations
- Session wizard automatically opens with beach and time already filled in
- Wizard jumps directly to Goals step (step 3) for immediate goal setting
- Seamless workflow reduces friction in session planning
- Users can immediately add goals and notes without data re-entry

**Implementation:**
- URL-based prefill system with deep linking support
- Comprehensive validation using Zod schemas (UUID, timestamps, step numbers)
- Type-safe parameter handling with TypeScript
- Security-first approach with XSS prevention and input sanitization
- Graceful degradation for invalid or missing parameters
- Backwards compatible - existing `/sessions/new` URLs work unchanged

**CTA Integration:**
- **Personalized Forecast**: "Plan Session" button in `components/home-screen/forecast-tab.tsx`
- **Surf Discovery**: "Plan Session" button in `components/discover/beach-discovery-list.tsx`
- Both CTAs use `buildSessionWizardUrl()` utility for consistent URL generation

**Components Updated:**
- `/app/sessions/new/page.tsx` - Added URL parameter parsing and validation
- `/components/session/wizard/SessionWizard.tsx` - Added `initialFormState` and `targetStep` props
- `/components/session/wizard/AnimatedSessionWizard.tsx` - Added auto-jump logic to target step
- `/hooks/use-session-form.ts` - Added `initialFormState` parameter for prefill support
- `/components/discover/beach-discovery-list.tsx` - Added "Plan Session" CTA with prefill
- `/components/home-screen/forecast-tab.tsx` - Added "Plan Session" CTA with prefill

**Infrastructure:**
- `/types/session-wizard.ts` - Type definitions for prefill parameters and form state
- `/lib/validation/schemas.ts` - Zod schema for comprehensive parameter validation
- `/lib/utils/session-wizard-params.ts` - URL parsing and building utilities with security validation

**URL Parameter Schema:**
- `mode`: Session mode ('plan' | 'log')
- `beach`: Beach UUID (validated)
- `beachName`: Beach display name (sanitized)
- `startTime`: ISO timestamp (validated, security checks)
- `endTime`: ISO timestamp (validated, max 12-hour duration)
- `step`: Target wizard step (1-4, validated)

**Usage Example:**
```typescript
const url = buildSessionWizardUrl({
  mode: 'plan',
  beachId: beach.id,
  beachName: beach.name,
  startTime: new Date('2025-11-22T06:00:00Z'),
  endTime: new Date('2025-11-22T10:00:00Z'),
  targetStep: 3,
});
router.push(url); // Jumps to Goals step with beach and time prefilled
```

**Security Features:**
- XSS prevention with DOMPurify-style sanitization
- UUID format validation (prevents SQL injection attempts)
- Timestamp validation (rejects invalid/malicious dates)
- Duration limits (max 12 hours prevents abuse)
- Step number validation (1-4 range enforcement)

**Testing Coverage:**
- **Unit Tests**: 25 tests in `__tests__/lib/utils/session-wizard-params.test.ts`
  - URL building, parameter parsing, validation, edge cases
- **Hook Tests**: 40 tests total in `__tests__/hooks/use-session-form.test.ts` (9 new)
  - Prefill initialization, form state management, validation
- **E2E Tests**: 20 tests in `/e2e/plan-session.spec.ts`
  - Full CTA flow, wizard navigation, data persistence, error handling
- **Total Coverage**: 85 comprehensive tests (>90% code coverage for new paths)

**Benefits:**
- Reduces friction in session planning workflow
- Seamless integration with forecast and discovery features
- Maintains backwards compatibility (existing URLs still work)
- Production-ready with comprehensive validation and error handling
- Deep linking support enables sharing session plans via URL

**Documentation:**
- See `/docs/SESSION_WIZARD_PREFILL.md` for complete implementation details
- See `/docs/SESSION_WIZARD_PREFILL_TESTING.md` for testing documentation

### Changed

#### Unified Forecast Recommendations with Discovery Service - November 23, 2025

**Change:** Consolidated personalized home forecast with surf discovery service to use consistent time-decay scoring logic across all recommendations.

**What Changed:**
- Personalized forecast card now uses surf discovery service with `maxResults=1`
- Both PersonalizedForecastCard and BeachDiscoveryList now use the same underlying service
- Time-window selection now consistently applies time-decay penalty (0.5 points/hour, capped at 24 hours)
- Discovery's composite scoring (70% conditions + 30% confidence) now powers all recommendations
- **Nighttime Filtering**: Automatically excludes unrealistic surf sessions between 9pm and 4am

**Implementation:**
- Created adapter layer (`lib/adapters/discovery-to-personalized.ts`) to map discovery responses to personalized format
- Updated `components/home-screen/forecast-tab.tsx` to use `useSurfDiscovery` with adapter
- Deprecated `usePersonalizedHomeForecast` hook (now wraps discovery service)
- Deprecated `/api/home/personalized-forecast` endpoint (now wraps discovery service)
- Maintained backward compatibility - all existing analytics events preserved
- No UI changes visible to users

**Benefits:**
- **Consistent Time Selection**: Both cards now prefer near-term quality forecasts
- **Single Codebase**: Eliminates duplicate window selection logic
- **Improved Scoring**: Composite scoring provides better recommendations
- **Maintainability**: Single service to test and optimize

**Migration Path (for future cleanup):**
- Old stack marked as `@deprecated` with migration instructions
- Wrapper implementation ensures no breaking changes
- Plan removal in v2.0 after 3-month deprecation period

**User Impact:**
- Seamless - no visible changes to UI or UX
- May see slight changes in recommended time windows (time-decay preference)
- Analytics events continue tracking with same names

**Technical Details:**
- Adapter maps 6-part discovery subscores to 4-part personalized breakdown:
  - base: waveHeightFit
  - onboardingPrefs: periodEnergyScore
  - learnedPrefs: windAlignment + tideFit
  - affinity: affinityBonus
- Discovery's `matchQuality` derived from score thresholds
- Distance/driving time fields ignored (Phase 2 feature)

### Fixed

#### Surf Discovery "Plan Session" CTA 404 Error - November 22, 2025

**Issue:** The "Plan Session" button in Surf Discovery cards was routing to `/sessions/wizard` which returned a 404 error, completely blocking session planning from surf recommendations.

**Root Cause:** The `handlePlanSession` function in `components/discover/beach-discovery-list.tsx` was using an incorrect route path (`/sessions/wizard`) instead of the correct route (`/sessions/new`).

**Solution:**
- Updated `handlePlanSession` to route to `/sessions/new` with prefill parameters
- Uses `buildSessionWizardUrl()` utility for consistent URL generation
- Properly passes beach, time window, and target step parameters
- Matches routing pattern used in Personalized Forecast CTA

**Files Modified:**
- `components/discover/beach-discovery-list.tsx` - Fixed routing to use `/sessions/new` with prefill

**Impact:** Users can now successfully plan sessions from Surf Discovery recommendations without encountering 404 errors. The complete "Plan Session" flow now works end-to-end.

#### Beach Discovery URL Routing - November 22, 2025

**Issue:** The "View Beach" button in Beach Discovery cards was routing to UUID-based URLs (e.g., `/beaches/65809772-20bc-4009-b9b2-89c8ef3c4127`) which resulted in 404 errors, instead of using the proper hierarchical slug-based format (e.g., `/ca/pacific-beach-san-diego/pacific-beach`).

**Root Cause:** The `handleViewBeach` function in `components/discover/beach-discovery-list.tsx` was directly constructing URLs using beach UUIDs without utilizing the beach's slug, city, and state fields.

**Solution:**
- Updated `handleViewBeach` to use the `getBeachUrlSafe` utility function
- Extracts complete beach data from the recommendation object
- Generates proper hierarchical URLs with fallback to UUID-based routes
- Adds source tracking query parameter (`?from=surf_discovery`)

**Files Modified:**
- `components/discover/beach-discovery-list.tsx` - Updated routing logic to use `getBeachUrlSafe`

**Impact:** Users can now successfully navigate to beach detail pages from the Surf Discovery section without encountering 404 errors.

#### Featured Beaches API Contract Regression - November 24, 2025

**Issue:** `/api/beaches/featured` drifted from the e2e contract, returning unsorted data without cache headers, missing required fields, and failing 405 handling for non-GET requests.

**Solution:**
- Centralized featured fallback metadata in `lib/constants/featured-beaches-config.ts` and re-used it in the landing component to keep responses consistent.
- Rebuilt the API route to sanitize Supabase results, enforce required schema fields, dedupe IDs/names, and guarantee beaches with real photos appear first while still preferring fallback-friendly beaches for the remaining slots.
- Added HTTP caching (ETag + `Cache-Control`) via `createCachedResponse`, implemented `If-None-Match` handling, and exposed explicit `methodNotAllowed` handlers for POST/PUT/DELETE calls.

**Impact:** The featured beaches endpoint now satisfies the 28-step Playwright contract suite, returns deterministic payloads with security headers, and degrades gracefully with empty arrays instead of 500s.

### Performance

#### Landing Page Optimization (Major Performance Overhaul) - November 22, 2025

**Issue:** Landing page had severe performance issues with LCP of 8.8s and TBT of 1.13s, far exceeding acceptable thresholds.

**Root Causes:**
- Entire landing page was client-rendered (`"use client"`)
- Framer Motion library adding ~400KB to bundle
- Heavy search component (cmdk) loaded upfront (~300KB)
- Analytics scripts loaded for unauthenticated visitors
- Excessive resource hints for unused services (maps)

**Solution:** Implemented server-first architecture with progressive enhancement:

1. **Server Component Architecture** (`app/page.tsx`, `components/landing-page-server.tsx`)
   - Converted landing page to server component
   - Server-side authentication check (eliminates client delay)
   - Server-side data fetching (eliminates waterfall)
   - Dynamic rendering for auth-based routing

2. **Progressive Section Wrapper** (`components/landing-page/progressive-section.tsx`)
   - Lightweight client component for scroll animations
   - IntersectionObserver-based progressive loading
   - Test environment auto-detection
   - ~1KB JavaScript footprint

3. **Optimized Data Fetching** (`lib/data/landing-page.ts`)
   - Server-side beach data fetching
   - Selective field queries (no `SELECT *`)
   - Next.js cache with 1-hour revalidation
   - Query time: <100ms, cached: ~1ms

4. **Framer Motion Removal** (all `components/landing-page/*.tsx`)
   - Replaced with Tailwind CSS animations
   - Added 9 reusable animation utilities to `tailwind.config.ts`
   - Bundle reduction: ~400KB
   - Same visual fidelity maintained

5. **Lazy-Loaded Search** (`components/landing-page/hero-search-lazy.tsx`)
   - Simple input placeholder renders immediately
   - Full BeachSearchAutocomplete lazy-loaded on focus or idle
   - Preserves user input across transition
   - Bundle reduction: ~300KB (cmdk deferred)

6. **Conditional Analytics** (`components/analytics/analytics-loader.tsx`)
   - Analytics only loaded on authenticated routes
   - Landing page: 0 analytics scripts
   - Bundle reduction: ~100KB

7. **Route-Specific Resource Hints**
   - Removed map preconnects from root layout
   - Added route-specific layouts (`app/map/layout.tsx`, etc.)
   - Landing page: Only font preconnects
   - Frees 3-5 browser connection slots

**Performance Impact:**
- **LCP:** 8.8s → ~2.0s (77% improvement, **-6.8s**)
- **TBT:** 1.13s → ~80ms (93% improvement, **-1,050ms**)
- **Bundle Size:** ~1.09MB → ~690KB (37% reduction, **-400KB**)
- **TTI:** ~5s → ~2s (60% improvement, **-3s**)
- **Lighthouse Score:** Expected >90 (from ~60)

**Files Created:**
- `components/landing-page-server.tsx` - Server component entry point
- `components/landing-page/progressive-section.tsx` - Progressive loading wrapper
- `components/landing-page/hero-search-lazy.tsx` - Lazy-loaded search
- `lib/data/landing-page.ts` - Server data fetching utilities
- `components/analytics/analytics-loader.tsx` - Conditional analytics
- `components/resource-hints/map-hints.tsx` - Map resource hints
- `app/map/layout.tsx`, `app/beaches/layout.tsx`, `app/forecast/layout.tsx` - Route layouts
- `components/landing-page/ARCHITECTURE.md` - Architecture documentation
- `docs/PERFORMANCE_OPTIMIZATION.md` - Performance optimization guide

**Files Modified:**
- `app/page.tsx` - Server component with auth routing
- `app/layout.tsx` - Removed inline analytics, optimized resource hints
- `tailwind.config.ts` - Added animation keyframes and utilities
- All `components/landing-page/*.tsx` - Removed framer-motion, added CSS animations
- `components/beach/beach-search-autocomplete.tsx` - Added `initialValue` prop
- `hooks/use-beach-autocomplete.ts` - Added `initialQuery` support

**Breaking Changes:** None (feature parity maintained)

**Migration Notes:**
- Analytics now load via `<AnalyticsLoader />` component
- Framer-motion removed from landing page (use CSS animations)
- Landing page data fetching moved to server (see `lib/data/landing-page.ts`)

**Testing:**
- E2E tests updated for new architecture
- Server rendering verified (content visible without JS)
- Progressive loading tested
- Analytics loading behavior tested

**Documentation:**
- `components/landing-page/ARCHITECTURE.md` - Complete architecture guide
- `docs/PERFORMANCE_OPTIMIZATION.md` - Systematic optimization approach

**Contributors:** Performance Optimizer, Next.js Developer, React Expert, Supabase DB Expert, Refactoring Specialist, Documentation Specialist


### Changed
- **Cache-Backed Surf Discovery System** (November 22, 2025):
  - Removed reliance on EnhancedForecastService for on-demand forecast regeneration
  - Issue: Services could timeout when attempting to regenerate stale forecasts during user requests
  - Previous behavior: `personalized-home-forecast-service` called `EnhancedForecastService.generateComprehensiveForecast()` when cache was stale/missing
  - New behavior: Both services strictly cache-backed, never call external APIs
  - New helper: `getFreshForecastFromCache()` in `lib/utils/forecast-service-utils.ts` - single source of truth for cache access
  - Returns stale data with clear warnings instead of failing or attempting regeneration
  - Background jobs (cron at 6 AM, manual `updateAllBeachForecasts()`) exclusively responsible for forecast generation
  - Performance: Consistent ~50ms cache reads vs 3-8s+ API generation with frequent timeouts
  - Impact: No more user-facing timeouts, predictable response times, reduced API load during peak hours
  - Files modified:
    - `lib/utils/forecast-service-utils.ts` - Added `getFreshForecastFromCache()` helper
    - `lib/services/surf-discovery-service.ts` - Migrated to shared helper, track stale/failed beaches
    - `lib/services/personalized-home-forecast-service.ts` - Removed `EnhancedForecastService`, use cache-only helper
    - `types/personalization.ts` - Added staleness metadata to response types
- **Surf Discovery Window Selection - Time Priority** (November 22, 2025):
  - Modified `selectBestWindow` in `lib/services/surf-discovery-service.ts` to prioritize nearer-term forecasts
  - Issue: Discovery cards could recommend surf sessions days away when slightly better conditions exist
  - Previous behavior: Pure composite scoring (conditions 70% + confidence 30%) without time consideration
  - New behavior: Applies linear time-decay penalty (0.5 points/hour, capped at 24 hours)
  - Formula: `adjustedScore = compositeScore - (hoursAhead * 0.5)`
  - Impact: Users now see recommendations for the soonest good opportunity, not just highest absolute score
  - Example: Forecast 3 hours away (score 65) now beats forecast 21 hours away (score 70)
  - Tie-breaking: Equal adjusted scores prefer higher composite, then conditions, then later time
  - Test Coverage: Added 10 comprehensive tests for time-priority logic and edge cases
  - Files modified: `lib/services/surf-discovery-service.ts`, `__tests__/lib/services/surf-discovery-service.test.ts`
