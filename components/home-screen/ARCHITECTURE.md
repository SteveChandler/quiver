# Home Screen Components Architecture

## 🎯 **PURPOSE**

The home screen components create the main application dashboard with personalized forecasts and community intel through a tabbed interface with lazy loading and caching.

## 📁 **COMPONENT STRUCTURE**

```
components/home-screen/
├── index.tsx           # Main HomeScreen container with tab management
├── forecast-tab.tsx    # Personalized forecast for user's home beach
├── community-tab.tsx   # Local intel dashboard (replaces community feed)
├── use-home-data.ts    # Shared data fetching hook
└── nearby-beach-chips.tsx # Location-permissioned chip row for nearest beaches
```

## 🏗️ **ARCHITECTURE PATTERNS**

### **Tab-Based Architecture**

```typescript
HomeScreen (Container)
├── TabsComponent (UI Framework)
├── ForecastTab (Lazy Loaded)
└── CommunityTab (Lazy Loaded)
```

### **Lazy Loading Pattern**

```typescript
// Performance optimization with dynamic imports
const ForecastTab = lazy(() =>
  import("./forecast-tab").then((m) => ({ default: m.ForecastTab }))
);

// Suspense boundaries with loading states
<Suspense fallback={<TabSkeleton />}>
  <ForecastTab profile={profile} homeBeach={homeBeach} />
</Suspense>;
```

### **Shared Data Strategy**

```typescript
// Centralized data fetching with memoization
const { beaches, sessions, loading } = useHomeData();

// Cached profile data to prevent flickering
const { profile, homeBeach, profileLoading, hasCachedData } =
  useCachedProfile();
```

### **Location-Permissioned Nearby Chips**

```typescript
// Follows useDataFetcher pattern and `useGeolocation({ autoRequest: false })` for permissioned location
<NearbyBeachChips onSelect={(b) => setSelectedBeachOverride(b)} />

// Chip click sets override beach to immediately preview Today at <beach>
<ForecastTab overrideBeach={selectedBeachOverride} />
```

Behavior:

- Prominent "Use my location" CTA for first-time visitors (no auto-prompt).
- After grant, fetches `/api/beaches/nearby?latitude&longitude&limit=5`.
- Renders horizontally scrollable chips; tap to preview and optionally Set Home Beach.

Constraints:

- Uses `useDataFetcher` and `useGeolocation` (manual request) per hooks/ARCHITECTURE.md.
- No new data fetching patterns introduced.

## 📊 **COMPONENT RESPONSIBILITIES**

### **HomeScreen** (Main Container)

- **Purpose**: Tab orchestration and layout management
- **State Management**: Active tab state, user authentication
- **Features**:
  - Lazy loading of tab components
  - Shared data distribution
  - Responsive welcome section
  - Bottom navigation integration

**Key Features:**

```typescript
// Tab management
const [activeTab, setActiveTab] = useState("forecast");

// Lazy loading with error boundaries
<Suspense fallback={<TabSkeleton />}>
  <ForecastTab profile={profile} homeBeach={homeBeach} />
</Suspense>;

// Welcome personalization
{
  user ? profile?.full_name || "Surfer" : "Guest";
}
```

### **ForecastTab** (Personalized Forecasts)

- **Purpose**: Home beach forecast with community calibration
- **Props**: `profile: Profile | null, homeBeach: Beach | null`
- **Features**:
  - Personalized forecast for user's home beach
  - Community-adjusted vs raw forecast toggle
  - Beach intel integration
  - Action buttons for session planning

**Data Flow:**

```typescript
// Forecast fetching with skip logic
const fetchTodaysForecast = useCallback(async () => {
  if (!homeBeach?.id) return null;
  return await getForecastForToday(homeBeach.id);
}, [homeBeach?.id]);

// Community calibration integration
const { beachAccuracy, getConfidenceLevel, accuracyStats } =
  useForecastCalibration({ beachId: homeBeach?.id });
```

**Forecast States:**

- **No Home Beach**: Prompt to set home beach
- **Forecast Loading**: Skeleton animation
- **Forecast Available**: Full forecast display with adjustments
- **Forecast Unavailable**: Error state with fallback actions

### **CommunityTab** (Local Intel)

- **Purpose**: Local intel dashboard (replaced community feed)
- **Props**: `sessions?: any[], loading?: boolean` (legacy compatibility)
- **Features**:
  - Intel dashboard integration
  - Full-height container optimization
  - Simplified interface

**Modern Implementation:**

```typescript
// Simplified to intel dashboard
export function CommunityTab({ sessions, loading }: CommunityTabProps) {
  return (
    <div className="h-[calc(100vh-200px)] max-w-full mx-auto">
      <IntelDashboard />
    </div>
  );
}
```

### **useHomeData** (Shared Data Hook)

- **Purpose**: Centralized data fetching for beaches and sessions
- **Returns**: `beaches[], sessions[], loading, error, refetch`
- **Features**:
  - Memoized fetch functions
  - Parallel data fetching
  - Error handling and retries

**Implementation Pattern:**

```typescript
// Prevent infinite loops with useCallback
const fetchBeaches = useCallback(async () => {
  const result = await getBeaches();
  if (result.success && result.data) return result.data;
  throw new Error(result.error || "Failed to fetch beaches");
}, []);

// Parallel data fetching
const { data: beachesData, loading: beachesLoading } =
  useDataFetcher(fetchBeaches);
const { data: sessionsData, loading: sessionsLoading } =
  useDataFetcher(fetchSessions);
```

## 🎨 **DESIGN PATTERNS**

### **Responsive Layout System**

```typescript
// Mobile-first responsive classes
<main className="flex-1 home-container py-6 sm:py-8 lg:py-10 space-y-8 sm:space-y-10 lg:space-y-12">

// Responsive typography
<h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold">

// Responsive tab system
<TabsList className="grid grid-cols-3 w-full max-w-3xl mx-auto h-12 sm:h-14">
```

## 🔎 Home Search Bar

- Location: Centered container directly under the `Forecast | Local Intel` tabs on the Home screen.
- Component: `components/home-screen/beach-search-bar.tsx`
- Behavior:
  - Uses `useDataFetcher` with a memoized fetch function that calls `searchBeachesByName` for fuzzy/close matches (supports abbreviations like "OB", "PB").
  - On success, calls `onSelect(beach)` which sets `selectedBeachOverride` in `HomeScreen`.
  - On failure, shows an inline error: "No beach found. Try again." without altering current forecast.

### State Flow

```typescript
HomeScreen
  state: selectedBeachOverride: Beach | null
  └─ <BeachSearchBar onSelect={setSelectedBeachOverride} />
  └─ <ForecastTab overrideBeach={selectedBeachOverride} homeBeach={homeBeach} />

// Precedence used inside ForecastTab
effectiveBeach = overrideBeach || homeBeach || popularBeach;
```

### Data Fetching Pattern

```typescript
const performSearch = useCallback(async () => {
  return await searchBeachesByName(query);
}, [query]);

const { loading, refetch } = useDataFetcher(performSearch, {
  immediate: false,
  onSuccess: (beach) =>
    beach ? onSelect(beach) : setError("No beach found. Try again."),
});
```

### Error Handling UX

- Inline message under the search bar for not-found or network errors
- Does not change the current `effectiveBeach` unless a valid match is found

### **Loading State Hierarchy**

```typescript
// Component-level loading
if (forecastLoading) return <SkeletonAnimation />;

// Tab-level loading
<Suspense fallback={<TabSkeleton />}>

// Data-level loading
{loading && <Loader2 className="animate-spin" />}
```

### **Color-Coded Information Architecture**

```typescript
// Forecast data visualization
<div className="text-center p-3 bg-blue-50 rounded-lg">
  <div className="text-2xl font-bold text-blue-600">{waveHeight}</div>
  <div className="text-xs text-blue-500">Wave Height</div>
</div>

// Community trust levels
<div className={`p-3 rounded-lg ${confidenceLevel.bg}`}>
  <confidenceLevel.icon className={confidenceLevel.color} />
  <span className={confidenceLevel.color}>
    Community Trust: {confidenceLevel.level}
  </span>
</div>
```

## 🚀 **PERFORMANCE OPTIMIZATIONS**

### **Lazy Loading Strategy**

```typescript
// Dynamic imports for heavy components
const ForecastTab = lazy(() => import("./forecast-tab"));

// Code splitting by tab
// Only loads tab components when accessed
```

### **Memoization Patterns**

```typescript
// Memoized beach processing
const displayBeaches = useMemo(() => beaches.slice(0, 5), [beaches]);

// Memoized beach IDs for stable dependencies
const beachIds = useMemo(
  () => displayBeaches.map((beach) => beach.id),
  [displayBeaches]
);
```

### **Data Caching**

```typescript
// Profile caching to prevent flicker
const { profile, homeBeach, hasCachedData } = useCachedProfile();

// Skip unnecessary fetches
const { skip: !homeBeach?.id } // Skip forecast fetch without beach
```

## 🔄 **DATA INTEGRATION**

### **Authentication Flow**

```typescript
// User state management
const { user } = useAuth();

// Profile data with caching
const { profile, homeBeach } = useCachedProfile();

// Conditional rendering based on auth state
{
  user ? profile?.full_name || "Surfer" : "Guest";
}
```

### **Forecast Integration**

```typescript
// Today's forecast with error handling
const fetchTodaysForecast = useCallback(async () => {
  if (!homeBeach?.id) return null;
  return await getForecastForToday(homeBeach.id);
}, [homeBeach?.id]);

// Community calibration
const { beachAccuracy } = useForecastCalibration({
  beachId: homeBeach?.id,
});
```

## 📱 **MOBILE OPTIMIZATION**

### **Touch-Friendly Interface**

- Large tab targets (h-12 sm:h-14)
- Proper spacing for touch interaction
- Responsive button layouts

### **Mobile-First Responsive Design**

- Progressive enhancement from mobile
- Flexible layouts that scale up
- Optimized image loading

## 🧪 **TESTING CONSIDERATIONS**

### **Component Testing**

- Tab switching functionality
- Lazy loading behavior
- Loading state displays
- Error state handling

### **Integration Testing**

- Data flow between tabs
- Authentication state changes
- Profile updates and caching

## 🔮 **FUTURE ENHANCEMENTS**

### **Planned Features**

- Push notifications for forecasts
- Personalized recommendations
- Social activity feeds
- Weather alerts integration

### **Performance Improvements**

- Service worker caching
- Background data sync
- Optimistic UI updates

---

**Last Updated**: November 18, 2025
**Status**: Production-ready with lazy loading and caching optimizations
**Next Review**: After push notifications implementation
**Recent Changes**: Removed Best Conditions and Nearby Tab features (Nov 18, 2025)

## 🔮 **Personalized Insights Integration (December 2025)**

### **PersonalizedForecastCard** - Enhanced with Insights

- **File**: `components/home-screen/personalized-forecast-card.tsx`
- **New Features**:
  - Displays personalized insights comparing forecast to user's session history
  - "For You" KPI tile shows match label (Perfect/Great/Good) or personalization boost
  - Board recommendations displayed in amber tip box when detected
  - Similar sessions drawer accessible via button or clicking "For You" tile
  - Three states: ready (insights shown), onboarding (encouragement message), degraded (graceful fallback)
- **Props**:
  - `insights`: PersonalizedInsights from useInsights hook
  - `insightsLoading`: boolean loading state
  - `onViewSimilarSessions`: callback to open drawer
- **UI Elements**:
  - Match percentage badge (e.g., "85% Match")
  - Reason bullets in summary section
  - Board tip in amber box with ruler icon
  - "View X similar sessions" button when available
  - Clickable "For You" tile opens similar sessions drawer

### **SimilarSessionsDrawer** - Session History Comparison

- **File**: `components/home-screen/similar-sessions-drawer.tsx`
- **Purpose**: Display user's past sessions with similar conditions
- **Features**:
  - Current forecast conditions summary at top
  - List of similar sessions sorted by similarity score
  - Match quality badges (Perfect green, Great blue, Good yellow, Low outline)
  - Session details: beach name, date, rating (stars), conditions (wave/wind), board used
  - Empty state when no similar sessions found
  - Touch-friendly mobile design
- **Props**:
  - `open`: boolean drawer state
  - `onOpenChange`: state setter callback
  - `sessions`: SimilarSessionInsight[] array
  - `currentConditions`: { waveHeight, wavePeriod, wind } for comparison header
- **Design**:
  - Max height 85vh with scrollable content
  - Color-coded match badges
  - Icon-based condition indicators (Waves, Wind, Ruler for board)
  - Close button in header

---

**Last Updated**: December 16, 2025
**Status**: Production-ready with lazy loading, caching optimizations, and personalized insights
**Next Review**: After push notifications implementation
**Recent Changes**: Added PersonalizedInsights integration with ML-powered session matching (Dec 16, 2025)
