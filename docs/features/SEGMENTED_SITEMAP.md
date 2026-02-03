# Segmented Sitemap Architecture

> Dynamic, segmented sitemap generation for improved crawl efficiency and SEO.

**Location:** `app/sitemap.ts`
**Last Updated:** February 2026

## Overview

Quiver uses Next.js 14+ `generateSitemaps()` to split the sitemap into specialized segments. This approach improves crawl efficiency by allowing search engines to selectively refresh segments based on update frequency.

## Why Segmentation?

### Benefits

1. **Crawl Budget Optimization**: Search engines can refresh high-priority segments (beaches, intents) more frequently
2. **Incremental Updates**: Changes to beaches don't require re-crawling static pages
3. **Reduced Generation Time**: Each segment generates independently, faster than a monolithic sitemap
4. **Better Priority Signaling**: Different priorities per segment type

### Compared to Single Sitemap

| Approach | URLs per File | Generation Time | Crawl Flexibility |
|----------|---------------|-----------------|-------------------|
| Single sitemap | All (~10K+) | Slow | None |
| Segmented (5) | ~2K per segment | Fast | Per-segment refresh |

## Segments

### 1. Static Segment (`static`)

**Purpose:** Core marketing and utility pages that rarely change.

**Pages Included:**
- `/` (home) - priority 1.0
- `/features`
- `/about`
- `/privacy`
- `/map`
- `/beaches/usa`

**Change Frequency:** Daily
**Priority:** 0.7-1.0

### 2. Beaches Segment (`beaches`)

**Purpose:** Beach detail pages and beach-level intent pages.

**Pages Included:**
- `/beaches/usa/{state}/{city}/{beach}` - main beach detail
- `/beaches/usa/{state}/{city}/{beach}/tides` - tide information
- `/beaches/usa/{state}/{city}/{beach}/water-temp` - water temperature

**Change Frequency:** Weekly (main), Daily (tides/water-temp)
**Priority:** 0.55-0.6

**URL Generation:**

```typescript
// Uses hierarchical URL structure when location data available
const beachUrl = beach.city && beach.state
  ? `${baseUrl}${buildBeachUrl(beach)}`  // /beaches/usa/ca/san-diego/ocean-beach
  : `${baseUrl}/spots/${beach.slug}`;     // /spots/ocean-beach (legacy fallback)
```

### 3. Locations Segment (`locations`)

**Purpose:** City and state listing pages for geographic discovery.

**Pages Included:**
- `/beaches/usa/{state}` - state listing (e.g., `/beaches/usa/ca`)
- `/beaches/usa/{state}/{city}` - city listing (e.g., `/beaches/usa/ca/san-diego`)

**Change Frequency:** Weekly
**Priority:** 0.7-0.75

**Special Handling:**
- Hawaii Waimea disambiguation: `/beaches/usa/hi/waimea-kauai` and `/beaches/usa/hi/waimea-big-island`
- Non-US locations: `/beaches/{country}/{region}/{city}`

### 4. Intents Segment (`intents`)

**Purpose:** Intent-based surf guide pages at city and state levels.

**Intent Types:**
- `beginner` - Beginner-friendly beaches
- `longboard` - Longboarding spots
- `least-crowded` - Less crowded options
- `tide` - Tide-dependent beaches
- `water-temp` - Water temperature info
- `dawn-patrol` - Early morning surfing
- `sunset` - Evening session spots

**Pages Included:**
- `/{intent}/{city-slug}` (e.g., `/beginner/san-diego`)
- `/{intent}/{state}` (e.g., `/beginner/ca`)

**Change Frequency:** Daily
**Priority:** 0.75-0.85

### 5. Guides Segment (`guides`)

**Purpose:** Hub region editorial guides.

**Pages Included:**
- `/guides/surfing-{region}` (e.g., `/guides/surfing-san-diego`)

**Change Frequency:** Weekly
**Priority:** 0.9 (highest non-homepage)

## Smart Filtering

### Intent Page Filtering

The sitemap excludes intent pages for cities without matching beaches to prevent empty pages from being indexed.

```typescript
// Skill-based intents requiring beach skill levels
const BEGINNER_INTENTS = new Set(["beginner", "longboard"]);

for (const cityRecord of usCities) {
  for (const intent of intents) {
    // Skip beginner/longboard intents for cities without beginner beaches
    if (BEGINNER_INTENTS.has(intent) && !cityRecord.hasBeginnerBeaches) continue;

    routes.push({
      url: `${baseUrl}/${intent}/${citySlug}`,
      // ...
    });
  }
}
```

### Database Query

The filtering uses `getAllCitiesWithBeachSkills()` which returns:

```typescript
interface CityWithSkills {
  city: string;
  state: string;
  country: string;
  hasBeginnerBeaches: boolean;  // true if any beach has skill_level = 'beginner'
}
```

## Implementation

### generateSitemaps()

```typescript
export async function generateSitemaps(): Promise<{ id: SitemapSegment }[]> {
  return [
    { id: "static" },
    { id: "beaches" },
    { id: "locations" },
    { id: "intents" },
    { id: "guides" },
  ];
}
```

Next.js generates URLs:
- `/sitemap/static.xml`
- `/sitemap/beaches.xml`
- `/sitemap/locations.xml`
- `/sitemap/intents.xml`
- `/sitemap/guides.xml`

### Sitemap Index

Next.js automatically creates `/sitemap.xml` as an index pointing to all segments:

```xml
<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap><loc>https://quiversurf.app/sitemap/static.xml</loc></sitemap>
  <sitemap><loc>https://quiversurf.app/sitemap/beaches.xml</loc></sitemap>
  <sitemap><loc>https://quiversurf.app/sitemap/locations.xml</loc></sitemap>
  <sitemap><loc>https://quiversurf.app/sitemap/intents.xml</loc></sitemap>
  <sitemap><loc>https://quiversurf.app/sitemap/guides.xml</loc></sitemap>
</sitemapindex>
```

### Dynamic Rendering

```typescript
// Force dynamic rendering for database queries at request time
export const dynamic = "force-dynamic";
```

This ensures sitemaps always reflect current database state.

## URL Priority Strategy

| Priority | Content Type | Rationale |
|----------|-------------|-----------|
| 1.0 | Homepage | Primary landing page |
| 0.9 | Hub guides | High-value editorial content |
| 0.85 | Beginner intents | High-traffic search intent |
| 0.8 | Other intents | Search-focused pages |
| 0.75 | City/state pages | Geographic discovery |
| 0.7 | Static pages | Supporting content |
| 0.6 | Beach detail | Individual beach pages |
| 0.55 | Beach sub-pages | Tides, water-temp |

## Performance

### Estimated URL Counts

| Segment | Est. URLs | Generation Time |
|---------|-----------|-----------------|
| Static | ~10 | <100ms |
| Beaches | ~3000 | ~2s |
| Locations | ~500 | ~500ms |
| Intents | ~5000 | ~3s |
| Guides | ~20 | <100ms |

### Database Queries per Segment

| Segment | Queries |
|---------|---------|
| Static | 0 |
| Beaches | 1 (`getBeaches()`) |
| Locations | 1 (`getAllBeachLocations()`) |
| Intents | 1 (`getAllCitiesWithBeachSkills()`) |
| Guides | 0 (uses static HUB_REGION_SLUGS) |

## Monitoring

### Google Search Console

Monitor each segment's crawl stats:
1. Go to Search Console > Settings > Sitemaps
2. View individual segment URLs
3. Check "Pages" for indexed count per segment

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Empty segment | Database query failed | Check logs, verify DB connection |
| Missing beaches | No slug on beach record | Add slug to beach in database |
| Duplicate URLs | Collision in city names | Update `detectCityCollisions()` |

## Related Documentation

- [URL Routing Architecture](/docs/architecture/URL_ROUTING.md)
- [Beach URL Utils](/lib/utils/beach-url-utils.ts)
- [City Slug Utils](/lib/seo/city-slug-utils.ts)
- [Next.js Sitemap Docs](https://nextjs.org/docs/app/api-reference/file-conventions/metadata/sitemap)

---

**Last Updated:** February 2026
