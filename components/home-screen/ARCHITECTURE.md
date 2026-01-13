# Home Screen Components Architecture

## Purpose

The home screen components create the main application dashboard with personalized surf recommendations displayed in a single vertical feed layout with a dark gradient header section.

## Component Structure

```
components/home-screen/
├── index.tsx                  # Main HomeScreen container with single-feed layout
├── bottom-nav.tsx             # Fixed mobile bottom navigation (md:hidden)
├── greeting-section.tsx       # Time-aware greeting component
├── hero-recommendation.tsx    # Top surf recommendation card
├── primary-actions.tsx        # "I'm at the beach" / "Plan Weekend" buttons
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
│   └── PrimaryActions          # Quick action buttons
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

- **Purpose**: Featured surf spot with conditions
- **Props**: `recommendation`, `loading`, `error`, callbacks
- **Features**:
  - Orange score badge (#f97316)
  - White text on dark/image background
  - Translucent badges for conditions
  - Enable reminder CTA integration
  - Loading skeleton state

### PrimaryActions (Quick Actions)

- **Purpose**: Main CTA buttons below hero
- **Props**: `topRecommendation`, callbacks, `disabled`
- **Features**:
  - "I'm at the beach" button (solid)
  - "Plan Weekend" button (translucent for dark bg)
  - Pre-fills session form with recommendation data

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
- Carousel scroll behavior

### Integration Testing

- Discovery data flow to components
- Navigation between routes
- Reminder enable flow
- Session form pre-fill

### E2E Testing

- See `e2e/HOME_SCREEN_LAYOUT_TESTS.md` for layout test documentation

## Related Documentation

- `/lib/utils/greeting-utils.ts` - Greeting utility functions
- `/hooks/use-surf-discovery.ts` - Discovery hook
- `/components/dashboard/coast-pulse.tsx` - Live updates component
- `/components/dashboard/profile-strength.tsx` - Onboarding widget

---

**Last Updated**: January 2025
**Status**: Production-ready with single vertical feed layout
**Recent Changes**:
- Replaced tab-based layout with single vertical feed
- Added dark gradient header section
- Added BottomNav mobile navigation
- Updated GreetingSection for dark background
- Integrated CoastPulse timeline component
