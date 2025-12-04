# City Editorial Content System

This document describes the city editorial content feature, which enables curated editorial content on city landing pages.

## Overview

The city editorial content system allows for rich, curated content on city surf guide pages, including:

- Session timing advice (Today, Now, Weekend)
- Quick action navigation links
- Editorial descriptions of surf culture
- Planning checklists
- Featured intent guides

## Database Schema

**Migration**: `supabase/migrations/20251204030000_create_city_editorial_content.sql`

### Table: `city_editorial_content`

```sql
CREATE TABLE city_editorial_content (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Location identifiers (match /beaches/[country]/[state]/[city] route)
  city_slug TEXT NOT NULL,
  state_slug TEXT NOT NULL DEFAULT 'ca',
  country_slug TEXT NOT NULL DEFAULT 'usa',

  -- Display info
  city_name TEXT NOT NULL,
  region_label TEXT NOT NULL,  -- e.g., "San Diego County, California"

  -- Content fields (see below for structure)
  description TEXT[] NOT NULL DEFAULT '{}',
  session_timing JSONB NOT NULL DEFAULT '[]'::jsonb,
  quick_links JSONB NOT NULL DEFAULT '[]'::jsonb,
  featured_intents TEXT[] NOT NULL DEFAULT '{}',
  planning_checklist TEXT[] NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Ensure unique city per location
  UNIQUE(city_slug, state_slug, country_slug)
);
```

### Indexes

```sql
CREATE INDEX idx_city_editorial_city_slug
  ON city_editorial_content(city_slug);

CREATE INDEX idx_city_editorial_location
  ON city_editorial_content(city_slug, state_slug, country_slug);
```

### Row Level Security

```sql
-- Public read access (editorial content is public)
CREATE POLICY "city_editorial_content_public_read"
  ON city_editorial_content
  FOR SELECT
  USING (true);

-- Only admins can modify (via service role)
CREATE POLICY "city_editorial_content_admin_write"
  ON city_editorial_content
  FOR ALL
  USING (
    auth.jwt() ->> 'role' = 'service_role' OR
    auth.jwt() ->> 'email' IN (
      SELECT email FROM auth.users
      WHERE raw_app_meta_data->>'is_admin' = 'true'
    )
  );
```

## Content Structure

### Description Field

**Type**: `TEXT[]` (array of strings)

**Purpose**: Paragraphs describing the city's surf culture, seasonality, and local knowledge.

**Example**:
```sql
description => ARRAY[
  'San Diego surf culture is a rhythm of dawn patrols, parking lot burritos, and checking canyon buoys more often than work email.',
  'Seasonality matters. Autumn brings glassy peaks with combo swells, winter lights up submarine canyons like Blacks.',
  'The key is pairing the right tide with the right bank and having a backup when the lot is full.'
]
```

### Session Timing Field

**Type**: `JSONB` (array of objects)

**Purpose**: Tactical advice for different time horizons (Today, Now, Weekend).

**Schema**:
```typescript
interface SessionTimingModule {
  icon: "sun" | "clock" | "calendar";
  title: string;
  summary: string;
}
```

**Example**:
```json
[
  {
    "icon": "sun",
    "title": "Today",
    "summary": "Track marine layer burn-off and watch the tide flip around mid-morning. Use the crowd meter in Quiver to find gaps between surf school lessons."
  },
  {
    "icon": "clock",
    "title": "Now",
    "summary": "Check live wind before you paddle. Kelp-protected reefs hold shape longer, while open beachbreaks favor lighter boards once the breeze arrives."
  },
  {
    "icon": "calendar",
    "title": "Weekend",
    "summary": "Pair the rising morning tides with combo swells for longer rides. If the main peak is slammed, drive five minutes to the alternates listed above."
  }
]
```

### Quick Links Field

**Type**: `JSONB` (array of objects)

**Purpose**: Navigation shortcuts to related city pages.

**Schema**:
```typescript
interface QuickLink {
  label: string;
  href: string;
}
```

**Example**:
```json
[
  {"label": "San Diego surf map", "href": "/map?city=san-diego"},
  {"label": "Today's tide chart", "href": "/tide/san-diego"},
  {"label": "Beginner-friendly breaks", "href": "/beginner/san-diego"},
  {"label": "Session log templates", "href": "/app"}
]
```

### Featured Intents Field

**Type**: `TEXT[]` (array of intent slugs)

**Purpose**: Which intent guides to feature on the city page.

**Valid Values**: `"beginner"`, `"least-crowded"`, `"tide"`, `"water-temp"`, `"surf-forecast"`

**Example**:
```sql
featured_intents => ARRAY['beginner', 'least-crowded', 'tide', 'water-temp']
```

### Planning Checklist Field

**Type**: `TEXT[]` (array of strings)

**Purpose**: Actionable checklist items for session planning.

**Example**:
```sql
planning_checklist => ARRAY[
  'Refresh buoy readings before dawn to confirm swell angle.',
  'Screenshot tide windows and share with your crew inside Quiver chat.',
  'Log the session afterward to tag crowd levels, wave quality, and board choice.'
]
```

## RPC Function

### `get_city_editorial(p_city, p_state, p_country)`

**Purpose**: Fetch editorial content for a specific city.

**Parameters**:
- `p_city` (TEXT): City slug (e.g., "san-diego")
- `p_state` (TEXT, default "ca"): State slug
- `p_country` (TEXT, default "usa"): Country slug

**Returns**: Single row from `city_editorial_content` table or NULL

**Example**:
```sql
SELECT * FROM get_city_editorial('san-diego', 'ca', 'usa');
```

## Adding Editorial Content for a New City

### Step 1: Prepare Content

Gather the following content:

1. **City Information**:
   - City slug (e.g., "newport")
   - State slug (e.g., "or")
   - Country slug (e.g., "usa")
   - Display name (e.g., "Newport")
   - Region label (e.g., "Lincoln County, Oregon")

2. **Description Paragraphs** (3-5 paragraphs):
   - Local surf culture and community
   - Seasonality and swell patterns
   - Key insights for session planning

3. **Session Timing Modules** (3 cards):
   - Today: Marine layer, tide, crowd patterns
   - Now: Current wind and conditions
   - Weekend: Planning advice

4. **Quick Links** (4-6 links):
   - Map view
   - Tide chart
   - Beginner guide
   - Other relevant pages

5. **Featured Intents** (2-4 intent slugs):
   - Which guides are most relevant for this city

6. **Planning Checklist** (2-4 items):
   - Actionable tips specific to the city

### Step 2: Insert into Database

**Option A: Using SQL**

```sql
INSERT INTO city_editorial_content (
  city_slug,
  state_slug,
  country_slug,
  city_name,
  region_label,
  description,
  session_timing,
  quick_links,
  featured_intents,
  planning_checklist
) VALUES (
  'newport',
  'or',
  'usa',
  'Newport',
  'Lincoln County, Oregon',
  ARRAY[
    'Newport sits at the midpoint of Oregon''s central coast...',
    'Winter months bring consistent groundswells from the northwest...',
    'The key to Newport is understanding wind patterns and tide windows.'
  ],
  '[
    {"icon": "sun", "title": "Today", "summary": "Check morning wind reports..."},
    {"icon": "clock", "title": "Now", "summary": "Monitor tide transitions..."},
    {"icon": "calendar", "title": "Weekend", "summary": "Plan around swell forecast..."}
  ]'::jsonb,
  '[
    {"label": "Newport surf map", "href": "/map?city=newport"},
    {"label": "Tide chart", "href": "/tide/newport"},
    {"label": "Beginner spots", "href": "/beginner/newport"}
  ]'::jsonb,
  ARRAY['beginner', 'tide', 'water-temp'],
  ARRAY[
    'Check buoy 46050 for offshore swell direction',
    'Plan sessions around low to mid tide for best shape',
    'Log water temp - Oregon can be cold even in summer'
  ]
);
```

**Option B: Using Supabase Dashboard**

1. Navigate to Table Editor → `city_editorial_content`
2. Click "Insert row"
3. Fill in all required fields
4. For JSONB fields, use the JSON editor
5. Click "Save"

### Step 3: Verify Content

1. Navigate to city page: `/beaches/usa/or/newport`
2. Verify editorial layout renders
3. Check session timing modules
4. Test quick action links
5. Expand About section

## Integration with City Page Layout

**Component**: `app/beaches/[country]/[state]/[city]/page.tsx`

### Server Action

**Location**: `actions/city/city-editorial-actions.ts`

```typescript
export async function getCityEditorialContent(
  citySlug: string,
  stateSlug: string = "ca",
  countrySlug: string = "usa"
): Promise<ActionResponse<CityEditorialContent | null>>
```

**Usage**:
```typescript
const editorialResponse = await getCityEditorialContent(city, state, country);
const editorial = editorialResponse.data;
```

### Conditional Rendering

The city page conditionally renders different layouts based on whether editorial content exists:

```typescript
// If editorial content exists
if (editorial) {
  return (
    <>
      <CityMapView spots={transformedSpots} cityName={editorial.city_name} />
      <QuickActionsBar links={editorial.quick_links} />
      <SessionTimingModules modules={editorial.session_timing} />
      <AboutAccordion description={editorial.description} cityName={editorial.city_name} />
      <GuidesByIntentGrid intents={editorial.featured_intents} citySlug={citySlug} />
      <PlanningChecklist items={editorial.planning_checklist} />
    </>
  );
}

// Fallback to simple beach list
return <BeachList beaches={beaches} />;
```

## Component Reference

### CityMapView

**Location**: `components/city/city-map-view.tsx`

**Props**:
```typescript
interface CityMapViewProps {
  spots: SurfSpot[];
  cityName: string;
  citySlug: string;
  stateSlug?: string;
  countrySlug?: string;
}
```

**Features**:
- Desktop: Beach list (380px) on left, interactive map (600px) on right
- Mobile: Map (350px) on top, horizontal beach scroll below
- Click beach → navigate to detail page
- Hover beach → highlight on map

See `/components/city/ARCHITECTURE.md` for details.

### QuickActionsBar

**Location**: `components/city/quick-actions-bar.tsx`

**Props**:
```typescript
interface QuickActionsBarProps {
  links: QuickLink[];
}
```

**Features**:
- Horizontal pill navigation
- Auto-detects icons from href content
- Responsive wrapping

### SessionTimingModules

**Location**: `components/city/session-timing-modules.tsx`

**Props**:
```typescript
interface SessionTimingModulesProps {
  modules: SessionTimingModule[];
}
```

**Features**:
- 3-column grid (desktop), stacked (mobile)
- Icons: Sun (Today), Clock (Now), Calendar (Weekend)

### AboutAccordion

**Location**: `components/city/about-accordion.tsx`

**Props**:
```typescript
interface AboutAccordionProps {
  cityName: string;
  citySlug: string;
  description: string[];
  topSpotSlug?: string;
  topSpotName?: string;
}
```

**Features**:
- Collapsible to reduce above-fold text
- Dynamic links to top spots and less-crowded guides
- Accessible accordion component

### GuidesByIntentGrid

**Location**: `components/city/guides-by-intent-grid.tsx`

**Props**:
```typescript
interface GuidesByIntentGridProps {
  intents: string[];
  citySlug: string;
}
```

**Features**:
- 2x2 grid of intent cards
- Links to intent-specific city pages

### PlanningChecklist

**Location**: `components/city/planning-checklist.tsx`

**Props**:
```typescript
interface PlanningChecklistProps {
  items: string[];
}
```

**Features**:
- Checkmark bullet list
- Actionable session planning tips

## Seeded Cities

### San Diego, California

- **URL**: `/beaches/usa/ca/san-diego`
- **Content**: Dawn patrols, canyon buoys, seasonal patterns
- **Featured Intents**: beginner, least-crowded, tide, water-temp

### Orange County, California

- **URL**: `/beaches/usa/ca/orange-county`
- **Content**: Tides and traffic, cobblestone points, San Clemente training ground
- **Featured Intents**: beginner, least-crowded, tide, water-temp

## Content Guidelines

### Writing Editorial Descriptions

1. **Voice**: Conversational but knowledgeable
2. **Length**: 3-5 paragraphs, 50-100 words each
3. **Topics**: Surf culture, seasonality, local knowledge
4. **Tone**: Helpful and insider-focused
5. **Examples**: Use specific spot names and local terminology

### Session Timing Advice

1. **Today**: Focus on same-day tactical decisions (tide, wind, crowds)
2. **Now**: Current conditions and immediate decisions
3. **Weekend**: Multi-day planning and backup spots

### Quick Links

1. **Priority**: Most-used pages first (map, tide, beginner)
2. **Naming**: Clear, action-oriented labels
3. **Count**: 4-6 links (avoid overwhelming users)

### Planning Checklist

1. **Actionable**: Start with verbs (Check, Plan, Log)
2. **Specific**: Reference local buoys, tide patterns, water temp
3. **Ordered**: Most important first

## Future Enhancements

### Potential Additions

1. **Photos**: City hero image or gallery
2. **Videos**: Embedded surf clips or tutorials
3. **Live Data**: Real-time tide, wind, swell overlays
4. **User Contributions**: Community-submitted tips
5. **Seasonal Content**: Different content for summer vs winter

### Content Management

Consider building an admin UI for:
- WYSIWYG editing of descriptions
- Drag-and-drop reordering of quick links
- Preview before publish
- Version history and rollback

## Related Documentation

- [City Editorial Authoring Guide](CITY_EDITORIAL_AUTHORING_GUIDE.md) - Content team authoring guide
- [URL Routing](/docs/architecture/URL_ROUTING.md) - City page URL structure
- [City Components](/components/city/ARCHITECTURE.md) - City component architecture
- [Adding New States](/docs/guides/ADDING_NEW_STATES.md) - Regional expansion guide
- [Beach to SurfSpot Transformer](/docs/utilities/BEACH_TO_SURFSPOT_TRANSFORMER.md) - Data transformation

## Troubleshooting

### Editorial Content Not Showing

**Check**:
1. Does row exist in `city_editorial_content` table?
2. Do city/state/country slugs match route params exactly?
3. Is RLS policy allowing read access?

**Debug**:
```typescript
const result = await getCityEditorialContent("san-diego", "ca", "usa");
console.log("Editorial content:", result);
```

### JSONB Validation Errors

**Issue**: Invalid JSON in `session_timing` or `quick_links`

**Fix**: Validate JSON before inserting:
```sql
-- Test JSON validity
SELECT '{"icon": "sun", "title": "Today"}'::jsonb;
```

### Missing Component Props

**Issue**: Component expecting field that doesn't exist

**Fix**: Check component prop types match database schema. Use optional chaining:
```typescript
editorial?.session_timing || []
```

## Change Log

- **2025-12-04**: Created city editorial content system
- **2025-12-04**: Seeded San Diego and Orange County content
- **2025-12-04**: Created documentation
