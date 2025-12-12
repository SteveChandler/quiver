# URL Routing Architecture

This document describes the URL routing system for the Quiver surf application, including hierarchical beach URLs, state validation, and route precedence.

## Overview

Quiver uses a hierarchical URL structure that mirrors real-world geography, providing SEO-friendly URLs and clear navigation paths for users.

## Route Hierarchy

### 1. Beach Detail Routes

**Primary Pattern**: `/[state]/[city]/[beachSlug]`

Examples:

- `/ca/san-diego/ocean-beach`
- `/or/newport/agate-beach`
- `/hi/oahu/pipeline`

**Implementation**: `app/[intent]/[city]/[beachSlug]/page.tsx`

This route uses state slug validation to distinguish state codes from intent slugs.

### 2. City Landing Pages

**Pattern**: `/beaches/[country]/[state]/[city]`

Examples:

- `/beaches/usa/ca/san-diego`
- `/beaches/usa/or/newport`
- `/beaches/usa/hi/oahu`

**Implementation**: `app/beaches/[country]/[state]/[city]/page.tsx`

City pages display:

- Interactive map with beach markers
- Scrollable beach list (desktop) or horizontal scroll (mobile)
- Editorial content (when available)
- Session timing modules
- Planning checklists

### 3. Intent-Based Routes

**Pattern**: `/[intent]/[city]`

Examples:

- `/surf-forecast/san-diego`
- `/beginner/orange-county`
- `/least-crowded/newport`
- `/tide/oahu`

**Implementation**: Various intent-specific pages

## State Slug Validation

### Purpose

State slug validation prevents routing conflicts between state codes and intent slugs:

- `/ca/san-diego/ocean-beach` → Beach detail (CA is a valid state)
- `/surf-forecast/san-diego/ocean-beach` → Intent route (surf-forecast is NOT a state)

### Validation Functions

**Location**: `lib/utils/beach-url-utils.ts`

```typescript
// Get all valid state slugs
getValidStateSlugs(): string[]
// Returns: ["ca", "fl", "hi", "nc", "or", "wa", "tx", ...]

// Check if a slug is a valid state
isValidStateSlug(slug: string): boolean
// Examples:
//   isValidStateSlug("ca") → true
//   isValidStateSlug("or") → true
//   isValidStateSlug("surf-forecast") → false
```

### State Slug Mapping

**Source**: `lib/utils/beach-url-utils.ts` - `STATE_SLUG_MAP`

US States (2-letter codes):

- `CA`, `California` → `ca`
- `FL`, `Florida` → `fl`
- `HI`, `Hawaii` → `hi`
- `NC`, `North Carolina` → `nc`
- `SC`, `South Carolina` → `sc`
- `OR`, `Oregon` → `or`
- `WA`, `Washington` → `wa`
- `TX`, `Texas` → `tx`
- `NJ`, `New Jersey` → `nj`
- `NY`, `New York` → `ny`
- `MA`, `Massachusetts` → `ma`
- `RI`, `Rhode Island` → `ri`

International:

- `Baja California` → `mexico/baja-california`

## URL Building Utilities

### Beach URLs

**Location**: `lib/utils/beach-url-utils.ts`

```typescript
// Build hierarchical beach URL
buildBeachUrl(beach: { slug, city, state }): string
// Example: { slug: "ocean-beach", city: "San Diego", state: "CA" }
// Returns: "/ca/san-diego/ocean-beach"

// Safe URL generation with fallbacks
getBeachUrlSafe(beach: { id?, slug?, city?, state? }): string | null
// Priority: hierarchical → slug-based → null
// Example: Returns "/ca/san-diego/ocean-beach" if all data present
//          Returns "/beach/ocean-beach" if city/state missing
//          Returns null if no slug

// Build beach URL with tab parameter
buildBeachUrlWithTab(beach, tab: string): string
// Example: Returns "/ca/san-diego/ocean-beach?tab=reviews"
```

### Location URLs

**Location**: `lib/utils/location-slug.ts`

```typescript
// Build location page URL
buildLocationUrl(city, state, country?): string
// Example: ("San Diego", "CA", "USA")
// Returns: "/beaches/usa/ca/san-diego"

// Generate URL slug from text
generateLocationSlug(text: string): string
// Example: "San Diego" → "san-diego"

// Parse human-readable name from slug
parseLocationFromSlug(slug: string): string
// Example: "san-diego" → "San Diego"
//          "cardiff-by-the-sea" → "Cardiff by the Sea"

// Build breadcrumb segments
buildBreadcrumbSegments(city, state, country?): Array<{label, url}>
// Returns hierarchical breadcrumbs for navigation
```

## Route Precedence and Conflict Resolution

### Conflict: State Code vs Intent Slug

**Problem**: How to distinguish `/ca/san-diego` (city page) from `/surf-forecast/san-diego` (intent page)?

**Solution**: State validation in dynamic route

```typescript
// In app/[intent]/[city]/[beachSlug]/page.tsx
export async function generateMetadata({ params }) {
  const { intent } = params;

  // Check if first segment is a valid state code
  if (isValidStateSlug(intent)) {
    // This is a beach detail route: /ca/san-diego/ocean-beach
    // "intent" is actually the state code
    // Handle as beach detail...
  } else {
    // This is an intent route: /surf-forecast/san-diego/ocean-beach
    // Handle as intent-based page...
  }
}
```

### Route Priority

1. Static routes (highest priority)
2. Beach detail routes with state validation (`/[state]/[city]/[beach]`)
3. City landing pages (`/beaches/[country]/[state]/[city]`)
4. Intent routes (`/[intent]/[city]`)
5. Catch-all and 404 (lowest priority)

## Migration from Deprecated Routes

### Legacy California Routes

**Deprecated**: `/ca/[city]` and `/ca/[city]/page.tsx`

**New Route**: `/beaches/usa/ca/[city]`

**Middleware Redirect**: `middleware.ts` (lines 36-45)

```typescript
// Redirect legacy CA city routes
const legacyCaMatch = pathname.match(/^\/ca\/(san-diego|orange-county)$/);
if (legacyCaMatch) {
  const city = legacyCaMatch[1];
  return NextResponse.redirect(
    new URL(`/beaches/usa/ca/${city}`, request.url),
    { status: 302 }
  );
}
```

**Impact**:

- `/ca/san-diego` → redirects to `/beaches/usa/ca/san-diego`
- `/ca/orange-county` → redirects to `/beaches/usa/ca/orange-county`
- Old URLs remain functional via 302 redirect
- Search engines will update indexed URLs over time

### SEO Considerations for Redirects

**Why 302 (Temporary) Instead of 301 (Permanent)?**

We use 302 redirects during the migration period to:

1. Preserve flexibility to adjust URL structure if needed
2. Allow A/B testing of new URL patterns
3. Monitor traffic patterns before committing permanently

**Migration Timeline:**

- **December 2025**: 302 redirects deployed
- **January 2026**: Monitor search console for indexing status
- **February 2026**: Evaluate and consider switching to 301

**When to Switch to 301:**

- Once new URLs are fully indexed by search engines
- After confirming no further URL structure changes needed
- When legacy URL traffic has mostly shifted to new URLs

**Search Console Actions:**

1. Submit new sitemap with `/beaches/usa/ca/*` URLs
2. Monitor "URL Inspection" for both old and new patterns
3. Track crawl stats for redirect chains

### Future City Redirects

When adding new cities with legacy routes, add to middleware:

```typescript
// Example: Adding Los Angeles and Ventura redirects
const legacyCaMatch = pathname.match(
  /^\/ca\/(san-diego|orange-county|los-angeles|ventura)$/
);
```

## Examples for All US States

### California

```
Beach: /ca/san-diego/ocean-beach
City:  /beaches/usa/ca/san-diego
```

### Oregon

```
Beach: /or/newport/agate-beach
City:  /beaches/usa/or/newport
```

### Washington

```
Beach: /wa/seattle/alki-beach
City:  /beaches/usa/wa/seattle
```

### Hawaii

```
Beach: /hi/oahu/pipeline
City:  /beaches/usa/hi/oahu
```

### Florida

```
Beach: /fl/jacksonville/jacksonville-beach
City:  /beaches/usa/fl/jacksonville
```

### North Carolina

```
Beach: /nc/outer-banks/cape-hatteras
City:  /beaches/usa/nc/outer-banks
```

### Texas

```
Beach: /tx/galveston/stewart-beach
City:  /beaches/usa/tx/galveston
```

## SEO Considerations

### URL Structure Benefits

1. **Hierarchical**: URLs reflect geographic hierarchy
2. **Descriptive**: Human-readable slugs (no UUIDs in public URLs)
3. **Consistent**: Same pattern across all states/countries
4. **Keyword-rich**: State and city names in URL path

### Canonical URLs

All routes use absolute canonical URLs:

```typescript
// In page metadata
export async function generateMetadata({ params }) {
  return {
    alternates: {
      canonical: `https://www.quiversurf.app/ca/san-diego/ocean-beach`,
    },
  };
}
```

### Sitemap Generation

**Location**: `app/sitemap.ts`

The sitemap generator uses URL building utilities to ensure consistency:

```typescript
// Beach entries use buildBeachUrl()
beachEntries = beaches.map((beach) => ({
  url: `${baseUrl}${buildBeachUrl(beach)}`,
  lastModified: beach.updated_at,
  changeFrequency: "weekly",
  priority: 0.6,
}));

// Location entries use buildLocationUrl()
locationRoutes = locations.map((location) => ({
  url: `${baseUrl}${buildLocationUrl(
    location.city,
    location.state,
    location.country
  )}`,
  lastModified: lastmod,
  changeFrequency: "weekly",
  priority: 0.75,
}));
```

## Best Practices

### When Building URLs

1. Always use utility functions (`buildBeachUrl`, `buildLocationUrl`)
2. Never hardcode URL patterns
3. Use `getBeachUrlSafe()` when beach data might be incomplete
4. Handle null returns from URL builders gracefully

### When Adding New States/Countries

1. Add state mapping to `STATE_SLUG_MAP` in `beach-url-utils.ts`
2. Add both 2-letter code and full name mappings
3. Test URL generation with new state code
4. Update this documentation with examples

### When Creating New Routes

1. Check for conflicts with existing routes
2. Use state validation if route uses geographic slugs
3. Add route to sitemap generator
4. Document in this file

## Troubleshooting

### Beach URLs Return 404

**Check**:

1. Does beach have `slug`, `city`, and `state` fields?
2. Is state code in `STATE_SLUG_MAP`?
3. Is dynamic route configured correctly?

**Debug**:

```typescript
const url = getBeachUrlSafe(beach);
console.log("Generated URL:", url);
console.log("Beach data:", {
  slug: beach.slug,
  city: beach.city,
  state: beach.state,
});
```

### State Code Not Recognized

**Check**:

1. Is state code in `STATE_SLUG_MAP`?
2. Is `getValidStateSlugs()` returning the state?

**Fix**:
Add to `STATE_SLUG_MAP` in `beach-url-utils.ts`:

```typescript
const STATE_SLUG_MAP: Record<string, string> = {
  // Add new state
  NEW_STATE_CODE: "new-state-slug",
  "New State Name": "new-state-slug",
  // ...
};
```

### Intent Route Conflict

If a new intent slug matches a state code, rename the intent slug or add special handling in the dynamic route.

## Related Documentation

- `/docs/features/CITY_EDITORIAL_CONTENT.md` - City page content system
- `/docs/seo/METADATA_STRATEGY.md` - SEO metadata generation
- `/components/city/ARCHITECTURE.md` - City page components
- `/lib/utils/beach-url-utils.ts` - URL building utilities
- `/lib/utils/location-slug.ts` - Location slug utilities
- `/middleware.ts` - Route redirects and validation

## Change Log

- **2025-12-03**: Created generic state route with validation
- **2025-12-03**: Added middleware redirect for legacy `/ca/*` routes
- **2025-12-03**: Documented state slug validation system
- **2025-12-04**: Expanded to all US surf states
