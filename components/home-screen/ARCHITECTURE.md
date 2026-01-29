# Home Screen Components Architecture

## Purpose

The home screen components create the main application dashboard with personalized surf recommendations displayed in a single vertical feed layout with a dark gradient header section.

## Component Structure

```
components/home-screen/
├── index.tsx                  # Main HomeScreen container with single-feed layout
├── bottom-nav.tsx             # Fixed mobile bottom navigation (md:hidden)
├── greeting-section.tsx       # Time-aware greeting component
├── hero-recommendation.tsx    # Top surf recommendation card with share support
├── primary-actions.tsx        # "I'm at the beach" / "Plan Weekend" / "Share" buttons
├── top-spots-carousel.tsx     # Horizontal carousel of top spots
├── compact-spot-card.tsx      # Card component for carousel spots
├── use-time-of-day.ts         # Hook for time-of-day detection
├── personalized-forecast-card.tsx # Forecast with personalized insights
├── similar-sessions-drawer.tsx    # Session history comparison drawer
├── use-home-data.ts           # Shared data fetching hook
├── beach-search-bar.tsx       # Beach search input
└── GREETING_README.md         # Greeting system documentation
```

## Architecture Patterns

### Single Vertical Feed Layout

The home screen uses a single vertical feed (no tabs) with a dark gradient header section:

```typescript
HomeScreen (Container)
├── Dark Gradient Header (bg-gradient-to-b from-[#0f172a] to-[#1e293b])
│   ├── GreetingSection         # Time-based greeting
│   ├── HeroRecommendation      # Top recommendation card
│   └── PrimaryActions          # Quick action buttons + Share
├── Content Section (default background)
│   ├── TopSpotsCarousel        # Additional recommendations
│   ├── CoastPulse              # Live coast updates timeline
│   └── ProfileStrength         # Onboarding progress (auto-hides)
└── BottomNav                   # Mobile-only fixed navigation
```

### Dark Theme Header Pattern

The header uses a dark gradient with light text for visual impact:

```typescript
// Dark gradient background
<div className="bg-gradient-to-b from-[#0f172a] to-[#1e293b]">
  // White/light text for contrast
  <h1 className="text-white/80">...</h1>
  // Translucent elements
  <button className="bg-white/10 border-white/20">...</button>
</div>
```

### Mobile Bottom Navigation

```typescript
// BottomNav component features:
// - Fixed position at bottom of screen
// - Safe area insets for iOS (pb-[env(safe-area-inset-bottom)])
// - Hidden on md+ screens (md:hidden)
// - 44px minimum touch targets
// - Orange accent color for active state (#f97316)

<BottomNav />
// Routes: Home, Map, Log, Profile
```

### Discovery-Based Data Flow

```typescript
// Uses useSurfDiscovery hook for personalized recommendations
const { discovery, loading, error } = useSurfDiscovery({
  maxResults: 6,
  horizonHours: 24,
  enabled: !!profile,
  userLocation: seedDiscoveryLocation,
});

// Top recommendation becomes hero
const topRecommendation = discovery?.recommendations[0];
// Remaining spots go to carousel
const topSpots = discovery?.recommendations.slice(1);
```

### Location-Aware Personalization

```typescript
// Location priority for discovery:
// 1. Browser geolocation (if granted and not default)
// 2. User's home beach coordinates
// 3. Fallback to default location

const seedDiscoveryLocation =
  geoSource === "browser" && !usingDefaultLocation && geoCoords
    ? { lat: geoCoords.lat, lon: geoCoords.lon }
    : homeBeach?.lat != null
      ? { lat: homeBeach.lat, lon: homeBeach.lon }
      : undefined;
```

## Component Responsibilities

### HomeScreen (Main Container)

- **Purpose**: Layout orchestration and data management
- **Features**:
  - Single vertical feed layout
  - Dark gradient header section
  - Discovery-based recommendations
  - Push notification setup for reminders
  - Bottom navigation for mobile
  - Share data building via `buildSurfCallShareData()`

### BottomNav (Mobile Navigation)

- **Purpose**: Fixed bottom navigation for mobile devices
- **Props**: None (uses pathname for active state)
- **Features**:
  - Fixed position with safe area insets
  - Four navigation items: Home, Map, Log, Profile
  - Orange accent (#f97316) for active state
  - Hidden on md+ screens (uses header nav instead)
  - Lucide icons (Home, Map, BookOpen, User)

### GreetingSection (Time-Aware Greeting)

- **Purpose**: Display personalized, time-based greeting
- **Props**: `userName: string | null`, `timeOfDay: TimeOfDay`
- **Features**:
  - Time periods: morning (5am-12pm), afternoon (12pm-5pm), evening (5pm-5am)
  - Falls back to "Surfer" when no name provided
  - White/translucent text for dark background
  - See `GREETING_README.md` for full documentation

### HeroRecommendation (Top Recommendation)

- **Purpose**: Featured surf spot with conditions and share capability
- **Props**: `recommendation`, `loading`, `error`, callbacks
- **Features**:
  - Orange score badge (#f97316)
  - White text on dark/image background
  - Translucent badges for conditions
  - **"Best at" peak time badge** - displays optimal surf time within window (e.g., "Best at 7:30am")
  - Time window badge with day prefix for tomorrow
  - Wave height badge
  - Condition badges (e.g., "Great Conditions", "Fair Conditions")
  - Enable reminder CTA integration
  - Loading skeleton state

#### Badge Display Order

```typescript
// Badges appear in this order in the hero card:
1. Time window badge (e.g., "6am-10am" or "Tomorrow 7am-11am")
2. Peak time badge (e.g., "Best at 7:30am") - only if window.peakTime exists
3. Wave height badge (e.g., "3-4ft")
4. Condition badges from recommendation data
```

#### Peak Time Formatting

```typescript
// formatPeakTime formats the peak time for display:
// - Uses beach timezone for accurate local time
// - Shows minutes only when not on the hour
// - Examples: "7am", "7:30am", "10:45am"

function formatPeakTime(peakTime: Date, timezone: string): string {
  const minutesStr = formatBeachDateTime(peakTime, timezone, "m");
  const minutes = parseInt(minutesStr, 10);
  if (minutes === 0) {
    return formatBeachDateTime(peakTime, timezone, "ha").toLowerCase();
  }
  return formatBeachDateTime(peakTime, timezone, "h:mma").toLowerCase();
}
```

### PrimaryActions (Quick Actions)

- **Purpose**: Main CTA buttons below hero including share
- **Props**: `topRecommendation`, `shareData`, callbacks, `disabled`
- **Features**:
  - "I'm at the beach" button (solid orange)
  - "Plan Weekend" button (translucent for dark bg)
  - **Share button** (translucent, secondary style) - opens ShareSheet
  - Pre-fills session form with recommendation data
  - ShareSheet integration for social sharing

#### Share Button Integration

```typescript
// Share button appears alongside other primary actions
// Uses ShareSheet component with data from buildSurfCallShareData()

<PrimaryActions
  topRecommendation={topRecommendation}
  shareData={shareData}  // From buildSurfCallShareData()
  onAtBeach={handleAtBeach}
  onPlanWeekend={handlePlanWeekend}
/>

// Share button styling (secondary style for dark background)
<Button variant="outline" className="bg-white/10 border-white/20">
  <Share2 className="h-4 w-4 mr-2" />
  Share
</Button>
```

### TopSpotsCarousel (Recommendations Carousel)

- **Purpose**: Horizontal scroll of additional spots
- **Props**: `spots`, `loading`, callbacks, location CTA props
- **Features**:
  - Edge-to-edge horizontal scroll
  - CompactSpotCard for each spot
  - Optional "Use my location" CTA
  - No artificial limit on spots displayed

### CompactSpotCard (Carousel Card)

- **Purpose**: Individual spot card in carousel
- **Features**:
  - White card background
  - Orange score (#f97316)
  - Ruler/Wind icons for conditions
  - Time window display
  - Uses condition tier utilities for consistent styling

## Share Data Flow

### Share Data Building

The share functionality uses centralized utilities from `lib/share/share-data-builder.ts`:

```typescript
// In HomeScreen index.tsx
import { buildSurfCallShareData } from "@/lib/share/share-data-builder";

// Build share data from recommendation
const shareData = useMemo(() => {
  if (!topRecommendation) return null;
  return buildSurfCallShareData({
    recommendation: topRecommendation,
    timeSlot: timeSlotFilter,
  });
}, [topRecommendation, timeSlotFilter]);
```

### Share Data Structure

```typescript
interface ShareData {
  imageUrl: string;    // OG image URL for social preview
  beachName: string;   // Beach name for share text
  title: string;       // Share title (e.g., "Check out Blacks Beach!")
  text: string;        // Share description with conditions
}
```

### OG Image Generation

Share cards are generated at `/api/og/surf-call` with:
- Centered layout with Quiver logo
- Large orange score display
- Beach name headline
- Conditions summary
- Ocean gradient background

## Condition Tier Integration

### Using condition-tier-utils

Components use centralized utilities from `lib/utils/condition-tier-utils.ts`:

```typescript
import {
  getConditionTier,
  getScoreColorClass,
  getConditionBadge,
  buildHeadlineText,
  isTomorrowInTimezone,
} from "@/lib/utils/condition-tier-utils";

// Get tier from score
const tier = getConditionTier(recommendation.score);

// Get color class for score display
const colorClass = getScoreColorClass(tier);

// Get badge configuration
const badge = getConditionBadge(tier);

// Build headline text
const headline = buildHeadlineText(
  beach.name,
  tier,
  isTomorrow,
  timeSlot
);
```

### Tier Thresholds

```typescript
// Score thresholds for condition tiers:
// - great: >= 80
// - good: 60-79
// - fair: 40-59
// - marginal: < 40
```

## Design System Integration

### Color Tokens Used

```css
/* Dark header gradient */
--header-gradient-start: #0f172a;
--header-gradient-end: #1e293b;

/* Primary accent (orange) */
--accent-orange: #f97316;

/* Coast Pulse dark */
--coast-pulse-bg: #1e1e1e;

/* Translucent elements */
--translucent-white: rgba(255, 255, 255, 0.1);
--translucent-border: rgba(255, 255, 255, 0.2);
--text-white-muted: rgba(255, 255, 255, 0.8);
```

### Responsive Breakpoints

```typescript
// Mobile-first responsive classes
<main className="pb-20 md:pb-0">  // Bottom padding for nav on mobile only
<nav className="md:hidden">        // Bottom nav hidden on md+
```

## Performance Optimizations

### Data Fetching Strategy

```typescript
// Single discovery fetch provides all recommendations
const { discovery, loading } = useSurfDiscovery({
  maxResults: 6,
  horizonHours: 24,
  enabled: !!profile,
});

// Skip fetches when no profile
const { data: boardsResponse } = useDataFetcher(() => getUserBoards(), {
  skip: !profile,
});
```

### Memoization Patterns

```typescript
// Memoized handlers to prevent unnecessary re-renders
const handleAtBeach = useCallback(() => {
  // Navigate with pre-filled data
}, [topRecommendation, router]);

const handleViewBeach = useCallback((beachId: string) => {
  router.push(`/beach/${beachId}?from=home_hero`);
}, [router]);

// Memoized share data
const shareData = useMemo(() => {
  if (!topRecommendation) return null;
  return buildSurfCallShareData({
    recommendation: topRecommendation,
    timeSlot: timeSlotFilter,
  });
}, [topRecommendation, timeSlotFilter]);
```

## Mobile Optimization

### Touch-Friendly Interface

- Bottom nav items: 44px+ touch targets
- Cards with adequate padding for finger taps
- Horizontal scroll for carousel (natural mobile gesture)

### Safe Area Handling

```typescript
// iOS safe area for bottom nav
<nav className="pb-[env(safe-area-inset-bottom)]">
```

### Responsive Spacing

```typescript
// Progressive spacing
<div className="space-y-6 xs:space-y-8">
<section className="px-4 sm:px-0">
```

## Testing Considerations

### Component Testing

- BottomNav active state detection
- GreetingSection time-of-day display
- HeroRecommendation loading/error states
- HeroRecommendation peak time badge rendering
- PrimaryActions share button functionality
- Carousel scroll behavior

### Integration Testing

- Discovery data flow to components
- Navigation between routes
- Reminder enable flow
- Session form pre-fill
- Share data generation
- OG image URL construction

### E2E Testing

- See `e2e/HOME_SCREEN_LAYOUT_TESTS.md` for layout test documentation
- Share flow testing via ShareSheet component

## Related Documentation

- `/lib/utils/greeting-utils.ts` - Greeting utility functions
- `/lib/utils/condition-tier-utils.ts` - Condition tier calculations
- `/lib/share/share-data-builder.ts` - Share data construction
- `/hooks/use-surf-discovery.ts` - Discovery hook
- `/components/dashboard/coast-pulse.tsx` - Live updates component
- `/components/dashboard/profile-strength.tsx` - Onboarding widget

---

**Last Updated**: January 2026
**Status**: Production-ready with single vertical feed layout
**Recent Changes**:
- Added "Best at" peak time badge to HeroRecommendation
- Moved Share button from hero-recommendation to primary-actions row
- Integrated condition-tier-utils for consistent tier logic
- Added share-data-builder for centralized share data construction
- Redesigned OG share card with centered layout
