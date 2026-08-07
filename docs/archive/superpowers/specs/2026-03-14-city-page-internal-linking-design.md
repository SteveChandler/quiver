# City Page Internal Linking Improvements

**Date:** 2026-03-14
**Problem:** Only 44.9% of city intent pages are indexed by Google despite being in the sitemap. Root cause is crawl discovery — insufficient internal links from state-level pages to city intent pages.

## Current State

| Page Type | URL Pattern | Links to City Pages? | Gap |
|-----------|-------------|---------------------|-----|
| State root (`/ca`) | `app/[intent]/page.tsx` | No | Lists beaches only, no city grouping |
| State browse (`/beaches/usa/ca`) | `app/beaches/usa/[state]/page.tsx` | Yes — all cities | Links to city hubs only, not intent pages |
| State intent (`/beginner/ca`) | `app/[intent]/[city]/page.tsx` | Top 8 only | `getTopCitiesInState(stateSlug, 8)` caps results |

## Changes

### Change A: Add City Section to State Root Pages (`/ca`)

**File:** `app/[intent]/page.tsx`

Add a "Surf cities in {State}" section below the beach list. Group existing beach data by city and render links to:
- City hub: `/{state}/{city}` (e.g., `/ca/san-diego`)
- Top intent pages per city: `/beginner/{city}`, `/tide/{city}`, `/water-temp/{city}`

**Data source:** The page already fetches all beaches in the state (line 86-94). Group by `beach.city` to derive city list — no new query needed.

**UI:** Simple list matching the existing page style. Each city row shows city name, beach count, and 2-3 intent quick-links as small pills/badges.

**Structured data:** Add the city links to the existing `ItemListSchema` or add a second ItemList for cities.

### Change B: Show All Qualifying Cities on State Intent Pages

**File:** `components/intent/popular-cities-for-intent.tsx`
**File:** `actions/beach/beach-location-actions.ts` (`getTopCitiesInState`)

Change `PopularCitiesForIntent` from a flat grid capped at 8 to a two-tier display:

1. **Top cities** (first 8, as today) — prominently displayed in the existing grid
2. **More cities** (9+) — rendered below in a compact list, always visible (no accordion/collapse that hides links from crawlers)

Update `getTopCitiesInState` to accept a higher limit (or remove the limit entirely) so all qualifying cities are returned.

**Important:** Do NOT use client-side expand/collapse (accordion, disclosure) for the "More cities" section. The whole point is crawl discovery — the links must be in the initial server-rendered HTML.

### What This Does NOT Change

- Sitemap generation logic (no threshold changes)
- City page content or quality requirements
- State browse pages (`/beaches/usa/{state}`) — already link to all cities
- Beach detail page linking

## Expected Impact

- Every qualifying city intent page gets at least 2 internal links from state-level pages (state root + state intent)
- Google discovers city pages through natural crawl paths, not just sitemap
- Should improve the 44.9% → 70%+ indexation rate over 2-4 weeks

## Files Modified

1. `app/[intent]/page.tsx` — add city grouping section
2. `components/intent/popular-cities-for-intent.tsx` — two-tier display
3. `actions/beach/beach-location-actions.ts` — remove/increase limit on `getTopCitiesInState`
