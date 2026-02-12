# City/Location Listing Page — Architecture

## Overview

Displays all ranked surf beaches for a given city, with two rendering paths:
- **Editorial layout** — curated cities with hand-written editorial content (map, quick actions, session timing, about accordion, guides, planning checklist)
- **Standard layout** — data-driven pages with beach list grid, sticky map, intent guides, and FAQ section

## File Structure

```
[city]/
├── page.tsx                  # Entry point (~120 LOC) — validate, fetch, resolve, branch
├── city-page-utils.ts        # Shared utilities: resolveDisplayCityName, resolveMetroConfig,
│                              #   resolveIslandDisplayName, buildItemListItems, SITE_ORIGIN
├── city-page-metadata.ts     # generateMetadata (re-exported from page.tsx)
├── city-page-static-gen.ts   # generateStaticParams (re-exported from page.tsx)
├── editorial-layout.tsx      # Editorial render path component
├── standard-layout.tsx       # Standard render path component
├── location-map-client.tsx   # Client wrapper for Mapbox LocationMap (dynamic import, no SSR)
├── error.tsx                 # Error boundary
├── loading.tsx               # Loading skeleton
├── not-found.tsx             # 404 page
└── ARCHITECTURE.md           # This file
```

## Data Flow

```
page.tsx
  ├── isValidCountrySlug() → notFound()
  ├── getLocationPageData(city, state, country)
  │     └── returns { location, stats, beaches }
  ├── resolveDisplayCityName() ← Hawaii island suffix handling
  ├── resolveMetroConfig() ← Metro area detection
  ├── getCityEditorialContent() → editorial | null
  ├── buildLocationPlaceStructuredData() → jsonLd
  ├── buildItemListItems() → itemListItems
  │
  ├── editorial ? → <EditorialLayout />
  └── else       → <StandardLayout />
```

## SEO Considerations

- `generateMetadata` and `generateStaticParams` **must** be named exports from `page.tsx` (Next.js App Router requirement). They are re-exported from their respective modules.
- Both layouts render JSON-LD structured data (`Place` schema) and `ItemListSchema` for carousel SERP features.
- The standard layout includes `FAQSection` with `FAQPage` schema for rich results.
- Canonical URLs use the pattern `/beaches/{country}/{state}/{city}`.
- `export const dynamic = "force-dynamic"` is set on the page for fresh data.

## Hawaii Island Handling

Cities in Hawaii (state slug `hi`) may have island-suffixed slugs like `waimea-big-island`. The `resolveDisplayCityName` and `resolveIslandDisplayName` utilities in `city-page-utils.ts` handle parsing these slugs and producing display names like "Waimea (Big Island)".

## Metro Areas

Metro area pages aggregate beaches from multiple cities (e.g., "San Diego" metro includes La Jolla, Pacific Beach, etc.). Detection uses `isMetroArea()` / `getMetroConfig()` from `lib/constants/metro-areas.ts`.
