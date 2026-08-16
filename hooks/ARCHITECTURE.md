# Hooks Directory Architecture

## **PURPOSE**

The `/hooks` directory provides a comprehensive collection of custom React hooks that implement reusable business logic, data fetching patterns, state management, and UI interactions across the Quiver surf community platform.

## **DIRECTORY STRUCTURE**

```
hooks/
├── Core Data Fetching
├── use-data-fetcher.ts              # Universal data fetching with error handling
├── use-cached-api.ts                # Cached API calls with TTL management
├── use-cached-profile.ts            # User profile caching
│
├── Authentication & User Management
├── use-user-profile.ts              # User profile data management
├── use-user-follow.ts               # User following/follower system
│
├── Beach & Location Services
├── use-beach-search.ts              # Beach search and filtering
├── use-enhanced-beach-data.ts       # Comprehensive beach information
├── use-geolocation.ts                # Canonical user location services (geolocation)
│
├── Session Management
├── use-session-form.ts              # Session creation and editing
├── use-session-like.ts              # Session like/unlike functionality
├── use-comment-count.ts             # Session comment counting
│
├── Forecast & Weather
├── use-enhanced-forecast.ts         # Advanced forecast data
├── use-forecast-preview.ts          # Quick forecast previews
├── use-forecast-calibration.ts      # Forecast accuracy tracking
├── use-personalized-home-forecast.ts # Personalized recommendations
│
├── Social Features
├── use-activity-feed.ts             # Social activity feeds
├── use-optimized-realtime.ts        # Real-time updates optimization
│
├── Content & Media
├── use-intel-data.ts                # Community intel posts
│
├── UI & Interaction
├── use-mobile.tsx                   # Mobile device detection
├── use-toast.ts                     # Toast notification system
├── use-form-submission.ts           # Form handling and submission
├── use-personalization-milestones.ts # Personalization milestone toasts
```

## **ARCHITECTURE PATTERNS**

### **Hook Classification System**

```typescript
DataFetching
├── Core Patterns (use-data-fetcher, use-cached-api)
├── Entity-Specific (use-beach-*, use-session-*, use-user-*)
└── Real-time (use-optimized-realtime, use-activity-feed)

StateManagement
├── Form State (use-session-form, use-form-submission)
├── UI State (use-mobile, use-toast)
└── Cache Management (use-cached-*, invalidation patterns)

BusinessLogic
├── Authentication (use-user-profile, use-user-follow)
├── Social Features (use-session-like, use-activity-feed)
└── Domain Logic (use-forecast-*, use-beach-*, use-intel-*)

Geospatial
└── Location (use-geolocation)
```

### **Standardized Hook Interface Pattern**

```typescript
// Common hook return pattern
interface HookReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch?: () => Promise<void>;
  // Action methods specific to hook
}

// Options pattern for configuration
interface HookOptions {
  immediate?: boolean;
  enabled?: boolean;
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}
```

## **CORE HOOK CATEGORIES**

### **Data Fetching Hooks**

#### **useDataFetcher** (Universal Data Fetching)

- **Purpose**: Standardized data fetching with error handling and loading states
- **Pattern**: Base hook for all data fetching operations
- **Features**:
  - Automatic loading state management
  - Error handling with user-friendly messages
  - Optional immediate execution
  - Skip functionality for conditional fetching
  - Success/error callbacks

```typescript
export function useDataFetcher<T>(
  fetchFn: () => Promise<T>,
  options: DataFetcherOptions = {}
) {
  const [state, setState] = useState<DataFetcherState<T>>({
    data: null,
    loading: false,
    error: null,
  });

  const refetch = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const result = await fetchFn();
      setState({ data: result, loading: false, error: null });
      options.onSuccess?.(result);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "An error occurred";
      setState((prev) => ({ ...prev, loading: false, error: errorMessage }));
      options.onError?.(errorMessage);
    }
  }, [fetchFn, options]);

  return { ...state, refetch };
}
```

#### **useCachedApi** (Intelligent Caching)

- **Purpose**: API caching with TTL management and cache invalidation
- **Features**:
  - Time-based cache expiration
  - Manual cache invalidation
  - Location-based cache keys
  - Background refresh capabilities

```typescript
// Location-aware caching
export function createLocationCacheKey(
  prefix: string,
  latitude: number,
  longitude: number,
  precision: number = 3
): string {
  const lat = latitude.toFixed(precision);
  const lon = longitude.toFixed(precision);
  return `${prefix}-${lat}-${lon}`;
}
```

### **Beach & Location Hooks**

#### **useBeachSearch** (Search & Filtering)

- **Purpose**: Beach search with filtering and state management
- **Features**:
  - Real-time search filtering
  - Beach selection state
  - Search query persistence

#### **useGeolocation** (Geolocation)

- **Purpose**: Canonical location hook. Supports both:
  - **Auto-request on mount** (map screens)
  - **Manual request only** via `requestLocation()` (home screens / explicit CTA)

```typescript
// Home screen (no auto prompt):
const { coords, requestLocation, source } = useGeolocation({
  autoRequest: false,
});

// Map screen (auto request on mount):
const { userLocation, getUserLocation } = useGeolocation();
```

### **Session Management Hooks**

#### **useSessionForm** (Complex Form State)

- **Purpose**: Multi-step session form management with dual modes
- **Features**:
  - Plan vs Log mode switching
  - Step-based navigation
  - Form state persistence
  - Board and beach data loading

```typescript
export type SessionFormMode = "plan" | "log";

export function useSessionForm(initialMode: SessionFormMode = "plan") {
  const [mode, setMode] = useState<SessionFormMode>(initialMode);
  const [step, setStep] = useState(0);
  const [formState, setFormState] = useState<SessionFormState>(() => ({
    selectedBeach: "",
    selectedDate: new Date().toISOString().split("T")[0],
    selectedTime: "",
    selectedBoard: "",
    duration: "",
    waveQuality: "",
    notes: "",
    photos: [],
  }));

  const steps = getFormSteps(mode);
  const isFirstStep = step === 0;
  const isLastStep = step === steps.length - 1;

  return {
    mode,
    setMode,
    step,
    nextStep: () => setStep(step + 1),
    prevStep: () => setStep(step - 1),
    formState,
    updateField: (field, value) =>
      setFormState((prev) => ({ ...prev, [field]: value })),
    isFirstStep,
    isLastStep,
    steps,
  };
}
```

#### **useSessionLike** (Social Interactions)

- **Purpose**: Session like/unlike with optimistic updates
- **Features**:
  - Optimistic UI updates
  - Like count management
  - Error rollback handling
  - Real-time synchronization

### **Forecast & Weather Hooks**

#### **useEnhancedForecast** (Advanced Forecasting)

- **Purpose**: Comprehensive forecast data with caching and auto-generation
- **Features**:
  - Multi-day forecast management
  - Date-based forecast organization
  - Auto-generation triggers
  - Cache invalidation
  - Real-time updates

```typescript
export function useEnhancedForecast({
  beachId,
  defaultDays = 12,
  immediate = true,
  autoGenerate = true,
}: UseEnhancedForecastOptions): UseEnhancedForecastReturn {
  const [selectedDate, setSelectedDate] = useState(
    new Date().toISOString().split("T")[0]
  );

  const fetchData = useCallback(async () => {
    if (!beachId) return null;

    const result = await getEnhancedForecastsAction(beachId, {
      days: defaultDays,
      autoGenerate,
    });

    if (!result.success) {
      throw new Error(result.error || "Failed to fetch forecasts");
    }

    return result.data;
  }, [beachId, defaultDays, autoGenerate]);

  const { data, loading, error, refetch } = useDataFetcher(fetchData, {
    immediate: immediate && !!beachId,
  });

  // Process forecasts by date
  const forecastsByDate = useMemo(() => {
    if (!data?.forecasts) return {};

    return data.forecasts.reduce((acc, forecast) => {
      const date = forecast.forecast_date;
      if (!acc[date]) acc[date] = [];
      acc[date].push(forecast);
      return acc;
    }, {} as Record<string, EnhancedForecastEntity[]>);
  }, [data?.forecasts]);

  return {
    data,
    forecasts: data?.forecasts || [],
    forecastsByDate,
    availableDates: Object.keys(forecastsByDate),
    selectedDate,
    selectedDateForecasts: forecastsByDate[selectedDate] || [],
    loading,
    error,
    setSelectedDate,
    refetch,
    // Additional methods...
  };
}
```

#### **usePersonalizedHomeForecast** (Personalized Recommendations)

- **Purpose**: Fetch personalized surf forecast recommendations for authenticated users
- **Features**:
  - User-specific forecast scoring based on preferences and history
  - Integrates with home beach and favorite beaches
  - Optional beach ID override
  - Authentication-gated with automatic skip when user is not logged in
  - Rate-limited and cached server-side (5 minutes)

```typescript
export function usePersonalizedHomeForecast({
  homeBeachId,
  enabled = true,
  immediate = true,
}: UsePersonalizedHomeForecastOptions): UsePersonalizedHomeForecastReturn {
  const { user } = useAuth();

  const fetchPersonalizedForecast = useCallback(async () => {
    if (!user) {
      throw new Error("User must be authenticated");
    }

    const params = new URLSearchParams();
    if (homeBeachId) {
      params.set("homeBeachId", homeBeachId);
    }

    const url = `/api/home/personalized-forecast${
      params.toString() ? `?${params}` : ""
    }`;
    const response = await fetch(url);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || "Failed to fetch forecast");
    }

    const result = await response.json();
    return result.data;
  }, [user, homeBeachId]);

  const { data, loading, error, refetch } = useDataFetcher(
    fetchPersonalizedForecast,
    {
      immediate: immediate && enabled && !!user,
      skip: !enabled || !user,
    }
  );

  return {
    recommendation: data,
    loading,
    error,
    refetch,
  };
}
```

**Usage Example**:

```typescript
function HomePage() {
  const { recommendation, loading, error, refetch } =
    usePersonalizedHomeForecast({
      immediate: true,
      enabled: true,
    });

  if (loading) return <LoadingSpinner />;
  if (error) return <ErrorMessage message={error} />;
  if (!recommendation) return <NoDataMessage />;

  return (
    <ForecastCard
      beach={recommendation.beach.name}
      summary={recommendation.summary}
      score={recommendation.score}
      reasons={recommendation.reasons}
      window={recommendation.window}
    />
  );
}
```

### **useInsights** (Personalized Insights Hook) - December 2025

- **Purpose**: Fetch personalized insights comparing forecast conditions to user's session history
- **Location**: `hooks/use-insights.ts`
- **Features**:
  - Automatic fetching when enabled with valid beach and conditions
  - Three states: ready (>=3 sessions), onboarding (<3 sessions), degraded (no snapshots)
  - Similar sessions list with match percentages
  - Board recommendations when pattern detected
  - Match quality labels (Perfect/Great/Good/Low)

**TypeScript Interface:**

```typescript
interface UseInsightsOptions extends SimilarityInsightsInput {
  beachId: string; // Beach UUID
  beachName: string; // Beach name
  waveHeight: number; // Wave height in feet
  wavePeriod: number; // Wave period in seconds
  windSpeed: number; // Wind speed in mph
  windDirection?: number; // Wind direction in degrees (optional)
  tideHeight?: number; // Tide height in feet (optional)
  tideStatus?: string; // Tide status (optional)
  windowStart?: string; // ISO timestamp (optional)
  enabled?: boolean; // Whether hook is enabled (default: true)
}

interface UseInsightsReturn {
  insights: PersonalizedInsights | null; // Insights data
  loading: boolean; // Loading state
  error: string | null; // Error message
  refetch: () => Promise<void>; // Manual refetch function
}
```

**Usage Example:**

```typescript
function PersonalizedForecastCard({ recommendation }) {
  const { insights, loading, error } = useInsights({
    beachId: recommendation.beach.id,
    beachName: recommendation.beach.name,
    waveHeight: parseWaveHeight(recommendation.window.waveHeight),
    wavePeriod: parseWavePeriod(recommendation.window.wavePeriod),
    windSpeed: parseWindSpeed(recommendation.window.wind),
    windDirection: 270, // SW wind
    enabled: !!recommendation,
  });

  if (loading) return <InsightsLoader />;
  if (error) return <InsightsError message={error} />;
  if (!insights || insights.state === "onboarding")
    return <OnboardingMessage />;

  return (
    <div>
      <Badge>
        {insights.label} ({insights.matchPercent}%)
      </Badge>
      {insights.reasonBullets.map((reason) => (
        <p key={reason}>{reason}</p>
      ))}
      {insights.boardTip && <BoardTip text={insights.boardTip} />}
      {insights.similarSessions.length > 0 && (
        <Button onClick={() => setDrawerOpen(true)}>
          View {insights.similarSessions.length} similar sessions
        </Button>
      )}
    </div>
  );
}
```

**Data Flow:**

1. Hook validates required parameters (beachId, beachName, wave/wind data)
2. Constructs query params with required + optional conditions
3. Fetches from `/api/surf/insights?beachId=...&waveHeight=...`
4. Parses response into PersonalizedInsights type
5. Provides loading/error/data states via useDataFetcher pattern

**Performance:**

- Respects useDataFetcher caching patterns
- Private per-user API caching (5 minutes)
- Skip fetch when conditions invalid or user not authenticated
- Automatic refetch capability for manual refresh

**Integration:**

- Used by `PersonalizedForecastCard` component
- Drives similar sessions drawer display
- Provides board recommendation UI
- Shows match quality indicators

### **Utility Hooks**

#### **useScrollToElement** (Smooth Scrolling)

- **Purpose**: Hook for scrolling to an element when a condition is met
- **Location**: `hooks/use-scroll-to-element.ts`
- **Features**:
  - Configurable delay for DOM settling
  - Smooth or instant scroll behavior
  - Scroll block alignment options
  - Automatic cleanup on unmount

```typescript
interface UseScrollToElementOptions {
  shouldScroll: boolean;     // Whether to trigger scroll
  delay?: number;            // Delay before scrolling (ms) - allows DOM to settle
  behavior?: ScrollBehavior; // 'smooth' | 'instant' | 'auto'
  block?: ScrollLogicalPosition; // 'start' | 'center' | 'end' | 'nearest'
}

function useScrollToElement<T extends HTMLElement = HTMLDivElement>(
  options: UseScrollToElementOptions
): React.RefObject<T>;
```

**Usage Example:**

```typescript
function AccordionSection({ isActive }) {
  const ref = useScrollToElement<HTMLDivElement>({
    shouldScroll: isActive,
    delay: 100,
    behavior: 'smooth',
    block: 'start',
  });

  return <div ref={ref}>Target Section</div>;
}
```

#### **useOnboardingTracking** (Onboarding Analytics)

- **Purpose**: Connects onboarding store to event tracking for funnel analytics
- **Location**: `hooks/use-onboarding-tracking.ts`
- **Features**:
  - Tracks each step completion in the onboarding flow
  - Fires `onboarding_step` events to `/api/events`
  - Includes step index, step name, and completion status
  - Automatically handles cleanup on unmount

```typescript
function useOnboardingTracking(): void;
```

**Usage Example:**

```typescript
function OnboardingDialog() {
  // Set up tracking - call once in the dialog component
  useOnboardingTracking();

  // Rest of onboarding UI...
  return <OnboardingSteps />;
}
```

**Event Payload:**

```typescript
{
  eventType: 'onboarding_step',
  metadata: {
    step: 1,          // 1-indexed step number
    step_name: 'welcome',
    completed: true,
  }
}
```

**Integration:**

- Works with `useOnboardingStore` from `store/onboarding-store.ts`
- Fires events via `useTrackEvent` hook
- Events stored in `user_events` table for funnel analysis

---

### **Social & Real-time Hooks**

#### **useOptimizedRealtime** (Real-time Optimization)

- **Purpose**: Optimized real-time subscriptions with batching
- **Features**:
  - Subscription pooling and management
  - Batched update processing
  - Memory leak prevention
  - Connection optimization

```typescript
// Real-time subscription manager singleton
class RealtimeSubscriptionManager {
  private static instance: RealtimeSubscriptionManager;
  private channels: Map<string, RealtimeChannel> = new Map();
  private subscriptions: Map<string, RealtimeSubscription> = new Map();
  private updateQueue: RealtimeUpdate[] = [];

  subscribe(
    type: "session_likes" | "user_follows" | "comments",
    entityIds: string[],
    callback: (update: RealtimeUpdate) => void,
    options: OptimizedRealtimeOptions = {}
  ): () => void {
    const subscriptionKey = `${type}-${entityIds.sort().join(",")}`;

    // Reuse existing subscription or create new one
    if (!this.subscriptions.has(subscriptionKey)) {
      this.createSubscription(subscriptionKey, type, entityIds, options);
    }

    // Add callback to subscription
    const subscription = this.subscriptions.get(subscriptionKey)!;
    const callbackId = `${Date.now()}-${Math.random()}`;
    subscription.callbacks.set(callbackId, callback);

    // Return cleanup function
    return () => {
      subscription.callbacks.delete(callbackId);
      if (subscription.callbacks.size === 0) {
        this.cleanupSubscription(subscriptionKey);
      }
    };
  }
}
```

#### **useActivityFeed** (Social Feed Management)

- **Purpose**: Activity feed with pagination and real-time updates
- **Features**:
  - Infinite scroll pagination
  - Real-time activity updates
  - User-specific vs global feeds
  - Background refresh capabilities

### **UI & Interaction Hooks**

#### **useFormSubmission** (Form Handling)

- **Purpose**: Standardized form submission with loading states and feedback
- **Features**:
  - Loading state management
  - Success/error feedback
  - Toast integration
  - Form reset on success

```typescript
export function useFormSubmission(options: UseFormSubmissionOptions = {}) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = useCallback(
    async (submitFn: () => Promise<any>, form?: any) => {
      setIsSubmitting(true);

      try {
        const result = await submitFn();

        if (options.showToast !== false) {
          toast.success(options.successMessage || "Success!");
        }

        if (options.resetOnSuccess && form) {
          form.reset();
        }

        options.onSuccess?.(result);
        return result;
      } catch (error) {
        const errorMessage =
          error instanceof Error
            ? error.message
            : options.errorMessage || "An error occurred";

        if (options.showToast !== false) {
          toast.error(errorMessage);
        }

        options.onError?.(errorMessage);
        throw error;
      } finally {
        setIsSubmitting(false);
      }
    },
    [options, toast]
  );

  return {
    isSubmitting,
    handleSubmit,
  };
}
```

#### **usePersonalizationMilestones** (Personalization Milestone Toasts)

- **Purpose**: Fetches unshown personalization milestones and displays them as Sonner toast notifications
- **Location**: `hooks/use-personalization-milestones.ts`
- **Signature**: `usePersonalizationMilestones(isAuthenticated: boolean): void`
- **Features**:
  - Max 2 toasts per visit, staggered (2s initial delay, 1.5s between)
  - Marks milestones as shown via PATCH after display
  - Prevents double-fire in React strict mode via hasRun ref
  - Silent failure (non-critical feature)
  - Returns void (side-effect only hook)

**Usage Example:**

```typescript
function HomeScreen() {
  const { user } = useAuth();

  // Display milestone toasts for authenticated users
  usePersonalizationMilestones(!!user);

  return <div>Home content...</div>;
}
```

**Integration:**

- Related service: `lib/services/personalization-milestone-service.ts`
- Constants: `lib/constants/personalization-milestones.ts`
- Messaging utils: `lib/utils/personalization-messaging.ts`
- API endpoint: `/api/me/milestones` (GET for fetching, PATCH for marking shown)
- Toast library: Sonner (via `use-toast.ts`)

**Implementation Notes:**

- Uses `useRef` to prevent double-execution in React strict mode
- Fetches unshown milestones on mount when authenticated
- Displays up to 2 milestones with progressive delays
- Marks milestones as shown after toast display
- Gracefully handles API errors without user disruption

## **PERFORMANCE OPTIMIZATIONS**

### **Memoization Patterns**

```typescript
// Expensive calculation memoization
const processedData = useMemo(() => {
  return expensiveDataProcessing(rawData);
}, [rawData]);

// Callback memoization
const handleUpdate = useCallback(
  (id: string, value: any) => {
    updateEntity(id, value);
  },
  [updateEntity]
);
```

### **Cache Management**

```typescript
// Intelligent cache invalidation
export function invalidateProfileCache(userId?: string) {
  if (userId) {
    cache.delete(`profile-${userId}`);
  } else {
    // Clear all profile caches
    Array.from(cache.keys())
      .filter((key) => key.startsWith("profile-"))
      .forEach((key) => cache.delete(key));
  }
}
```

### **Conditional Execution**

```typescript
// Skip expensive operations when not needed
const { data, loading, error } = useDataFetcher(fetchData, {
  skip: !enabled || !beachId,
  immediate: immediate && enabled && !!beachId,
});
```

## **INTEGRATION PATTERNS**

### **Server Action Integration**

```typescript
// Server action wrapper pattern
export function useServerAction<T, Args extends any[]>(
  action: (
    ...args: Args
  ) => Promise<{ success: boolean; data?: T; error?: string }>,
  options: DataFetcherOptions = {}
) {
  const executeAction = useCallback(
    async (...args: Args) => {
      const result = await action(...args);

      if (!result.success) {
        throw new Error(result.error || "Action failed");
      }

      return result.data;
    },
    [action]
  );

  return useDataFetcher(executeAction, { immediate: false, ...options });
}
```

### **Real-time Synchronization**

```typescript
// Real-time data synchronization
useEffect(() => {
  const unsubscribe = subscriptionManager.subscribe(
    "session_likes",
    [sessionId],
    (update) => {
      if (update.type === "session_like") {
        setLikesCount(update.payload.likes_count);
        setLiked(update.payload.user_liked);
      }
    }
  );

  return unsubscribe;
}, [sessionId]);
```

## **TESTING STRATEGIES**

### **Hook Testing Patterns**

```typescript
// React Testing Library hook testing
import { renderHook, act } from "@testing-library/react";

test("useSessionLike should toggle like state", async () => {
  const { result } = renderHook(() => useSessionLike("session-123"));

  expect(result.current.liked).toBe(false);

  await act(async () => {
    await result.current.toggleLike();
  });

  expect(result.current.liked).toBe(true);
});
```

### **Integration Testing**

- Hook interaction with server actions
- Real-time update handling
- Cache invalidation behavior
- Error boundary integration

## **FUTURE ENHANCEMENTS**

### **Planned Features**

- Offline data synchronization hooks
- Advanced caching strategies with service worker
- Background sync for failed operations
- Enhanced real-time optimization
- Hook composition utilities

### **Performance Improvements**

- Virtual scrolling hooks for large lists
- Intersection observer hooks for lazy loading
- Web Worker integration for heavy computations
- Service Worker caching hooks

## **BEST PRACTICES**

### **Hook Design Principles**

1. **Single Responsibility**: Each hook has a clear, focused purpose
2. **Consistent Interface**: Standardized return patterns across similar hooks
3. **Error Handling**: Comprehensive error handling with user feedback
4. **Performance**: Optimized with memoization and conditional execution
5. **Reusability**: Generic patterns that work across different components

### **Usage Guidelines**

1. **Composition**: Combine simpler hooks to build complex functionality
2. **Dependency Arrays**: Careful management of effect dependencies
3. **Cleanup**: Proper cleanup of subscriptions and timers
4. **Testing**: Comprehensive testing of hook behavior and edge cases
5. **Documentation**: Clear documentation of hook purpose and usage

---

**Last Updated**: February 13, 2026
**Status**: Production-ready with comprehensive custom hook library
**Next Review**: After offline synchronization hooks implementation
