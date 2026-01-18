# City Components Architecture

## Overview

The `/components/city` directory contains specialized components for rendering city-level surf destination pages with rich editorial content, interactive maps, and intelligent guides. These components transform city pages from simple beach listings into comprehensive surf planning hubs with tactical advice, session timing recommendations, and intent-based beach discovery.

## Purpose

City components provide:

- **Editorial-First Design**: Rich storytelling about each city's surf culture and characteristics
- **Interactive Beach Discovery**: Full-width map view with integrated beach list for exploration
- **Tactical Surf Intelligence**: Session timing modules with marine layer, tide, and wind advice
- **Intent-Based Navigation**: Filter beaches by user goals (beginner-friendly, less crowded, tide-dependent)
- **Actionable Planning**: Quick links and checklists for session preparation

## Component Hierarchy

```
City Page (app/beaches/[country]/[state]/[city]/page.tsx)
│
├── CityMapView
│   ├── InteractiveMap (from /components/map)
│   └── BeachListItem (internal component)
│
├── QuickActionsBar
│
├── SessionTimingModules
│
├── AboutAccordion
│
├── GuidesByIntentGrid
│
└── PlanningChecklist
```

## Components

### 1. CityMapView

**File**: `city-map-view.tsx`

**Purpose**: Full-width interactive map with beach list sidebar (desktop) or horizontal scroll (mobile). Combines exploration with navigation to individual beach detail pages.

**Props**:

```typescript
interface CityMapViewProps {
  spots: SurfSpot[];           // Beach data in SurfSpot format
  cityName: string;            // Display name (e.g., "San Diego")
  citySlug: string;            // URL slug (e.g., "san-diego")
  stateSlug?: string;          // State slug (default: "ca")
  countrySlug?: string;        // Country slug (default: "usa")
}
```

**Key Features**:

- **Responsive Layout**: Desktop shows side-by-side beach list + map. Mobile shows map above horizontal beach scroll.
- **Interactive Markers**: Click beach on map to select it
- **Navigation**: Click beach in list to navigate to beach detail page
- **Error Boundaries**: Graceful fallback if Mapbox fails to load
- **SurfSpot Transformation**: Converts `SurfSpot` objects to `Beach` format for map compatibility

**Internal Components**:

- **`BeachListItem`**: Individual beach row with skill level badge, name, description, and hover states
- **`MapErrorBoundary`**: Class-based error boundary for Mapbox errors

**Usage Example**:

```typescript
import { CityMapView } from "@/components/city/city-map-view";
import { transformBeachesToSurfSpots } from "@/lib/utils/beach-to-surfspot-transformer";

const surfSpots = transformBeachesToSurfSpots(beaches);

<CityMapView
  spots={surfSpots}
  cityName="San Diego"
  citySlug="san-diego"
  stateSlug="ca"
  countrySlug="usa"
/>
```

**Styling Patterns**:

- Desktop: `lg:grid lg:grid-cols-[380px_1fr]` - Fixed 380px sidebar + fluid map
- Mobile: `flex flex-col` - Stacked layout with horizontal scroll for beaches
- Skill Level Badges: Color-coded (`bg-green-100 text-green-700` for beginner, `bg-red-100 text-red-700` for advanced)
- Selected State: `bg-sky-50 border-l-4 border-sky-500`
- Hover State: `bg-slate-50`

**Data Flow**:

```
City Page Data Fetch
  → Transform beaches to SurfSpots (beach-to-surfspot-transformer)
  → Pass to CityMapView
  → Transform back to Beach format for InteractiveMap
  → User clicks beach → Navigate to beach detail page
```

---

### 2. QuickActionsBar

**File**: `quick-actions-bar.tsx`

**Purpose**: Horizontal navigation row with pill-shaped buttons linking to related city pages (tide charts, beginner guides, water temp, etc.).

**Props**:

```typescript
interface QuickActionsBarProps {
  links: QuickLink[];  // Array of navigation links
}

interface QuickLink {
  label: string;       // Display text (e.g., "Tide Charts")
  href: string;        // URL (e.g., "/tide/san-diego")
}
```

**Icon Mapping**:

The component automatically selects icons based on `href` content:

- `href.includes("map")` → `Map` icon
- `href.includes("tide")` → `Waves` icon
- `href.includes("beginner")` → `Users` icon
- `href.includes("water-temp")` → `Thermometer` icon
- Default → `Map` icon

**Usage Example**:

```typescript
import { QuickActionsBar } from "@/components/city/quick-actions-bar";

const quickLinks = [
  { label: "Tide Charts", href: "/tide/san-diego" },
  { label: "Beginner Beaches", href: "/beginner/san-diego" },
  { label: "Water Temp Guide", href: "/water-temp/san-diego" },
];

<QuickActionsBar links={quickLinks} />
```

**Styling Patterns**:

- Pill Buttons: `rounded-full border border-slate-200 bg-white hover:bg-sky-50`
- Flex Wrap: `flex flex-wrap gap-3` - Responsive wrapping on small screens
- Icon + Text: `flex items-center gap-2` with `h-4 w-4` icons
- Hover State: `hover:border-sky-200 hover:text-sky-700`

**Conditional Rendering**:

Returns `null` if `links` is empty or undefined.

---

### 3. SessionTimingModules

**File**: `session-timing-modules.tsx`

**Purpose**: Three-card grid displaying tactical surf advice for different time horizons (Today, Now, Weekend).

**Props**:

```typescript
interface SessionTimingModulesProps {
  modules: SessionTimingModule[];
}

interface SessionTimingModule {
  title: string;    // "Today", "Now", "Weekend"
  summary: string;  // Tactical advice text
  icon: string;     // Icon name ("sun", "clock", "calendar")
}
```

**Icon Mapping**:

```typescript
"sun" → Sun
"clock" → Clock
"calendar" → Calendar
default → Sun
```

**Usage Example**:

```typescript
import { SessionTimingModules } from "@/components/city/session-timing-modules";

const modules = [
  {
    title: "Today",
    summary: "Marine layer burns off by 9 AM. Best surf at morning low tide around 7 AM.",
    icon: "sun"
  },
  {
    title: "Now",
    summary: "Offshore winds picking up. Glassy conditions expected until 2 PM.",
    icon: "clock"
  },
  {
    title: "Weekend",
    summary: "Incoming swell Saturday afternoon. Shoulder-high sets expected Sunday morning.",
    icon: "calendar"
  }
];

<SessionTimingModules modules={modules} />
```

**Styling Patterns**:

- Grid Layout: `grid gap-4 md:grid-cols-3` - Single column mobile, 3 columns desktop
- Card Style: `rounded-xl border border-slate-200 bg-slate-50 p-5`
- Icon + Title: `flex items-center gap-2` with `h-5 w-5 text-sky-600` icons
- Typography: `text-lg font-semibold` title, `text-sm text-slate-700` summary

**Content Strategy**:

- **Today**: Marine layer timing, tide schedules, parking advice
- **Now**: Current wind patterns, crowd reports, immediate conditions
- **Weekend**: Multi-day planning, swell forecasts, backup options

---

### 4. AboutAccordion

**File**: `about-accordion.tsx`

**Purpose**: Collapsible "About {City} Surf" section with editorial content and dynamic links to top spots and less-crowded guides.

**Props**:

```typescript
interface AboutAccordionProps {
  cityName: string;          // "San Diego"
  citySlug: string;          // "san-diego"
  description: string[];     // Array of editorial paragraphs
  topSpotSlug?: string;      // Slug for top-rated beach
  topSpotName?: string;      // Name for top-rated beach
}
```

**Usage Example**:

```typescript
import { AboutAccordion } from "@/components/city/about-accordion";

const description = [
  "San Diego's 70 miles of coastline offer year-round surf across a dozen microclimates...",
  "From the hollow beachbreaks of Pacific Beach to the mellow longboard waves of La Jolla Shores...",
];

<AboutAccordion
  cityName="San Diego"
  citySlug="san-diego"
  description={description}
  topSpotSlug="blacks-beach"
  topSpotName="Blacks Beach"
/>
```

**Dynamic Content Injection**:

The component appends two standard closing paragraphs with dynamic links:

1. **Tactical Paragraph**: Links to top spot
   - "Today's playbook: set alerts for the morning low tide... toward [Blacks Beach](#)."
2. **Weekend Planning**: Links to less-crowded guide
   - "Weekend outlook: pair the incoming tide push... jump into the [less-crowded guide](/least-crowded/san-diego)..."

**Styling Patterns**:

- Accordion: Radix UI `Accordion` with `type="single" collapsible`
- Container: `border rounded-xl px-5` on `AccordionItem`
- Trigger: `text-xl font-semibold text-slate-900 hover:no-underline`
- Content: `space-y-4 text-base leading-relaxed text-slate-700 pb-4`
- Links: `font-semibold text-sky-700 underline-offset-2 hover:underline`

**Conditional Rendering**:

Returns `null` if `description` is empty.

---

### 5. GuidesByIntentGrid

**File**: `guides-by-intent-grid.tsx`

**Purpose**: 2x2 grid of intent-based beach guides (beginner, less-crowded, tide, water-temp) with top beaches and links to full playbook pages.

**Props**:

```typescript
interface GuidesByIntentGridProps {
  cityName: string;              // "San Diego"
  citySlug: string;              // "san-diego"
  featuredIntents: string[];     // ["beginner", "least-crowded", "tide"]
  beaches: BeachWithMetrics[];   // All beaches in city
}

type SurfIntentSlug = "beginner" | "least-crowded" | "tide" | "water-temp";
```

**Intent Filtering Logic**:

```typescript
switch (intent) {
  case "beginner":
    return skillLevel.includes("beginner") || skillLevel.includes("longboard");
  case "least-crowded":
    return crowdLevel.includes("light") || crowdLevel.includes("low");
  case "tide":
  case "water-temp":
    return true; // All beaches relevant
}
```

**Usage Example**:

```typescript
import { GuidesByIntentGrid } from "@/components/city/guides-by-intent-grid";

<GuidesByIntentGrid
  cityName="San Diego"
  citySlug="san-diego"
  featuredIntents={["beginner", "least-crowded", "tide", "water-temp"]}
  beaches={beaches}
/>
```

**Data Flow**:

```
featuredIntents → Filter valid intent slugs
  → For each intent:
    → Filter beaches matching intent criteria
    → Show top 4 beaches as linked list
    → Link to full playbook page (/{intent}/{citySlug})
```

**Styling Patterns**:

- Grid: `grid gap-6 md:grid-cols-2` - 1 column mobile, 2 columns desktop
- Card: `rounded-xl border border-slate-200 p-5 shadow-sm hover:shadow-md transition-shadow`
- Beach List: `mt-4 space-y-2 text-sm text-sky-700`
- Links: `underline-offset-2 hover:underline`

**Intent Definitions**:

Dynamically pulled from `SURF_INTENTS` constant:

- **beginner**: "Best Beginner Beaches in {cityName}"
- **least-crowded**: "Less-Crowded Surf Spots in {cityName}"
- **tide**: "Tide-Dependent Breaks in {cityName}"
- **water-temp**: "Water Temperature Guide for {cityName}"

---

### 6. PlanningChecklist

**File**: `planning-checklist.tsx`

**Purpose**: Compact footer with actionable checklist items for session planning.

**Props**:

```typescript
interface PlanningChecklistProps {
  items: string[];  // Array of checklist items
}
```

**Usage Example**:

```typescript
import { PlanningChecklist } from "@/components/city/planning-checklist";

const checklist = [
  "Check marine layer burn-off time (usually 9-10 AM)",
  "Set alerts for morning low tide windows",
  "Monitor wind reversal after 10 AM",
  "Have backup parking plan for weekends",
  "Review less-crowded alternatives if primary spot is packed",
];

<PlanningChecklist items={checklist} />
```

**Styling Patterns**:

- Container: `mt-12 rounded-xl border border-slate-200 bg-slate-50 p-6`
- List: `space-y-2 text-sm text-slate-700`
- List Items: `flex items-start gap-2` with `text-sky-600 mt-0.5` dash marker
- Typography: `text-lg font-semibold text-slate-900 mb-3` for heading

**Content Strategy**:

Checklist items should be:
- **Actionable**: Start with verbs (Check, Set, Monitor, Review)
- **Specific**: Reference local conditions (marine layer, tide windows)
- **Tactical**: Provide concrete advice (backup parking, wind timing)

---

## Integration with City Page

### Page Structure

```typescript
// app/beaches/[country]/[state]/[city]/page.tsx

export default async function LocationPage({ params }: LocationPageProps) {
  // 1. Fetch location data
  const response = await getLocationPageData(params.city, params.state, params.country);

  // 2. Fetch editorial content
  const editorial = await getCityEditorialContent(params.city, params.state, params.country);

  // 3. If editorial exists, render enhanced layout
  if (editorial) {
    const surfSpots = transformBeachesToSurfSpots(beaches);

    return (
      <>
        {/* Header with breadcrumb */}
        <header>...</header>

        {/* City Components */}
        <CityMapView spots={surfSpots} cityName={editorial.city_name} {...params} />
        <QuickActionsBar links={editorial.quick_links} />
        <SessionTimingModules modules={editorial.session_timing} />
        <AboutAccordion cityName={editorial.city_name} description={editorial.description} {...} />
        <GuidesByIntentGrid cityName={editorial.city_name} featuredIntents={editorial.featured_intents} beaches={beaches} />
        <PlanningChecklist items={editorial.planning_checklist} />
      </>
    );
  }

  // 4. Otherwise, render standard layout
  return <StandardLocationLayout {...} />;
}
```

### Editorial Content Structure

City editorial content is stored in the `city_editorial_content` table:

```sql
CREATE TABLE city_editorial_content (
  city_slug TEXT PRIMARY KEY,
  city_name TEXT NOT NULL,
  state_slug TEXT NOT NULL,
  country_slug TEXT NOT NULL,
  region_label TEXT,
  description TEXT[] NOT NULL,                    -- AboutAccordion paragraphs
  session_timing JSONB DEFAULT '[]',              -- SessionTimingModules data
  quick_links JSONB DEFAULT '[]',                 -- QuickActionsBar links
  featured_intents TEXT[] DEFAULT '{}',           -- GuidesByIntentGrid intents
  planning_checklist TEXT[] DEFAULT '{}',         -- PlanningChecklist items
  updated_at TIMESTAMPTZ DEFAULT now()
);
```

### Data Transformer

**File**: `/lib/utils/beach-to-surfspot-transformer.ts`

Converts `BeachWithMetrics` database records to `SurfSpot` objects for city components:

```typescript
export function transformBeachesToSurfSpots(beaches: BeachWithMetrics[]): SurfSpot[] {
  return beaches.map(beach => ({
    id: beach.id,
    name: beach.name,
    slug: beach.slug,
    coordinates: {
      lat: beach.lat,
      lon: beach.lon,  // Use 'lon' not 'lng' for consistency
    },
    region: `${beach.city}, ${beach.state}`,
    skillLevel: beach.skill_level || "Intermediate",
    overview: beach.description || "...",
    // ... other fields
  }));
}
```

---

## Data Flow Summary

```
┌─────────────────────────────────────────────────────────────┐
│ City Page Server Component                                  │
│                                                              │
│ 1. Fetch location data (beaches, stats)                     │
│ 2. Fetch editorial content (if exists)                      │
│ 3. Transform beaches → SurfSpots                            │
└──────────────────┬──────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ City Components (Client-Side)                               │
│                                                              │
│ ┌─────────────────────┐  ┌────────────────────┐            │
│ │  CityMapView        │  │ QuickActionsBar    │            │
│ │  - spots            │  │ - links            │            │
│ │  - cityName, etc.   │  └────────────────────┘            │
│ └─────────────────────┘                                     │
│                                                              │
│ ┌─────────────────────┐  ┌────────────────────┐            │
│ │ SessionTimingModules│  │ AboutAccordion     │            │
│ │ - modules           │  │ - description      │            │
│ └─────────────────────┘  │ - topSpotSlug      │            │
│                          └────────────────────┘            │
│                                                              │
│ ┌─────────────────────┐  ┌────────────────────┐            │
│ │ GuidesByIntentGrid  │  │ PlanningChecklist  │            │
│ │ - featuredIntents   │  │ - items            │            │
│ │ - beaches           │  └────────────────────┘            │
│ └─────────────────────┘                                     │
└─────────────────────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────┐
│ User Interactions                                            │
│                                                              │
│ - Click beach in map/list → Navigate to beach detail page  │
│ - Click quick link → Navigate to related guide page        │
│ - Click intent guide → Navigate to full playbook           │
│ - Expand accordion → Read editorial content                │
└─────────────────────────────────────────────────────────────┘
```

---

## Styling Patterns

### Color System

All city components follow the Quiver design system:

- **Primary Brand**: `sky-600`, `sky-700` for links and accents
- **Neutral Backgrounds**: `slate-50`, `slate-100` for cards
- **Borders**: `slate-200` for subtle dividers
- **Text Hierarchy**:
  - Primary: `slate-900`
  - Secondary: `slate-700`
  - Tertiary: `slate-600`, `slate-500`

### Responsive Patterns

```css
/* Mobile-first approach */
.component {
  /* Base: Mobile styles */
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

/* Tablet and up */
@media (min-width: 768px) {
  .component {
    grid-template-columns: repeat(2, 1fr);
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .component {
    grid-template-columns: repeat(3, 1fr);
  }
}
```

### Tailwind Class Patterns

- **Spacing**: Consistent `gap-{n}`, `p-{n}`, `mt-{n}` scale (4px increments)
- **Rounded Corners**: `rounded-xl` for cards, `rounded-full` for pills
- **Shadows**: `shadow-sm` default, `hover:shadow-md` on interactive elements
- **Transitions**: `transition-colors`, `transition-shadow` for smooth interactions

---

## Best Practices

### Component Design

1. **Conditional Rendering**: All components return `null` if data is empty/undefined
2. **Prop Validation**: TypeScript interfaces enforce strict typing
3. **Icon Selection**: Dynamic icon mapping based on content/context
4. **Error Boundaries**: CityMapView includes error boundary for Mapbox failures
5. **Accessibility**: Semantic HTML, ARIA labels, keyboard navigation

### Data Management

1. **Server-Side Fetching**: Editorial content fetched in server component (city page)
2. **Client-Side Interactivity**: City components are `"use client"` for map, accordions, etc.
3. **Transformation Layer**: Clear separation between database schema and component props
4. **Type Safety**: Strict TypeScript interfaces for all props and data structures

### Performance

1. **Dynamic Imports**: InteractiveMap loaded with `next/dynamic` (no SSR)
2. **Lazy Loading**: Map only renders when component mounts
3. **Error Fallbacks**: Graceful degradation if map fails
4. **Memoization**: `useMemo` for expensive calculations (map center, beach filtering)

### Content Strategy

1. **Editorial Quality**: Rich, local-specific content over generic templates
2. **Actionable Advice**: Tactical tips (tide timing, wind patterns, parking)
3. **Intent-Based Discovery**: Help users find beaches matching their goals
4. **Progressive Disclosure**: Use accordions to hide long content initially

---

## Testing Considerations

### Unit Tests

```typescript
// Example: QuickActionsBar tests
describe("QuickActionsBar", () => {
  it("renders links with correct icons", () => {
    const links = [
      { label: "Tide Charts", href: "/tide/san-diego" },
      { label: "Beginner Beaches", href: "/beginner/san-diego" },
    ];
    render(<QuickActionsBar links={links} />);
    expect(screen.getByText("Tide Charts")).toBeInTheDocument();
    // Icon assertions...
  });

  it("returns null when links are empty", () => {
    const { container } = render(<QuickActionsBar links={[]} />);
    expect(container.firstChild).toBeNull();
  });
});
```

### Integration Tests

Test full page rendering with editorial content:

```typescript
describe("City Page with Editorial", () => {
  it("renders all city components when editorial exists", async () => {
    // Mock editorial data
    // Render page
    // Assert all components present
  });

  it("falls back to standard layout when no editorial", async () => {
    // Mock no editorial
    // Render page
    // Assert standard layout
  });
});
```

### E2E Tests (Playwright)

```typescript
test("city page navigation flow", async ({ page }) => {
  await page.goto("/beaches/usa/ca/san-diego");

  // Click beach in map
  await page.click('[data-beach-slug="blacks-beach"]');

  // Verify navigation to beach detail page
  await expect(page).toHaveURL(/.*blacks-beach/);
});
```

---

## Future Enhancements

### Planned Features

1. **Real-Time Session Timing**: Live updates from weather API
2. **Personalized Recommendations**: ML-based beach suggestions
3. **User-Generated Content**: Community-submitted timing tips
4. **Save/Bookmark Cities**: User preference storage
5. **Swell Forecast Integration**: Multi-day forecast cards

### Component Improvements

1. **CityMapView**: Add 3D terrain, satellite imagery toggle
2. **SessionTimingModules**: Expand to hourly timeline
3. **GuidesByIntentGrid**: Add filters for swell direction, tide phase
4. **AboutAccordion**: Support rich media (videos, image galleries)

### Performance Optimizations

1. **Map Clustering**: Group nearby beaches at low zoom levels
2. **Virtual Scrolling**: Handle 100+ beaches in list
3. **Image Optimization**: WebP/AVIF formats for beach photos
4. **Code Splitting**: Lazy load intent grid per card

---

## Changelog

**Created**: 2025-12-03
**Components Documented**: 6
**Related Files**:
- `/components/city/city-map-view.tsx`
- `/components/city/quick-actions-bar.tsx`
- `/components/city/session-timing-modules.tsx`
- `/components/city/about-accordion.tsx`
- `/components/city/guides-by-intent-grid.tsx`
- `/components/city/planning-checklist.tsx`
- `/app/beaches/[country]/[state]/[city]/page.tsx`
- `/lib/utils/beach-to-surfspot-transformer.ts`
