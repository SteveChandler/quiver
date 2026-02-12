# Merge Landing Page Conditions Into Surf Spots Cards

**Date:** 2026-02-11
**Status:** Approved

## Problem

The landing page has three stacked sections that feel disjointed:
1. "Best Conditions Today" — blue card with regional score
2. "Best Right Now" — ranked leaderboard of top 5 beaches
3. "Popular Surf Spots near {city}" — photo cards with ratings

The first two feel stiff and disconnected from the visual surf spot cards.

## Solution

Remove sections 1 and 2 entirely. Enhance the surf spot photo cards with live condition data and sort by score (best conditions first).

### Card Enhancements

Each existing `SurfSpotCard` gains:
- **Score badge** — color-coded circle overlaid on photo (top-right corner)
- **Wave height** — "Xft" with waves icon, near the beach name
- **Wind condition** — "Offshore" / "Light" / "Onshore" as a small tag

### Data Changes

- New API endpoint or enhanced `/api/beaches/featured` returns beaches enriched with current forecast data (score, wave height, wind)
- Sort order changes from proximity-first to score-first (within nearby set)
- Location awareness unchanged (IP + browser geolocation)

### Removed Components

- `ConditionsSnapshot` — removed from landing page
- `BestRightNow` — removed from landing page
- Related server actions remain available for other pages (forecast hub)

## Files to Modify

1. `components/landing-page/landing-interactive-sections.tsx` — remove ConditionsSnapshot and BestRightNow
2. `components/landing-page/surf-highlights-section.tsx` — add forecast data fetching, pass to cards
3. `components/landing-page/surf-spot-card.tsx` — add score badge, wave height, wind display
4. `app/api/beaches/featured/route.ts` — enrich response with forecast data
5. `lib/data/server/featured-beaches.ts` — merge forecast data into beach results
6. `components/landing-page/landing-page-ssr-section.tsx` — update SSR version if needed
