# Landing Page Architecture

## Purpose

AllTrails-inspired surf discovery platform. Growth-focused marketing surface that emphasizes search, discovery, and community engagement.

## Design Philosophy

The landing page follows the **AllTrails.com** design pattern:

- **Search-centric hero** with prominent search bar
- **Activity-based navigation** (surf types: longboard, reef breaks, point breaks, beginner-friendly, etc.)
- **Spot cards** displaying surf breaks with real-time conditions
- **Clean, scannable layout** with nature imagery (beach/wave photos)
- **Community trust signals** (reviews, conditions, local insights)

## Sections

### Core Components

- `navbar.tsx` — **NEW** AllTrails-style navigation with dropdown menus for Explore, Forecast, Discover

  - Sticky header with logo, navigation links, auth buttons
  - Mobile-responsive with Sheet-based mobile menu
  - Organized "Explore" dropdown by Regions, Surf Spot Types, and Conditions

- `hero-section.tsx` — **REDESIGNED** Search-centric hero with search bar

  - Headline: "Find your next wave"
  - Prominent search bar: "Search by beach, spot, or region"
  - Quick action buttons: "Explore Nearby", "View Forecast"
  - Video background maintained for visual appeal

- `surf-highlights-section.tsx` — **NEW** Replaces social feed with surf spot cards

  - Displays featured surf breaks with conditions
  - Each card shows: image, name, location, swell height/direction, wind, tide, difficulty, crowd level
  - Tags: Beginner/Advanced/Expert, Uncrowded/Moderate/Crowded, Hidden Gem
  - Uses `SurfSpotCard` component

- `activities-section.tsx` — **NEW** Replaces features with surf type filters

  - Activity cards for: Longboarding, Reef Breaks, Point Breaks, Beginner-Friendly, Boogie Boarding, Offshore Winds
  - Each card links to filtered discovery page
  - Icon-driven design with hover effects

- `forecast-section.tsx` — Live forecast demonstration (unchanged)

- `cta-section.tsx` — **UPDATED** New surf-focused messaging

  - Headline: "Wherever the swell takes you"
  - Subtitle: "Track, plan, and share your surf sessions with Quiver"
  - Button: "Join the Lineup"

- `footer-section.tsx` — **ENHANCED** AllTrails-style footer
  - Tagline: "Built for surfers. Powered by the swell."
  - Organized columns: About Quiver, Support/Contact, Legal, Socials
  - Prominent Instagram/YouTube links

### Reusable Components

- `surf-spot-card.tsx` — **NEW** Surf spot display with conditions

  - Props: name, location, imageUrl, swellHeight, swellDirection, windSpeed, tideStatus, difficulty, crowdLevel, isHiddenGem
  - Responsive card design with hover effects
  - Badge system for difficulty and crowd levels

- `feature-card.tsx` — Legacy component (kept for backward compatibility)
- `section-wrapper.tsx` — Consistent section layout wrapper

### Legacy Components (Backward Compatibility)

- `social-feed-section.tsx` — Original social feed (maintained but not used in AllTrails layout)
- `features-section.tsx` — Original features grid (maintained but not used in AllTrails layout)

## Data Flow

### Surf Highlights Section

```typescript
// Fetches featured beaches from API
const fetchBeaches = async () => {
  const response = await fetch("/api/beaches/featured");
  const beaches = await response.json();
  return beaches.map((beach) => ({
    ...beach,
    // Augment with conditions data
    swellHeight: getConditions(beach.id),
    // ... other condition fields
  }));
};
```

**Note**: Current implementation uses mock condition data. In production, integrate with real forecast API.

## Content Management

All copy is centralized in `lib/constants/features.ts`:

```typescript
export const CONTENT = {
  hero: { title, subtitle, cta, ... },
  sections: {
    surfHighlights: { title, subtitle },
    activities: { title, subtitle },
    cta: { ... },
  },
};

export const SURF_ACTIVITIES = [
  { icon, title, description, link, ... },
  // ... surf type activities
];
```

## Patterns

### Performance Optimization

- **Progressive Loading**: Uses `IntersectionObserver` for section lazy loading
- **Video Optimization**: Lazy-loads hero video after initial paint (LCP optimization)
- **Image Optimization**: Next.js Image component with proper sizing and lazy loading
- **Code Splitting**: Components loaded progressively as user scrolls

### Responsive Design

- **Mobile-first approach**: All components designed for mobile, enhanced for desktop
- **Breakpoints**: sm (640px), md (768px), lg (1024px), xl (1280px)
- **Touch-friendly**: 44px minimum touch targets on mobile
- **Sticky navigation**: Navbar sticks to top on scroll

### SEO Optimization

- **Structured data**: FAQ schema via `QuiverFAQSchema` component
- **Semantic HTML**: Proper heading hierarchy, landmarks, ARIA labels
- **Meta tags**: Configured via `lib/seo/meta.ts`
- **Performance**: Fast LCP, FCP for better Core Web Vitals

## Testing

### Component Tests

- Navbar: Navigation links, dropdown menus, mobile menu interaction
- Hero: Search functionality, button clicks, video loading
- Surf Spot Card: Condition display, badge rendering, image fallbacks
- Activities: Icon rendering, link navigation

### Integration Tests

- End-to-end user flow: Landing → Search → Spot discovery
- API integration: Featured beaches fetch and display
- Responsive behavior across breakpoints

### Performance Tests

- Lighthouse scores: Performance, Accessibility, Best Practices, SEO
- LCP target: < 2.5s
- CLS target: < 0.1
- FID target: < 100ms

## Migration Notes

### From Old Landing Page to AllTrails Style

**Breaking Changes**:

- `HeroSection` props changed (removed `InteractiveHeroDemo`, added search functionality)
- `SocialFeedSection` replaced by `SurfHighlightsSection` in main layout
- `FeaturesSection` replaced by `ActivitiesSection` in main layout

**Backward Compatibility**:

- Legacy sections (`SocialFeedSection`, `FeaturesSection`) maintained in codebase
- Can be imported and used in other pages if needed
- No breaking changes to exported components (only layout changes)

## Related Docs

- `components/seo/ARCHITECTURE.md` — SEO schema and meta tag configuration
- `docs/ARCHITECTURE_REVIEW.md` — Overall system architecture
- `lib/constants/features.ts` — Content and configuration constants
- `hooks/use-data-fetcher.ts` — Data fetching pattern used in sections

## Future Enhancements

1. **Real-time Conditions**: Integrate with forecast API for live swell/wind data
2. **User Location**: Auto-detect user location for "Explore Nearby" personalization
3. **Search Autocomplete**: Add search suggestions as user types
4. **Spot Photos**: User-generated photos in surf spot cards
5. **Filter UI**: Advanced filtering in Activities section (skill level, crowd preference, etc.)
6. **A/B Testing**: Test different hero headlines, CTA copy for conversion optimization
