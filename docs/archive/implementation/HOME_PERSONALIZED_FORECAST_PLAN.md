# Personalized Home Forecast Plan

> **Status:** Implementation completed. Original `personalized-home-forecast-service.ts` was deprecated and removed in November 2025. Functionality now handled by `surf-discovery-service.ts` with cache-backed architecture. See `lib/services/ARCHITECTURE.md` for current implementation details.

## Goals & Outcomes
- **Best spot for you today**: Surface one beach recommendation that aligns with the rider’s preferences, recent behavior, and today’s conditions. Should feel like a coach pick, not a static home beach card.
- **Best time for you today**: Highlight a concrete 2–3 hour window that balances wave quality, tide stage, and daylight for the chosen beach.
- **Ideal conditions summary**: Summarize why the recommendation is a match (wave range, tide, wind, crowd fit, board pick) in a single glance card to boost trust.
- **Success metrics**: Increase home-to-session flows (+X% clicks on `Plan Session`, +Y% visits to beach detail) and collect feedback on recommendation accuracy.

## Experience Blueprint

### Visual Hierarchy & Layout
- Position the Personalized Forecast card at the top of the Forecast tab (`components/home-screen/forecast-tab.tsx`) directly under the tab content so it is visible before scrolling.
- **Mobile-First Design** (375px - 768px):
  - Single column layout
  - Touch targets minimum 44x44px (iOS Human Interface Guidelines)
  - Buttons use `touch-manipulation` CSS for instant feedback
  - Stack all content vertically for easy thumb reach
  - Beach name + actions within thumb zone (bottom 50% of screen)
- **Desktop Layout** (1024px+):
  - Can show personalized card alongside regular forecast (2-column grid)
  - Sticky positioning for persistent visibility
  - Larger KPI tiles for better scannability

### Card Structure
1. **Header Section**:
   - Title: "Your Best Spot Today" with Target icon
   - Personalization badge (top-right): "For You" with Sparkles icon
   - Uses ocean-blue gradient background for visual distinction

2. **Beach Snapshot**:
   - Beach name (large, semibold)
   - Distance from current location (if geolocation available)
   - "Details" button linking to `/beach/[slug]` (ghost variant, right-aligned)

3. **Best Surf Window** (highlighted section):
   - Blue-tinted background (`bg-blue-50`) for emphasis
   - Time range: e.g., "8:00 AM - 11:00 AM"
   - Confidence badge: e.g., "85% confident"
   - Micro-indicators: tide phase icon + wind direction icon
   - Clock icon for visual association

4. **Ideal Conditions KPIs** (3-column grid):
   - Wave Height: using `KpiTile` with blue theme
   - Crowd Level: using `KpiTile` with green theme
   - Match Score: using `KpiTile` with purple theme
   - Each tile shows value + unit + label

5. **Personalization Explanation**:
   - Light gray background (`bg-gray-50`)
   - Info icon with summary text
   - Examples: "3-4 ft waves match your preference + offshore wind + mid-tide rising"
   - Builds trust through transparency

6. **Action CTAs**:
   - Primary: "Plan Session" (ocean-blue background)
   - Secondary: "View Forecast" (outline variant)
   - Full-width on mobile, flex on desktop
   - BookOpen icon on primary button

### Empty/Error States
- **Not logged in**:
  - Show generic recommendation OR
  - Reuse `HomeBeachBanner` to prompt sign-up/login

- **No preferences yet** (< 3 sessions):
  ```tsx
  <Card className="border-dashed">
    <CardContent className="text-center py-6">
      <UserPlus className="h-8 w-8 mx-auto mb-2 text-gray-400" />
      <p className="font-medium mb-1">Set Your Preferences</p>
      <p className="text-sm text-muted-foreground mb-3">
        Tell us about your surf style for personalized recommendations
      </p>
      <Button onClick={() => router.push("/profile")}>
        Update Profile
      </Button>
    </CardContent>
  </Card>
  ```

- **Building profile** (3-5 sessions):
  ```tsx
  <Card className="bg-yellow-50/50 border-yellow-200">
    <CardContent className="py-4">
      <div className="flex items-start gap-3">
        <TrendingUp className="h-5 w-5 text-yellow-600 mt-0.5" />
        <div>
          <p className="font-medium text-sm">Getting to know your style...</p>
          <p className="text-xs text-muted-foreground mt-1">
            Log {5 - sessionCount} more sessions for better recommendations
          </p>
        </div>
      </div>
    </CardContent>
  </Card>
  ```

- **Rate limited**:
  ```tsx
  <Alert variant="warning" data-testid="rate-limit-message">
    <AlertCircle className="h-4 w-4" />
    <AlertTitle>Too Many Requests</AlertTitle>
    <AlertDescription>
      Please wait a moment before refreshing forecast data.
    </AlertDescription>
  </Alert>
  ```

- **API failure**:
  - Log to Sentry with context (userId, timestamp, error)
  - Degrade to showing current home beach forecast
  - OR hide the card entirely and continue with regular forecast display
  - Show retry button if transient error

### Accessibility
- All interactive elements keyboard accessible
- ARIA labels for icon-only buttons
- Semantic HTML structure (headings, landmarks)
- Color contrast meets WCAG AA standards
- Loading states announced to screen readers

## Data & Scoring Strategy
1. **Candidate beach pool**
   - Start with `(homeBeach || favorites || nearby chips)` combinations; fallback to `coach picks` to guarantee at least one beach.
   - Include user’s last 3 logged beaches (from `sessions` table via `/api/sessions` or supabase view) to reflect recency bias.
2. **Personalized scoring**
   - Reuse `lib/services/personalized-scoring-service.ts` to blend base coach score, onboarding prefs, learned prefs (`user_surf_preferences`), and `user_beach_affinity`.
   - Normalize scores 0–100, keep breakdown for explanation copy.
3. **Forecast inputs**
   - For each candidate fetch next 24 hours of enhanced forecasts via `/api/forecasts/update-enhanced?beachId=...`.
   - Collapse forecast points into dayparts (early/late AM, mid-day, PM) and compute:
     - Weighted wave rating (height within personal min/max, favorable period).
     - Wind comfort (offshore/side).
     - Tide alignment with learned preference band.
   - Pick the time window with highest combined score. Persist a JSON blob with: `start`, `end`, `wave_height`, `wind`, `tide`, `confidence`.
4. **Ideal conditions summary**
   - Compose summary sentences using data from scoring breakdown plus window metrics (e.g., “3-4 ft, light offshore wind, mid tide rising — matches your preferred wave size and favorite board”).
   - Provide metadata fields for UI chips: `primary_reason`, `secondary_reason`, `board_hint`, `crowd_hint`.

## Technical Implementation Plan

### Phase 1 – Service & API (Backend)
1. **Create service module** `lib/services/personalized-home-forecast-service.ts`
   - Input: `userId`, optional `geo` (lat/lon - **NOT lng**), optional override `beachId`.
   - **CRITICAL PERFORMANCE REQUIREMENTS**:
     - **Batching**: Fetch forecasts with concurrency limit (max 3 parallel requests) to avoid rate limiting
     - **Caching**: LRU cache keyed by `userId-lat-lon` for 5 minutes to avoid hitting Supabase/forecast API repeatedly
     - **Timeout**: Abort forecast fetches after 5 seconds to prevent hanging
     - **Fallback**: Use Promise.allSettled to handle partial failures gracefully
   - Responsibilities:
     - Build candidate list (home beach, favorites from `favorite_beaches`, recent sessions, high-affinity beaches).
     - Fetch/calc forecasts with controlled concurrency and error handling.
     - Score beaches using `personalized-scoring-service` and select best.
     - Produce DTO: `{ beach, window, forecast, score, personalized, breakdown, summary, reasons[], generated_at }`.
   - Implementation pattern:
     ```typescript
     import { LRUCache } from "lru-cache";

     const forecastCache = new LRUCache<string, PersonalizedForecastRecommendation>({
       max: 100,
       ttl: 5 * 60 * 1000, // 5 minutes
     });

     export async function getPersonalizedHomeForecast(
       userId: string,
       options: { geo?: { lat: number; lon: number }; homeBeachId?: string }
     ): Promise<PersonalizedForecastResponse> {
       const cacheKey = `${userId}-${options.geo?.lat}-${options.geo?.lon}`;

       // Check cache first
       const cached = forecastCache.get(cacheKey);
       if (cached) return cached;

       // Build candidate pool
       const candidates = await buildCandidatePool(userId, options);
       if (candidates.length === 0) {
         return {
           reason: 'no_beaches',
           message: 'No beaches available for personalized recommendations',
           generated_at: new Date().toISOString(),
         };
       }

       // Batch fetch forecasts with rate limiting
       const forecasts = await batchFetchForecasts(candidates, {
         maxConcurrent: 3,
         timeout: 5000,
       });

       // Score and select best
       const affinityMap = await loadUserAffinityMap(userId, candidates);
       const scores = await scoreBeachesForUser(userId, forecasts, affinityMap);
       const best = selectBestRecommendation(forecasts, scores);

       if (!best) {
         return {
           reason: 'insufficient_data',
           message: 'Not enough data to generate personalized recommendation',
           minSessionsRequired: 3,
           generated_at: new Date().toISOString(),
         };
       }

       const recommendation = {
         beach: {
           ...best.beach,
           // Map database coordinate fields to standard names
           latitude: best.beach.center_lat,
           longitude: best.beach.center_lng,
         },
         window: best.window,
         forecast: best.forecast,
         score: best.score,
         personalized: best.personalized,
         breakdown: best.breakdown,
         summary: generateSummary(best),
         reasons: generateReasons(best),
         generated_at: new Date().toISOString(),
       };

       // Cache result
       forecastCache.set(cacheKey, recommendation);
       return recommendation;
     }

     // Helper: Batch fetch with concurrency control
     async function batchFetchForecasts(
       beaches: Beach[],
       options: { maxConcurrent: number; timeout: number }
     ): Promise<BeachForecast[]> {
       const queue = [...beaches];
       const results: BeachForecast[] = [];
       const inFlight = new Set<Promise<void>>();

       while (queue.length > 0 || inFlight.size > 0) {
         while (inFlight.size < options.maxConcurrent && queue.length > 0) {
           const beach = queue.shift()!;
           const promise = fetchForecastForBeach(beach, options.timeout)
             .then(forecast => results.push({ beach, forecast }))
             .catch(error => console.warn(`Failed to fetch forecast for ${beach.name}:`, error))
             .finally(() => inFlight.delete(promise));

           inFlight.add(promise);
         }

         if (inFlight.size > 0) {
           await Promise.race(inFlight);
         }
       }

       return results;
     }
     ```
2. **API route** `app/api/home/personalized-forecast/route.ts`
   - **CRITICAL**: Follow standardized API response format (see API Specification section below)
   - Use existing `ApiSuccess`/`ApiError` from `lib/api-utils.ts`
   - Auth required; use `createSupabaseServerClient`
   - Input validation with Zod schemas
   - Returns 200 with `{ success: true, data: recommendation | metadata }` when successful
   - Returns 200 with `{ success: true, data: { reason: string, ...metadata } }` when no recommendation available
   - Logs telemetry (duration, candidate count, winning beach id, errors)
   - Enforce rate-limit: 10 req/min per user via `withRateLimit` middleware
   - HTTP cache headers: `Cache-Control: public, max-age=300`
   - Security headers: automatically applied via `createSuccessResponse`
   - Complete implementation example:
     ```typescript
     // app/api/home/personalized-forecast/route.ts
     import { NextRequest } from 'next/server';
     import { z } from 'zod';
     import {
       createSuccessResponse,
       handleApiError,
       createAuthError,
       CacheDuration,
     } from '@/lib/api-utils';
     import { withRateLimit } from '@/lib/middleware/rate-limiter';
     import { createSupabaseServerClient } from '@/lib/supabase/server';
     import { getPersonalizedHomeForecast } from '@/lib/services/personalized-home-forecast-service';
     import { assertValidCoordinates } from '@/lib/coordinate-validation';

     // Request validation schema
     const QuerySchema = z.object({
       lat: z.coerce.number().min(-90).max(90).optional(),
       lon: z.coerce.number().min(-180).max(180).optional(),
       homeBeachId: z.string().uuid().optional(),
     }).refine(
       (data) => (data.lat !== undefined) === (data.lon !== undefined),
       { message: 'Both lat and lon must be provided together' }
     );

     export const runtime = 'nodejs';
     export const dynamic = 'force-dynamic';

     async function personalizedForecastHandler(request: NextRequest) {
       const startTime = Date.now();

       try {
         // 1. Authentication
         const supabase = await createSupabaseServerClient();
         const { data: { user }, error: authError } = await supabase.auth.getUser();

         if (authError || !user) {
           return createAuthError('Authentication required');
         }

         // 2. Parse and validate query params
         const { searchParams } = new URL(request.url);
         const parseResult = QuerySchema.safeParse({
           lat: searchParams.get('lat'),
           lon: searchParams.get('lon'),
           homeBeachId: searchParams.get('homeBeachId'),
         });

         if (!parseResult.success) {
           return NextResponse.json(
             {
               success: false,
               error: parseResult.error.errors[0].message,
               timestamp: new Date().toISOString(),
             },
             { status: 400 }
           );
         }

         const { lat, lon, homeBeachId } = parseResult.data;

         // 3. Coordinate validation
         if (lat !== undefined && lon !== undefined) {
           assertValidCoordinates(lat, lon, 'Personalized forecast API');
         }

         // 4. Rate limiting handled by middleware (see export at bottom)

         // 5. Fetch personalized forecast
         const recommendation = await getPersonalizedHomeForecast(user.id, {
           geo: lat !== undefined && lon !== undefined ? { lat, lon } : undefined,
           homeBeachId,
         });

         // 6. Log telemetry
         const duration = Date.now() - startTime;
         console.log('[PersonalizedForecast]', {
           duration_ms: duration,
           user_id: user.id,
           has_recommendation: !!recommendation,
           personalized: recommendation?.personalized || false,
         });

         // 7. Return cached response
         return createSuccessResponse(
           recommendation,  // Can be null for insufficient data
           CacheDuration.SHORT  // 5 minutes
         );

       } catch (error) {
         return handleApiError(
           error,
           'Failed to fetch personalized forecast'
         );
       }
     }

     // Apply rate limiting middleware: 10 req/min for authenticated users
     export const GET = withRateLimit(
       personalizedForecastHandler,
       "authenticated-forecast"  // Rate limit tier defined in rate-limiter.ts
     );
     ```

### Phase 2 – Frontend Data Layer
1. **Hook** `hooks/use-personalized-home-forecast.ts`
   - **CRITICAL**: Must use established `useDataFetcher` hook pattern (see `hooks/use-data-fetcher.ts` for reference)
   - Follow the exact pattern from `forecast-tab.tsx:82-85` for data fetching
   - Implementation:
     ```typescript
     // hooks/use-personalized-home-forecast.ts
     import { useCallback, useMemo } from "react";
     import { useDataFetcher } from "@/hooks/use-data-fetcher";
     import { useGeo } from "@/hooks/useGeo";
     import type { PersonalizedForecastRecommendation } from "@/types/personalization";

     interface UsePersonalizedHomeForecastOptions {
       userId?: string;
       homeBeachId?: string;
       favoriteBeachIds?: string[];
     }

     export function usePersonalizedHomeForecast(options: UsePersonalizedHomeForecastOptions) {
       const { coords } = useGeo();

       // Memoize fetch function per Quiver patterns
       const fetchPersonalizedForecast = useCallback(async () => {
         if (!options.userId) return null;

         const params = new URLSearchParams({
           ...(coords && { lat: String(coords.lat), lon: String(coords.lon) }),
           ...(options.homeBeachId && { homeBeachId: options.homeBeachId }),
         });

         const response = await fetch(`/api/home/personalized-forecast?${params}`, {
           // Let HTTP Cache-Control headers manage caching (not cache: "no-store")
           next: { revalidate: 0 }
         });

         if (!response.ok) {
           const error = await response.json().catch(() => ({}));
           throw new Error(error.error || `Failed to fetch personalized forecast: ${response.status}`);
         }

         const result = await response.json();
         // API returns { success: true, data: recommendation | metadata }
         return result.success ? result.data : null;
       }, [options.userId, options.homeBeachId, coords?.lat, coords?.lon]);

       const { data, loading, error, refetch } = useDataFetcher<PersonalizedForecastResponse | null>(
         fetchPersonalizedForecast,
         {
           skip: !options.userId,
           initialData: null,
         }
       );

       // Auto-refresh if data is stale (>30 minutes old)
       const isStale = useMemo(() => {
         if (!data?.generated_at) return false;
         const age = Date.now() - new Date(data.generated_at).getTime();
         return age > 30 * 60 * 1000;
       }, [data?.generated_at]);

       // Type guard to check if data is a recommendation
       const isRecommendation = (data: PersonalizedForecastResponse | null): data is PersonalizedForecastRecommendation => {
         return !!data && 'beach' in data;
       };

       return {
         data,
         recommendation: isRecommendation(data) ? data : null,
         metadata: !isRecommendation(data) && data ? data as PersonalizedForecastMetadata : null,
         loading,
         error,
         isStale,
         refetch,
         hasPersonalization: isRecommendation(data) && data.personalized,
       };
     }
     ```
   - Exposes `{ data, recommendation, metadata, loading, error, isStale, refetch, hasPersonalization }`.
   - `recommendation` is non-null when a personalized beach was found
   - `metadata` is non-null when no recommendation available (contains reason and message)
   - Handles stale data by comparing `generated_at` vs now and auto-refreshing if >30 minutes old or when `homeBeach` changes.

2. **Type definitions**
   - Add `PersonalizedHomeForecast` interface under `types/personalization.ts` (NEW FILE):
     ```typescript
     export interface PersonalizedForecastRecommendation {
       beach: Beach;
       window: {
         start: string; // ISO timestamp
         end: string;   // ISO timestamp
         tide: string;
         wind: string;
         wave_height: string;
         confidence: number; // 0-100
       };
       forecast: EnhancedForecastEntity;
       score: number;
       personalized: boolean;
       breakdown: {
         base: number;
         onboardingPrefs: number;
         learnedPrefs: number;
         affinity: number;
       };
       summary: string;
       reasons: string[];
       generated_at: string; // ISO timestamp
     }

     // Metadata returned when no personalized recommendation available
     export interface PersonalizedForecastMetadata {
       reason: 'insufficient_data' | 'no_beaches' | 'no_forecasts';
       message: string;
       minSessionsRequired?: number;
       generated_at: string; // ISO timestamp
     }

     // Union type for API response data
     export type PersonalizedForecastResponse =
       | PersonalizedForecastRecommendation
       | PersonalizedForecastMetadata;
     ```
   - Provide union for UI states: `type ForecastState = "loading" | "ready" | "needs_prefs" | "error" | "rate_limited"`.

3. **Storybook/fixtures**
   - Create mocked JSON payloads under `components/home-screen/__fixtures__/personalized-forecast.ts` to aid development and tests.
   - Include edge cases: no preferences, low confidence, rate limited, etc.

### Phase 3 – UI Integration
1. **New component** `components/home-screen/personalized-forecast-card.tsx`
   - **CRITICAL**: Follow existing component patterns from `forecast-tab.tsx` (lines 1-40)
   - **MUST reuse** existing UI components:
     - `Card`, `CardContent`, `CardHeader`, `CardTitle` from `@/components/ui/card`
     - `Badge` from `@/components/ui/badge`
     - `Button` from `@/components/ui/button`
     - `KpiTile` from `@/components/ui/kpi-tile` (see `forecast-tab.tsx:19`)
     - Icons from `lucide-react` (Waves, MapPin, Star, Clock, Wind, Info, ChevronRight, Sparkles, Target)
   - **Mobile-first design requirements**:
     - Touch targets minimum 44x44px (iOS standard)
     - Responsive grid: `grid-cols-1 lg:grid-cols-2`
     - Stack vertically on mobile, side-by-side on desktop
     - Use `touch-manipulation` CSS class for buttons
   - Component structure:
     ```tsx
     interface PersonalizedForecastCardProps {
       recommendation: PersonalizedForecastRecommendation | null;
       loading?: boolean;
       error?: Error | null;
       onPlanSession: () => void;
       onViewBeach: (beachId: string) => void;
       onDismiss?: () => void;
       onFeedback?: (helpful: boolean) => void;
     }

     export function PersonalizedForecastCard({
       recommendation,
       loading,
       error,
       onPlanSession,
       onViewBeach,
     }: PersonalizedForecastCardProps) {
       if (loading) return <PersonalizedForecastSkeleton />;
       if (error) return <PersonalizedForecastError error={error} />;
       if (!recommendation) return null;

       const { beach, window, score, breakdown, summary, reasons } = recommendation;

       return (
         <Card className="relative overflow-hidden bg-gradient-to-br from-ocean-blue/5 to-blue-500/5" data-testid="personalized-forecast-card">
           {/* Personalization Badge - Top Right */}
           <div className="absolute top-3 right-3">
             <Badge variant="blue" className="flex items-center gap-1" data-testid="personalization-badge">
               <Sparkles className="h-3 w-3" />
               <span>For You</span>
             </Badge>
           </div>

           <CardHeader className="pb-3">
             <CardTitle className="flex items-center gap-2">
               <Target className="h-5 w-5 text-ocean-blue" />
               <span>Your Best Spot Today</span>
             </CardTitle>
           </CardHeader>

           <CardContent className="space-y-4">
             {/* Beach Recommendation */}
             <div className="flex items-start justify-between">
               <div>
                 <h3 className="text-lg font-semibold">{beach.name}</h3>
                 {distance && (
                   <p className="text-sm text-muted-foreground flex items-center gap-1">
                     <MapPin className="h-3 w-3" />
                     {distance} miles away
                   </p>
                 )}
               </div>
               <Button
                 variant="ghost"
                 size="sm"
                 onClick={() => onViewBeach(beach.id)}
                 className="min-h-[44px] touch-manipulation"
               >
                 Details <ChevronRight className="h-4 w-4 ml-1" />
               </Button>
             </div>

             {/* Best Time Window */}
             <div className="bg-blue-50 rounded-lg p-3" data-testid="best-window">
               <div className="flex items-center justify-between mb-2">
                 <span className="text-sm font-medium">Best Window</span>
                 <Badge variant="outline" className="text-xs">
                   {window.confidence}% confident
                 </Badge>
               </div>
               <div className="flex items-center gap-3">
                 <Clock className="h-4 w-4 text-blue-600" />
                 <span className="font-semibold text-blue-900">
                   {formatTimeWindow(window.start)} - {formatTimeWindow(window.end)}
                 </span>
               </div>
               <div className="flex gap-4 mt-2 text-xs text-blue-700">
                 <span className="flex items-center gap-1">
                   <TideIcon className="h-3 w-3" />
                   {window.tide}
                 </span>
                 <span className="flex items-center gap-1">
                   <Wind className="h-3 w-3" />
                   {window.wind}
                 </span>
               </div>
             </div>

             {/* Condition Pills - Reuse KpiTile */}
             <div className="grid grid-cols-3 gap-2">
               <KpiTile
                 value={window.wave_height}
                 unit="ft"
                 label="Waves"
                 className="bg-blue-50"
                 valueClassName="text-blue-600 text-lg"
               />
               <KpiTile
                 value={crowdLevel}
                 label="Crowd"
                 className="bg-green-50"
                 valueClassName="text-green-600 text-lg"
               />
               <KpiTile
                 value={score}
                 unit="%"
                 label="Match"
                 className="bg-purple-50"
                 valueClassName="text-purple-600 text-lg"
               />
             </div>

             {/* Personalization Explanation */}
             <div className="text-xs text-muted-foreground p-2 bg-gray-50 rounded">
               <p className="flex items-start gap-1">
                 <Info className="h-3 w-3 mt-0.5 flex-shrink-0" />
                 <span>{summary}</span>
               </p>
             </div>

             {/* Action Buttons */}
             <div className="flex gap-2">
               <Button
                 onClick={onPlanSession}
                 className="flex-1 bg-ocean-blue hover:bg-ocean-blue-dark min-h-[44px] touch-manipulation"
                 data-testid="plan-session-from-personalized"
               >
                 <BookOpen className="h-4 w-4 mr-2" />
                 Plan Session
               </Button>
               <Button
                 onClick={() => onViewBeach(beach.id)}
                 variant="outline"
                 className="flex-1 min-h-[44px] touch-manipulation"
               >
                 View Forecast
               </Button>
             </div>
           </CardContent>
         </Card>
       );
     }
     ```
   - Include separate components for skeleton, error, and empty states
   - Use `data-testid` attributes for Playwright tests

2. **Home screen wiring** - Follow `forecast-tab.tsx` integration pattern
   - In `components/home-screen/forecast-tab.tsx` (NOT `index.tsx`):
     - Import `usePersonalizedHomeForecast` hook
     - Call hook at component top with proper options:
       ```typescript
       const { recommendation, loading, error, refetch } = usePersonalizedHomeForecast({
         userId: profile?.id,
         homeBeachId: homeBeach?.id,
       });
       ```
     - Render with Suspense boundary:
       ```tsx
       <div className="space-y-4">
         {profile && (
           <Suspense fallback={<PersonalizedForecastSkeleton />}>
             <PersonalizedForecastCard
               recommendation={recommendation}
               loading={loading}
               error={error}
               onPlanSession={() => {
                 track("personalized_forecast_plan_clicked", {
                   beach_id: recommendation?.beach.id,
                   score: recommendation?.score,
                 });
                 router.push(`/sessions/new?mode=plan&beach=${recommendation?.beach.id}`);
               }}
               onViewBeach={(beachId) => {
                 track("personalized_forecast_view_clicked", { beach_id: beachId });
                 router.push(getBeachUrlSafe({ id: beachId }));
               }}
             />
           </Suspense>
         )}

         {/* Regular forecast display continues below */}
         {shouldShowHomeBeachBanner && <HomeBeachBanner />}
         {/* ... existing forecast content ... */}
       </div>
       ```
   - Keep logic isolated so Forecast tab continues to function even if personalized service fails
   - Use guard clauses and error boundaries

3. **Copy & formatting**
   - Follow Quiver's content voice: helpful coach, not marketing
   - Content guidelines stored in `docs/copy/home-personalized-forecast.md` (optional) to align design/product review.

### Phase 4 – Analytics, Feedback, & Controls
1. Instrument events:
   - `personalized_forecast_impression`, `personalized_forecast_click_plan`, `personalized_forecast_click_view_beach`, `personalized_forecast_dismissed`, `personalized_forecast_feedback_submitted`.
   - Payload fields: `beach_id`, `score`, `window_start/end`, `reasons`, `personalized` boolean.
2. Optional `Was this helpful?` micro-feedback button writing to Supabase table `personalized_forecast_feedback`.
3. Feature flag via existing config (e.g., `utils/feature-flags.ts`) to roll out gradually or disable quickly from remote config.

## Testing & Validation

### Unit Tests (Jest)
- **Service layer** (`lib/services/personalized-home-forecast-service.test.ts`):
  - Mock Supabase client and forecast API responses
  - Test candidate pool building logic
  - Verify batching respects concurrency limits (max 3 parallel)
  - Test caching behavior (hit, miss, expiration)
  - Test timeout handling (5-second limit)
  - Verify scoring integration with `personalized-scoring-service`
  - Test window selection logic (best time calculation)

- **Hook tests** (`hooks/use-personalized-home-forecast.test.ts`):
  - Test `useDataFetcher` integration
  - Verify skip logic when userId is null
  - Test stale data detection (>30 min)
  - Test error state handling
  - Verify refetch mechanism

- **Component tests** (`components/home-screen/personalized-forecast-card.test.tsx`):
  - Snapshot tests for all states: loading, ready, error, needs_prefs
  - Test callback handlers (onPlanSession, onViewBeach)
  - Verify proper prop passing to KpiTile components
  - Test responsive rendering (mobile vs desktop)

### Integration Tests (Playwright)
Create new file: `e2e/personalized-forecast.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import { seedTestUser, seedBeachData, mockForecastAPI } from "./fixtures";

test.describe("Personalized Home Forecast", () => {
  test("shows personalized recommendation for user with preferences", async ({ page }) => {
    // Setup: User with 10+ sessions and preferences
    const user = await seedTestUser({
      hasPreferences: true,
      preferredWaveSize: "medium",
      sessions: 10,
    });

    await page.goto("/home?tab=forecast");

    // Verify card appears
    await expect(page.locator('[data-testid="personalized-forecast-card"]')).toBeVisible();
    await expect(page.locator('[data-testid="personalization-badge"]')).toContainText("For You");

    // Verify window is displayed
    await expect(page.locator('[data-testid="best-window"]')).toBeVisible();
    await expect(page.locator('[data-testid="best-window"]')).toContainText(/\d{1,2}:\d{2}/); // Time format

    // Test Plan Session interaction
    await page.click('[data-testid="plan-session-from-personalized"]');
    await expect(page).toHaveURL(/\/sessions\/new\?mode=plan/);
  });

  test("shows needs-prefs state for new users", async ({ page }) => {
    const newUser = await seedTestUser({ sessions: 0 });

    await page.goto("/home?tab=forecast");

    // Should show prompt to update preferences
    await expect(page.locator('[data-testid="needs-more-data-message"]')).toBeVisible();
    await expect(page.getByText(/Set Your Preferences/i)).toBeVisible();

    // Click should navigate to profile
    await page.click("text=Update Profile");
    await expect(page).toHaveURL("/profile");
  });

  test("handles rate limiting gracefully", async ({ page }) => {
    // Mock rate limit response
    await page.route("**/api/home/personalized-forecast", (route) => {
      route.fulfill({ status: 429, body: JSON.stringify({ error: "Too many requests" }) });
    });

    await seedTestUser({ sessions: 10 });
    await page.goto("/home?tab=forecast");

    await expect(page.locator('[data-testid="rate-limit-message"]')).toBeVisible();
    await expect(page.getByText(/Too Many Requests/i)).toBeVisible();
  });

  test("mobile responsiveness and touch targets", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }); // iPhone SE

    await seedTestUser({ sessions: 10 });
    await page.goto("/home?tab=forecast");

    const card = page.locator('[data-testid="personalized-forecast-card"]');
    await expect(card).toBeVisible();

    // Verify touch targets meet 44px minimum
    const buttons = card.locator("button");
    for (const button of await buttons.all()) {
      const box = await button.boundingBox();
      expect(box?.height).toBeGreaterThanOrEqual(44);
    }

    // Verify vertical stacking on mobile
    const kpiGrid = card.locator(".grid");
    const gridClasses = await kpiGrid.getAttribute("class");
    expect(gridClasses).toContain("grid-cols-3");
  });

  test("shows building profile state for intermediate users", async ({ page }) => {
    await seedTestUser({ sessions: 4 }); // Between 3-5 sessions

    await page.goto("/home?tab=forecast");

    await expect(page.getByText(/Getting to know your style/i)).toBeVisible();
    await expect(page.getByText(/Log.*more sessions/i)).toBeVisible();
  });

  test("integrates with analytics tracking", async ({ page }) => {
    const analyticsEvents: any[] = [];

    // Intercept analytics calls
    await page.route("**/api/analytics/**", (route) => {
      analyticsEvents.push(route.request().postDataJSON());
      route.fulfill({ status: 200 });
    });

    await seedTestUser({ sessions: 10 });
    await page.goto("/home?tab=forecast");

    await page.click('[data-testid="plan-session-from-personalized"]');

    // Verify analytics event fired
    const planEvent = analyticsEvents.find(e => e.event === "personalized_forecast_plan_clicked");
    expect(planEvent).toBeDefined();
    expect(planEvent.beach_id).toBeTruthy();
  });

  test("degrades gracefully on API failure", async ({ page }) => {
    // Mock API error
    await page.route("**/api/home/personalized-forecast", (route) => {
      route.fulfill({ status: 500, body: JSON.stringify({ error: "Internal server error" }) });
    });

    await seedTestUser({ sessions: 10 });
    await page.goto("/home?tab=forecast");

    // Should still show regular forecast content
    await expect(page.locator('[data-testid="personalized-forecast-card"]')).not.toBeVisible();
    // Regular forecast should be visible
    await expect(page.locator('[data-testid="forecast-display"]')).toBeVisible();
  });

  test("updates when home beach changes", async ({ page }) => {
    const user = await seedTestUser({ sessions: 10 });

    await page.goto("/home?tab=forecast");

    const firstBeach = await page.locator('[data-testid="personalized-forecast-card"] h3').textContent();

    // Change home beach
    await page.click('[data-testid="set-home-beach-button"]');
    await page.click('[data-testid="beach-option-alternative"]');

    // Wait for re-fetch
    await page.waitForTimeout(1000);

    const secondBeach = await page.locator('[data-testid="personalized-forecast-card"] h3').textContent();
    expect(secondBeach).not.toBe(firstBeach);
  });
});
```

### API Route Tests
Create file: `__tests__/api/home/personalized-forecast.test.ts`

```typescript
import { testApiHandler } from "next-test-api-route-handler";
import * as handler from "@/app/api/home/personalized-forecast/route";

describe("/api/home/personalized-forecast", () => {
  it("returns 401 when not authenticated", async () => {
    await testApiHandler({
      handler,
      test: async ({ fetch }) => {
        const res = await fetch({ method: "GET" });
        expect(res.status).toBe(401);
      },
    });
  });

  it("returns 204 when user has no preferences", async () => {
    // Mock authenticated user with no prefs
    // ... test implementation
  });

  it("returns personalized recommendation for valid user", async () => {
    // Mock authenticated user with preferences
    // ... test implementation
  });

  it("enforces rate limiting", async () => {
    // Make multiple rapid requests
    // Verify 429 response after threshold
  });
});
```

### Load Testing
Script: `scripts/load-test-personalized-forecast.ts`
- Hit `/api/home/personalized-forecast` with 100 concurrent requests
- Verify caching reduces database load
- Measure P50, P95, P99 response times
- Confirm rate limiting activates appropriately

### Manual QA Checklist
- [ ] User with home beach set
- [ ] User without home beach (should show popular beach)
- [ ] User with no preferences (show prompt)
- [ ] User with 3-5 sessions (building profile state)
- [ ] User with 10+ sessions (full personalization)
- [ ] User toggling favorites (verify re-fetch)
- [ ] GEO permission denied (distance not shown)
- [ ] GEO permission granted (distance shown)
- [ ] Offline mode (show cached or error)
- [ ] Slow network (loading skeleton)
- [ ] Desktop viewport (1920x1080)
- [ ] Mobile viewport (375x667)
- [ ] Tablet viewport (768x1024)
- [ ] Dark mode compatibility (if applicable)
- [ ] Click through to beach detail
- [ ] Click through to plan session
- [ ] Analytics events firing correctly

## Coordinate Conventions (CRITICAL)

**MUST follow Quiver's coordinate naming standards** (see `/docs/COORDINATE_CONVENTIONS.md`):

### Standard Naming
- ✅ **CORRECT**: `lat`, `lon`, `latitude`, `longitude`
- ❌ **INCORRECT**: `lng` (do NOT use in new code)

### Implementation Requirements

1. **API Parameters**:
   ```typescript
   // ✅ CORRECT
   const params = new URLSearchParams({
     lat: String(coords.lat),
     lon: String(coords.lon),  // NOT lng!
   });
   ```

2. **Component Props**:
   ```typescript
   // ✅ CORRECT - Use full names
   interface BeachProps {
     latitude: number;
     longitude: number;  // NOT lng!
   }
   ```

3. **Database Mapping** (CRITICAL):
   ```typescript
   // ❌ WRONG - Assumes property names match
   <Component latitude={beach.latitude} />  // beach.latitude doesn't exist!

   // ✅ CORRECT - Explicit mapping from database fields
   <Component
     latitude={beach.center_lat}
     longitude={beach.center_lng}  // Legacy DB field name
   />
   ```

4. **Validation**:
   ```typescript
   import { assertValidCoordinates } from '@/lib/coordinate-validation';

   // Before API calls
   assertValidCoordinates(lat, lon, 'Personalized forecast API');

   // In development
   if (process.env.NODE_ENV === 'development') {
     validateCoordinates(latitude, longitude, 'PersonalizedForecastCard');
   }
   ```

### Common Pitfalls to Avoid
- Using `lng` instead of `lon` in API parameters
- Assuming `beach.latitude` exists (it's `beach.center_lat`)
- Not mapping database fields to component props
- Swapping latitude and longitude values

## Dependencies & Risks

### Data Dependencies
- **Supabase data freshness**: `user_surf_preferences` must be populated
  - **Action**: Add migration/backfill task if coverage is low
  - **Minimum**: Require 3 sessions before showing personalized recommendations
- **Beach affinity data**: `user_beach_affinity` table must exist and be populated
  - **Action**: Verify migration `20251103000002_beach_affinity.sql` has run
  - **Verification**: Run migration verification script (see below)
- **Forecast API availability**: Depends on external forecast provider uptime
  - **Mitigation**: Implement 5-second timeout and graceful degradation

#### Migration Verification Script

Create `scripts/verify-personalized-forecast-dependencies.sql` to verify all required tables and columns exist:

```sql
-- Migration Verification Script for Personalized Forecast Feature
-- Run this before deploying the personalized forecast API

DO $$
DECLARE
  missing_dependencies TEXT[] := ARRAY[]::TEXT[];
BEGIN
  -- Check if user_surf_preferences table exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_surf_preferences'
  ) THEN
    missing_dependencies := array_append(missing_dependencies,
      'user_surf_preferences table does not exist. Run migration 20251103000003.');
  END IF;

  -- Check if user_beach_affinity table exists
  IF NOT EXISTS (
    SELECT FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name = 'user_beach_affinity'
  ) THEN
    missing_dependencies := array_append(missing_dependencies,
      'user_beach_affinity table does not exist. Run migration 20251103000002.');
  END IF;

  -- Check if required columns exist in profiles table
  IF NOT EXISTS (
    SELECT FROM information_schema.columns
    WHERE table_schema = 'public'
    AND table_name = 'profiles'
    AND column_name = 'preferred_wave_size'
  ) THEN
    missing_dependencies := array_append(missing_dependencies,
      'profiles.preferred_wave_size column missing.');
  END IF;

  -- Check if RLS is enabled
  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'user_surf_preferences'
    AND rowsecurity = false
  ) THEN
    missing_dependencies := array_append(missing_dependencies,
      'RLS not enabled on user_surf_preferences. Run RLS migration.');
  END IF;

  IF EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'user_beach_affinity'
    AND rowsecurity = false
  ) THEN
    missing_dependencies := array_append(missing_dependencies,
      'RLS not enabled on user_beach_affinity. Run RLS migration.');
  END IF;

  -- Report results
  IF array_length(missing_dependencies, 1) > 0 THEN
    RAISE EXCEPTION E'Missing dependencies for Personalized Forecast:\n%',
      array_to_string(missing_dependencies, E'\n');
  ELSE
    RAISE NOTICE 'All dependencies verified successfully ✓';
  END IF;
END $$;
```

**Run verification**:
```bash
# Local development
npx supabase db push
psql -h 127.0.0.1 -p 54322 -U postgres -d postgres -f scripts/verify-personalized-forecast-dependencies.sql

# Production (via Supabase CLI)
npx supabase db execute --file scripts/verify-personalized-forecast-dependencies.sql --project-ref <project-ref>
```

### Performance Risks
- **Forecast API latency**: Multiple forecast fetches could be slow
  - **Mitigation**: Batching (max 3 concurrent), caching (5 min TTL), timeouts
- **Database query performance**: Complex joins for candidate pool
  - **Mitigation**: Add proper indexes, limit candidate pool to 10 beaches max
- **Memory usage**: LRU cache could grow large
  - **Mitigation**: Limit cache to 100 entries, 5-minute TTL

### Privacy & Security
- **User data exposure**: Only show data for authenticated user
  - **Action**: Ensure API route validates session before accessing service role
- **RLS policies**: Verify proper row-level security on all tables
  - **Action**: Review and test RLS policies for `user_surf_preferences`, `user_beach_affinity`
  - **Implementation**: Add RLS policies in migration (see below)
- **Rate limiting**: Prevent abuse of forecast endpoint
  - **Action**: Implement rate limiting middleware (10 req/min per user)

#### Required RLS Policies

Add to migration file (e.g., `supabase/migrations/YYYYMMDDHHMMSS_add_personalized_forecast_rls.sql`):

```sql
-- Enable RLS on user_surf_preferences table
ALTER TABLE user_surf_preferences ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only select their own preferences
CREATE POLICY "select_own_surf_preferences"
ON user_surf_preferences FOR SELECT
USING ((select auth.uid()) = user_id);

-- Enable RLS on user_beach_affinity table
ALTER TABLE user_beach_affinity ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only select their own beach affinity data
CREATE POLICY "select_own_beach_affinity"
ON user_beach_affinity FOR SELECT
USING ((select auth.uid()) = user_id);

-- Grant necessary permissions
GRANT SELECT ON user_surf_preferences TO authenticated;
GRANT SELECT ON user_beach_affinity TO authenticated;
```

**Testing RLS Policies**:
```sql
-- Test as authenticated user
SET request.jwt.claim.sub = 'test-user-id';

-- Should return only rows for test-user-id
SELECT * FROM user_surf_preferences WHERE user_id = 'test-user-id';
SELECT * FROM user_beach_affinity WHERE user_id = 'test-user-id';

-- Should return empty (no access to other users' data)
SELECT * FROM user_surf_preferences WHERE user_id = 'other-user-id';
SELECT * FROM user_beach_affinity WHERE user_id = 'other-user-id';
```

### Design & UX Risks
- **Design alignment**: Visual design must match Quiver's style
  - **Action**: Need Figma mockup review with product/design before implementation
- **Content voice**: Copy must sound like a helpful coach, not marketing
  - **Action**: Review copy with content team
- **Accessibility**: Must meet WCAG AA standards
  - **Action**: Accessibility audit after implementation

### Edge Cases
- **Best window before sunrise/after sunset**:
  - **Solution**: Clamp to daylight hours OR add "dawn patrol" / "sunset session" label
- **No valid candidates**: All beaches fail scoring
  - **Solution**: Return 204 status, show generic recommendation
- **Forecast data missing**: Candidate beach has no forecast
  - **Solution**: Skip that beach, try next candidate
- **User location unavailable**: No geolocation permission
  - **Solution**: Don't show distance, proceed with home beach
- **Stale recommendations**: User hasn't refreshed in hours
  - **Solution**: Auto-detect stale data (>30 min), show "Refresh" button

## Performance Budgets & Monitoring

### API Response Time Targets
```typescript
const PERFORMANCE_BUDGETS = {
  // API endpoint response times (ms)
  personalizedForecast: {
    p50: 500,   // 50th percentile - must be <500ms
    p95: 1500,  // 95th percentile - must be <1.5s
    p99: 3000,  // 99th percentile - must be <3s
    timeout: 5000, // Hard timeout - abort after 5s
  },

  // Component render times (ms)
  componentRender: {
    firstRender: 100,  // Initial render <100ms
    reRender: 50,      // Subsequent renders <50ms
  },

  // Bundle size impact
  bundleSize: {
    maxIncrease: 15,   // Maximum 15KB gzipped increase
    totalJsLimit: 300, // Total JS budget: 300KB gzipped
  },

  // Cache effectiveness
  cacheHitRate: {
    target: 0.7,       // 70% cache hit rate
    minimum: 0.5,      // 50% minimum acceptable
  },
};
```

### Monitoring & Telemetry

1. **API Metrics** (track in service):
   ```typescript
   {
     duration_ms: number,
     candidate_count: number,
     cache_hit: boolean,
     winning_beach_id: string,
     user_id: string,
     personalized: boolean,
     score: number,
     error?: string,
     timestamp: ISO8601,
   }
   ```

2. **Frontend Metrics** (track with analytics):
   ```typescript
   // Performance
   track("personalized_forecast_performance", {
     fetch_duration_ms: number,
     render_duration_ms: number,
     cache_hit: boolean,
   });

   // User Interactions
   track("personalized_forecast_impression", {
     beach_id: string,
     score: number,
     personalized: boolean,
     session_count: number,
   });

   // Errors
   track("personalized_forecast_error", {
     error_type: "rate_limit" | "timeout" | "no_data" | "api_error",
     beach_id?: string,
     candidate_count?: number,
   });
   ```

3. **Sentry Error Tracking**:
   - Log all API errors with context
   - Track rate limiting occurrences
   - Monitor cache miss patterns
   - Alert on P99 > 5s

### Alerting Thresholds
- **P95 response time > 2s** for 5 minutes → Alert engineering
- **Cache hit rate < 50%** for 1 hour → Investigate caching
- **Error rate > 5%** for 5 minutes → Alert on-call
- **Rate limit hits > 100/hour** → Review rate limiting config

## Feature Flags & Rollout

### Feature Flag Configuration
```typescript
// lib/features/flags.ts
export const FEATURE_FLAGS = {
  HOME_PERSONALIZED_FORECAST: {
    enabled: process.env.NEXT_PUBLIC_ENABLE_PERSONALIZED_FORECAST === "true",
    rolloutPercentage: parseInt(process.env.NEXT_PUBLIC_PERSONALIZED_ROLLOUT || "0"),

    isEnabled(userId?: string): boolean {
      if (!this.enabled) return false;
      if (this.rolloutPercentage === 100) return true;
      if (!userId) return false;

      // Consistent rollout based on user ID hash
      const hash = hashCode(userId);
      return (hash % 100) < this.rolloutPercentage;
    },
  },
};

// Usage in component
if (FEATURE_FLAGS.HOME_PERSONALIZED_FORECAST.isEnabled(userId)) {
  return <PersonalizedForecastCard {...props} />;
}
```

### Rollout Plan

#### Phase 1: Internal Dogfooding (Week 1)
- Enable flag for internal users only
- Seed QA users with varied preference profiles
- Collect feedback on UX and accuracy
- Monitor error logs and performance
- **Success criteria**: 0 critical bugs, <2s P95 response time

#### Phase 2: Limited Beta (Week 2)
- Gradually expand to 10% of users (A/B test)
- Monitor KPIs:
  - Home → Beach detail click-through rate
  - Home → Plan Session conversion rate
  - Recommendation accuracy (user feedback)
- **Success criteria**: Conversion lift >10% vs control

#### Phase 3: Expanded Rollout (Week 3)
- Expand to 50% of users
- Continue monitoring metrics
- Collect "Was this helpful?" feedback
- Iterate on algorithm if needed
- **Success criteria**: No degradation in core metrics

#### Phase 4: Full Release (Week 4)
- Deploy to 100% of users
- Monitor for 72 hours
- Collect success metrics:
  - Session creation rate
  - User engagement with recommendations
  - Forecast accuracy feedback
- **Success criteria**: >20% increase in home-to-session flow

### Rollback Plan
If critical issues occur:
1. **Immediate**: Set `NEXT_PUBLIC_PERSONALIZED_ROLLOUT=0`
2. **Within 5 minutes**: Deploy config change
3. **Within 15 minutes**: Verify card is hidden for all users
4. **Post-incident**: Review logs, fix bugs, re-deploy

## Implementation Checklist

### Phase 1: Backend (Week 1)
- [ ] Create `types/personalization.ts` with interfaces
- [ ] Implement `lib/services/personalized-home-forecast-service.ts`
  - [ ] Candidate pool building
  - [ ] Batch forecast fetching (max 3 concurrent)
  - [ ] LRU cache implementation
  - [ ] Timeout handling (5s)
- [ ] Create API route `app/api/home/personalized-forecast/route.ts`
  - [ ] Authentication check
  - [ ] Rate limiting middleware
  - [ ] Telemetry logging
- [ ] Add database indexes for performance
- [ ] Unit tests for service layer

### Phase 2: Frontend (Week 1-2)
- [ ] Create `hooks/use-personalized-home-forecast.ts`
  - [ ] Proper `useDataFetcher` integration
  - [ ] Stale data detection
- [ ] Create `components/home-screen/personalized-forecast-card.tsx`
  - [ ] Main card component
  - [ ] Skeleton loading state
  - [ ] Error states
  - [ ] Empty states (needs prefs, building profile)
- [ ] Integrate into `forecast-tab.tsx`
  - [ ] Hook invocation
  - [ ] Suspense boundary
  - [ ] Analytics tracking
- [ ] Mobile responsiveness testing
- [ ] Component unit tests

### Phase 3: Testing & Quality (Week 2)
- [ ] Playwright E2E tests (`e2e/personalized-forecast.spec.ts`)
  - [ ] Happy path test
  - [ ] New user state test
  - [ ] Rate limiting test
  - [ ] Mobile responsiveness test
  - [ ] Analytics integration test
- [ ] API route tests
- [ ] Load testing script
- [ ] Accessibility audit
- [ ] Manual QA across devices

### Phase 4: Launch Prep (Week 2-3)
- [ ] Feature flag implementation
- [ ] Performance monitoring setup
- [ ] Sentry error tracking configuration
- [ ] Analytics dashboard setup
- [ ] Documentation complete
- [ ] Team training / walkthrough
- [ ] Rollout plan approval

### Phase 5: Rollout & Monitor (Week 3-4)
- [ ] Internal dogfooding (10 users)
- [ ] Beta rollout (10% users)
- [ ] Expanded rollout (50% users)
- [ ] Full release (100% users)
- [ ] Post-launch monitoring (72h)
- [ ] Collect and analyze metrics
- [ ] Iterate on algorithm if needed

## Success Metrics

### Primary KPIs
- **Session creation rate**: +20% from personalized recommendations
- **Home → Beach detail CTR**: +15% vs generic forecast
- **User satisfaction**: >75% "helpful" feedback rating

### Secondary KPIs
- **Recommendation accuracy**: >80% confidence on average
- **Cache hit rate**: >70% to minimize API calls
- **API performance**: P95 <1.5s response time
- **Error rate**: <2% of requests fail

### Monitoring Dashboards
- Real-time: Vercel Analytics + custom dashboard
- Weekly: Session creation trends
- Monthly: User engagement and retention impact

---

## API Specification

### Endpoint Definition

```
GET /api/home/personalized-forecast
```

**Authentication**: Required (Supabase session cookie)
**Authorization**: User can only access their own personalized forecast
**Rate Limit**: 10 requests per minute per user
**Cache**: 5 minutes (HTTP + server-side)

### Request Parameters

| Parameter | Type | Required | Validation | Description |
|-----------|------|----------|------------|-------------|
| `lat` | number | No | -90 to 90 | User's current latitude (short name, NOT `latitude`) |
| `lon` | number | No | -180 to 180 | User's current longitude (short name, NOT `lng`) |
| `homeBeachId` | string | No | UUID format | Override home beach ID |

**Validation Rules**:
- If `lat` is provided, `lon` must also be provided (and vice versa)
- Coordinates must be valid geographic coordinates
- `homeBeachId` must be a valid UUID if provided

```typescript
// Request validation schema (Zod)
import { z } from 'zod';

export const PersonalizedForecastQuerySchema = z.object({
  lat: z.coerce.number().min(-90).max(90).optional(),
  lon: z.coerce.number().min(-180).max(180).optional(),
  homeBeachId: z.string().uuid().optional(),
}).refine(
  (data) => (data.lat !== undefined) === (data.lon !== undefined),
  { message: 'Both lat and lon must be provided together' }
);
```

### Response Format

#### Success Response (200 OK)

**With Recommendation**:
```typescript
{
  "success": true,
  "data": {
    "beach": {
      "id": "beach-123",
      "name": "Ocean Beach",
      "latitude": 32.7534,     // Mapped from database field center_lat
      "longitude": -117.2511   // Mapped from database field center_lng
    },
    "window": {
      "start": "2025-11-18T08:00:00Z",    // ISO 8601 timestamp
      "end": "2025-11-18T11:00:00Z",      // ISO 8601 timestamp
      "tide": "mid-tide rising",
      "wind": "E 5-8 mph",
      "waveHeight": "3-4 ft",             // camelCase (NOT wave_height)
      "confidence": 85                     // 0-100
    },
    "forecast": { /* EnhancedForecastEntity */ },
    "score": 87,                          // 0-100
    "personalized": true,
    "breakdown": {
      "base": 30,
      "onboardingPrefs": 25,              // camelCase (NOT onboarding_prefs)
      "learnedPrefs": 20,                 // camelCase (NOT learned_prefs)
      "affinity": 12
    },
    "summary": "3-4 ft waves match your preference + offshore wind + mid-tide rising",
    "reasons": [
      "Good wave height (3-4ft)",
      "Offshore winds (E)",
      "Mid tide in sweet spot",
      "High forecast confidence"
    ],
    "generatedAt": "2025-11-18T06:00:00Z"  // camelCase (NOT generated_at)
  },
  "timestamp": "2025-11-18T06:00:00Z"
}
```

**No Recommendation** (insufficient data):
```typescript
{
  "success": true,
  "data": null,    // NOT 204 No Content - always return 200 with null
  "timestamp": "2025-11-18T06:00:00Z"
}
```

#### Error Responses

**400 Bad Request** (Invalid parameters):
```typescript
{
  "success": false,
  "error": "Invalid coordinates: latitude must be between -90 and 90",
  "timestamp": "2025-11-18T06:00:00Z"
}
```

**401 Unauthorized** (Not authenticated):
```typescript
{
  "success": false,
  "error": "Authentication required",
  "timestamp": "2025-11-18T06:00:00Z"
}
```

**429 Too Many Requests** (Rate limit exceeded):
```typescript
{
  "success": false,
  "error": "Too many requests. Please wait before refreshing forecast data.",
  "timestamp": "2025-11-18T06:00:00Z"
}
```

**Headers**:
```
Retry-After: 60
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 0
X-RateLimit-Reset: 1700300400
```

**500 Internal Server Error**:
```typescript
{
  "success": false,
  "error": "Failed to fetch personalized forecast",
  "timestamp": "2025-11-18T06:00:00Z"
}
```

### Response Headers

**Success Response (200 OK)**:
```
Cache-Control: public, max-age=300, s-maxage=300
ETag: "abc123..."
Expires: Mon, 18 Nov 2025 06:05:00 GMT
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
X-XSS-Protection: 1; mode=block
```

**Conditional Request Support**:
```
Request:
  If-None-Match: "abc123..."

Response (if not modified):
  304 Not Modified
  (empty body)
```

### TypeScript Type Definitions

```typescript
// types/personalization.ts

import type { Beach, EnhancedForecastEntity } from '@/types/database';

/**
 * Personalized forecast recommendation
 */
export interface PersonalizedForecastRecommendation {
  beach: Beach;
  window: {
    start: string;        // ISO 8601 timestamp
    end: string;          // ISO 8601 timestamp
    tide: string;
    wind: string;
    waveHeight: string;   // camelCase
    confidence: number;   // 0-100
  };
  forecast: EnhancedForecastEntity;
  score: number;          // 0-100
  personalized: boolean;
  breakdown: {
    base: number;
    onboardingPrefs: number;  // camelCase
    learnedPrefs: number;     // camelCase
    affinity: number;
  };
  summary: string;
  reasons: string[];
  generatedAt: string;    // ISO 8601, camelCase
}

/**
 * Standard API success response
 */
export interface ApiSuccess<T> {
  success: true;
  data: T;
  timestamp: string;  // ISO 8601
}

/**
 * Standard API error response
 */
export interface ApiError {
  success: false;
  error: string;
  details?: any;
  timestamp: string;  // ISO 8601
}

/**
 * API response type
 */
export type PersonalizedForecastResponse =
  | ApiSuccess<PersonalizedForecastRecommendation | null>
  | ApiError;
```

### Example Requests

**Example 1: Get personalized forecast with location**
```bash
curl -X GET \
  'https://quiver.surf/api/home/personalized-forecast?lat=32.7157&lon=-117.1611' \
  -H 'Cookie: sb-access-token=eyJhbG...' \
  -H 'Accept: application/json'
```

**Example 2: Get personalized forecast with home beach override**
```bash
curl -X GET \
  'https://quiver.surf/api/home/personalized-forecast?homeBeachId=123e4567-e89b-12d3-a456-426614174000' \
  -H 'Cookie: sb-access-token=eyJhbG...' \
  -H 'Accept: application/json'
```

**Example 3: Conditional request with ETag**
```bash
curl -X GET \
  'https://quiver.surf/api/home/personalized-forecast' \
  -H 'Cookie: sb-access-token=eyJhbG...' \
  -H 'If-None-Match: "abc123..."' \
  -H 'Accept: application/json'
```

### Caching Strategy (Three-Tier)

1. **HTTP Cache** (Browser/CDN):
   - Duration: 5 minutes
   - Headers: `Cache-Control: public, max-age=300`
   - Invalidation: Time-based expiration
   - Support: `If-None-Match` for bandwidth savings

2. **Server-side Cache** (LRU):
   - Duration: 5 minutes
   - Key: `userId-lat-lon`
   - Size: 100 entries
   - Invalidation: Time-based + LRU eviction

3. **Client-side Cache** (React state):
   - Duration: Until component unmount or manual refetch
   - Invalidation: Stale detection (>30 min) or user action

### API Evolution & Versioning

**Current Version**: 1.0
**Versioning Strategy**: No URI versioning (internal API)
**Breaking Changes**: Require new endpoint (e.g., `/api/home/personalized-forecast-v2`)

**Deprecation Policy**:
- Breaking changes require 90-day notice
- Old version supported for 6 months after deprecation
- Deprecated endpoints return `Warning` header:
  ```
  Warning: 299 - "This API version is deprecated. Migrate to v2 by 2026-02-15"
  ```

**Safe Changes** (non-breaking):
- Adding optional fields to response
- Adding new query parameters (with defaults)
- Adding new error codes

**Breaking Changes** (require new version):
- Removing or renaming fields
- Changing field types
- Changing required parameters
- Changing authentication mechanism

### Rate Limiting

**Limits**:
- 10 requests per minute per user
- Sliding window algorithm

**Headers**:
```
X-RateLimit-Limit: 10
X-RateLimit-Remaining: 7
X-RateLimit-Reset: 1700300400  // Unix timestamp
```

**Exceeded Response**:
```
429 Too Many Requests
Retry-After: 60  // Seconds until reset
```

**Implementation** (choose one):

Option 1: Supabase database-backed (recommended for accuracy):
```sql
-- Migration: rate_limiting.sql
CREATE TABLE IF NOT EXISTS api_rate_limits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id),
  endpoint TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  INDEX idx_rate_limits_lookup (user_id, endpoint, created_at)
);

CREATE OR REPLACE FUNCTION check_rate_limit(
  p_user_id UUID,
  p_endpoint TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER
) RETURNS BOOLEAN AS $$
DECLARE
  call_count INTEGER;
BEGIN
  -- Count calls in window
  SELECT COUNT(*) INTO call_count
  FROM api_rate_limits
  WHERE user_id = p_user_id
    AND endpoint = p_endpoint
    AND created_at > NOW() - (p_window_seconds || ' seconds')::INTERVAL;

  IF call_count >= p_limit THEN
    RETURN FALSE;
  END IF;

  -- Record this call
  INSERT INTO api_rate_limits (user_id, endpoint)
  VALUES (p_user_id, p_endpoint);

  RETURN TRUE;
END;
$$ LANGUAGE plpgsql;
```

Option 2: In-memory (Upstash Redis):
```typescript
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '1 m'),
  analytics: true,
});

// In API route
const { success, limit, remaining, reset } = await ratelimit.limit(
  `personalized_forecast:${user.id}`
);
```

### Performance Requirements

**API Response Times**:
- P50: <500ms
- P95: <1500ms
- P99: <3000ms
- Timeout: 5000ms (hard limit)

**Monitoring**:
```typescript
// Log metrics for each request
{
  duration_ms: number,
  cache_hit: boolean,
  candidate_count: number,
  winning_beach_id: string,
  user_id: string,
  personalized: boolean,
  score: number,
  error?: string,
  timestamp: ISO8601,
}
```

**Alerting**:
- P95 > 2s for 5 minutes → Alert engineering
- Cache hit rate < 50% for 1 hour → Investigate
- Error rate > 5% for 5 minutes → Alert on-call

## Summary of Changes from Original Plan

### Architectural Review Updates (2025-11-18)

Based on comprehensive architectural review, the following critical fixes were applied:

#### 1. API Response Format (CRITICAL FIX)
- ❌ **Before**: Returned 204 No Content when no personalized data available
- ✅ **After**: Returns 200 with `{ success: true, data: metadata }` containing reason and context
- **Impact**: Consistent with Quiver's `ApiSuccess`/`ApiError` pattern, provides actionable frontend feedback
- **Changes**:
  - Updated hook to handle `PersonalizedForecastResponse` union type
  - Added `PersonalizedForecastMetadata` interface with `reason`, `message`, `minSessionsRequired`
  - Frontend can now show specific messages based on `reason` (insufficient_data, no_beaches, etc.)

#### 2. Rate Limiting Implementation (CRITICAL FIX)
- ❌ **Before**: Rate limiting mentioned but not implemented
- ✅ **After**: Uses `withRateLimit` middleware from existing Quiver infrastructure
- **Impact**: Prevents API abuse, aligns with existing rate limiting patterns
- **Changes**:
  - Added `import { withRateLimit } from '@/lib/middleware/rate-limiter'`
  - Wrapped handler: `export const GET = withRateLimit(personalizedForecastHandler, "authenticated-forecast")`
  - Documented rate limit tier definition

#### 3. Coordinate Naming Violations (CRITICAL FIX)
- ❌ **Before**: Used `centerLat`/`centerLng` in API response, `lng` in parameters
- ✅ **After**: Uses `latitude`/`longitude` in API response, `lat`/`lon` in parameters
- **Impact**: Prevents mapping bugs, aligns with documented coordinate conventions
- **Changes**:
  - Service maps database fields: `latitude: beach.center_lat, longitude: beach.center_lng`
  - API response uses `latitude`/`longitude` (NOT `centerLat`/`centerLng`)
  - All parameters use `lat`/`lon` (NOT `lng`)

#### 4. useDataFetcher Integration (CRITICAL FIX)
- ❌ **Before**: Used `cache: "no-store"` which bypasses HTTP caching
- ✅ **After**: Uses `next: { revalidate: 0 }` to respect HTTP Cache-Control headers
- **Impact**: Allows proper HTTP caching, improves performance
- **Changes**:
  - Removed `cache: "no-store"` from fetch options
  - Added `next: { revalidate: 0 }` to let server headers control caching
  - Improved error handling to extract error message from response

#### 5. RLS Policies (NEW ADDITION)
- ❌ **Before**: No RLS policy implementation documented
- ✅ **After**: Complete RLS policies for `user_surf_preferences` and `user_beach_affinity`
- **Impact**: Ensures data security, prevents unauthorized access
- **Changes**:
  - Added migration SQL for enabling RLS on both tables
  - Added `select_own_*` policies to restrict access to user's own data
  - Added testing SQL to verify RLS policies work correctly

#### 6. Migration Verification Script (NEW ADDITION)
- ❌ **Before**: No automated dependency verification
- ✅ **After**: SQL script to verify all required tables, columns, and RLS policies exist
- **Impact**: Prevents runtime failures from missing dependencies
- **Changes**:
  - Created `scripts/verify-personalized-forecast-dependencies.sql`
  - Checks for table existence, column existence, RLS enablement
  - Provides clear error messages with migration numbers to run

### Previous Design Review Fixes (Already Applied)
1. ✅ **Data Fetching Pattern**: Uses `useDataFetcher` hook correctly
2. ✅ **Performance Optimization**: Batching, caching, timeouts implemented
3. ✅ **Component Architecture**: Aligned with `forecast-tab.tsx` patterns
4. ✅ **Mobile-First Design**: Touch targets (44px), responsive grids
5. ✅ **Testing Strategy**: Comprehensive Playwright + Jest tests
6. ✅ **Coordinate Conventions**: Documented lat/lon standards throughout
7. ✅ **Performance Budgets**: Specific metrics (P50 <500ms, P95 <1.5s, P99 <3s)

### Ready for Implementation
This refined plan now:
- Follows Quiver's established patterns exactly
- Includes production-ready code examples
- Has comprehensive testing strategy
- Addresses all critical design review issues
- Provides clear performance targets
- Includes detailed rollout and monitoring plan

---

**Owner**: Home team lead
**Supporting**: Data platform (preference enrichment), Infrastructure (caching, monitoring)
**Estimated Timeline**: 3-4 weeks from start to full rollout
**Dependencies**:
- `user_surf_preferences` table populated (>70% coverage)
- `user_beach_affinity` migration deployed
- Feature flag infrastructure available
