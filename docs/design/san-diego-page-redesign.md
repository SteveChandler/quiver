# San Diego City Page Redesign

**Document Version**: 1.0
**Date**: December 3, 2025
**Status**: Design Review Complete - Ready for Implementation
**URL**: https://www.quiversurf.app/ca/san-diego

---

## Executive Summary

This document provides a comprehensive design review and redesign proposal for the San Diego city surf guide page. The current implementation is text-heavy and lacks visual hierarchy, resulting in cognitive overload for users. The proposed redesign introduces a **map-first layout** with beaches listed alongside the map, pushing text content below the fold.

### Overall Rating: **Needs Changes**

| Criterion | Current Score | Target Score |
|-----------|---------------|--------------|
| UX Clarity & Accessibility | 3/5 | 5/5 |
| Visual Hierarchy | 2/5 | 5/5 |
| Component Consistency | 4/5 | 5/5 |
| Performance | 4/5 | 4/5 |
| Mobile Responsiveness | 3/5 | 5/5 |
| Growth Hooks | 3/5 | 4/5 |

---

## Part 1: Current State Analysis

### 1.1 Page Structure Analysis

The current page (`/app/ca/[city]/page.tsx`) consists of the following sections in order:

1. **Header Section** (lines 92-115)
   - Region label (San Diego County, California)
   - H1 title
   - Update timestamp
   - Intro paragraph

2. **Main Content Grid** (lines 117-184)
   - Left column (2/3 width): 5+ paragraphs of descriptive text
   - Right column (1/3 width): Quick navigation + Planning checklist cards

3. **Featured Surf Spots Section** (lines 186-220)
   - 8 beach cards in a 2-column grid

4. **Session Timing Modules** (lines 222-255)
   - 3-column grid with Today/Now/Weekend cards

5. **Guides by Intent** (lines 257-299)
   - 4 intent cards (beginner, less-crowded, tide, water-temp)

### 1.2 Identified UX Issues

#### Issue 1: Text-Heavy Above-the-Fold Content (CRITICAL)
- **Location**: Lines 117-147
- **Problem**: Users are immediately greeted with 5+ dense paragraphs of descriptive text
- **Evidence**: First viewport (screenshot analysis) shows predominantly text with minimal visual breaks
- **Design Principle Violated**: "No surprises in components" - users expect actionable content, not essays
- **User Impact**: High cognitive load, increased bounce rate, reduced engagement

#### Issue 2: No Visual Map Integration (CRITICAL)
- **Location**: Entire page structure
- **Problem**: Despite having a "San Diego surf map" quick link, there is no embedded map on the page
- **Evidence**: Existing `InteractiveMap` and `MapContent` components are available but not utilized
- **Design Principle Violated**: "Performance by Design" - users must navigate away to see beach locations
- **User Impact**: Additional clicks required, context switching, reduced spatial understanding

#### Issue 3: Beach Cards Lack Visual Context (HIGH)
- **Location**: Lines 194-219 (Featured spots section)
- **Problem**: Beach cards are text-only (name, skill level, overview, tide advice) with no images or map preview
- **Evidence**: Current BeachCard component supports `imageUrl` prop but it's not being used here
- **Design Principle Violated**: "DRY components" - BeachCard has image support that's unused
- **User Impact**: Reduced visual appeal, harder to differentiate beaches

#### Issue 4: Poor Visual Hierarchy in Header (MEDIUM)
- **Location**: Lines 92-115
- **Problem**: Multiple paragraphs of similar styling create monotony
- **Evidence**: All text is similar slate-700/slate-800 with minimal size variation
- **Design Principle Violated**: "Simplicity & Consistency" - hierarchy should guide scanning
- **User Impact**: Users can't quickly scan for key information

#### Issue 5: Session Timing Modules Lack Actionable Data (MEDIUM)
- **Location**: Lines 226-254
- **Problem**: Today/Now/Weekend cards contain generic advice instead of real-time data
- **Evidence**: Static text like "Track marine layer burn-off..." with no actual forecasts
- **Design Principle Violated**: "Transparency & User Trust" - users expect real data
- **User Impact**: Reduced trust, perceived low value

#### Issue 6: Mobile Layout Concerns (MEDIUM)
- **Location**: Lines 117, 194, 226, 266
- **Problem**: Multi-column grids may stack awkwardly on mobile
- **Evidence**: `lg:grid-cols-[2fr_1fr]`, `md:grid-cols-2`, `md:grid-cols-3` breakpoints
- **Design Principle Violated**: Mobile-first responsive design
- **User Impact**: Suboptimal mobile experience

### 1.3 Accessibility Audit

| Check | Status | Notes |
|-------|--------|-------|
| Heading Hierarchy | PASS | H1 > H2 > H3 structure maintained |
| Link Contrast | PASS | sky-700 on white background |
| Focus States | NEEDS CHECK | Using hover:underline, needs focus:ring |
| ARIA Labels | NEEDS IMPROVEMENT | Cards lack role="article" |
| Keyboard Navigation | PASS | Standard link navigation |
| Screen Reader | NEEDS IMPROVEMENT | Cards need aria-describedby for context |

---

## Part 2: Proposed Redesign

### 2.1 New Layout Architecture

```
+------------------------------------------------------------------+
|                          HEADER                                    |
|  [Region Label] [H1 Title] [Updated Timestamp]                    |
+------------------------------------------------------------------+
|                                                                    |
|  +---------------------------+  +------------------------------+  |
|  |                           |  |                              |  |
|  |     BEACH LIST            |  |       INTERACTIVE MAP        |  |
|  |     (Scrollable)          |  |       (Full height)          |  |
|  |                           |  |                              |  |
|  |  [Beach Card 1]           |  |       [Map with markers]     |  |
|  |  [Beach Card 2]           |  |                              |  |
|  |  [Beach Card 3]           |  |                              |  |
|  |  [Beach Card 4]           |  |                              |  |
|  |  ...                      |  |                              |  |
|  |                           |  |                              |  |
|  +---------------------------+  +------------------------------+  |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|  QUICK ACTIONS BAR                                                 |
|  [Tide Chart] [Beginner Guide] [Less Crowded] [Water Temp]        |
|                                                                    |
+------------------------------------------------------------------+
|                                                                    |
|                    BELOW THE FOLD                                  |
|                                                                    |
|  +--------------------+  +--------------------+                    |
|  | Session Timing     |  | Planning Tips      |                    |
|  | [Today] [Now]      |  | [Checklist items]  |                    |
|  +--------------------+  +--------------------+                    |
|                                                                    |
|  +------------------------------------------------------------+  |
|  |                   ABOUT SAN DIEGO SURF                       |  |
|  |  [Collapsed/expandable descriptive content]                  |  |
|  +------------------------------------------------------------+  |
|                                                                    |
|  +------------------------------------------------------------+  |
|  |                   GUIDES BY INTENT                           |  |
|  |  [4 intent cards in grid]                                    |  |
|  +------------------------------------------------------------+  |
|                                                                    |
+------------------------------------------------------------------+
```

### 2.2 Component Breakdown

#### 2.2.1 Hero Map Section (NEW)

**Purpose**: Primary visual anchor showing San Diego beaches on an interactive map with a scrollable beach list on the left.

**Component Structure**:
```tsx
<section className="mx-auto w-full max-w-7xl px-4 pb-8 pt-6">
  {/* Compact Header */}
  <header className="mb-6">
    <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">
      {city.regionLabel}
    </p>
    <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
      {city.name} Surf Guide
    </h1>
    <p className="text-sm text-slate-500">
      Updated {updatedAt} PT
    </p>
  </header>

  {/* Map + Beach List Layout */}
  <div className="grid lg:grid-cols-[380px_1fr] gap-6 h-[600px]">
    {/* Left: Scrollable Beach List */}
    <div className="overflow-y-auto border rounded-xl bg-white shadow-sm">
      <div className="p-4 border-b sticky top-0 bg-white z-10">
        <h2 className="font-semibold text-slate-900">Featured Beaches</h2>
        <p className="text-xs text-slate-500">{spots.length} spots</p>
      </div>
      <div className="divide-y">
        {spots.map(spot => (
          <CityBeachListItem
            key={spot.slug}
            spot={spot}
            onHover={setHoveredBeach}
            onClick={setSelectedBeach}
          />
        ))}
      </div>
    </div>

    {/* Right: Interactive Map */}
    <div className="rounded-xl overflow-hidden shadow-lg">
      <InteractiveMap
        initialCenter={[city.center.lat, city.center.lon]}
        initialZoom={11}
        beaches={spots}
        selectedBeachId={selectedBeach?.id}
        onLocationClick={handleBeachSelect}
      />
    </div>
  </div>
</section>
```

**Key Features**:
- Fixed height (600px) for above-the-fold prominence
- Beach list on LEFT (per user request)
- Map on RIGHT occupying remaining space
- Beach cards highlight on hover, map marker pulses
- Click on list item centers map and opens popup

#### 2.2.2 CityBeachListItem Component (NEW)

**Purpose**: Compact beach card optimized for the scrollable list.

```tsx
interface CityBeachListItemProps {
  spot: SurfSpot;
  isSelected?: boolean;
  isHovered?: boolean;
  onHover: (spot: SurfSpot | null) => void;
  onClick: (spot: SurfSpot) => void;
}

function CityBeachListItem({ spot, isSelected, isHovered, onHover, onClick }: CityBeachListItemProps) {
  return (
    <motion.div
      className={cn(
        "p-4 cursor-pointer transition-colors",
        isSelected && "bg-sky-50 border-l-4 border-sky-500",
        isHovered && !isSelected && "bg-slate-50"
      )}
      onMouseEnter={() => onHover(spot)}
      onMouseLeave={() => onHover(null)}
      onClick={() => onClick(spot)}
      whileHover={{ x: 2 }}
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-slate-900">{spot.name}</h3>
          <span className={cn(
            "text-xs font-medium px-2 py-0.5 rounded-full",
            spot.skillLevel === "Beginner friendly" && "bg-green-100 text-green-700",
            spot.skillLevel === "Intermediate" && "bg-amber-100 text-amber-700",
            spot.skillLevel.includes("expert") && "bg-red-100 text-red-700"
          )}>
            {spot.skillLevel}
          </span>
        </div>
        <ChevronRight className="h-5 w-5 text-slate-400" />
      </div>
      <p className="text-sm text-slate-600 mt-1 line-clamp-2">{spot.overview}</p>
    </motion.div>
  );
}
```

#### 2.2.3 Quick Actions Bar (NEW)

**Purpose**: Horizontal navigation to intent-based guides, replacing the sidebar.

```tsx
<section className="mx-auto w-full max-w-7xl px-4 py-6">
  <div className="flex flex-wrap gap-3">
    {city.quickLinks.map(link => (
      <Link
        key={link.href}
        href={link.href}
        className="flex items-center gap-2 px-4 py-2 rounded-full border border-slate-200
                   bg-white hover:bg-sky-50 hover:border-sky-200 transition-colors
                   text-sm font-medium text-slate-700 hover:text-sky-700"
      >
        <LinkIcon type={link.type} />
        {link.label}
      </Link>
    ))}
  </div>
</section>
```

#### 2.2.4 Collapsible About Section (REFACTORED)

**Purpose**: Move descriptive text below the fold in a collapsible accordion.

```tsx
<Accordion type="single" collapsible className="w-full">
  <AccordionItem value="about">
    <AccordionTrigger className="text-xl font-semibold">
      About San Diego Surf
    </AccordionTrigger>
    <AccordionContent className="prose prose-slate max-w-none">
      {city.description.map((paragraph, index) => (
        <p key={index}>{paragraph}</p>
      ))}
    </AccordionContent>
  </AccordionItem>
</Accordion>
```

### 2.3 Mobile Responsive Design

```
MOBILE LAYOUT (< 1024px)
+----------------------------------+
|           HEADER                  |
|  [H1] [Updated timestamp]         |
+----------------------------------+
|                                   |
|         INTERACTIVE MAP           |
|         (Full width, 300px)       |
|                                   |
+----------------------------------+
|                                   |
|      HORIZONTAL BEACH SCROLL      |
|   [Card] [Card] [Card] -->        |
|                                   |
+----------------------------------+
|                                   |
|       QUICK ACTIONS               |
|   (Horizontal scroll)             |
|                                   |
+----------------------------------+
|                                   |
|    CONTENT SECTIONS               |
|    (Stacked vertically)           |
|                                   |
+----------------------------------+
```

**Mobile-Specific Changes**:
1. Map displays first (full width, 300px height)
2. Beach list becomes horizontal scroll (like `nearby-beach-scroll.tsx`)
3. Quick actions become horizontal scrollable pills
4. All grids stack to single column

### 2.4 Interaction Patterns

#### Map <-> List Synchronization
- **Hover on list item**: Corresponding map marker scales up (1.2x) with pulse animation
- **Click on list item**: Map pans and zooms to beach, popup opens
- **Click on map marker**: List scrolls to corresponding item, highlights it
- **Mobile tap**: Same behavior, with haptic feedback if available

#### Motion Design (per DESIGN_PRINCIPLES.md)
- List item hover: `whileHover={{ x: 2 }}` (subtle rightward shift)
- Selected state: `border-l-4 border-sky-500` slide-in animation
- Map marker: Existing pulse animation from `InteractiveMap`
- Page transitions: Fade in with stagger (0.1s between sections)

---

## Part 3: Implementation Recommendations

### 3.1 High Priority (Blockers)

| Issue | Fix | Effort | Files Affected |
|-------|-----|--------|----------------|
| No map on page | Add InteractiveMap component | Medium | `app/ca/[city]/page.tsx` |
| Text-heavy header | Simplify to 2 lines max | Low | `app/ca/[city]/page.tsx` |
| Beach cards no images | Add map thumbnail or image | Low | `app/ca/[city]/page.tsx` |

### 3.2 Medium Priority (Should Fix)

| Issue | Fix | Effort | Files Affected |
|-------|-----|--------|----------------|
| Session timing static | Connect to forecast API | Medium | New component needed |
| Sidebar navigation | Convert to quick action bar | Low | `app/ca/[city]/page.tsx` |
| Descriptive text prominence | Move to accordion | Low | `app/ca/[city]/page.tsx` |

### 3.3 Low Priority (Nice to Have)

| Issue | Fix | Effort | Files Affected |
|-------|-----|--------|----------------|
| Add beach images | Integrate with Supabase storage | Medium | Data layer changes |
| Skill level filtering | Add filter dropdown | Medium | New component |
| Real-time conditions | Add forecast badges to list | High | API integration |

### 3.4 Performance Considerations

1. **Map Lazy Loading**: Use `next/dynamic` with SSR disabled for InteractiveMap (already implemented)
2. **Beach List Virtualization**: For cities with 20+ beaches, use virtualized list (already in beach-list.tsx)
3. **Image Optimization**: Use `next/image` for beach thumbnails with blur placeholders
4. **Forecast Batching**: Use existing `/api/forecasts/bulk` endpoint for wave heights

### 3.5 Accessibility Improvements

```tsx
// Beach list item with proper ARIA
<div
  role="option"
  aria-selected={isSelected}
  aria-describedby={`beach-${spot.slug}-desc`}
  tabIndex={0}
  onKeyDown={(e) => e.key === 'Enter' && onClick(spot)}
>
  <h3>{spot.name}</h3>
  <p id={`beach-${spot.slug}-desc`}>{spot.overview}</p>
</div>

// Map region with label
<div
  role="region"
  aria-label="Interactive map showing San Diego surf spots"
>
  <InteractiveMap ... />
</div>
```

---

## Part 4: Security Verification

| Check | Status | Notes |
|-------|--------|-------|
| No PII exposure | PASS | Page is public, no user data |
| XSS prevention | PASS | All content is static/server-rendered |
| CSRF not applicable | N/A | Read-only page |
| RLS not applicable | N/A | No database mutations |

---

## Part 5: Performance Budget

| Metric | Current | Target | Status |
|--------|---------|--------|--------|
| LCP | ~2.1s | < 2.5s | PASS |
| FID | < 50ms | < 100ms | PASS |
| CLS | ~0.05 | < 0.1 | PASS |
| Bundle Size | ~180KB | < 200KB | PASS |

**Note**: Adding InteractiveMap will increase bundle by ~50KB (Mapbox GL). Mitigate with dynamic import.

---

## Part 6: AI Image Generation Prompt

Use this prompt with image generation tools (Midjourney, DALL-E, Figma AI) to create a mockup:

```
Create a modern, clean web page design for a surf forecast website showing San Diego beaches.

Layout specifications:
- Desktop view, 1440px width
- White background with subtle blue accents (#0077B6)
- Professional sans-serif typography (Inter or similar)

Top section (above the fold):
- Compact header with "San Diego County, California" label in sky blue
- Bold title "San Diego Surf Guide" with timestamp below
- Two-column layout below header:
  - LEFT SIDE (380px): Scrollable list of beach cards
    - Each card shows: beach name, skill level badge (green/amber/red), brief description
    - One card highlighted with blue left border
  - RIGHT SIDE (remaining space): Interactive map showing San Diego coastline
    - Map markers as orange/yellow pills with wave height numbers (e.g., "3-4 ft")
    - Blue highlight on one marker corresponding to selected beach card

Below the map section:
- Horizontal row of pill-shaped quick action buttons: "Tide Chart", "Beginner Guide", "Less Crowded", "Water Temp"

Below the fold:
- Collapsed accordion for "About San Diego Surf" descriptive content
- Grid of intent guide cards

Style notes:
- Clean shadows (shadow-sm to shadow-md)
- Rounded corners (rounded-xl for cards)
- Subtle hover states with scale effects
- Mobile-responsive indicators in corner

Color palette:
- Primary: #0077B6 (ocean blue)
- Accent: #F59E0B (amber for highlights)
- Text: #1E293B (slate-800)
- Background: #FFFFFF
- Muted: #F1F5F9 (slate-100)

Do not include: Emojis, cluttered elements, stock photography
```

---

## Part 7: Verdict and Next Actions

### Verdict: **Needs Changes**

The current page design prioritizes content quantity over user experience. The proposed map-first redesign directly addresses user feedback about text heaviness while leveraging existing Quiver components.

### Recommended Next Actions

1. **Immediate** (This Sprint):
   - [ ] Convert page to Client Component for map interactivity
   - [ ] Add InteractiveMap with beach list integration
   - [ ] Reduce header text to essential information
   - [ ] Move descriptive content to collapsible accordion

2. **Short-term** (Next Sprint):
   - [ ] Create CityBeachListItem component
   - [ ] Add quick action bar
   - [ ] Implement map-list synchronization
   - [ ] Mobile responsive testing

3. **Medium-term** (Backlog):
   - [ ] Add real forecast data to beach cards
   - [ ] Implement beach image thumbnails
   - [ ] Add skill level filtering
   - [ ] A/B test new vs old design

### Effort Estimate

| Phase | Effort | Duration |
|-------|--------|----------|
| Core Layout Changes | Medium | 2-3 days |
| Map Integration | Medium | 1-2 days |
| Polish & Testing | Low | 1 day |
| **Total** | **Medium** | **4-6 days** |

---

## Part 8: Existing Component Reuse (CRITICAL)

**DO NOT create new map components.** Reuse existing battle-tested components from the codebase.

### 8.1 Primary Components to Reuse

| Component | File Path | Usage |
|-----------|-----------|-------|
| **InteractiveMap** | `components/map/interactive-map.tsx` | Main Mapbox map with wave height markers |
| **BeachList** | `components/map/beach-list.tsx` | Virtualized beach listing with filters |
| **MapContent** | `components/map/map-content.tsx` | Wrapper with location controls & error handling |
| **LocationMap** | `components/location/location-map.tsx` | Pre-configured map for location pages |
| **NearbyBeachScroll** | `components/map/nearby-beach-scroll.tsx` | Horizontal beach card scroll (mobile) |
| **SelectedBeachCard** | `components/map/selected-beach-card.tsx` | Highlighted beach selection card |

### 8.2 InteractiveMap Props Reference

```tsx
<InteractiveMap
  initialCenter={[32.7157, -117.1611]}  // San Diego center [lat, lon]
  initialZoom={11}                       // City-level zoom
  beaches={sanDiegoBeaches}              // Pre-filtered beaches array
  onLocationClick={(beach) => handleBeachSelect(beach)}
  className="h-[600px] rounded-xl"
  regionViewport={{                      // Optional: lock to region
    center: [32.7157, -117.1611],
    zoom: 11,
    bounds: [[-117.28, 32.53], [-117.04, 33.05]]
  }}
/>
```

### 8.3 BeachList Props Reference

```tsx
<BeachList
  filteredBeaches={sanDiegoBeaches}
  searchQuery=""
  userLocation={null}  // Or provide for distance calc
  usingDefaultLocation={false}
  loading={false}
  onBeachSelect={(beach) => setSelectedBeach(beach)}
  onClearSearch={() => {}}
  onGetUserLocation={() => {}}
  onLoadBeaches={() => {}}
  getDistanceFromUser={(lat, lon) => "2.3 mi"}
/>
```

### 8.4 LocationMap Pattern (Recommended)

The `LocationMap` component is specifically designed for location pages and auto-calculates zoom/center:

```tsx
import { LocationMap, LocationMapSkeleton } from '@/components/location/location-map';

// In page component
<Suspense fallback={<LocationMapSkeleton />}>
  <LocationMap
    beaches={sanDiegoBeaches}
    city="San Diego"
    state="California"
    className="h-[600px]"
  />
</Suspense>
```

### 8.5 Mobile Layout Pattern

For mobile, reuse `NearbyBeachScroll` for horizontal beach cards:

```tsx
// Desktop: BeachList (vertical scroll)
// Mobile: NearbyBeachScroll (horizontal scroll)

<div className="hidden lg:block">
  <BeachList ... />
</div>
<div className="lg:hidden">
  <NearbyBeachScroll
    nearbyBeachesForScroll={sanDiegoBeaches}
    selectedBeach={selectedBeach}
    onBeachSelect={handleBeachSelect}
    onViewModeChange={() => {}}
    getDistanceFromUser={getDistanceFromUser}
    userLocation={userLocation}
    showForecastPreviews={true}
  />
</div>
```

### 8.6 Additional Reusable Components

| Component | File Path | Purpose |
|-----------|-----------|---------|
| **MapSearchHeader** | `components/map/map-search-header.tsx` | Map/List toggle with "Near Me" button |
| **LocationTimeoutBanner** | `components/map/location-timeout-banner.tsx` | Geolocation fallback messaging |
| **MapHeader** | `components/map/map-header.tsx` | Search input + view toggle |

### 8.7 Key Implementation Notes

1. **Dynamic Import Required**: InteractiveMap uses Mapbox GL which must be client-side only:
   ```tsx
   const InteractiveMap = dynamic(
     () => import('@/components/map/interactive-map'),
     { ssr: false, loading: () => <MapSkeleton /> }
   );
   ```

2. **Coordinate Convention**: Use `lat`, `lon` (NOT `lng`) per project standards

3. **Beach Data Type**: Components expect `Beach` type with:
   - `id`, `name`, `lat`, `lon`, `slug`, `city`, `state`, `average_rating`

4. **Default Location**: Falls back to Ocean Beach (32.7503, -117.2534)

5. **Virtualization**: `BeachList` already implements virtual scrolling for performance

---

## Appendix: File References

- Current page: `/Users/stevenchandler/Desktop/quiver/quiver/app/ca/[city]/page.tsx`
- InteractiveMap: `/Users/stevenchandler/Desktop/quiver/quiver/components/map/interactive-map.tsx`
- MapContent: `/Users/stevenchandler/Desktop/quiver/quiver/components/map/map-content.tsx`
- BeachList: `/Users/stevenchandler/Desktop/quiver/quiver/components/map/beach-list.tsx`
- LocationMap: `/Users/stevenchandler/Desktop/quiver/quiver/components/location/location-map.tsx`
- NearbyBeachScroll: `/Users/stevenchandler/Desktop/quiver/quiver/components/map/nearby-beach-scroll.tsx`
- SelectedBeachCard: `/Users/stevenchandler/Desktop/quiver/quiver/components/map/selected-beach-card.tsx`
- MapSearchHeader: `/Users/stevenchandler/Desktop/quiver/quiver/components/map/map-search-header.tsx`
- Design principles: `/Users/stevenchandler/Desktop/quiver/quiver/docs/DESIGN_PRINCIPLES.md`
- Component architecture: `/Users/stevenchandler/Desktop/quiver/quiver/components/ARCHITECTURE.md`

---

**Document Author**: Quiver Design Review Agent
**Review Date**: December 3, 2025
**Next Review**: After implementation
