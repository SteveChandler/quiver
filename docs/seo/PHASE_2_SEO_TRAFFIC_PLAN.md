# Phase 2: Turn Coverage Into Traffic (SEO Implementation Plan)

> **Goal**: Now that Quiver has national beach coverage, unlock SEO to turn the product from a side project into a real web property with organic traffic funnels.

**Timeline**: Weeks 2–4  
**Priority**: High  
**Status**: Planning

---

## Executive Summary

With beaches across California, Hawaii, Oregon, Washington, East Coast, Southeast, Gulf, and Puerto Rico now in the database, we have the foundation to build state-level and city-level landing pages that will capture organic search traffic.

This document outlines the implementation plan for:

1. State landing pages (`/california`, `/hawaii`, `/new-jersey`, etc.)
2. Enhanced beach page SEO metadata
3. Dynamic OG images for social sharing
4. Sitemap optimization

---

## Current State Assessment

### ✅ Already Implemented

| Component                 | Location                                        | Status      |
| ------------------------- | ----------------------------------------------- | ----------- |
| Beach detail pages        | `app/[intent]/[city]/[beachSlug]/page.tsx`      | ✅ Complete |
| City landing pages        | `app/beaches/[country]/[state]/[city]/page.tsx` | ✅ Complete |
| SEO metadata helper       | `lib/seo/meta.ts`                               | ✅ Complete |
| State slug utilities      | `lib/utils/beach-url-utils.ts`                  | ✅ Complete |
| Sitemap generator         | `app/sitemap.ts`                                | ✅ Partial  |
| Structured data (JSON-LD) | Beach pages have Place/Breadcrumb schemas       | ✅ Complete |
| Session OG images         | `app/api/og/session/[sessionId]/route.ts`       | ✅ Complete |

### ❌ Missing (Phase 2 Work)

| Component                     | Priority | Effort   |
| ----------------------------- | -------- | -------- |
| State landing pages           | **High** | 1-2 days |
| Beach page title optimization | Medium   | 1 hour   |
| Dynamic OG images for beaches | Medium   | 1 day    |
| Sitemap state-level URLs      | High     | 2 hours  |

---

## 1. State Landing Pages

### Overview

Create SEO-optimized landing pages for each state/territory with surf beaches:

| URL               | Target Keywords                                               |
| ----------------- | ------------------------------------------------------------- |
| `/california`     | "California surf forecast", "best surf beaches California"    |
| `/hawaii`         | "Hawaii surf forecast", "surfing Hawaii", "best waves Hawaii" |
| `/oregon`         | "Oregon surf spots", "Pacific Northwest surfing"              |
| `/washington`     | "Washington surf beaches", "PNW surf forecast"                |
| `/florida`        | "Florida surf forecast", "East Coast surfing Florida"         |
| `/new-jersey`     | "New Jersey surf", "Jersey Shore surf report"                 |
| `/new-york`       | "New York surf spots", "Long Island surf forecast"            |
| `/north-carolina` | "North Carolina surf", "Outer Banks surf forecast"            |
| `/south-carolina` | "South Carolina surf beaches"                                 |
| `/texas`          | "Texas surf forecast", "Gulf Coast surfing Texas"             |
| `/puerto-rico`    | "Puerto Rico surf", "Caribbean surfing"                       |
| `/massachusetts`  | "Massachusetts surf spots", "New England surfing"             |
| `/rhode-island`   | "Rhode Island surf beaches"                                   |
| `/maine`          | "Maine surf spots"                                            |
| `/new-hampshire`  | "New Hampshire surf"                                          |
| `/georgia`        | "Georgia surf beaches"                                        |

### File Structure

```
app/
├── [stateSlug]/
│   └── page.tsx          # State landing page
```

**Alternative**: Use human-readable slugs

```
app/
├── california/
│   └── page.tsx
├── hawaii/
│   └── page.tsx
├── new-jersey/
│   └── page.tsx
└── ... (one folder per state)
```

### Implementation Details

#### Route: `app/[stateSlug]/page.tsx`

```typescript
// Key components needed:

export async function generateMetadata({ params }): Promise<Metadata> {
  // Generate SEO-optimized metadata
  return {
    title: `${stateName} Surf Forecast | Best Beaches & Conditions | Quiver`,
    description: `Discover ${beachCount} surf spots across ${stateName}. Live conditions, forecasts, tide charts, and community intel for every beach.`,
    // ... OG tags, canonical URL, etc.
  };
}

export async function generateStaticParams() {
  // Return all valid state slugs for pre-rendering
  return getValidStateSlugs().map((slug) => ({ stateSlug: slug }));
}

export default async function StateLandingPage({ params }) {
  // Fetch beaches for this state
  // Group by city/region
  // Render with map + beach listings
}
```

#### Page Content Structure

```
┌────────────────────────────────────────────────┐
│ [Breadcrumb: Home > California]                │
├────────────────────────────────────────────────┤
│ # California Surf Forecast                     │
│ Discover 150+ surf spots across the Golden     │
│ State                                          │
│                                                │
│ ⭐ 4.2 avg rating · 1,234 reviews · 156 beaches│
├────────────────────────────────────────────────┤
│ [Interactive Map with all beach markers]       │
├────────────────────────────────────────────────┤
│ ## San Diego (45 beaches)                      │
│ ├── Ocean Beach ⭐4.5                          │
│ ├── Pacific Beach ⭐4.3                        │
│ └── ... more                                   │
│                                                │
│ ## Orange County (32 beaches)                  │
│ ├── Huntington Beach ⭐4.6                     │
│ └── ... more                                   │
│                                                │
│ ## Los Angeles (28 beaches)                    │
│ └── ...                                        │
├────────────────────────────────────────────────┤
│ ## About Surfing in California                 │
│ [SEO content about the state's surf scene]     │
└────────────────────────────────────────────────┘
```

#### Structured Data (JSON-LD)

```json
{
  "@context": "https://schema.org",
  "@type": "CollectionPage",
  "name": "California Surf Beaches",
  "description": "Complete guide to surfing in California",
  "url": "https://www.quiversurf.app/california",
  "mainEntity": {
    "@type": "ItemList",
    "numberOfItems": 156,
    "itemListElement": [
      {
        "@type": "ListItem",
        "position": 1,
        "item": {
          "@type": "Beach",
          "name": "Ocean Beach",
          "url": "https://www.quiversurf.app/ca/san-diego/ocean-beach"
        }
      }
      // ... more beaches
    ]
  }
}
```

---

## 2. Beach Page SEO Optimization

### Current Title Format

```
{Beach Name} in {City}, {State} - {N} Reviews, Map & Forecast
```

Example: `Ocean Beach in San Diego, CA - 45 Reviews, Map & Forecast`

### Recommended New Format

```
{Beach Name} Surf Forecast | Quiver
```

Example: `Ocean Beach Surf Forecast | Quiver`

### Updated Meta Tags

**File**: `app/[intent]/[city]/[beachSlug]/page.tsx`

```typescript
return buildPageMetadata({
  title: `${beach.name} Surf Forecast | Quiver`,
  description: `Live surf conditions, wave height, tide times, and wind forecast for ${beach.name} in ${beach.city}, ${beach.state}. ${reviewCount} community reviews and real-time intel.`,
  path: buildBeachUrl(beach),
  keywords: [
    `${beach.name} surf forecast`,
    `${beach.name} surf report`,
    `${beach.city} surfing`,
    `${beach.state} surf spots`,
    "surf conditions",
    "wave forecast",
    "tide chart",
  ],
});
```

### Enhanced Description Template

```
Live surf conditions, wave height, tide times, and wind forecast for {Beach Name} in {City}, {State}. {N} community reviews, {M} recent intel posts, and real-time conditions updated hourly.
```

---

## 3. Dynamic OG Images for Beaches

### Overview

Create shareable social media images for each beach showing:

- Beach name and location
- Current conditions (if available)
- Star rating
- Quiver branding

### API Route

**File**: `app/api/og/beach/[beachSlug]/route.ts`

```typescript
/**
 * GET /api/og/beach/[beachSlug]
 * Generates 1200x630 PNG for social sharing
 */
export async function GET(request, { params }) {
  const beach = await getBeachBySlug(params.beachSlug);

  // Use Satori to render image
  const image = await renderBeachOGImage({
    name: beach.name,
    city: beach.city,
    state: beach.state,
    rating: beach.average_rating,
    reviewCount: beach.review_count,
    // Optional: current conditions
  });

  return new NextResponse(image, {
    headers: {
      "Content-Type": "image/png",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
```

### Image Design

```
┌────────────────────────────────────────────────┐
│                                                │
│  🏄 QUIVER                                     │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │                                          │  │
│  │         OCEAN BEACH                      │  │
│  │         San Diego, California            │  │
│  │                                          │  │
│  │         ⭐ 4.5 · 127 reviews             │  │
│  │                                          │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  quiversurf.app                                │
└────────────────────────────────────────────────┘
```

### Usage in Metadata

```typescript
// In generateMetadata()
openGraph: {
  images: [{
    url: `/api/og/beach/${beach.slug}`,
    width: 1200,
    height: 630,
    alt: `${beach.name} Surf Forecast`,
  }],
},
```

---

## 4. Sitemap Optimization

### Current Sitemap Structure

```
sitemap.ts currently includes:
✅ Static routes (/, /features, /about, etc.)
✅ City routes (curated California cities)
✅ Intent routes (/surf-forecast/san-diego, etc.)
✅ Beach entries (hierarchical URLs)
✅ Location pages (/beaches/usa/ca/san-diego)
❌ State landing pages (MISSING)
```

### Updates Needed

**File**: `app/sitemap.ts`

```typescript
// Add state landing pages
const stateRoutes: MetadataRoute.Sitemap = getValidStateSlugs()
  .filter((slug) => !slug.includes("/")) // Exclude international (mexico/baja-california)
  .map((stateSlug) => ({
    url: `${baseUrl}/${stateSlug}`,
    lastModified: lastmod,
    changeFrequency: "daily",
    priority: 0.85, // High priority - these are traffic funnels
  }));

// Add to return array
return [
  ...staticRoutes,
  ...stateRoutes, // NEW
  ...cityRoutes,
  ...intentRoutes,
  ...locationRoutes,
  ...beachEntries,
  ...forecastEntries,
];
```

### Priority Hierarchy

| Route Type     | Priority | Change Frequency |
| -------------- | -------- | ---------------- |
| Homepage       | 1.0      | daily            |
| State pages    | 0.85     | daily            |
| City pages     | 0.80     | daily            |
| Beach pages    | 0.70     | weekly           |
| Forecast pages | 0.80     | daily            |
| Static pages   | 0.60     | monthly          |

---

## 5. State Slug Mapping Reference

### Current Mapping (from `lib/utils/beach-url-utils.ts`)

| State          | 2-Letter Code | URL Slug |
| -------------- | ------------- | -------- |
| California     | CA            | `ca`     |
| Florida        | FL            | `fl`     |
| Georgia        | GA            | `ga`     |
| Hawaii         | HI            | `hi`     |
| Maine          | ME            | `me`     |
| Massachusetts  | MA            | `ma`     |
| New Hampshire  | NH            | `nh`     |
| New Jersey     | NJ            | `nj`     |
| New York       | NY            | `ny`     |
| North Carolina | NC            | `nc`     |
| Oregon         | OR            | `or`     |
| Puerto Rico    | PR            | `pr`     |
| Rhode Island   | RI            | `ri`     |
| South Carolina | SC            | `sc`     |
| Texas          | TX            | `tx`     |
| Washington     | WA            | `wa`     |

### Human-Readable Alternatives (for state landing pages)

| URL Slug       | Display Name |
| -------------- | ------------ |
| `/california`  | California   |
| `/hawaii`      | Hawaii       |
| `/new-jersey`  | New Jersey   |
| `/puerto-rico` | Puerto Rico  |
| etc.           |              |

---

## 6. Implementation Checklist

### Week 2: Foundation

- [ ] Create state landing page route (`app/[stateSlug]/page.tsx`)
- [ ] Implement `generateStaticParams()` for all states
- [ ] Implement `generateMetadata()` with SEO-optimized titles
- [ ] Create beach listing by city/region component
- [ ] Add state-level map component
- [ ] Add JSON-LD structured data

### Week 3: Enhancement

- [ ] Update beach page titles to new format
- [ ] Update beach page meta descriptions
- [ ] Create `/api/og/beach/[beachSlug]` route
- [ ] Integrate Satori for beach OG image generation
- [ ] Update beach pages to use dynamic OG images

### Week 4: Polish & Launch

- [ ] Update sitemap with state URLs
- [ ] Test all state pages render correctly
- [ ] Verify structured data with Google Rich Results Test
- [ ] Submit updated sitemap to Google Search Console
- [ ] Monitor indexing in Search Console

---

## 7. Testing & Validation

### SEO Validation Tools

1. **Google Rich Results Test**: https://search.google.com/test/rich-results

   - Test structured data for state and beach pages

2. **Facebook Sharing Debugger**: https://developers.facebook.com/tools/debug/

   - Verify OG images render correctly

3. **Twitter Card Validator**: https://cards-dev.twitter.com/validator

   - Test Twitter card previews

4. **Lighthouse SEO Audit**
   ```bash
   npx lighthouse https://www.quiversurf.app/california --only-categories=seo
   ```

### Manual Checklist

- [ ] Each state page has unique title and description
- [ ] Canonical URLs are correct
- [ ] OG images load within 3 seconds
- [ ] Mobile rendering is correct
- [ ] Internal links work (state → city → beach)
- [ ] Breadcrumbs display correctly

---

## 8. Success Metrics

### Short-term (1 month)

- [ ] All state pages indexed by Google
- [ ] State pages appear in search results for `"{state} surf forecast"`
- [ ] OG images display correctly on social shares

### Medium-term (3 months)

- [ ] 10% of traffic from organic search
- [ ] State pages ranking top 20 for target keywords
- [ ] 50+ backlinks to state landing pages

### Long-term (6 months)

- [ ] 25% of traffic from organic search
- [ ] State pages ranking top 10 for primary keywords
- [ ] Featured snippets for "best surf beaches in {state}"

---

## Related Documentation

- [URL Routing Architecture](../architecture/URL_ROUTING.md)
- [Adding New States Guide](../guides/ADDING_NEW_STATES.md)
- [City Editorial Content](../features/CITY_EDITORIAL_CONTENT.md)
- [Location Pages Feature](../features/LOCATION_PAGES.md)

---

**Last Updated**: December 8, 2025  
**Author**: Phase 2 SEO Planning
