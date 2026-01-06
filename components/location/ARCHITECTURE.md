# Location Components Architecture

## Overview

The `/components/location` directory contains small, focused UI primitives used by **location listing pages** (city/region pages) and related surf discovery surfaces.

Location pages live at:

- `app/beaches/[country]/[state]/[city]/page.tsx` (canonical listing pages)

This folder intentionally stays lightweight:

- Map rendering is delegated to `components/map/*` (Mapbox + markers).
- Data fetching lives in server actions (e.g. `actions/beach/*`) and page-level server components.

## Components

### `LocationMap` (`components/location/location-map.tsx`)

**Purpose**

- Wraps `components/map/interactive-map.tsx` with location-page defaults.
- Computes a center/zoom from provided beach coordinates for a good initial viewport.
- Navigates to beach detail pages when a marker is clicked.

**Props**

- **`beaches`**: `BeachWithMetrics[]` (ranked + coordinate-ready rows for this location)
- **`city`**: display name (used for accessibility labels + navigation fallbacks)
- **`state`**: display name/code (used for accessibility labels + navigation fallbacks)
- **`className`**: optional layout sizing

**Navigation / URL conventions**

- Beach detail pages are hierarchical:
  - USA: `/{state}/{city}/{beachSlug}`
  - Intl: `/{country}/{regionState}/{city}/{beachSlug}`
- `LocationMap` should **never** emit ad-hoc shortened routes (these can become crawlable 404s).
- Use `getBeachHrefSafe()` from `lib/utils/beach-url-utils.ts` when routing from partial beach rows.

**Error/empty states**

- When `beaches.length === 0`, the map renders a simple empty state (no navigation).
- Mapbox load failures are handled at the `InteractiveMap` level (see `components/map/ARCHITECTURE.md`).

### `RankingBadge` (`components/location/ranking-badge.tsx`)

**Purpose**

- Renders a small tier badge (Top / Highly Rated / Popular) for ranked beach cards on location pages.
- Returns `null` for the `standard` tier (no badge).

**Props**

- **`tier`**: `RankingTier` (`top`, `highly-rated`, `popular`, `standard`)
- **`label`**: user-visible badge label
- **`className`**: optional styling overrides

## Integration Points

### Location Listing Page

`app/beaches/[country]/[state]/[city]/page.tsx`:

- Fetches data via `getLocationPageData()`
- Renders ranked beach list UI and (when used) a map
- Dynamically imports `LocationMap` with `ssr: false` (Mapbox client-only)

### City Editorial Layout

When a city has editorial content, `app/beaches/[country]/[state]/[city]/page.tsx`
switches to the editorial-first layout powered by `components/city/*` (not this folder).

- Map + list UI is provided by `CityMapView` (`components/city/city-map-view.tsx`)
- `CityMapView` uses the shared `InteractiveMap` from `components/map/*`

## SEO + Crawlability Notes

- Avoid emitting internal links that don’t resolve to a real route (Google will discover and report them).
- Prefer centralized URL builders:
  - `getBeachHrefSafe()` for beach detail links when data may be incomplete.
  - `buildBeachUrl()` when `slug + city + state` are present.
  - `buildLocationUrl()` for canonical location listing pages.
- For structured data (JSON-LD), only emit **US state-root** crumbs for valid two-letter states to avoid crawlable international “state” slugs like `/baja-california`.

## Testing

- Unit tests for URL helpers live in `__tests__/lib/utils/beach-url-utils.test.ts`.
- Location page routing behavior is also covered by:
  - `__tests__/middleware.integration.test.ts` (redirects/canonicalization)
  - `__tests__/app/sitemap.test.ts` (sitemap route emission)

## Related Documentation

- `components/map/ARCHITECTURE.md`
- `components/city/ARCHITECTURE.md`
- `docs/architecture/URL_ROUTING.md`
- `docs/features/LOCATION_PAGES.md`

