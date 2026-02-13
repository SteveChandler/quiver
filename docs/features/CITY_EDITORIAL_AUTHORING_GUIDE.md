# City Editorial Content Authoring Guide

> How to create and update editorial content for Quiver city landing pages.

## Overview

City editorial content enriches city landing pages (like `/beaches/usa/ca/san-diego`) with:

- **Surf culture descriptions** - Local flavor and knowledge
- **Session timing advice** - When to surf (Today, Now, Weekend)
- **Quick action links** - Fast navigation to related pages
- **Planning checklists** - Actionable steps for session planning
- **Featured intent guides** - Highlighted surf guides

## Who Should Use This Guide

- **Content editors** adding new cities
- **Marketing team** updating seasonal content
- **Developers** seeding test data

## Quick Start

### Adding a New City (SQL)

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
  'huntington-beach',
  'ca',
  'usa',
  'Huntington Beach',
  'Orange County, California',
  ARRAY[
    'Huntington Beach is Surf City USA – consistent peaks, iconic pier, and a scene that never sleeps.',
    'Summer brings south swells, winter delivers northwest energy, and spring/fall offer the best of both.'
  ],
  '[
    {"icon": "sun", "title": "Today", "summary": "Check the pier cam for crowd density. Dawn patrol beats the wind; glass off usually happens by 5pm."},
    {"icon": "clock", "title": "Now", "summary": "North side of pier handles bigger swells. South side is mellower for longboards and beginners."},
    {"icon": "calendar", "title": "Weekend", "summary": "Arrive before 7am for parking. Or bike from downtown and skip the lot entirely."}
  ]'::jsonb,
  '[
    {"label": "HB surf map", "href": "/map?city=huntington-beach"},
    {"label": "Today''s tide chart", "href": "/tide/huntington-beach"},
    {"label": "Beginner spots", "href": "/beginner/huntington-beach"}
  ]'::jsonb,
  ARRAY['beginner', 'least-crowded', 'tide'],
  ARRAY[
    'Check the webcam before leaving home.',
    'Bring quarters for parking meters.',
    'Log your session to track progression.'
  ]
);
```

---

## Content Fields Reference

### 1. Location Identifiers

| Field | Type | Required | Example |
|-------|------|----------|---------|
| `city_slug` | TEXT | Yes | `"san-diego"`, `"huntington-beach"` |
| `state_slug` | TEXT | Yes (default: ca) | `"ca"`, `"hi"`, `"or"` |
| `country_slug` | TEXT | Yes (default: usa) | `"usa"` |
| `city_name` | TEXT | Yes | `"San Diego"`, `"Huntington Beach"` |
| `region_label` | TEXT | Yes | `"San Diego County, California"` |

**Slug Rules:**
- Lowercase
- Hyphens for spaces
- No special characters
- Must match URL pattern: `/beaches/usa/ca/san-diego`

### 2. Description (TEXT[])

**Purpose:** Capture the local surf culture in 2-4 paragraphs.

**Tone Guidelines:**
- Conversational but knowledgeable
- Reference local landmarks and terminology
- Include seasonality tips
- Mention what makes the area unique

**Good Example:**
```sql
description => ARRAY[
  'San Diego surf culture is a rhythm of dawn patrols, parking lot burritos, and checking canyon buoys more often than work email.',
  'Seasonality matters. Autumn brings glassy peaks with combo swells, winter lights up submarine canyons like Blacks.',
  'The key is pairing the right tide with the right bank and having a backup when the lot is full.'
]
```

**Bad Example:**
```sql
-- Too generic, no local flavor
description => ARRAY[
  'San Diego has great surfing.',
  'There are many beaches to choose from.',
  'Check the forecast before you go.'
]
```

### 3. Session Timing (JSONB)

**Purpose:** Tactical advice for different planning horizons.

**Structure:**
```typescript
interface SessionTimingModule {
  icon: "sun" | "clock" | "calendar";
  title: "Today" | "Now" | "Weekend";
  summary: string;  // 1-3 sentences of actionable advice
}
```

**Icon Meanings:**
| Icon | Title | Planning Horizon |
|------|-------|------------------|
| `sun` | Today | Next 12 hours |
| `clock` | Now | Current conditions |
| `calendar` | Weekend | Multi-day planning |

**Content Guidelines:**
- **Today**: Weather transitions, tide windows, crowd patterns
- **Now**: Real-time conditions, wind checks, alternative spots
- **Weekend**: Swell timing, parking strategy, crew coordination

**Example:**
```json
[
  {
    "icon": "sun",
    "title": "Today",
    "summary": "Check the forecast and watch the tide flip around mid-morning. Browse recent crowd intel from other surfers to find gaps between surf school lessons."
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

### 4. Quick Links (JSONB)

**Purpose:** Navigation shortcuts displayed as pill buttons.

**Structure:**
```typescript
interface QuickLink {
  label: string;  // Button text (keep short: 2-4 words)
  href: string;   // Internal URL path
}
```

**Standard Links to Include:**

| Link Type | Label Pattern | URL Pattern |
|-----------|---------------|-------------|
| Surf map | "[City] surf map" | `/map?city=[slug]` |
| Tide chart | "Today's tide chart" | `/tide/[city-slug]` |
| Beginner spots | "Beginner-friendly" | `/beginner/[city-slug]` |
| Session logs | "Session log templates" | `/features` |

**Example:**
```json
[
  {"label": "San Diego surf map", "href": "/map?city=san-diego"},
  {"label": "Today's tide chart", "href": "/tide/san-diego"},
  {"label": "Beginner-friendly breaks", "href": "/beginner/san-diego"},
  {"label": "Session log templates", "href": "/features"}
]
```

### 5. Featured Intents (TEXT[])

**Purpose:** Which intent guide cards to display prominently.

**Valid Values:**
- `"beginner"` - Beginner-friendly spots
- `"least-crowded"` - Less crowded options
- `"tide"` - Tide information
- `"water-temp"` - Water temperature guide
- `"surf-forecast"` - Detailed forecast

**Recommendation:** Include 3-4 intents most relevant to the city.

**Example:**
```sql
featured_intents => ARRAY['beginner', 'least-crowded', 'tide', 'water-temp']
```

### 6. Planning Checklist (TEXT[])

**Purpose:** Actionable items users can complete before surfing.

**Guidelines:**
- Start each item with a verb
- Keep items concrete and actionable
- Include Quiver-specific actions where appropriate
- Limit to 3-5 items

**Example:**
```sql
planning_checklist => ARRAY[
  'Refresh buoy readings before dawn to confirm swell angle.',
  'Screenshot tide windows and share with your crew inside Quiver chat.',
  'Log the session afterward to tag crowd levels, wave quality, and board choice.'
]
```

---

## Adding a New City (Step-by-Step)

### Step 1: Research the Area

Before writing content:
1. Identify 3-5 key beaches in the area
2. Note local terminology and landmarks
3. Understand seasonality patterns
4. Find parking/access considerations

### Step 2: Create the SQL Insert

Use this template:

```sql
-- [City Name] Editorial Content
-- Added: [Date]
-- Author: [Your Name]

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
  '[city-slug]',           -- lowercase, hyphenated
  '[state-code]',          -- 2-letter state code
  'usa',
  '[City Name]',           -- Display name
  '[Region], [State]',     -- e.g., "Orange County, California"
  ARRAY[
    '[Paragraph 1 - culture/vibe]',
    '[Paragraph 2 - seasonality]',
    '[Paragraph 3 - local tips]'
  ],
  '[
    {"icon": "sun", "title": "Today", "summary": "[advice]"},
    {"icon": "clock", "title": "Now", "summary": "[advice]"},
    {"icon": "calendar", "title": "Weekend", "summary": "[advice]"}
  ]'::jsonb,
  '[
    {"label": "[City] surf map", "href": "/map?city=[slug]"},
    {"label": "Tide chart", "href": "/tide/[slug]"},
    {"label": "Beginner spots", "href": "/beginner/[slug]"},
    {"label": "Session log templates", "href": "/features"}
  ]'::jsonb,
  ARRAY['beginner', 'least-crowded', 'tide'],
  ARRAY[
    '[Checklist item 1]',
    '[Checklist item 2]',
    '[Checklist item 3]'
  ]
);
```

### Step 3: Test the Content

1. **Local Testing:**
   ```bash
   # Apply migration locally
   npx supabase db push

   # Visit the page
   open http://localhost:3000/beaches/usa/[state]/[city-slug]
   ```

2. **Verify Display:**
   - Description paragraphs render correctly
   - Session timing cards show with correct icons
   - Quick links navigate to valid pages
   - Checklist items are readable

### Step 4: Deploy to Production

1. Create a migration file:
   ```bash
   npx supabase migration new add_[city]_editorial_content
   ```

2. Add your INSERT statement to the migration

3. Deploy via CI/CD or manual push:
   ```bash
   npx supabase db push
   ```

---

## Updating Existing Content

### Update Description

```sql
UPDATE city_editorial_content
SET
  description = ARRAY[
    'Updated paragraph 1...',
    'Updated paragraph 2...'
  ],
  updated_at = now()
WHERE city_slug = 'san-diego'
  AND state_slug = 'ca';
```

### Update Session Timing

```sql
UPDATE city_editorial_content
SET
  session_timing = '[
    {"icon": "sun", "title": "Today", "summary": "New advice..."}
  ]'::jsonb,
  updated_at = now()
WHERE city_slug = 'san-diego';
```

### Add a Quick Link

```sql
UPDATE city_editorial_content
SET
  quick_links = quick_links || '[{"label": "New Link", "href": "/path"}]'::jsonb,
  updated_at = now()
WHERE city_slug = 'san-diego';
```

---

## Validation Checklist

Before deploying new content, verify:

- [ ] City slug matches URL pattern (`/beaches/usa/[state]/[slug]`)
- [ ] State slug is valid 2-letter code
- [ ] Description has 2-4 paragraphs
- [ ] Session timing has all 3 modules (Today, Now, Weekend)
- [ ] Quick links use valid internal URLs
- [ ] Featured intents use valid values
- [ ] Checklist has 3-5 actionable items
- [ ] No typos or grammatical errors
- [ ] Content renders correctly in browser

---

## Current Cities with Editorial Content

| City | State | URL | Status |
|------|-------|-----|--------|
| San Diego | CA | `/beaches/usa/ca/san-diego` | Active |
| Orange County | CA | `/beaches/usa/ca/orange-county` | Active |

---

## Related Documentation

- [City Editorial Content System](CITY_EDITORIAL_CONTENT.md) - Technical implementation
- [URL Routing](/docs/architecture/URL_ROUTING.md) - URL patterns
- [Coverage Areas](/docs/COVERAGE_AREAS.md) - Supported regions

---

**Last Updated:** December 2025
