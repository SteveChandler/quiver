# Intent Components Architecture

## Overview

The `/components/intent` directory contains specialized components for rendering intent-based pages -- tide charts, water temperature guides, and other purpose-driven surf planning tools. These components power the `/tide/[city]`, `/water-temp/[city]`, `/beginner/[city]`, and `/least-crowded/[city]` routes, transforming raw NOAA and forecast data into interactive, visual planning modules.

## Purpose

Intent components provide:

- **Dedicated Tide Pages**: Full-featured tide planning with interactive multi-day charts, 7-day schedules, and per-beach tide preferences
- **Overview Modules**: Compact tide and water temperature summaries for generic intent templates
- **Cross-Linking Infrastructure**: State-level city grids that create crawl loops for SEO (state intent -> city intent -> city hub -> state intent)
- **Data Visualization**: Recharts-powered interactive charts with time range toggling, trend lines, and responsive layouts

## Component Hierarchy

```
Dedicated Tide Page (/tide/[city])
│
├── TidePageContent (root orchestrator)
│   ├── BreadcrumbStructuredData
│   ├── FAQSchema
│   ├── TideHeroSection (current conditions)
│   ├── TideFullChart (interactive multi-day chart)
│   ├── SevenDayTideTable (7-day high/low schedule)
│   ├── BeachTideCards (per-beach tide preferences)
│   ├── InlineSignupCta
│   ├── CityMapView (from /components/city)
│   ├── CTASection
│   └── StickySignupBar
│
Generic Intent Page (/[intent]/[city])
│
├── TideOverviewSection (compact tide card)
├── WaterTempOverviewSection (compact temp card)
└── ...
│
State Intent Page (/[intent]/[state])
│
└── PopularCitiesForIntent (city link grid)
```

## Components

### 1. TidePageContent

**File**: `tide-page-content.tsx`

**Type**: Server component

**Purpose**: Root orchestrator for `/tide/[city]` pages. Composes the full tide experience from hero section through charts, tables, beach cards, map, editorial content, and CTAs. Includes structured data (breadcrumbs, FAQ schema) for SEO.

**Props**:

```typescript
interface TidePageContentProps {
  cityName: string;
  citySlug: string;
  stateSlug: string;
  stateName: string;
  regionLabel: string;
  pageContent: IntentPageContent;
  tideData: CityTideDataExpanded;
  spots: SurfSpot[];
  updatedAt: string;
  baseUrl: string;
}
```

**Key Features**:

- Composes TideHeroSection, TideFullChart, SevenDayTideTable, and BeachTideCards in sequence
- Injects BreadcrumbStructuredData and FAQSchema for SEO
- Includes CityMapView for spot recommendations when beaches are available
- Renders editorial "focus points" from SURF_INTENTS definition
- "Continue exploring" aside links to related intent pages (beginner, water-temp, least-crowded)
- Includes InlineSignupCta, CTASection, and StickySignupBar for conversion

**Composition Flow**:

```
Header (breadcrumb + heading + intro)
  -> TideHeroSection (current conditions)
  -> TideFullChart (interactive chart)
  -> SevenDayTideTable (7-day schedule)
  -> BeachTideCards (per-beach preferences)
  -> InlineSignupCta
  -> CityMapView (spot recommendations)
  -> Focus Points (editorial)
  -> Continue Exploring (cross-links)
  -> CTASection + StickySignupBar
```

---

### 2. TideHeroSection

**File**: `tide-hero-section.tsx`

**Type**: Server component

**Purpose**: Prominent hero section displaying current tide conditions with large height readout, status badge (rising/falling), next tide info, and NOAA station attribution.

**Props**:

```typescript
interface TideHeroSectionProps {
  data: CityTideDataExpanded;
}
```

The component destructures `data` to access: `currentStatus`, `currentHeight`, `nextTideType`, `nextTideTime`, `nextTideHeight`, `beachName`, `tideStation`.

**Key Features**:

- Large numeric height display (e.g., "3.2 ft") parsed from string
- Rising/falling status badge with directional arrow icons
- Next tide panel with time and height
- NOAA station attribution footer
- Responsive layout: stacked on mobile, side-by-side on desktop

**Icon Logic**:

```typescript
isRising  -> ArrowUp icon (blue)
isFalling -> ArrowDown icon (blue)
nextHigh  -> ArrowUp icon
nextLow   -> ArrowDown icon
```

**Styling Patterns**:

- Container: `rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border border-blue-200/50 shadow-lg`
- Height Display: `text-5xl font-bold text-blue-800` with `text-2xl font-semibold text-blue-600` unit
- Status Badge: `bg-blue-100/80 text-blue-800`
- Attribution: `text-xs text-gray-500` with `border-t border-blue-100/50`

---

### 3. TideFullChart

**File**: `tide-full-chart.tsx`

**Type**: Client component (`"use client"`)

**Purpose**: Full interactive tide chart with three time range tabs (Today, 3-Day, 7-Day). Wraps the shared `TideChart` component from `/components/forecast` with time range toggling and a larger chart viewport.

**Props**:

```typescript
interface TideFullChartProps {
  hourlyPoints: Array<{ time: string; height: number }>;
}
```

**Key Features**:

- Three time range tabs: Today (24h), 3-Day (72h), 7-Day (168h)
- Time window shows 20% past / 80% future relative to current time
- Wraps shared `TideChart` component with `compact={true}` and dynamic `windowHours`
- Memoized date reference (`useMemo`) to prevent re-renders
- Returns `null` when `hourlyPoints` is empty

**Tab Configuration**:

```typescript
const TAB_CONFIG = [
  { key: "today", label: "Today",  hours: 24  },
  { key: "3day",  label: "3-Day",  hours: 72  },
  { key: "7day",  label: "7-Day",  hours: 168 },
];
```

**Styling Patterns**:

- Tab Container: `flex rounded-lg bg-gray-100 p-0.5`
- Active Tab: `bg-white text-blue-700 shadow-sm`
- Inactive Tab: `text-gray-600 hover:text-gray-800`
- Chart Container: `h-80 w-full rounded-2xl border bg-white p-2 shadow-sm`
- ARIA: `role="tablist"` on container, `role="tab"` with `aria-selected` on buttons

---

### 4. SevenDayTideTable

**File**: `seven-day-tide-table.tsx`

**Type**: Client component (`"use client"`)

**Purpose**: 7-day table of high/low tide extrema grouped by day, with responsive layouts for desktop (horizontal table) and mobile (stacked cards).

**Props**:

```typescript
interface SevenDayTideTableProps {
  days: TideDayExtrema[];
}
```

**Key Features**:

- Desktop: HTML `<table>` with columns Day | High 1 | Low 1 | High 2 | Low 2
- Mobile: Stacked card-per-day layout with grid of events
- Today's row highlighted with blue background and left border accent
- Internal `TideEventCell` component renders individual tide events with directional icons
- Returns `null` when `days` is empty
- Accessible: `<caption className="sr-only">` for screen readers

**Internal Components**:

- **`TideEventCell`**: Renders a single tide event with arrow icon (blue for high, indigo for low), formatted time, and height in feet

**Styling Patterns**:

- Desktop Table: `hidden md:block overflow-x-auto rounded-2xl border border-gray-200 shadow-sm`
- Today Row: `bg-blue-50 border-l-2 border-l-blue-500`
- Mobile Card: `rounded-xl border p-4 shadow-sm`, today variant: `bg-blue-50 border-blue-200`
- High Tide Icon: `text-blue-600`
- Low Tide Icon: `text-indigo-500`

---

### 5. BeachTideCards

**File**: `beach-tide-cards.tsx`

**Type**: Server component

**Purpose**: Grid of per-beach tide preference cards showing each beach's preferred tide range, preferred tide direction, and skill level badge. Links to individual beach detail pages.

**Props**:

```typescript
interface BeachTideCardsProps {
  beaches: BeachTidePreference[];
  citySlug: string;
  stateSlug: string;
}
```

**Key Features**:

- Filters beaches to only those with at least one tide preference attribute
- Skill level color-coded badges (green=beginner, yellow=intermediate, red=advanced)
- Preferred tide range displayed as pill (e.g., "1.2--3.5 ft")
- Directional icon for preferred tide direction (rising/falling/neutral)
- Links to beach detail pages when slug is available; plain card otherwise
- Returns `null` when no beaches have preference data

**Internal Components**:

- **`DirectionIcon`**: Maps direction strings to ArrowUp (rising), ArrowDown (falling), or Minus (neutral)
- **`skillLevelColor`**: Returns Tailwind classes based on skill level string

**Styling Patterns**:

- Grid: `grid gap-4 sm:grid-cols-2`
- Card: `rounded-xl border border-gray-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow`
- Tide Range Pill: `rounded-md bg-blue-50 px-2 py-1 text-blue-800 font-medium`
- Skill Badges: `bg-green-100 text-green-800` (beginner), `bg-yellow-100 text-yellow-800` (intermediate), `bg-red-100 text-red-800` (advanced)

---

### 6. TideOverviewSection

**File**: `tide-overview-section.tsx`

**Type**: Client component (`"use client"`)

**Purpose**: Compact tide overview card for the generic intent template (not the dedicated tide page). Shows current status, next tide info, and a mini tide chart using the shared `TideChart` component.

**Props**:

```typescript
interface TideOverviewSectionProps {
  data: CityTideData | null;
}
```

**Key Features**:

- Returns `null` when `data` is null
- Status badge combining current status and height (e.g., "Rising - 3.2 ft")
- Next tide info with directional icon
- Mini tide chart (h-48) rendered only when 2+ tide points are available
- Station/beach attribution

**Styling Patterns**:

- Card: `rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-blue-50/60 border-blue-200/50 shadow-lg`
- Header: `bg-gradient-to-r from-blue-50/80 to-indigo-50/80 border-b border-blue-100/50`
- Status Badge: `bg-blue-100/80 text-blue-800`
- Chart Height: `h-48`

---

### 7. WaterTempOverviewSection

**File**: `water-temp-overview-section.tsx`

**Type**: Client component (`"use client"`)

**Purpose**: Water temperature overview card with large temperature display, wetsuit recommendation, and 7-day trend line chart using Recharts `LineChart`.

**Props**:

```typescript
interface WaterTempOverviewSectionProps {
  data: CityWaterTempData | null;
}
```

**Key Features**:

- Returns `null` when `data` is null
- Large temperature readout (e.g., "62 F")
- Wetsuit recommendation via `getWetsuitRecommendation()` utility (thickness, description, extras)
- 7-day trend chart with Recharts `LineChart` (shown when 2+ data points exist)
- Y-axis domain auto-calculated with 2-degree padding
- Tooltip with full date formatting

**Styling Patterns**:

- Card: `rounded-2xl backdrop-blur-sm bg-gradient-to-br from-white/80 to-cyan-50/60 border-cyan-200/50 shadow-lg`
- Header: `bg-gradient-to-r from-cyan-50/80 to-teal-50/80 border-b border-cyan-100/50`
- Temperature: `text-5xl font-bold text-cyan-700` with `text-2xl font-semibold text-cyan-600` unit
- Chart: Recharts `LineChart`, stroke `#0891b2` (cyan-600), dot fill `#0891b2`, active dot `#06b6d4`
- Chart Height: `h-36`

**Dependencies**:

- `recharts` (ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid)
- `@/lib/utils/wetsuit-utils` (getWetsuitRecommendation, formatWaterTemp, parseWaterTempF)

---

### 8. PopularCitiesForIntent

**File**: `popular-cities-for-intent.tsx`

**Type**: Server component

**Purpose**: Grid of city links displayed on state-level intent pages (e.g., `/beginner/ca`). Creates the crawl loop: state intent -> city intent -> city hub -> state intent.

**Props**:

```typescript
interface PopularCitiesForIntentProps {
  intentKey: IntentKey;
  intentLabel: string;
  stateName: string;
  cities: CityLink[];
}

interface CityLink {
  slug: string;
  name: string;
}
```

**Key Features**:

- Returns `null` when `cities` is empty
- Uses `buildCityIntentUrl()` from `@/lib/constants/intent-definitions` for URL generation
- ARIA labels on each link for accessibility (e.g., "Beginner guide for San Diego")
- Responsive grid: 2 columns on mobile, 3 columns on tablet and up

**Styling Patterns**:

- Grid: `grid grid-cols-2 md:grid-cols-3 gap-2`
- City Card: `rounded-xl border border-blue-100/50 bg-gradient-to-br from-white/90 to-blue-50/30 hover:border-blue-200 hover:shadow-md transition-[border-color,box-shadow]`

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────┐
│ Server Actions (actions/forecast/intent-forecast-actions.ts)    │
│                                                                 │
│ getCityTideData()          -> CityTideData                      │
│ getCityTideDataExpanded()  -> CityTideDataExpanded              │
│ getCityWaterTempHistory()  -> CityWaterTempData                 │
│                                                                 │
│ Data Sources:                                                   │
│   enhanced_forecasts  (tide_status, tide_height, water_temp)    │
│   tide_forecasts      (ts, tide_height_m, tide_ft)              │
│   beaches             (preferred_tide_*, skill_level, slug)     │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ Page Server Components                                          │
│                                                                 │
│ /tide/[city]/page.tsx  ->  getCityTideDataExpanded()            │
│                            -> TidePageContent                   │
│                                                                 │
│ /[intent]/[city]/page.tsx  ->  getCityTideData()                │
│                                getCityWaterTempHistory()        │
│                                -> TideOverviewSection           │
│                                -> WaterTempOverviewSection      │
│                                                                 │
│ /[intent]/[state]/page.tsx ->  PopularCitiesForIntent           │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ Intent Components                                               │
│                                                                 │
│ ┌─────────────────────────┐ ┌──────────────────────────┐       │
│ │ TidePageContent         │ │ TideOverviewSection      │       │
│ │ (root orchestrator)     │ │ (compact card)           │       │
│ │                         │ └──────────────────────────┘       │
│ │ ├── TideHeroSection     │                                    │
│ │ ├── TideFullChart       │ ┌──────────────────────────┐       │
│ │ ├── SevenDayTideTable   │ │ WaterTempOverviewSection │       │
│ │ └── BeachTideCards      │ │ (compact card + chart)   │       │
│ └─────────────────────────┘ └──────────────────────────┘       │
│                                                                 │
│ ┌──────────────────────────┐                                   │
│ │ PopularCitiesForIntent   │                                   │
│ │ (state -> city links)    │                                   │
│ └──────────────────────────┘                                   │
└──────────────────┬──────────────────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────────────────┐
│ User Interactions                                               │
│                                                                 │
│ - Toggle tide chart time range (Today / 3-Day / 7-Day)         │
│ - Click beach tide card -> navigate to beach detail page       │
│ - Click city in PopularCitiesForIntent -> city intent page     │
│ - Hover over trend chart -> tooltip with date + value          │
│ - Click "Continue exploring" links -> related intent pages     │
└─────────────────────────────────────────────────────────────────┘
```

### Type Definitions

All types are exported from `actions/forecast/intent-forecast-actions.ts`:

```typescript
// Base tide data for overview cards
interface CityTideData {
  tidePoints: TidePoint[];
  currentStatus: string | null;
  currentHeight: string | null;
  nextTideType: string | null;
  nextTideTime: string | null;
  nextTideHeight: string | null;
  beachName: string;
  tideStation: string | null;
}

// Extended data for dedicated tide pages
interface CityTideDataExpanded extends CityTideData {
  sevenDayExtrema: TideDayExtrema[];
  hourlyPoints: Array<{ time: string; height: number }>;
  beachTidePreferences: BeachTidePreference[];
}

// One day's high/low events for the 7-day table
interface TideDayExtrema {
  date: string;
  label: string;       // "Today", "Tomorrow", "Wed, Feb 12"
  isToday: boolean;
  events: TideExtremaEvent[];
}

// Individual tide extremum
interface TideExtremaEvent {
  time: string;
  height: number;
  type: "high" | "low";
  timeFormatted: string;
}

// Per-beach tide preference
interface BeachTidePreference {
  beachName: string;
  beachSlug: string | null;
  preferredTideMin: number | null;
  preferredTideMax: number | null;
  preferredDirection: string | null;
  skillLevel: string | null;
}

// Water temperature data for overview cards
interface CityWaterTempData {
  currentTemp: number;
  points: Array<{ date: string; tempF: number }>;
  beachName: string;
}
```

---

## Design Language

Intent components follow a frosted glass aesthetic that distinguishes them from the standard city components.

### Color System

- **Tide Components**: Blue-to-indigo gradient family
  - Card backgrounds: `bg-gradient-to-br from-white/80 to-blue-50/60`
  - Borders: `border-blue-200/50`, `border-blue-100/50`
  - Accents: `text-blue-600`, `text-blue-800`
  - Low tide accent: `text-indigo-500`
- **Water Temp Components**: Cyan-to-teal gradient family
  - Card backgrounds: `bg-gradient-to-br from-white/80 to-cyan-50/60`
  - Borders: `border-cyan-200/50`
  - Accents: `text-cyan-600`, `text-cyan-700`
- **Shared Patterns**:
  - Glass effect: `backdrop-blur-sm` on card containers
  - Semi-transparent backgrounds: `bg-white/80`, `bg-white/90`, `bg-white/60`
  - Ocean-tinted borders: `border-blue-100/50`
  - Card shape: `rounded-2xl` universally
  - Shadows: `shadow-lg` for primary cards, `shadow-sm` for secondary elements

### Responsive Patterns

- **Mobile-first**: All components stack vertically on small screens
- **Desktop breakpoints**: `md:` for layout changes (side-by-side, table vs. cards)
- **Chart heights**: `h-80` for full chart, `h-48` for overview chart, `h-36` for trend chart
- **Grids**: `sm:grid-cols-2` for beach cards, `md:grid-cols-3` for city links

### Typography Scale

- **Section headings**: `text-2xl font-semibold text-gray-800`
- **Card titles**: `text-lg font-semibold text-gray-800`
- **Body text**: `text-sm text-gray-600` or `text-base text-gray-700`
- **Attribution**: `text-xs text-gray-500`
- **Large numbers**: `text-5xl font-bold` (tide height, water temp)

---

## Related Files

- `/components/intent/tide-page-content.tsx`
- `/components/intent/tide-hero-section.tsx`
- `/components/intent/tide-full-chart.tsx`
- `/components/intent/seven-day-tide-table.tsx`
- `/components/intent/beach-tide-cards.tsx`
- `/components/intent/tide-overview-section.tsx`
- `/components/intent/water-temp-overview-section.tsx`
- `/components/intent/popular-cities-for-intent.tsx`
- `/components/intent/index.ts`
- `/actions/forecast/intent-forecast-actions.ts`
- `/app/[intent]/[city]/page.tsx`
- `/lib/constants/intent-definitions.ts`
- `/lib/constants/surf-intents.ts`
- `/lib/seo/intent-faq-generator.ts`
- `/lib/seo/intent-content-templates.ts`
- `/lib/utils/wetsuit-utils.ts`
- `/components/forecast/tide-chart-recharts.tsx`

---

## Changelog

**Created**: 2026-02-06
**Components Documented**: 8
