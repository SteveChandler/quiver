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
│   ├── ZineSurface (cream paper) with TideBreadcrumbs (visible + BreadcrumbList)
│   ├── TideStationNow, TideWeekTable (from /components/tide-stations)
│   ├── TidePanelChart (/components/tides; web port of native CompactTideDrilldownChart)
│   ├── Tide station card (links /tides/station/[slug])
│   ├── BeachTideCards ("Tide by spot": range + direction, no skill badges)
│   ├── FAQSchema
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

Renders `/tide/[city]`. Every tide number on the page (hero, chart, week table, and the
`<title>` built in `app/[intent]/[city]/page.tsx`) comes from one series,
`tideData.view` (`CityTideView`, `lib/tides/city-tide-view.ts`):

- the NOAA station table for the representative beach's `tide_forecasts.station_id`
  (the same table `/tides/station/[slug]` shows), or
- the beach's stored hourly series when the station row or NOAA is unavailable.

`view` is null (or has no extremes) when there is no series; the tide modules are then hidden.
The tide modules sit on cream paper (`ZineSurface`); session handoff, app CTA, map, focus
points, explore links and FAQ follow on the stage.

### 2–5. Removed (Nov 2026)

`TideHeroSection`, `TideFullChart` and `SevenDayTideTable` were replaced by the station page
parts and `TidePanelChart`. `BeachTideCards` now renders the paper "Tide by spot" list.

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
│ │ ├── TideStationNow      │                                    │
│ │ ├── TidePanelChart      │ ┌──────────────────────────┐       │
│ │ ├── TideWeekTable       │ │ WaterTempOverviewSection │       │
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
