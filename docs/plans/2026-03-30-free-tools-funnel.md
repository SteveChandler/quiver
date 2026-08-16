# Free Tools — Top of Funnel

**Date:** 2026-03-30
**Goal:** Build 8 free tools that rank for high-volume surf queries, attract new users, and funnel them into Quiver's core product (beach reports, session tracking, forecasts).

> **Status note — 2026-08-13:** This remains a design proposal, not evidence of shipped
> behavior or current monetization. The native app now contains an optional, dismissible
> Quiver Pro paywall; keep “free tools” claims scoped to the tools themselves.

**Design principles:** Retro surf aesthetic (Deep Twilight navy, Charming Orange accents). Data is sacred — numbers must be crisp and instantly scannable. Mobile-first (surfers check at the beach). Respect `prefers-reduced-motion`.

---

## Tool 1: Tide Clock

**Route:** `/tools/tide-clock`
**Target queries:** "what time is high tide", "tide chart today", "current tide [beach]", "next high tide"
**Search volume:** Very high — one of the most searched surf queries globally.

### What it does
Real-time tide display for any beach. Shows current tide height, whether it's rising or falling, and next high/low time. No signup required.

### Data sources
- NOAA CO-OPS hourly predictions via `lib/services/noaa-tide-service.ts`
- 52 hardcoded station mappings + dynamic `getNearestTideStation()` fallback (120km radius)
- `sun_times` table for sunrise/sunset overlay
- 100% beach coverage (all beaches have a resolved tide station)

### UX spec

**Hero state (no beach selected):**
- Search input: "Find your beach" with autocomplete
- Below: "Popular beaches" grid (top 8 by traffic) showing mini tide clocks
- Copy: "Real-time tide heights for 279+ beaches. Always free."

**Beach selected:**
- Large analog tide clock visualization (circular, shows current position in tide cycle)
- Current tide height in feet (large, prominent number)
- Rising/Falling indicator with arrow
- Next high tide: time + height
- Next low tide: time + height
- 24-hour tide curve chart below (current time marked with vertical line)
- Sunrise/sunset times overlaid on the chart
- "View full forecast" CTA linking to `/{state}/{city}/{beach}/tides`

**Mobile adaptation:**
- Tide clock: full-width, 280px diameter
- Tide curve: horizontal scroll for 24-hour view
- Touch target: 44px minimum on all interactive elements
- Bottom sheet for beach search (not dropdown)

**Empty/error states:**
- No tide data: "Tide data temporarily unavailable for [beach]. Try again in a few minutes."
- No beach found: "We don't have [query] yet. Browse nearby beaches instead." + map link

**Share:** URL updates with beach slug (`/tools/tide-clock?beach=la-jolla`). OG image showing current tide state.

**CTA placement:** Below the tide chart — "Get the full picture: wave height, wind, crowd levels & more" linking to the beach page. Not intrusive.

### Technical notes
- `revalidate = 300` (5 min) for tide predictions
- Client-side clock animation (requestAnimationFrame for smooth needle movement)
- Structured data: use existing tide Dataset schema pattern

---

## Tool 2: Wave Height Converter

**Route:** `/tools/wave-converter`
**Target queries:** "4 foot waves in meters", "hawaiian scale waves", "wave height converter", "feet to meters waves"
**Search volume:** High — surfers constantly convert between scales.

### What it does
Interactive converter between 4 wave measurement systems: Face height (ft), Face height (m), Hawaiian scale, and Back/Trough height.

### UX spec

**Layout:**
- Single input field with unit selector dropdown
- Real-time conversion to all other units displayed below
- Visual wave illustration that scales with the entered height (subtle animation)
- Reference table: common wave sizes with all conversions

**Conversion logic (pure math):**
- Face height (ft) = base unit
- Face height (m) = ft * 0.3048
- Hawaiian scale = face height / 2 (roughly — traditional Hawaiian measurement)
- Back/trough = face height * 0.7 (approximate)

**Reference table:**
| Description | Face (ft) | Face (m) | Hawaiian | Back |
|------------|-----------|----------|----------|------|
| Knee high | 2 | 0.6 | 1 | 1.4 |
| Waist high | 3 | 0.9 | 1.5 | 2.1 |
| Chest high | 4 | 1.2 | 2 | 2.8 |
| Head high | 5-6 | 1.5-1.8 | 2.5-3 | 3.5-4.2 |
| Overhead | 7-8 | 2.1-2.4 | 3.5-4 | 4.9-5.6 |
| Double overhead | 10-12 | 3-3.7 | 5-6 | 7-8.4 |

**Educational sidebar:** "How are waves measured?" explaining the debate between Hawaiian scale and face height. Link to `/learn` content.

**Mobile adaptation:**
- Full-width input, large touch-friendly unit selector
- Reference table: horizontal scroll on small screens
- Wave illustration: simplified to height bar on mobile

**Copy:**
- H1: "Wave Height Converter"
- Subhead: "Convert between feet, meters, and Hawaiian scale instantly."
- No jargon in labels. "Face height" not "wave face measurement."

### Technical notes
- Pure client-side (no API calls). `revalidate = 86400` for the page shell.
- Structured data: HowTo schema for the conversion explanation
- Input validation: 0-100ft range, numeric only

---

## Tool 3: Best Month to Surf (Enhancement)

**Route:** `/best-time-to-surf` (existing — enhance, don't rebuild)
**Target queries:** "best time to surf [destination]", "when to surf california", "surf season [state]"

### Current state
- Hub page + city-level pages exist
- 8 states profiled with monthly data (CA, HI, FL, NJ, NC, OR, WA, TX)
- Components: `MonthlySurfChart`, `MonthlyGrid`

### Enhancements

**1. Interactive comparison mode:**
- Let users compare 2-3 destinations side by side
- "Compare destinations" toggle at top of hub page
- Side-by-side monthly heatmaps
- Useful for trip planning ("Should I go to Hawaii or Costa Rica in March?")

**2. "Best month for ME" personalization:**
- Skill level selector (beginner/intermediate/advanced)
- Filter monthly data: beginners see months with smaller waves + warm water
- Crowd preference (avoid crowds / don't care)
- Output: "Based on your preferences, visit [state] in [month]"

**3. Visual heatmap upgrade:**
- Replace grid with color-coded heatmap calendar
- Green (best) → Yellow (decent) → Red (poor)
- Each cell shows: wave icon + temp icon + crowd dot
- Hover/tap reveals detail tooltip

**4. Missing states:**
- Add monthly profiles for: NY, NH, MA, RI, SC, GA, ME, PR
- Source from existing forecast data + hardcoded seasonal patterns
- Extends coverage from 8 → 16 states

**Copy improvements:**
- Current H1 is generic. Change to: "Best Time to Surf — Month-by-Month Guide for Every Coast"
- Add intro paragraph: "Find the perfect surf trip window. Monthly wave heights, water temps, wetsuit recommendations, and crowd levels for 16 states."

**CTA:** "Check today's conditions" button per state linking to `/forecast`

### Technical notes
- `lib/data/monthly-surf-data.ts` — extend with new state profiles
- Keep existing `revalidate` and ISR
- Add comparison mode as client-side state (no new API)

---

## Tool 4: Offshore Wind Checker

**Route:** `/tools/wind-checker`
**Target queries:** "offshore wind [beach]", "what direction is offshore", "is the wind good for surfing"
**Search volume:** Medium-high — surfers check wind before every session.

### What it does
Visual compass showing current wind direction relative to any beach's shore orientation. Instantly tells surfers if conditions are offshore (good), onshore (bad), or cross-shore (okay).

### Data sources
- Real-time wind: Open-Meteo API via `lib/services/open-meteo-wind-service.ts` (48hr forecast, free tier)
- Beach offshore angles: `beaches.wind_offshore_deg` (157/200 beaches configured)
- Beach orientation: `beaches.aspect_deg` (can derive offshore for missing beaches)
- Fallback: when no offshore angle, show wind direction + speed without quality rating

### UX spec

**Hero (no beach selected):**
- Beach search with autocomplete
- "Popular near you" section (use IP cookie for location)
- Copy: "Is the wind offshore at your beach? Check in one tap."

**Beach selected — compass view:**
- Large circular compass (300px desktop, full-width mobile)
- Beach shore line drawn at beach's `aspect_deg` angle
- Current wind arrow animated from wind direction
- Color-coded zones:
  - Green sector: offshore zone (within tolerance)
  - Yellow sectors: cross-shore zones
  - Red sector: onshore zone
- Center displays: wind speed (mph) + direction label (NW, SSE, etc.)
- Below compass: plain English verdict:
  - Offshore: "Offshore winds at 8 mph — clean conditions"
  - Cross-shore: "Cross-shore from the north at 12 mph — bumpy but surfable"
  - Onshore: "Onshore at 15 mph — choppy, consider a different break"

**48-hour wind timeline:**
- Horizontal timeline below compass
- Color-coded bars (green/yellow/red) for each hour
- "Best windows" highlighted: "Tomorrow 6am-10am: offshore, 5-8 mph"

**Missing offshore data:**
- Show wind direction + speed only (no quality rating)
- Copy: "Wind is 10 mph from the NW. We don't have shore orientation data for this beach yet."
- No broken/empty state — still useful without the quality overlay

**Mobile adaptation:**
- Compass: 280px diameter, centered
- Timeline: horizontal swipe
- Verdict text: larger font, prominent placement above compass
- Touch: tap compass sectors for explanation

**Copy (clarify principles):**
- Avoid: "Wind direction 315 degrees, offshore tolerance 40 degrees"
- Use: "Offshore winds — blowing from land to sea, keeping the wave face clean"
- Explain once, simply: "Offshore wind blows from shore toward the ocean, grooming waves into clean lines."

### Technical notes
- Client-side wind fetch (server component renders shell, client fetches wind data)
- `revalidate = 3600` for page shell
- Canvas or SVG for compass rendering
- Structured data: none specific (standard WebPage schema)

---

## Tool 5: Water Quality Check

**Route:** `/tools/water-quality`
**Target queries:** "is it safe to swim at [beach]", "water quality [beach]", "bacteria levels beach", "safe to surf after rain"
**Search volume:** High — spikes after every rain event. Health-conscious surfers search this regularly.

### Data sources
- `beach_water_quality` table: enterococcus levels, fecal coliform, sample dates, exceedance counts
- `wq_monitoring_stations` + `wq_samples` tables
- EPA criteria in `lib/constants/water-quality.ts`
- CEDEN (California) + PacIOOS ERDDAP (Hawaii) — synced bi-weekly
- Coverage: CA + HI beaches only (currently)

### UX spec

**Hero (no beach selected):**
- Beach search with autocomplete
- Map view showing color-coded pins (green/yellow/red) for all beaches with water quality data
- Copy: "Check bacteria levels before you paddle out. Updated from EPA monitoring stations."
- Prominent: "Currently covers California and Hawaii beaches"

**Beach selected — status card:**
- Large status badge: GOOD (green) / ADVISORY (yellow) / CLOSURE (red) / UNKNOWN (gray)
- Copy per status:
  - Good: "Water quality is within safe limits at [beach]. Last tested [date]."
  - Advisory: "Elevated bacteria levels detected. Consider avoiding water contact, especially with open wounds."
  - Closure: "Health advisory in effect. Water contact not recommended."
  - Unknown: "No recent test data available for [beach]. Check back after the next monitoring cycle."

**Detail section:**
- Latest enterococcus level: [value] CFU/100mL (with EPA threshold reference: 130 CFU/100mL)
- Latest fecal coliform: [value] CFU/100mL (threshold: 400 CFU/100mL)
- Last sample date
- 30-day trend: exceedance count / total samples
- Mini chart: 30-day bacteria level history

**Rain advisory logic (client-side):**
- If recent rain detected (from weather data): "It rained recently. Bacteria levels typically spike 24-72 hours after rain, especially near storm drains."
- General guidance: "Avoid surfing near river mouths or storm drains for 72 hours after rain."

**Limitations disclosure (important for trust):**
- "Data from [CEDEN/PacIOOS]. Monitoring stations may not be at your exact surf spot. Levels can change rapidly after rain."
- "Currently available for California and Hawaii. More states coming soon."

**Mobile adaptation:**
- Status badge: full-width banner at top
- Map: collapsible (tap to expand)
- Detail metrics: vertical stack, large numbers

**CTA:** "See full conditions at [beach]" linking to beach page.

### Technical notes
- `revalidate = 3600` (water quality data updates bi-weekly, hourly cache is conservative)
- Server component fetches from `beach_water_quality` table
- Need new server action: `getBeachWaterQuality(beachSlug)`
- Structured data: Dataset schema for water quality monitoring data

---

## Tool 6: Dawn Patrol Calculator

**Route:** `/tools/dawn-patrol`
**Target queries:** "sunrise time [beach]", "dawn patrol surf", "first light [beach]", "best time to surf morning"
**Search volume:** Medium-high — every dawn patrol surfer checks sunrise times.

### Data sources
- `sun_times` table: `sunrise_utc`, `sunset_utc` per beach, pre-computed 7 days ahead
- SunCalc library (already in package.json) for civil/nautical twilight
- `beaches.timezone` for local time conversion
- Tide data overlay (from NOAA CO-OPS)
- API endpoint exists: `/api/beaches/[id]/sun-times`

### UX spec

**Hero (no beach selected):**
- Beach search
- "Tomorrow's dawn patrol" cards for popular beaches (auto-computed)
- Copy: "Know exactly when to be in the water. First light, sunrise, golden hour — plus tide and wind."

**Beach selected — dawn patrol card:**
- Large time display: "First light: 5:47 AM" (civil twilight)
- Sunrise: "6:14 AM"
- Sunset: "7:32 PM" (with golden hour start time)
- Visual timeline: dark → twilight → sunrise → daylight → sunset → dark
  - Current time marker if today
  - Tide curve overlaid on timeline

**"Best window" recommendation:**
- Combine dawn timing + tide + wind for a recommendation:
  - "Dawn patrol tomorrow: paddle out at 5:50 AM. Rising tide, light offshore winds. Sunrise at 6:14."
  - "Skip dawn patrol Wednesday — high tide at first light makes the break too deep."

**7-day dawn patrol forecast:**
- Table or card grid showing each morning:
  - First light time
  - Tide state at dawn (high/low/rising/falling + height)
  - Wind at dawn (direction + speed)
  - Simple verdict: thumbs up / thumbs down / neutral

**Mobile adaptation:**
- Time display: huge font, center-aligned
- Timeline: full-width horizontal bar
- 7-day forecast: vertical card stack, swipeable

**Copy (clarify):**
- Not: "Civil twilight begins at 05:47 PST"
- Use: "First light at 5:47 AM — enough to see the lineup"
- Explain once: "First light is about 30 minutes before sunrise. Enough light to read waves and spot other surfers."

**CTA:** "Get the full morning forecast" → beach page. "Set a dawn patrol alert" → signup prompt.

### Technical notes
- Server component fetches from `sun_times` table + tide data
- SunCalc for civil twilight (computed server-side, not just from DB)
- `revalidate = 3600`
- Need: `getTwilightTimes(beachId, date)` utility wrapping SunCalc

---

## Tool 7: Surfboard Volume Calculator

**Route:** `/tools/board-calculator`
**Target queries:** "what size surfboard do I need", "surfboard volume calculator", "surfboard size chart", "beginner surfboard size"
**Search volume:** Very high — every surfer upgrading boards searches this.

### What it does
Input height, weight, fitness level, and skill level. Get recommended board volume (liters) with suggestions for board types.

### UX spec

**Form inputs:**
- Height: slider or input (ft/in or cm toggle)
- Weight: slider or input (lbs or kg toggle)
- Skill level: visual selector (Beginner / Intermediate / Advanced / Expert)
  - Each with illustration and brief description
  - "Beginner: Still learning to pop up and catch unbroken waves"
  - "Intermediate: Catching green waves, starting to turn"
  - "Advanced: Comfortable in overhead surf, carving turns"
  - "Expert: Riding critical sections, airs, barrels"
- Fitness: Normal / Athletic / Very fit
- Wave size preference: Small (1-3ft) / Medium (3-6ft) / Large (6ft+)

**Output — recommendation card:**
- Large number: "38.5 liters" (recommended volume)
- Volume range: "36-41 liters" (acceptable range)
- Board type suggestions:
  - Beginner + small waves → "Foamie or longboard (8-9ft)"
  - Intermediate + medium waves → "Funboard or fish (6'2-7'0)"
  - Advanced + medium waves → "Shortboard (5'10-6'2)"
- Visual: board silhouettes showing suggested shapes

**Reference table:**
- Weight-to-volume ratio by skill level
- Common board dimensions for each volume range

**Educational section:**
- "What is board volume?" — brief explainer
- "How volume affects your surfing" — volume = paddle power, stability
- "When to size up or down" — conditions-based guidance
- Links to relevant `/learn` articles

**Formula:**
```
baseVolume = weight(kg) * skillMultiplier
skillMultiplier: beginner=0.55, intermediate=0.45, advanced=0.38, expert=0.34
fitnessAdjust: normal=1.0, athletic=0.95, veryFit=0.90
waveAdjust: small=1.05, medium=1.0, large=0.95
recommendedVolume = baseVolume * fitnessAdjust * waveAdjust
```

**Mobile adaptation:**
- Form: full-width sliders, large touch targets
- Skill level: horizontal scroll cards (not tiny buttons)
- Result: prominent card at top after calculation
- Board silhouettes: single column stack

**Copy:**
- H1: "Surfboard Volume Calculator"
- Subhead: "Find the right board size for your weight, skill level, and the waves you ride."
- Error state: "Enter your weight to get a recommendation" (not "Required field missing")

**CTA:** "Find boards near you" or "Log your quiver" → signup flow

### Technical notes
- Pure client-side calculation (no API)
- `revalidate = 86400` for page shell
- Structured data: HowTo schema for the volume explanation
- URL params for sharing: `/tools/board-calculator?weight=180&skill=intermediate`

---

## Tool 8: Swell Quality Analyzer

**Route:** `/tools/swell-analyzer`
**Target queries:** "is 8 second swell period good", "what is a good swell period", "groundswell vs windswell", "swell direction for [beach]"
**Search volume:** Medium — more educated surfers searching to understand forecasts better.

### Data sources
- `lib/analyzers/swell-analyzer.ts` — existing quality scoring logic
- `EnhancedForecastEntity` — primary/secondary swell height, period, direction
- Beach swell windows from `beaches` table (`swellWindowMin`, `swellWindowMax`)
- Real forecast data for "current swell" display

### UX spec

**Interactive swell explainer (hero):**
- Three sliders:
  - Swell height: 1-20ft
  - Swell period: 4-22 seconds
  - Swell direction: compass selector
- Quality gauge that updates in real-time:
  - Period < 8s: "Wind swell — choppy, disorganized" (red)
  - Period 8-12s: "Mid-period swell — decent energy" (yellow)
  - Period 12-16s: "Ground swell — powerful, well-organized" (green)
  - Period > 16s: "Long-period ground swell — heavy, fast-moving" (dark green)
- Visual animation: wave cross-section that changes shape based on period
  - Short period: choppy, close-together waves
  - Long period: smooth, spaced-out waves

**"Check your beach" section:**
- Beach search input
- Shows current swell data for selected beach
- Overlay: beach's ideal swell window on the compass (green arc)
- Current swell arrow shows alignment
- Verdict: "The current WSW swell at 14s is in La Jolla's sweet spot" or "This NW swell is outside Rincon's window — expect closeouts"

**Educational content:**
- "Groundswell vs Windswell" explainer with diagrams
- "How swell period affects wave quality" with examples
- "Reading a swell forecast" step-by-step guide
- All linking to `/learn` articles for deeper dives

**Mobile adaptation:**
- Sliders: full-width, large thumb targets
- Compass: tap to select direction (not drag — hard on mobile)
- Wave animation: simplified to height bars
- Educational content: collapsible accordion

**Copy (clarify):**
- Not: "Swell period 14.2s, direction 245 degrees, Hs 1.8m"
- Use: "14-second ground swell from the WSW at 6 feet — powerful, clean energy hitting the coast"
- Explain: "Swell period is the time between waves. Longer periods mean more energy traveled farther — these waves hit harder and break more cleanly."

**CTA:** "See how this swell hits your local break" → beach forecast page

### Technical notes
- Client-side interactive sliders + canvas/SVG wave animation
- Server component fetches current swell data for "check your beach"
- Reuse `analyzeSwellMatch()` from `lib/analyzers/swell-analyzer.ts`
- `revalidate = 3600`
- Structured data: HowTo schema for swell reading guide

---

## Shared Patterns

### Navigation
All tools live under `/tools/*`. Add a tools index page at `/tools` with cards for each tool.

### SEO
- Each tool gets: unique title (< 60 chars), description (< 160 chars), OG image
- All tools get FAQ schema with 3-5 common questions
- Internal links between related tools (tide clock → dawn patrol, wind → swell)

### CTA Strategy
- **Non-intrusive.** Tools are free, forever. No paywall teasers.
- **Natural funnel:** After the user gets value, suggest the next logical step:
  - Tide clock → "See the full forecast" (beach page)
  - Wind checker → "Get wind alerts" (signup)
  - Dawn patrol → "Set a dawn patrol reminder" (signup)
  - Board calc → "Track your quiver" (signup)
- **Signup prompt:** Appear only AFTER the user has received value. Never before.

### Share
- All tools support URL state (`?beach=la-jolla`, `?weight=180&skill=intermediate`)
- Share button on result views using ShareSheet
- OG images dynamically generated where possible

### Analytics
- Track tool usage: `tool_view`, `tool_result_generated`, `tool_share`, `tool_cta_click`
- Funnel: tool view → result → CTA click → signup

---

## Team Assignment

### Engineer 1: Ocean Data Tools
- **Tide Clock** (#1) — tide data, NOAA integration, clock visualization
- **Dawn Patrol Calculator** (#6) — sun times, SunCalc, tide overlay

### Engineer 2: Pure Calculators
- **Wave Height Converter** (#2) — unit conversion, reference table
- **Surfboard Volume Calculator** (#7) — formula, skill selector, board type suggestions

### Engineer 3: Conditions Analyzers
- **Offshore Wind Checker** (#4) — compass visualization, Open-Meteo wind, shore orientation
- **Swell Quality Analyzer** (#8) — swell scoring, interactive sliders, wave animation

### Engineer 4: Data-Driven Pages
- **Water Quality Check** (#5) — CEDEN/PacIOOS data, EPA thresholds, map view
- **Best Month Enhancement** (#3) — comparison mode, personalization, heatmap, new state data

### UX Designer
- Component specs for all 8 tools (mobile + desktop wireframes)
- Shared tool shell/navigation pattern
- CTA placement and copy review
- Accessibility audit (contrast, screen reader, keyboard nav)

### QA
- Cross-browser testing (Safari, Chrome, Firefox)
- Mobile device testing (iOS Safari, Android Chrome)
- Accessibility: keyboard navigation, screen reader, contrast
- Edge cases: no data, slow connection, very long beach names
- Performance: Lighthouse > 90 all categories
- SEO validation: structured data, meta tags, OG images
