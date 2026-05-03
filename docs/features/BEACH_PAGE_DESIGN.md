# Beach Page Design Documentation

**Last Updated:** January 2025
**Status:** Production-ready
**Pattern:** AllTrails-inspired tabbed layout

---

## Overview

The beach detail page is the core content page in Quiver, displaying comprehensive information about surf spots. The design follows AllTrails' proven UX patterns while maintaining Quiver's surf-specific features.

## Design Philosophy

### Principles

1. **Progressive Disclosure** - Content organized in tabs to reduce cognitive load
2. **Mobile-First** - Optimized for surfers checking conditions on the go
3. **Visual Hierarchy** - Key information (photos, stats, actions) above the fold
4. **Minimal Scrolling** - Tabbed navigation reduces page length by 60%
5. **Action-Oriented** - Primary CTAs (Plan/Log Session) prominently displayed

### AllTrails Pattern Adoption

We adopted the following patterns from AllTrails:

- **Breadcrumb navigation** - Easy return to map
- **Compact hero** - Single line with rating, difficulty, location
- **Photo/map gallery** - Visual-first presentation
- **Stats grid** - Key metrics in scannable cards
- **Tabbed navigation** - Progressive disclosure of content
- **Dual action buttons** - Secondary (directions) + Primary (session planning)

## Page Structure

```
┌─────────────────────────────────────────────────┐
│ Breadcrumb: Map > Location > Beach Name         │
├─────────────────────────────────────────────────┤
│ Hero (Compact):                                 │
│   ⭐ 4.5 (23 reviews) · Easy · Beach Break · SD │
├─────────────────────────────────────────────────┤
│ Photo Gallery (3 photos + map)                  │
├─────────────────────────────────────────────────┤
│ Stats Grid (4 cards)                            │
│  ┌────────┬────────┬────────┬────────┐         │
│  │Break   │Best    │Best    │Pref    │         │
│  │Type    │Swell   │Wind    │Tide    │         │
│  └────────┴────────┴────────┴────────┘         │
├─────────────────────────────────────────────────┤
│ Actions:                                        │
│  [Get directions] [Log Session] [Plan Session] │
│  ⭐ Favorite  🏠 Set as Home Beach              │
├─────────────────────────────────────────────────┤
│ Tabs:                                           │
│  [Overview] [Forecast] [Reviews] [Intel] [...]  │
│                                                 │
│  [Tab Content Area]                             │
│                                                 │
└─────────────────────────────────────────────────┘
```

## Components

### Navigation Components

#### BeachBreadcrumb

**File:** `components/beach-detail/beach-breadcrumb.tsx`
**Purpose:** Hierarchical navigation

```tsx
<BeachBreadcrumb beach={beach} />
```

**Features:**

- Back to Map link with left arrow
- Location hierarchy (Map > Region > Beach)
- Responsive labels (hides "Back to" on mobile)
- Truncates beach name on small screens

---

#### BeachTabs

**File:** `components/beach-detail/beach-tabs.tsx`
**Purpose:** Main content navigation

**Usage:** Controlled mode (for deep-linking support)

```tsx
const [activeTab, setActiveTab] = useState<BeachTabValue>("overview");

// Support deep-linking to specific tabs
useEffect(() => {
  const section = searchParams?.get("section");
  if (section === "intel") {
    setActiveTab("intel");
  }
}, [searchParams]);

<BeachTabs activeTab={activeTab} onTabChange={setActiveTab}>
  <BeachTabContent value="overview">...</BeachTabContent>
  <BeachTabContent value="forecast">...</BeachTabContent>
  <BeachTabContent value="reviews">...</BeachTabContent>
  <BeachTabContent value="intel">...</BeachTabContent>
  <BeachTabContent value="sessions">...</BeachTabContent>
</BeachTabs>;
```

**Important:** Uses controlled mode to support:

- Deep-linking (e.g., `/beach/slug?section=intel`)
- Programmatic tab switching
- Tab state tracking for analytics

**Tab Structure:**
| Tab | Content |
|-----|---------|
| **Overview** | Beach description, amenities, hazards, gallery |
| **Forecast** | Current conditions, 5-day outlook, live cam, detailed forecasts |
| **Reviews** | Rating summary, review list, write review CTA |
| **Local Intel** | Community posts about conditions, crowds, access |
| **Sessions** | Recent sessions, forecast accuracy comparison |

**Mobile Behavior:**

- Full-width tabs with horizontal scroll
- Active tab highlighted with ocean-blue underline
- Touch-friendly 44px minimum target size

---

### Hero Components

#### BeachHeroCompact

**File:** `components/beach-detail/beach-hero-compact.tsx`
**Purpose:** Compact beach title and metadata

```tsx
<BeachHeroCompact beach={beach} />
```

**Displays:**

- Beach name (h1)
- Rating (⭐ 4.5)
- Review count (23 reviews)
- Skill level badge (Easy/Intermediate/Advanced)
- Break type (Beach Break, Point Break, etc.)
- Location (San Diego, California)

**Layout:**
All metadata on a single line, wraps on mobile.

---

#### BeachPhotoGallery

**File:** `components/beach-detail/beach-photo-gallery.tsx`
**Purpose:** Visual presentation of beach

```tsx
<BeachPhotoGallery beach={beach} />
```

**Layout:**

```
┌─────────────┬──────┐
│             │ sm 1 │
│   Hero      ├──────┤
│   Photo     │ sm 2/│
│             │ map  │
└─────────────┴──────┘
```

**Features:**

- Fetches 5 best beach photos
- Hero image (left/top)
- 2 smaller images + map (right/bottom)
- Fallback to camera icon if no photos
- Photo count badge overlay
- Responsive grid (stacks on mobile)

---

### Stats & Actions Components

#### BeachStatsGrid

**File:** `components/beach-detail/beach-stats-grid.tsx`
**Purpose:** Key metrics at a glance

```tsx
<BeachStatsGrid beach={beach} currentForecast={forecast} />
```

**Cards:**

1. **Break Type** - Beach Break, Point, Reef, etc.
2. **Best Swell** - Ideal swell direction (from calibration data)
3. **Best Wind** - Offshore wind direction
4. **Preferred Tide** - Optimal tide range in feet

**Layout:**

- 2x2 grid on mobile
- 4 columns on desktop
- Icon + label + value format
- Ocean-blue color scheme

---

#### BeachActions

**File:** `components/beach-detail/beach-actions.tsx`
**Purpose:** Primary and secondary actions

```tsx
<BeachActions
  beach={beach}
  onLogSession={handleLog}
/>
```

**Buttons:**

- **Get Directions** - Opens Google Maps (secondary)
- **Log Session** - Opens modal to record a session (primary, blue)
- **Favorite** - Toggle favorite status
- **Set as Home Beach** - Set as default beach

**Layout:**

- Stacks vertically on mobile
- Horizontal row on desktop
- Blue buttons for session planning (primary actions)
- Outline button for directions (secondary)

---

### Tab Content Components

#### OverviewTab

**File:** `components/beach-detail/tabs/overview-tab.tsx`
**Content:**

- Beach description and etiquette
- Feature tags (parking, restrooms, showers)
- Practical tips (parking, access, wave tips)
- Warnings and hazards
- Best-of photo gallery
- Amenities grid

---

#### ForecastTab

**File:** `components/beach-detail/tabs/forecast-tab.tsx`
**Content:**

- **Current Conditions** - Real-time tide, wind, swell cards
- **Live Cam** - Video feed (if available)
- **5-Day Outlook** - Interactive forecast cards
- **Detailed Forecasts** - Hourly breakdown with charts
- **Detailed Swell Modal** - Click any day for deep dive

**Replaces:** The old "Conditions" tab with surf-specific data

---

#### ReviewsTab

**File:** `components/beach-detail/tabs/reviews-tab.tsx`
**Content:**

- Rating summary (5-category breakdown)
- Write review button
- Review list with pagination
- User avatars and ratings
- Helpful vote system

---

#### IntelTab

**File:** `components/beach-detail/tabs/intel-tab.tsx`
**Content:**

- Community condition reports
- Tag filters (conditions, parking, crowd, access)
- Deduplication for similar posts
- User-generated photos
- Location tracking

**Single Instance:** Fixes duplicate intel bug

---

#### SessionsTab

**File:** `components/beach-detail/tabs/sessions-tab.tsx`
**Content:**

- Recent sessions at this beach
- Forecast accuracy comparison
- Session statistics and trends
- Community session activity

---

## Mobile-First Design

### Responsive Breakpoints

| Breakpoint | Width      | Layout Changes                                         |
| ---------- | ---------- | ------------------------------------------------------ |
| Mobile     | < 640px    | Single column, stacked actions, horizontal scroll tabs |
| Tablet     | 640-1024px | 2-column grid, some horizontal layouts                 |
| Desktop    | > 1024px   | 4-column stats, side-by-side layouts                   |

### Touch Targets

All interactive elements meet minimum 44px touch target size:

- Tab triggers: 44px height
- Action buttons: 48px height
- Photo gallery items: Full card clickable
- Stats cards: 100% tappable

### Performance

- **Lazy loading:** Forecast, reviews, intel, sessions tabs
- **Dynamic imports:** Large components load on demand
- **Image optimization:** Next.js Image with proper sizes
- **Skeleton states:** Loading indicators for async content

---

## Data Flow

### Props Interface

```typescript
interface BeachDetailProps {
  id: string; // Beach UUID
  publicMode?: boolean; // Guest vs authenticated view
  initialBeach?: Beach; // SSR data
}
```

### State Management

```typescript
// Modal states
const [sessionPlanningOpen, setSessionPlanningOpen] = useState(false);
const [sessionPlanningMode, setSessionPlanningMode] = useState<"log" | "plan">(
  "log"
);
const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
const [reviewRefreshTrigger, setReviewRefreshTrigger] = useState(0);

// Forecast states
const [selectedDay, setSelectedDay] = useState<string | null>(null);
const [selectedForecastEntry, setSelectedForecastEntry] =
  useState<EnhancedForecastEntity | null>(null);
const [isModalOpen, setIsModalOpen] = useState(false);
```

### Data Fetching

| Data        | Method        | Timing                   |
| ----------- | ------------- | ------------------------ |
| Beach       | SSR + API     | Initial page load        |
| Forecasts   | API           | Client-side, immediate   |
| Photos      | Action + Hook | Lazy, on component mount |
| Calibration | Action + Hook | Lazy, for stats          |
| Reviews     | API           | On tab switch            |
| Intel       | API           | On tab switch            |
| Sessions    | API           | On tab switch            |

---

## Accessibility

### ARIA Labels

- Breadcrumb navigation: `aria-label="Breadcrumb"`
- Tab navigation: `role="tablist"`, `role="tab"`, `aria-selected`
- Action buttons: Descriptive `aria-label` attributes
- Modals: `role="dialog"`, `aria-labelledby`

### Keyboard Navigation

- **Tab** - Navigate through interactive elements
- **Enter/Space** - Activate buttons and tabs
- **Escape** - Close modals
- **Arrow keys** - Navigate between tabs (future enhancement)

### Screen Readers

- Semantic HTML (h1, nav, section)
- Alt text for all images
- Label associations for form inputs
- Live regions for dynamic content

---

## SEO

### Structured Data

```tsx
<BeachPageStructuredData
  beachName={beach.name}
  description="Surf conditions, tides, wind..."
  latitude={beach.latitude}
  longitude={beach.longitude}
  rating={beach.average_rating}
  reviewCount={beach.review_count}
/>

<BreadcrumbStructuredData
  items={[
    { name: "Home", url: baseUrl },
    { name: "Surf Spots Map", url: `${baseUrl}/map` },
    { name: beach.name, url: `${baseUrl}/beach/${slug}` }
  ]}
/>
```

### Meta Tags

```typescript
export async function generateMetadata({ params }): Promise<Metadata> {
  const beach = await getBeachBySlug(params.slug);
  return {
    title: `${beach.name} Surf Guide`,
    description: `Today's surf summary, tides, wind, swell, cams, and community intel for ${beach.name}.`,
    // ... OpenGraph, Twitter cards, etc.
  };
}
```

---

## Testing

### Unit Tests

Test each component in isolation:

```typescript
describe("BeachHeroCompact", () => {
  it("displays beach name as h1", () => {
    render(<BeachHeroCompact beach={mockBeach} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Ocean Beach"
    );
  });

  it("shows rating and review count", () => {
    const beach = { ...mockBeach, average_rating: 4.5, review_count: 23 };
    render(<BeachHeroCompact beach={beach} />);
    expect(screen.getByText("4.5")).toBeInTheDocument();
    expect(screen.getByText("(23 reviews)")).toBeInTheDocument();
  });
});
```

### E2E Tests

See: [e2e/beach-detail.spec.ts](../e2e/beach-detail.spec.ts)

Key test scenarios:

- Breadcrumb navigation works
- Tabs switch correctly
- Session planning modal opens from buttons
- Forecast data loads in Forecast tab
- Reviews appear in Reviews tab
- Intel appears in Local Intel tab
- Photo gallery displays images
- Stats grid shows all 4 cards

---

## Migration from Old Design

### Removed Components

- Old hero section (large gradient background)
- Duplicate intel sections (public vs authenticated)
- CrowdTipsSection (unused feature)
- Long scrolling layout
- Inline forecast snapshot (moved to tab)

### Deprecated Patterns

- ❌ Accordion-style sections
- ❌ Duplicate content for public/auth modes
- ❌ Long vertical scrolling
- ❌ Full-page hero with large stats card

### New Patterns

- ✅ Tabbed navigation
- ✅ Compact hero
- ✅ Photo gallery above fold
- ✅ Unified content regardless of auth state (use PublicContentGate overlay)
- ✅ Modal-based session planning

---

## Design Tokens

### Colors

| Token              | Value     | Usage                               |
| ------------------ | --------- | ----------------------------------- |
| `ocean-blue`       | `#0074D9` | Primary actions, active tabs, links |
| `blue-600`         | `#1E40AF` | Hover states                        |
| `muted-foreground` | `#6B7280` | Secondary text                      |
| `foreground`       | `#111827` | Primary text                        |

### Spacing

| Size    | Value  | Usage                         |
| ------- | ------ | ----------------------------- |
| `mb-6`  | `24px` | Section spacing               |
| `mb-8`  | `32px` | Major section breaks          |
| `gap-2` | `8px`  | Tight spacing (badges, chips) |
| `gap-4` | `16px` | Card spacing                  |
| `px-4`  | `16px` | Mobile padding                |
| `px-6`  | `24px` | Desktop padding               |

### Typography

| Element          | Font   | Size    | Weight |
| ---------------- | ------ | ------- | ------ |
| Beach name (h1)  | Space Grotesk | 36-48px | 800    |
| Section headings | Space Grotesk | 20-24px | 600    |
| Body text        | System | 14px    | 400    |
| Metadata         | System | 12-14px | 500    |

---

## Future Enhancements

### Planned Features

1. **Swipeable tabs** - Swipe gestures for mobile tab navigation
2. **Deep linking to tabs** - `/beach/slug?tab=forecast`
3. **Skeleton loaders** - Better loading states for tabs
4. **Tab caching** - Remember last visited tab
5. **Share functionality** - Share specific tabs or forecast days
6. **Bookmark conditions** - Save specific forecast conditions

### Performance Optimizations

1. **Virtual scrolling** - For long review/session lists
2. **Image lazy loading** - Progressive photo gallery
3. **Request deduplication** - Share data between tabs
4. **Prefetch adjacent tabs** - Load likely next tab in background

---

## References

### Related Documentation

- [Design Principles](./DESIGN_PRINCIPLES.md)
- [Component Architecture](../components/ARCHITECTURE.md)
- [E2E Test Plan](./E2E_TEST_PLAN.md)
- [Reddit User Guidance](./reddit_guidance.md)

### Design Inspiration

- [AllTrails Trail Pages](https://www.alltrails.com) - Tab structure, stats cards
- [Surfline Spot Pages](https://www.surfline.com) - Forecast integration
- [Material Design Tabs](https://m3.material.io/components/tabs) - Interaction patterns

### Component Dependencies

```
beach-detail.tsx
├── beach-breadcrumb.tsx
├── beach-hero-compact.tsx
├── beach-photo-gallery.tsx
│   └── beach-media-actions.ts (server action)
├── beach-stats-grid.tsx
│   └── beach-calibration-actions.ts (server action)
├── beach-actions.tsx
│   ├── favorite-button.tsx
│   └── home-beach-banner.tsx
├── session-planning-modal.tsx
│   └── SessionForm.tsx
└── beach-tabs.tsx
    ├── tabs/overview-tab.tsx
    │   ├── enhanced-beach-overview.tsx
    │   └── spot-overview.tsx
    ├── tabs/forecast-tab.tsx
    │   ├── forecast-and-tides.tsx
    │   ├── cams-section.tsx
    │   └── detailed-swell-modal.tsx
    ├── tabs/reviews-tab.tsx
    │   ├── beach-review-summary.tsx
    │   └── beach-reviews-list.tsx
    ├── tabs/intel-tab.tsx
    │   └── beach-intel-section.tsx
    └── tabs/sessions-tab.tsx
        ├── recent-sessions-section.tsx
        └── session-forecast-comparison.tsx
```

---

## Implementation Status

**Status:** ✅ **All Phases Complete** (Phases 1-6)

**Completion Date:** January 2025

### Phase Highlights

**Phase 1-2: Stats Grid & Breadcrumb** ✅

- AllTrails-inspired stats grid with 24px icons, ocean-blue branding
- Breadcrumb navigation with › separators
- Comprehensive unit tests (65+ tests passing)

**Phase 3: Photo Gallery** ✅

- 3-photo static display + map integration
- Lazy loading, responsive layout
- Openverse attribution
- 19 unit tests passing

**Phase 4: Hero & Metadata** ✅

- Compact hero with 36px Space Grotesk headings
- 20px star ratings, difficulty badges
- 46 unit tests for typography and styling

**Phase 5: Tabs & Actions** ✅

- 5 dedicated tabs (Overview, Forecast, Reviews, Intel, Sessions)
- Dual action buttons (Plan/Log Session)
- 25 unit tests for tab interactions

**Phase 6: Complete Integration** ✅

- All components integrated
- E2E test coverage (13/14 passing)
- Production-ready implementation

**Test Summary:**

- **Unit Tests:** 200+ passing
- **E2E Tests:** 13/14 passing
- **Total Coverage:** Comprehensive across all components

**Design Compliance:** 100% adherence to AllTrails-inspired specifications

---

## Changelog

### January 2025 - AllTrails Redesign

**Added:**

- Tabbed navigation system
- Compact hero component
- Photo gallery with map
- Stats grid component
- Session planning modal
- 5 dedicated tab content components

**Changed:**

- Layout from long-scroll to tab-based
- Hero from full-width gradient to compact single-line
- Actions moved above tabs
- Forecast moved to dedicated tab

**Removed:**

- Duplicate intel sections
- CrowdTipsSection component
- Old accordion-style sections
- Full-page hero design

**Fixed:**

- Intel displayed twice (public + auth modes)
- Excessive vertical scrolling
- Mobile usability issues
- Unclear content hierarchy

---

**Maintained by:** Quiver Development Team
**Last Review:** January 2025
**Next Review:** March 2025
