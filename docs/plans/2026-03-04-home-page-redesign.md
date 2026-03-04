# Home Page Redesign — "Should I Surf Today?"

**Date:** 2026-03-04
**Status:** Design approved, ready for implementation

## Problem

The current authenticated home page is an 11-section vertical dashboard (greeting, time slots, hero recommendation, action buttons, conditions ticker, spots carousel, personalization progress, forecast outlook, coast pulse, profile strength, bottom nav). It's data-dense but doesn't wow. Users browse a few beaches and don't come back.

## Goal

Redesign the home page to answer one question: **"Should I surf today?"** Lead with a visual, photo-forward hero card (like AllTrails/Strava), strip away dashboard clutter, and build trust with forecast accuracy data.

## Design

### Layout (top to bottom)

```
┌──────────────────────────────────┐
│ Good morning, Steve              │
│                                  │
│ ┌──────────────────────────────┐ │
│ │ [Live cam still / photo]     │ │
│ │                              │ │
│ │ Blacks • 8/10                │ │
│ │ 3-4ft • Light offshore       │ │
│ │ Best: 6-10am                 │ │
│ │                              │ │
│ │ Yesterday: predicted 3ft,    │ │
│ │ actual 3.2ft ✔️               │ │
│ └──────────────────────────────┘ │
│                                  │
│  [I'm at the beach]  [Plan]     │
│                                  │
│ Your Spots ─────────────────     │
│ ┌────────┐┌────────┐┌────────┐  │
│ │[photo] ││[photo] ││[photo] │  │
│ │Swamis  ││OB Pier ││Scripps │  │
│ │ 6/10   ││ 5/10   ││ 8/10   │  │
│ └────────┘└────────┘└────────┘  │
│                                  │
│ 7-Day Outlook →                  │
│ Building swell Thu-Sat           │
│ [▁▂▃▅▇█▆] mini swell chart      │
│                                  │
│ ┌──────────────┐┌──────────────┐ │
│ │ [cam frame]  ││ [photo]      │ │
│ │ Live Cams    ││ Explore      │ │
│ │ near you     ││ new spots    │ │
│ └──────────────┘└──────────────┘ │
│                                  │
│ [Home] [Map] [Log] [Profile]     │
└──────────────────────────────────┘
```

### Section Details

#### 1. Greeting
- Existing `GreetingSection` — time-aware "Good morning/afternoon/evening, {Name}"
- No changes needed

#### 2. Hero Card (NEW design)
- **Image**: Live cam still frame when available for the top-rated beach, fallback to stored beach photo, fallback to coastal gradient
- **Cam still source**: Use existing cam feed URLs, fetch latest frame. If cam is offline/unavailable, fall back gracefully
- **Overlay content** (bottom of image, over dark gradient):
  - Beach name + conditions score (e.g., "Blacks • 8/10")
  - Condition badges: wave height, wind, quality (e.g., "3-4ft • Light offshore • Clean")
  - Best window: "Best: 6-10am"
- **Forecast accuracy line** (below image or at bottom of card):
  - "Yesterday: predicted 3ft, actual 3.2ft ✔️"
  - Data source: `ml_predictions_log` — compare yesterday's `corrected_forecast_m` with `observed_m` for this beach
  - Show checkmark if within 0.5ft, show delta if off
  - If no ground truth available for this beach, omit the line (don't show inaccurate placeholder)
- **Tap action**: Navigate to beach detail page
- **Card style**: Large rounded corners, subtle shadow, full-width with edge padding

#### 3. Action Buttons
- Two buttons side by side (down from 3 — drop Share):
  - **"I'm at the beach"** — primary solid button, pre-fills session form with hero beach
  - **"Plan"** — secondary/outline button, links to beach forecast tab
- Keep existing animation behaviors (icon rotation/bounce on hover)

#### 4. Your Spots Carousel (existing, enhanced)
- Keep existing `TopSpotsCarousel` with `CompactSpotCard` components
- Enhancement: ensure photo backgrounds are used (not just gradient overlays)
- Each card: photo background, score badge, beach name, brief conditions
- Horizontal scroll with snap-to-card

#### 5. 7-Day Outlook Card (enhanced)
- Keep existing `ForecastOutlookCard` concept but enhance with:
  - **Mini swell chart**: Small sparkline/bar chart showing wave height trend for next 7 days
  - **Headline**: "Building swell Thu-Sat" or "Flat week ahead" (auto-generated from forecast data)
  - **Tap**: Navigate to `/forecast/{regionSlug}`
- Data source: existing enhanced forecast data for user's home beach region

#### 6. Explore Grid (NEW)
- Two cards side by side:
  - **"Live Cams near you"** — photo: latest cam frame from nearest cam beach. Tap → `/cams/{region}`
  - **"Explore new spots"** — photo: random beach photo from area. Tap → `/map` or `/discover`
- Cards: rounded, photo background with text overlay, ~50% width each

#### 7. Bottom Nav
- Existing `BottomNav` — no changes (Home, Map, Log, Profile)

### Sections Removed
- **Time slot selector** (pills) — cut. Simplify. Users can explore time slots on the beach detail page
- **Personalization progress card** — cut. Move any onboarding messaging to profile page or subtle toast
- **Conditions ticker** — cut. Key data folded into hero card badges
- **Coast Pulse timeline** — cut. Was rarely scrolled to. Data-dense but low engagement value
- **Profile strength card** — cut. Move to profile page
- **First session CTA** — cut. The "I'm at the beach" button serves the same purpose more naturally
- **Share button** — cut from action row. Sharing lives on beach detail + session detail pages

### Forecast Accuracy Data

New data requirement: yesterday's prediction vs actual for the hero beach.

**Query approach:**
```sql
SELECT
  corrected_forecast_m,
  observed_m,
  ABS(corrected_forecast_m - observed_m) as error_m
FROM ml_predictions_log
WHERE beach_id = :beach_id
  AND observed_m > 0
  AND predicted_at >= (CURRENT_DATE - INTERVAL '1 day')::date
  AND predicted_at < CURRENT_DATE::date
ORDER BY predicted_at DESC
LIMIT 1;
```

**Display logic:**
- If `observed_m` is available: "Yesterday: predicted {X}ft, actual {Y}ft {icon}"
  - ✔️ if error < 0.5ft (accurate)
  - ≈ if error 0.5-1.0ft (close)
  - Omit icon if error > 1.0ft (just show the numbers, honesty builds trust)
- If no ground truth: don't show the accuracy line
- Convert meters to feet for display (multiply by 3.28084)

### Cam Still Frame

**Approach**: Use existing cam feed infrastructure. Many beaches have HLS streams or MJPEG feeds.

Options (in priority order):
1. **Existing cam thumbnail URL**: If beach has a `cam_thumbnail_url` or similar field, use it directly
2. **HLS frame extraction**: For HLS feeds, the proxy can serve a still frame
3. **Stored beach photo**: Fallback if no cam available
4. **Gradient placeholder**: Final fallback

Need to check what cam data is available per beach in the current schema.

## Files to Change

### Modified
1. `components/home-screen/index.tsx` — restructure layout, remove sections
2. `components/home-screen/hero-recommendation.tsx` — redesign as photo-forward hero card
3. `components/home-screen/primary-actions.tsx` — reduce to 2 buttons
4. `components/home-screen/top-spots-carousel.tsx` — ensure photo backgrounds
5. `components/home-screen/forecast-outlook-card.tsx` — add mini swell chart + headline

### New
6. `components/home-screen/hero-card.tsx` — new hero card with cam still + accuracy
7. `components/home-screen/explore-grid.tsx` — new 2-card explore section
8. `lib/forecast/yesterday-accuracy.ts` — fetch yesterday's prediction vs actual

### Removed (delete or stop importing)
9. `components/home-screen/time-slot-selector.tsx` — no longer rendered
10. `components/home-screen/home-conditions-ticker.tsx` — no longer rendered
11. References to PersonalizationProgress, CoastPulse, ProfileStrength on home page

## Success Metrics
- Time on home page (should decrease — users should quickly tap into a beach or action)
- Beach detail page views from home (should increase — hero card drives taps)
- Session logging rate (should increase — "I'm at the beach" is more prominent)
- Return visits (D1, D7 retention — the real goal)

## Dependencies
- Cam still frame availability (need to verify per-beach cam data)
- ML predictions log data for forecast accuracy (exists, 99 observable beaches)
- Beach photos for fallback (need to verify storage/availability)
