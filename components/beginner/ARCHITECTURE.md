# Beginner Components Architecture

## Overview

The `/components/beginner` directory contains specialized components for rendering beginner-focused surf city pages. These components power the `/beginner/[city]` route, transforming raw forecast data and editorial content into an approachable, information-rich experience designed for first-time and novice surfers. The design emphasizes safety, clarity, and progressive disclosure through scroll-triggered animations and a frosted glass aesthetic.

## Purpose

Beginner components provide:

- **Live Conditions Dashboard**: Real-time, color-coded metrics (waves, wind, water temp, tide, crowd) so beginners can assess conditions at a glance
- **Ranked Beach Discovery**: Curated, numbered list of beginner-friendly beaches with editorial rationale and logistics (parking, lifeguards, best hours)
- **Safety-First Content**: Dedicated safety essentials, gear guides, and seasonal context to build confidence
- **Structured Data for SEO**: FAQ and BreadcrumbList JSON-LD schema generated in the root orchestrator
- **Conversion CTAs**: Inline and sticky signup bars targeting unauthenticated visitors

## Component Hierarchy

```
Beginner City Page (app/beginner/[city]/page.tsx)
|
+-- BeginnerPageContent (root orchestrator, server component)
    |
    +-- SectionFadeUp (client, wraps every section below)
    |   +-- BeginnerHero
    |
    +-- SectionFadeUp
    |   +-- RightNowConditions
    |
    +-- SectionFadeUp
    |   +-- BeginnerSpotList
    |
    +-- SectionFadeUp
    |   +-- WhatToExpect
    |
    +-- SectionFadeUp
    |   +-- SeasonalGuide
    |
    +-- SectionFadeUp
    |   +-- SafetyEssentials
    |
    +-- SectionFadeUp
    |   +-- GearAndLessons
    |
    +-- SectionFadeUp
    |   +-- SessionGallery
    |
    +-- SectionFadeUp
    |   +-- BeginnerFAQ
    |
    +-- InlineSignupCta (from /components/shared)
    +-- StickySignupBar (from /components/shared)
```

## Components

### 1. BeginnerPageContent

**File**: `BeginnerPageContent.tsx`

**Type**: Server component

**Purpose**: Root orchestrator for `/beginner/[city]` pages. Composes all child sections, generates FAQ and BreadcrumbList structured data (JSON-LD), and includes conversion CTAs for unauthenticated users.

**Props**:

```typescript
interface BeginnerPageContentProps {
  cityName: string;
  citySlug: string;
  stateSlug: string;
  stateName: string;
  regionLabel: string;
  conditionsBadge: BeginnerConditionsBadge | null;
  rightNowConditions: RightNowConditionsType | null;
  beaches: BeginnerBeachWithEditorial[];
  cityEditorial: BeginnerCityEditorial | null;
  totalBeaches: number;
  baseUrl: string;
}
```

**Key Features**:

- **Section Composition**: Wraps every child section in `SectionFadeUp` for scroll-triggered animation
- **Structured Data**: Injects `<script type="application/ld+json">` for FAQ and BreadcrumbList schemas
- **Conditional Sections**: Renders `RightNowConditions` only if data is present; renders `WhatToExpect` only if editorial has multiple paragraphs
- **Auth-Gated CTAs**: Shows `InlineSignupCta` and `StickySignupBar` for unauthenticated visitors

**Usage Example**:

```typescript
import { BeginnerPageContent } from "@/components/beginner";

<BeginnerPageContent
  cityName="San Diego"
  citySlug="san-diego"
  stateSlug="ca"
  stateName="California"
  regionLabel="Southern California"
  conditionsBadge={conditionsBadge}
  rightNowConditions={conditions}
  beaches={beaches}
  cityEditorial={editorial}
  totalBeaches={12}
  baseUrl="https://www.quiversurf.app"
/>
```

---

### 2. BeginnerHero

**File**: `BeginnerHero.tsx`

**Type**: Server component

**Purpose**: Hero section displaying city name, region label, beach count, conditions badge, and the first editorial paragraph to immediately orient the visitor.

**Props**:

```typescript
interface BeginnerHeroProps {
  cityName: string;
  regionLabel: string;
  totalBeaches: number;
  conditionsBadge: BeginnerConditionsBadge | null;
  cityEditorial: BeginnerCityEditorial | null;
}
```

**Key Features**:

- **Conditions Badge**: Displays a "great", "fair", or "challenging" label with color-coded status dot (green, amber, red)
- **Beach Count**: Shows total number of beginner-friendly beaches
- **Editorial Intro**: Renders the first paragraph of city editorial content

**Styling Patterns**:

- Status Dots: Color-coded circle indicators matching condition severity
- Typography: Large heading for city name, subdued region label and beach count

---

### 3. RightNowConditions

**File**: `RightNowConditions.tsx`

**Type**: Server component

**Purpose**: Live conditions dashboard displaying 5 metrics in a responsive grid, each with status-colored indicators so beginners can quickly assess whether conditions are safe and suitable.

**Props**:

```typescript
interface RightNowConditionsProps {
  conditions: RightNowConditionsType;
}
```

**Metrics Displayed**:

| Metric     | Icon (Lucide) | Status Colors                    |
| ---------- | ------------- | -------------------------------- |
| Waves      | Waves         | green (good), amber (caution), red (warning) |
| Wind       | Wind          | green (good), amber (caution), red (warning) |
| Water Temp | Thermometer   | green (good), amber (caution), red (warning) |
| Tide       | ArrowUpDown   | green (good), amber (caution), red (warning) |
| Crowd      | Users         | green (good), amber (caution), red (warning) |

**Styling Patterns**:

- Responsive Grid: Adapts from stacked on mobile to multi-column on desktop
- Status Colors: `good` = green indicators, `caution` = amber indicators, `warning` = red indicators
- Icons: Lucide icon library, sized consistently across all metrics

---

### 4. BeginnerSpotList

**File**: `BeginnerSpotList.tsx`

**Type**: Server component

**Purpose**: Ranked list of beginner-friendly beaches with numbered badges, ratings, break type, current wave height, and rich editorial content explaining why each spot is good for beginners.

**Props**:

```typescript
interface BeginnerSpotListProps {
  cityName: string;
  beaches: BeginnerBeachWithEditorial[];
}
```

**Key Features**:

- **Numbered Rankings**: Each beach has a numbered badge indicating its rank
- **Beach Metadata**: Rating, break type, and current wave height
- **Editorial Content**: "Why beginners love it" section per beach
- **Logistics Info**: Parking availability, lifeguard coverage, best hours to visit
- **Navigation**: Each beach links to its detail page at `/spots/{slug}`

**Styling Patterns**:

- Numbered Badges: Circular badges with rank number
- Card Layout: Each beach rendered as a distinct card with structured content sections
- Links: Navigate to full beach detail page

---

### 5. WhatToExpect

**File**: `WhatToExpect.tsx`

**Type**: Server component

**Purpose**: Multi-paragraph editorial section providing deeper context about surfing in the city. Renders paragraphs 2+ from the city editorial description (paragraph 1 is used by BeginnerHero).

**Props**:

```typescript
interface WhatToExpectProps {
  cityName: string;
  cityEditorial: BeginnerCityEditorial;
}
```

**Conditional Rendering**:

Returns `null` if the editorial description has only one paragraph (since that paragraph is already displayed in BeginnerHero).

**Styling Patterns**:

- Background: Blue gradient accent
- Typography: Multi-paragraph editorial prose with comfortable line height

---

### 6. SeasonalGuide

**File**: `SeasonalGuide.tsx`

**Type**: Server component

**Purpose**: Static 4-season card layout helping beginners understand how conditions change throughout the year.

**Props**:

```typescript
interface SeasonalGuideProps {
  cityName: string;
}
```

**Card Layout**:

| Season | Months    | Card Style   |
| ------ | --------- | ------------ |
| Spring | Mar - May | Color-coded  |
| Summer | Jun - Aug | Color-coded  |
| Fall   | Sep - Nov | Color-coded  |
| Winter | Dec - Feb | Color-coded  |

**Styling Patterns**:

- Grid: 4-card responsive grid
- Cards: Each season has a distinct color treatment
- Content: Static content (not data-driven)

---

### 7. SafetyEssentials

**File**: `SafetyEssentials.tsx`

**Type**: Server component

**Purpose**: Four static safety tip cards covering the most important hazards and etiquette points for beginner surfers.

**Props**:

```typescript
interface SafetyEssentialsProps {
  cityName: string;
}
```

**Cards**:

1. **Rip Currents** - How to identify and escape
2. **Marine Life** - Local hazards to be aware of
3. **Rocks & Reef** - Bottom hazards and positioning
4. **Etiquette** - Lineup rules and right of way

**Styling Patterns**:

- Amber Accent: Amber styling to convey caution/safety messaging
- Card Grid: 4 cards in responsive grid layout
- Content: Static educational content

---

### 8. GearAndLessons

**File**: `GearAndLessons.tsx`

**Type**: Server component

**Purpose**: Static 2-card layout providing board and wetsuit guidance for beginners. No data dependencies.

**Props**: None

**Cards**:

1. **Board Guide** - Recommended board types for beginners (foam/soft-top, sizing advice)
2. **Wetsuit Guide** - Thickness recommendations based on water temperature ranges

**Styling Patterns**:

- 2-Column Grid: Side-by-side cards on desktop, stacked on mobile
- Content: Static educational content with no external data dependencies

---

### 9. SessionGallery

**File**: `SessionGallery.tsx`

**Type**: Server component

**Purpose**: Placeholder CTA section for future user-generated session content (photos, stories, tips from the community).

**Props**:

```typescript
interface SessionGalleryProps {
  cityName: string;
}
```

**Styling Patterns**:

- Dashed Border: `border-dashed` treatment indicating "coming soon" placeholder
- CTA: Encourages future engagement with the feature

---

### 10. BeginnerFAQ

**File**: `BeginnerFAQ.tsx`

**Type**: Server component

**Purpose**: Collapsible FAQ section using native HTML `<details>` / `<summary>` elements for zero-JS progressive enhancement. Dynamic question/answer pairs generated from city and beach data.

**Props**:

```typescript
interface BeginnerFAQProps {
  items: FAQItem[];
}

interface FAQItem {
  question: string;
  answer: string;
}
```

**Key Features**:

- **Native HTML Accordion**: Uses `<details>` / `<summary>` for collapsible behavior without client-side JavaScript
- **Dynamic Content**: Questions and answers are generated based on the specific city and its beaches
- **SEO**: Corresponding FAQ structured data (JSON-LD) is generated by BeginnerPageContent

**Conditional Rendering**:

Returns `null` if `items` is empty.

---

### 11. SectionFadeUp

**File**: `SectionFadeUp.tsx`

**Type**: Client component (`"use client"`)

**Purpose**: Scroll-triggered fade-up animation wrapper using Framer Motion. Applied to every content section in BeginnerPageContent for a polished reveal-on-scroll experience.

**Props**:

```typescript
interface SectionFadeUpProps {
  children: ReactNode;
  delay?: number;
  className?: string;
}
```

**Key Features**:

- **Scroll Trigger**: Animates children from opacity 0 / translateY to visible when scrolled into viewport
- **Accessibility**: Respects `prefers-reduced-motion` media query -- disables animation when user prefers reduced motion
- **Configurable Delay**: Optional `delay` prop for staggering sequential sections

**Usage Example**:

```typescript
import { SectionFadeUp } from "@/components/beginner";

<SectionFadeUp delay={0.1} className="mt-8">
  <SeasonalGuide cityName="San Diego" />
</SectionFadeUp>
```

---

## Data Flow

```
+---------------------------------------------------------------+
| Beginner City Page (Server Component)                         |
|                                                               |
| 1. getBeginnerConditionsData(citySlug)                        |
|    -> conditionsBadge, rightNowConditions                     |
|                                                               |
| 2. getBeginnerBeachesWithEditorial(citySlug)                  |
|    -> BeginnerBeachWithEditorial[]                             |
|                                                               |
| 3. getBeginnerCityEditorial(citySlug)                         |
|    -> BeginnerCityEditorial                                   |
+-----------------------------+---------------------------------+
                              |
                              v
+---------------------------------------------------------------+
| BeginnerPageContent (Server Orchestrator)                     |
|                                                               |
| +---------------------+  +------------------------------+    |
| | BeginnerHero        |  | RightNowConditions           |    |
| | - conditionsBadge   |  | - 5 live metrics             |    |
| | - cityEditorial[0]  |  | - status-colored indicators  |    |
| +---------------------+  +------------------------------+    |
|                                                               |
| +---------------------+  +------------------------------+    |
| | BeginnerSpotList    |  | WhatToExpect                 |    |
| | - ranked beaches    |  | - editorial paragraphs 2+    |    |
| | - editorial + tips  |  | - blue gradient background   |    |
| +---------------------+  +------------------------------+    |
|                                                               |
| +---------------------+  +------------------------------+    |
| | SeasonalGuide       |  | SafetyEssentials             |    |
| | - static 4 seasons  |  | - static 4 safety cards      |    |
| +---------------------+  +------------------------------+    |
|                                                               |
| +---------------------+  +------------------------------+    |
| | GearAndLessons      |  | SessionGallery               |    |
| | - static 2 cards    |  | - placeholder CTA            |    |
| +---------------------+  +------------------------------+    |
|                                                               |
| +---------------------+                                      |
| | BeginnerFAQ         |  + JSON-LD (FAQ, BreadcrumbList)     |
| | - dynamic Q&A pairs |  + InlineSignupCta                   |
| +---------------------+  + StickySignupBar                   |
+---------------------------------------------------------------+
                              |
                              v
+---------------------------------------------------------------+
| Data Sources                                                  |
|                                                               |
| Server Actions:                                               |
|   actions/beginner/beginner-actions.ts                        |
|   - getBeginnerConditionsData()                               |
|   - getBeginnerBeachesWithEditorial()                         |
|   - getBeginnerCityEditorial()                                |
|                                                               |
| Database Tables:                                              |
|   - beaches                    (beach metadata)               |
|   - enhanced_forecasts         (live conditions)              |
|   - beach_editorial_content    (per-beach editorial)          |
|   - city_editorial_content     (per-city editorial)           |
+---------------------------------------------------------------+
```

### Server Actions

All data fetching is handled by server actions in `actions/beginner/beginner-actions.ts`:

| Action                              | Returns                              | Consumed By                         |
| ----------------------------------- | ------------------------------------ | ----------------------------------- |
| `getBeginnerConditionsData()`       | `{ conditionsBadge, rightNow }`      | BeginnerHero, RightNowConditions    |
| `getBeginnerBeachesWithEditorial()` | `BeginnerBeachWithEditorial[]`        | BeginnerSpotList                    |
| `getBeginnerCityEditorial()`        | `BeginnerCityEditorial`              | BeginnerHero, WhatToExpect          |

### Type Definitions

All types are defined in `types/beginner.ts`:

```typescript
// Condition assessment
BeginnerConditionsBadge    // "great" | "fair" | "challenging" with color
BeginnerConditionStatus    // Status enum for badge
RightNowConditions         // 5-metric conditions object
MetricStatus               // "good" | "caution" | "warning"
ConditionMetric            // Single metric with value and status

// Beach data
BeginnerBeachWithEditorial // Beach + editorial + logistics
BeginnerBeachEditorial     // "Why beginners love it" content
BeginnerBeachLogistics     // Parking, lifeguards, best hours

// City editorial
BeginnerCityEditorial      // Multi-paragraph city description
```

---

## Design Language

### Frosted Glass Aesthetic

The beginner components use a consistent frosted glass visual treatment:

```css
/* Base card style */
bg-white/60 backdrop-blur-md
```

This creates a translucent, layered appearance that feels modern and approachable.

### Animation Pattern

Every content section is wrapped in `SectionFadeUp`, producing a staggered reveal-on-scroll effect:

- **Initial State**: `opacity: 0`, `translateY: 20px`
- **Visible State**: `opacity: 1`, `translateY: 0`
- **Stagger**: Incremental `delay` values per section
- **Reduced Motion**: Animation disabled when `prefers-reduced-motion` is active

### Color System

| Purpose             | Treatment                                                  |
| ------------------- | ---------------------------------------------------------- |
| Card backgrounds    | `bg-white/60 backdrop-blur-md` (frosted glass)            |
| Blue accents        | Blue gradient backgrounds (WhatToExpect, SeasonalGuide)    |
| Safety/caution      | Amber styling (SafetyEssentials cards)                     |
| Status: good        | Green indicators (`text-green-600`, `bg-green-100`)        |
| Status: caution     | Amber indicators (`text-amber-600`, `bg-amber-100`)        |
| Status: warning     | Red indicators (`text-red-600`, `bg-red-100`)              |
| Conditions: great   | Green status dot                                           |
| Conditions: fair    | Amber status dot                                           |
| Conditions: challenging | Red status dot                                         |

### Responsive Patterns

- **Mobile-first**: Single column layouts stacking vertically
- **Desktop**: Multi-column grids for conditions metrics, seasonal cards, and safety cards
- **Touch Targets**: All interactive elements meet 44x44px minimum

---

## Related Files

**Components**:
- `/components/beginner/BeginnerPageContent.tsx`
- `/components/beginner/BeginnerHero.tsx`
- `/components/beginner/RightNowConditions.tsx`
- `/components/beginner/BeginnerSpotList.tsx`
- `/components/beginner/WhatToExpect.tsx`
- `/components/beginner/SeasonalGuide.tsx`
- `/components/beginner/SafetyEssentials.tsx`
- `/components/beginner/GearAndLessons.tsx`
- `/components/beginner/SessionGallery.tsx`
- `/components/beginner/BeginnerFAQ.tsx`
- `/components/beginner/SectionFadeUp.tsx`
- `/components/beginner/index.ts`

**Page Route**:
- `/app/beginner/[city]/page.tsx`

**Server Actions**:
- `/actions/beginner/beginner-actions.ts`

**Types**:
- `/types/beginner.ts`

**Database Tables**:
- `beaches`
- `enhanced_forecasts`
- `beach_editorial_content`
- `city_editorial_content`

---

## Changelog

**Created**: 2026-02-06
**Components Documented**: 11
