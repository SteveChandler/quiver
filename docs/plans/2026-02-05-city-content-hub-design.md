# City Content Hub Redesign

**Date:** 2026-02-05
**Status:** Design approved, awaiting implementation
**Scope:** Three city-level page types forming a cohesive content hub

---

## Problem

The current city-level pages (`/beginner/{city}`, `/tide/{city}`, `/beaches/usa/{state}/{city}`) are low-effort. The beginner and tide pages are mostly template fill-in-the-blank with generic copy that swaps `{City}` into identical text. They don't rank well, don't provide genuine value, and don't drive signups.

## Goals

1. **SEO & organic traffic** - Unique, data-rich content per city that ranks for beginner/tide/city surf queries
2. **User value & retention** - Pages surfers actually bookmark and check regularly
3. **Conversion funnel** - Natural paths from organic discovery to signup and session logging

## Content Strategy

- **Hybrid approach:** Live data modules (conditions, forecasts, tide charts) combined with AI-generated editorial per city
- **Universal templates:** Same structure for every city, populated with city-specific data and editorial
- **User photos:** Session photos featured across all pages as social proof and fresh content
- **Cross-linking hub:** All three page types link to each other, forming a comprehensive city guide

## Visual Design

All modules use the existing Quiver design system. No new design primitives.

- **Cards:** `rounded-xl border border-slate-200 bg-slate-50 p-5` (slate variant) or `rounded-lg border border-slate-200 bg-white shadow-sm` (white variant)
- **Headings:** `text-2xl font-semibold text-slate-900 mb-4`
- **Body text:** `text-sm text-slate-700`
- **Icons:** `h-5 w-5 text-sky-600`
- **Badges:** `text-xs font-medium px-2.5 py-0.5 rounded-full` with semantic colors (green/amber/red)
- **Section spacing:** `space-y-12` between major sections
- **Interactive states:** `hover:bg-slate-50 transition-colors`, `hover:border-sky-200`

---

## Page 1: Beginner Page (`/beginner/{city}`)

**Priority:** Highest (biggest gap between current state and potential)
**Target queries:** "beginner surf spots {city}", "learn to surf {city}", "easy waves {city}"

### Module 1: Hero + Live Conditions Badge

**Content:**
- H1: "Beginner Surf Spots in {City}"
- Region label (e.g., "Southern California")
- Beach count (e.g., "12 beginner-friendly breaks")
- Conditions badge showing today's beginner-friendliness

**Conditions Badge Logic:**
- Pull forecast from the top-rated beginner beach in the city via `enhanced_forecasts`
- Green ("Great for Beginners Today"): swell < 4ft AND wind < 12mph AND not onshore gusty
- Yellow ("Fair for Beginners"): borderline conditions
- Red ("Challenging Today"): big swell or strong winds
- Display: wave height range, wind speed/direction, water temperature

**Badge styling:** `rounded-xl border border-slate-200 bg-slate-50 p-5` card with colored dot indicator using existing skill-level color tokens (`bg-green-100 text-green-700`, `bg-amber-100 text-amber-700`, `bg-red-100 text-red-700`)

**AI-generated intro paragraph:** 1-2 sentences unique to each city, stored in DB. Example: "San Diego is one of the best cities in the world to learn to surf, with year-round mild water, consistent small waves, and over a dozen sand-bottom breaks perfect for first-timers."

### Module 2: Right Now Conditions

**Content:** Current conditions at the most beginner-friendly spot in the city.

| Metric | Value | Interpretation |
|--------|-------|----------------|
| Wave Height | 2-3 ft | "Ideal for learning" |
| Wind | 5 mph offshore | "Clean conditions" |
| Water Temp | 68F | "Shorty wetsuit" |
| Tide | Rising (3.1ft) | "Good for beginners" |
| Crowd Level | Moderate | "Weekday morning" |

- Each metric gets a beginner-friendly label via simple rule engine (not AI)
- One-liner summary: "Head out now - conditions are textbook for a first session"
- Crowd level inferred from day-of-week + time-of-day heuristics

**Conversion hook:** "Get these conditions texted to you every morning" CTA

### Module 3: Curated Spot Cards

**What makes these different from the current filtered list:**

Each card includes:
- Rank number (composite "beginner friendliness" score, not alphabetical)
- Beach name, star rating, review count
- Break type badge (sand bottom, reef, etc.)
- **"Why beginners love it" bullets** - 2-3 AI-generated per-beach reasons (specific to each spot: sand bottom, easy paddle-out, lifeguards, nearby rentals)
- **Practical logistics:** parking, walk distance, lifeguard presence
- **Today's conditions inline:** current wave height for comparison
- **User session photo** as card thumbnail (fallback to placeholder if none)
- Link to full beach page

**Data sources:**
- Ratings/reviews: existing `beaches` table
- Current conditions: `enhanced_forecasts`
- Beginner descriptions: AI-generated, stored in new `beach_beginner_notes` column or `beach_editorial_content` table
- Session photos: user-uploaded photos from session logs

### Module 4: "What to Expect" Editorial

AI-generated per city, stored in `city_editorial_content` with `intent = 'beginner'`. Subsections:

1. **Water Temperature** - Seasonal range, wetsuit recommendations by month
2. **Typical Wave Size** - Average wave heights at beginner spots, seasonal variation
3. **Crowds & Etiquette** - When it's crowded, when it's empty, basic lineup rules
4. **Best Time of Day** - Dawn patrol vs evening, wind patterns

Each subsection targets long-tail keywords ("water temperature {city} surfing", "best time to surf {city}").

### Module 5: Seasonal Guide

Visual month-by-month chart showing best times for beginner surfing:
- Simple CSS bar chart (colored bars per month: green/amber/red)
- Month labels in `text-xs text-slate-500`
- Three season descriptions: Best (green), Good (amber), Challenging (red)
- Data from historical averages or AI-generated from regional surf knowledge

Container: `rounded-xl border border-slate-200 bg-white p-5`

### Module 6: Safety Essentials

AI-generated per city, specific hazards:
- Rip currents (where they commonly form in this city)
- Marine life (stingrays, jellyfish, sharks specific to region)
- Rocks & reef (which spots to avoid at which tides)
- Local rules (permits, restricted areas, surf school zones)

Styling: Warning-toned cards with `text-amber-700` icons, `bg-amber-50` backgrounds

### Module 7: Gear & Lessons

- Wetsuit guide by season (driven by water temp data)
- Board recommendations by skill level (universal content)
- Local surf school mentions (AI-generated)
- Rental shop guidance (AI-generated)

### Module 8: User Session Gallery

Grid of 6-9 recent session photos from beginner-friendly spots in the city:
- Photo + spot name + conditions at time of session
- Username and time ago
- Creates social proof and fresh content for SEO
- Empty state: CTA to "Be the first to share your beginner session in {City}"

### Module 9: FAQ with Schema.org Markup

5-8 questions per city, AI-generated with factual grounding:
- "What size waves are good for beginners in {City}?"
- "Do I need a wetsuit to surf in {City}?"
- "Where can I rent a surfboard in {City}?"
- "What's the best time of year to learn to surf in {City}?"
- "Are there surf schools in {City}?"

Uses `FAQPage` structured data for Google rich results. Accordion UI matching existing "About" pattern from city beaches editorial.

---

## Page 2: Tide Page (`/tide/{city}`)

**Priority:** Medium (has real value in the tide chart, needs surrounding content upgraded)
**Target queries:** "tide chart {city}", "{city} tide times", "best tide to surf {city}"

### Module 1: Hero + Today's Tide Summary

- H1: "{City} Tide Chart & Surf Forecast"
- Region label + last updated timestamp
- Inline summary: "Rising - 3.2 ft -> High at 11:24 AM | Next Low: 5:38 PM (0.4 ft)"

### Module 2: Interactive Tide Chart (existing - enhanced)

Keep the existing 24-hour tide chart. Enhancements:
- **Multi-day toggle:** Today / 3-Day / 7-Day views
- **Sunrise/sunset bands:** Shaded regions showing daylight hours
- **"Sweet spot" markers:** Highlighted windows where tide + daylight align for good surfing

### Module 3: Beach-by-Tide Recommendations (NEW - killer feature)

The missing piece. Different beaches work on different tides. Grouped by current/upcoming tide phase:

**Structure:**
```
Rising Tide (now -> 11:24 AM high)
  - La Jolla Shores: "Works best on mid-to-high incoming tide. Sand bottom fills in."
    [User session photo from rising tide session]
  - Blacks Beach: "Reef break cleans up as water deepens."
    [User session photo]

Low Tide (after 5:38 PM)
  - Tourmaline: "Sand bars expose, creating defined peaks."
    [User session photo]
```

**Data source:** AI-generated per-beach tide notes stored in a `beach_tide_notes` column or `beach_editorial_content` table. Describes which tide each beach works best on.

**User photos:** Session photos tagged with the tide state at time of logging. A photo of La Jolla Shores during a rising tide adds credibility.

### Module 4: Tide-Aware Planning Timeline

Visual timeline replacing the generic "focus points":
- Horizontal bar showing 6 AM to 9 PM
- Color-coded by tide phase (rising/high/falling/low)
- Surfer-friendly labels per window (dawn patrol, school crowd, glass-off)
- Shows when conditions align for best sessions

Container: full-width `rounded-xl border border-slate-200 bg-white p-5`

### Module 5: Tidal Knowledge (editorial)

AI-generated per city, replacing current generic focus points:
- How does this coastline respond to different tides? (coast orientation, bathymetry)
- Spring vs neap tide patterns for this region
- Seasonal tidal variations
- Tide station info and coverage area

### Module 6: User Session Gallery

Same pattern as beginner page but filtered to sessions with tide data:
- Photo grid showing sessions at various tide states
- Each photo tagged with tide state + spot + conditions
- Helps surfers visually understand what different tide states look like at local spots

### Module 7: FAQ with Schema.org Markup

- "What is the best tide to surf in {City}?"
- "What time is high tide in {City} today?"
- "Does tide affect surfing in {City}?"
- "What beaches work on low tide in {City}?"

---

## Page 3: City Beaches Page (`/beaches/usa/{state}/{city}`)

**Priority:** Lowest marginal gain (already the strongest page), but surgical upgrades

### Upgrade 1: User Photo Thumbnails

Each beach in the ranked list gets a hero thumbnail from user session photos:
- Pull the highest-rated session photo for each beach
- Fallback to a placeholder gradient with beach initials if no photo exists
- Incentive: "Your photo could be featured on the {City} surf guide"

### Upgrade 2: Quick Conditions Banner

Horizontal strip above the beach list showing current conditions across top spots:
```
La Jolla 2ft clean | Blacks 4ft bumpy | OB 3ft fair | PB 2ft clean
```

- One-glance comparison without clicking into each beach
- Uses `enhanced_forecasts` data, same as individual beach pages
- Styling: `flex gap-4 overflow-x-auto` with pill-style items

### Upgrade 3: Community Activity Feed

Below the map, a live activity section:
- "mike posted a session at Blacks - 3 hrs ago"
- "sara reviewed Tourmaline (4/5) - 1 day ago"
- "joe shared intel at Scripps - 2 days ago"

Shows active community, drives engagement. Pull from session logs, reviews, and intel posts.

### Upgrade 4: Enriched Cross-Links

Strengthen the Quick Actions bar with preview snippets from intent pages:
- Tide preview: "Rising tide - Best for La Jolla Shores right now"
- Beginner preview: "Great conditions for beginners today"
- Dynamic content pulled from the tide/beginner page data

---

## User Photos Strategy

### Where Photos Appear

| Page | Photo Usage | Source |
|------|------------|--------|
| Beginner | Spot card thumbnails, session gallery | Sessions at beginner spots |
| Tide | Beach-by-tide cards, session gallery | Sessions tagged with tide state |
| City Beaches | Beach list thumbnails, activity feed | Best session photo per beach |

### Data Model

Session logs need:
- `photo_url` (or link to Supabase Storage bucket)
- Tide state at session time (derivable from forecast data + session timestamp)
- Spot association (already exists)
- Optional: user permission flag for featuring photos on public pages

### Incentive Loop

User uploads session photo -> Photo featured on city guide pages -> More organic traffic sees the community -> More signups -> More session logging -> More photos -> Richer pages -> Better SEO rankings

---

## Database Changes Required

### New Tables/Columns

1. **`city_editorial_content`** - extend with `intent` column to support beginner/tide-specific editorial
   - Or create `intent_editorial_content` table: `city_slug`, `intent`, `section_key`, `content`, `generated_at`

2. **`beach_editorial_content`** - per-beach AI-generated notes
   - `beach_id`, `content_type` (beginner_notes, tide_notes), `content`, `generated_at`

3. **Session photos** - extend session logging with photo support
   - `session_photo_url`, `photo_featured` (boolean for moderation), `tide_state_at_session`

### AI Content Generation

- One-time batch job to generate editorial content for all cities with > 3 beaches
- Store in DB, regenerate quarterly or when significant data changes
- Use LLM with access to city's beach data for factual grounding
- Human review before publishing (or soft-launch with generated content behind a flag)

---

## Animation Strategy

Subtle polish using Framer Motion. Every animation respects `prefers-reduced-motion`.

### Shared Patterns (all pages)
- **Section fade-up on scroll:** Each major section fades in + slides up 16px on viewport entry. Staggered 100ms between siblings. `whileInView` with `once: true`.
- **Skeleton loading:** Pulsing skeleton placeholders for data-dependent modules while fetching.
- **Card hover lift:** `whileHover: { y: -2 }` with `transition: { duration: 0.2 }`.
- **Accordion expand/collapse:** Smooth height animation via `AnimatePresence` + `layout` prop.

### Beginner Page
- **Conditions badge:** Number values count up on mount (~400ms). Color dot pulses once.
- **Spot cards:** Staggered entrance, 80ms delay between cards.
- **Seasonal chart:** Bars grow from 0 to full width on scroll into view (~600ms ease-out).

### Tide Page
- **Tide chart line:** Draws left-to-right on load (~800ms). Current time marker fades in after.
- **Planning timeline:** Segments fill sequentially on viewport entry.
- **Beach-by-tide cards:** Same staggered entrance as beginner spot cards.

### City Beaches Page
- **Conditions banner:** Subtle horizontal bounce on mobile to hint scrollability.
- **Activity feed:** New items fade in from top.
- **Photo thumbnails:** Fade in on image load to prevent layout flash.

### Explicitly excluded
- No parallax (performance cost, accessibility)
- No page transition animations (Next.js App Router limitation)
- No looping/continuous animations (mobile battery drain)

---

## Implementation Priority

### Phase 1: Beginner Page Redesign
1. Extend `city_editorial_content` schema for intent-specific content
2. Add `beach_editorial_content` table for per-beach notes
3. Build beginner conditions badge (rule engine for go/no-go)
4. Redesign spot cards with "Why beginners love it" bullets
5. Add "What to Expect" editorial section
6. Add seasonal guide module
7. Add safety essentials module
8. Add FAQ with structured data
9. Generate AI editorial content for top 20 cities

### Phase 2: Tide Page Upgrade
1. Build beach-by-tide recommendations module
2. Add tide-aware planning timeline
3. Replace generic focus points with AI editorial
4. Enhance tide chart (multi-day, sunrise/sunset)
5. Generate tide-specific editorial for top 20 cities

### Phase 3: City Beaches Upgrades
1. Add quick conditions banner
2. Add community activity feed
3. Enrich cross-links with preview snippets

### Phase 4: User Photos (cross-cutting)
1. Add session photo upload to session logging flow
2. Build photo moderation/featuring system
3. Integrate photos into beginner spot cards
4. Integrate photos into tide beach-by-tide cards
5. Add photo thumbnails to city beaches ranked list
6. Build user session gallery module (shared across pages)

---

## Success Metrics

- **SEO:** Organic traffic to city-level pages (target: 3x increase within 6 months)
- **Engagement:** Time on page, scroll depth, cross-page navigation
- **Conversion:** Signup rate from city pages (target: 2x current)
- **Content:** Session photos uploaded per week (leading indicator of community health)
- **Rankings:** Position for "beginner surf spots {city}" and "{city} tide chart" queries
