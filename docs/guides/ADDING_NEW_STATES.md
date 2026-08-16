# Adding New States/Regions Guide

> Step-by-step guide for expanding Quiver's coverage to new geographic regions.

## Overview

Adding a new state or region to Quiver involves:

1. **Database** - Beach data and configurations
2. **URL Routing** - State slug mappings and routes
3. **Coverage Constants** - UI messaging and region lists
4. **SEO** - Sitemap and metadata updates
5. **Testing** - E2E and integration tests

## Prerequisites

Before expanding coverage:

- [ ] Beach data sourced and validated
- [ ] Forecast data providers identified (NOAA, CDIP, etc.)
- [ ] Editorial content prepared (optional but recommended)
- [ ] Marketing/launch plan ready

## Step 1: Add State Slug Mapping

**File:** `lib/utils/beach-url-utils.ts`

Add both the 2-letter code and full name to `STATE_SLUG_MAP`:

```typescript
const STATE_SLUG_MAP: Record<string, string> = {
  // Existing states...
  CA: "ca",
  FL: "fl",
  // ...

  // Add new state
  NC: "nc",                    // 2-letter code
  "North Carolina": "nc",      // Full name
};
```

**Supported Formats:**

| Type | Example | Slug |
|------|---------|------|
| 2-letter code | `NC` | `nc` |
| Full name | `North Carolina` | `nc` |
| International | `Baja California` | `mexico/baja-california` |

## Step 2: Update Coverage Constants

**File:** `lib/constants/coverage-areas.ts`

### Add to COVERED_REGIONS

```typescript
export const COVERED_REGIONS = [
  "San Diego County, CA",
  "Orange County, CA",
  // ... existing regions

  // Add new region
  "Outer Banks, NC",
  "Wilmington, NC",
] as const;
```

### Update OUT_OF_AREA_EXAMPLES (Remove if previously listed)

If the new region was in `OUT_OF_AREA_EXAMPLES`, remove it:

```typescript
// Remove this entry if adding North Carolina
export const OUT_OF_AREA_EXAMPLES = {
  // Remove: "north carolina": { ... }
  florida: { ... },
  // ...
};
```

### Update isLikelyOutOfAreaSearch patterns

```typescript
export function isLikelyOutOfAreaSearch(searchTerm: string): boolean {
  // Remove new state from out-of-area patterns
  const outOfAreaPatterns = [
    // Remove: /north carolina|outer banks/i
    /florida|miami|cocoa beach/i,
    // ...
  ];
  // ...
}
```

## Step 3: Add Beach Data

### Database Migration

Create a migration file for the new beaches:

```bash
npx supabase migration new add_north_carolina_beaches
```

**Migration Template:**

```sql
-- Migration: add_north_carolina_beaches.sql
-- Adds beaches for North Carolina coverage expansion

INSERT INTO beaches (
  id,
  name,
  slug,
  city,
  state,
  country,
  center_lat,
  -- Legacy beaches-table longitude column; new API/component shapes use lon.
  center_lng,
  break_type,
  wind_offshore_deg,
  swell_window_min_deg,
  swell_window_max_deg,
  tide_min_ft,
  tide_max_ft,
  description,
  is_private
) VALUES
(
  gen_random_uuid(),
  'Cape Hatteras',
  'cape-hatteras',
  'Outer Banks',
  'NC',
  'USA',
  35.2239,
  -75.5358,
  'beach',
  270,        -- Offshore from west
  130,        -- Swell window start
  220,        -- Swell window end
  1.0,        -- Min tide
  4.0,        -- Max tide
  'Legendary East Coast surf destination with powerful hurricane swells.',
  false
),
-- Add more beaches...
;

-- Add indexes for new city searches
CREATE INDEX IF NOT EXISTS idx_beaches_city_nc
ON beaches (city)
WHERE state = 'NC';
```

### Beach Scoring Configuration

Each beach needs scoring parameters:

| Parameter | Description | Example |
|-----------|-------------|---------|
| `wind_offshore_deg` | Ideal offshore wind direction | 270 (W) |
| `swell_window_min_deg` | Start of favorable swell window | 130 |
| `swell_window_max_deg` | End of favorable swell window | 220 |
| `tide_min_ft` | Minimum preferred tide | 1.0 |
| `tide_max_ft` | Maximum preferred tide | 4.0 |

## Step 4: Add Middleware Redirects (Optional)

If the state needs legacy URL support:

**File:** `middleware.ts`

```typescript
// Redirect legacy state routes
const legacyStateMatch = pathname.match(/^\/(nc)\/([\w-]+)$/);
if (legacyStateMatch) {
  const [, state, city] = legacyStateMatch;
  return NextResponse.redirect(
    new URL(`/beaches/usa/${state}/${city}`, request.url),
    { status: 302 }
  );
}
```

## Step 5: Update Sitemap

**File:** `app/sitemap.ts`

The sitemap automatically includes beaches from the database. Verify new beaches appear:

```typescript
// Beaches are auto-included via:
const { data: beaches } = await supabase
  .from('beaches')
  .select('id, slug, city, state, updated_at');
```

No code changes needed if using automatic sitemap generation.

## Step 6: Add Editorial Content (Recommended)

Create city-level editorial content for rich landing pages:

**Migration:**

```sql
INSERT INTO city_editorial_content (
  city_slug,
  state_slug,
  country_slug,
  city_name,
  region_label,
  description,
  session_timing,
  quick_links,
  featured_intents,
  planning_checklist
) VALUES (
  'outer-banks',
  'nc',
  'usa',
  'Outer Banks',
  'North Carolina',
  ARRAY[
    'The Outer Banks deliver East Coast power when hurricanes spin offshore...',
    'Fall is prime season with south swells and offshore winds...'
  ],
  '[
    {"icon": "sun", "title": "Today", "summary": "Check buoy 41025 for ground swell energy..."},
    {"icon": "clock", "title": "Now", "summary": "Cape Hatteras lighthouse area handles size..."},
    {"icon": "calendar", "title": "Weekend", "summary": "Track tropical systems for potential waves..."}
  ]'::jsonb,
  '[
    {"label": "OBX surf map", "href": "/map?city=outer-banks"},
    {"label": "Tide chart", "href": "/tide/outer-banks"}
  ]'::jsonb,
  ARRAY['beginner', 'least-crowded'],
  ARRAY[
    'Monitor hurricane season forecasts',
    'Check ferry schedules for Hatteras access',
    'Log sessions to track seasonal patterns'
  ]
);
```

See [City Editorial Authoring Guide](/docs/features/CITY_EDITORIAL_AUTHORING_GUIDE.md) for detailed content guidelines.

## Step 7: Configure Forecast Data Sources

### NOAA/NWS Integration

Identify the nearest NOAA forecast points:

```typescript
// lib/services/forecast-service.ts
const NOAA_GRID_POINTS: Record<string, { gridX: number; gridY: number; office: string }> = {
  // ... existing
  'outer-banks-nc': { gridX: 89, gridY: 67, office: 'MHX' },
};
```

### Buoy Associations

Link beaches to nearby NDBC buoys:

```sql
-- Associate beaches with buoys
UPDATE beaches
SET primary_buoy_id = 'station-41025'
WHERE city = 'Outer Banks' AND state = 'NC';
```

## Step 8: Testing

### Unit Tests

**File:** `__tests__/lib/utils/beach-url-utils.test.ts`

```typescript
describe('North Carolina URLs', () => {
  it('should generate correct state slug', () => {
    expect(stateToSlug('NC')).toBe('nc');
    expect(stateToSlug('North Carolina')).toBe('nc');
  });

  it('should build correct beach URL', () => {
    const url = buildBeachUrl({
      slug: 'cape-hatteras',
      city: 'Outer Banks',
      state: 'NC'
    });
    expect(url).toBe('/nc/outer-banks/cape-hatteras');
  });

  it('should validate state slug', () => {
    expect(isValidStateSlug('nc')).toBe(true);
  });
});
```

### E2E Tests

**File:** `e2e/nc-coverage.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test.describe('North Carolina Coverage', () => {
  test('should load Outer Banks city page', async ({ page }) => {
    await page.goto('/beaches/usa/nc/outer-banks');
    await expect(page.getByRole('heading', { name: /outer banks/i })).toBeVisible();
  });

  test('should load Cape Hatteras beach page', async ({ page }) => {
    await page.goto('/nc/outer-banks/cape-hatteras');
    await expect(page.getByText(/Cape Hatteras/i)).toBeVisible();
  });

  test('should find NC beaches in search', async ({ page }) => {
    await page.goto('/');
    await page.fill('[data-testid="beach-search"]', 'Hatteras');
    await expect(page.getByText('Cape Hatteras')).toBeVisible();
  });
});
```

## Step 9: Deployment Checklist

### Pre-Deployment

- [ ] Migration tested locally with `npx supabase db push`
- [ ] URL generation verified in development
- [ ] Beach search returns new beaches
- [ ] Forecast data available for region
- [ ] E2E tests passing

### Deployment

1. **Deploy migration to staging:**
   ```bash
   npx supabase db push --linked
   ```

2. **Verify staging:**
   - Beach pages load correctly
   - Search includes new beaches
   - Forecast data displays
   - Map shows correct locations

3. **Deploy to production:**
   ```bash
   vercel deploy --prod
   ```

### Post-Deployment

- [ ] Monitor error rates in Sentry
- [ ] Check sitemap includes new URLs
- [ ] Submit sitemap to Google Search Console
- [ ] Announce expansion to users

## File Checklist

| File | Change Required |
|------|-----------------|
| `lib/utils/beach-url-utils.ts` | Add state to `STATE_SLUG_MAP` |
| `lib/constants/coverage-areas.ts` | Add region to `COVERED_REGIONS` |
| `middleware.ts` | Add redirects (if needed) |
| `supabase/migrations/*.sql` | Beach data migration |
| `__tests__/*` | Add unit tests |
| `e2e/*.spec.ts` | Add E2E tests |

## Examples

### California (Existing)

```
State Code: CA
State Slug: ca
URL Pattern: /ca/{city}/{beach}
Example: /ca/san-diego/ocean-beach
```

### Oregon (Existing)

```
State Code: OR
State Slug: or
URL Pattern: /or/{city}/{beach}
Example: /or/newport/agate-beach
```

### International (Baja)

```
Region: Baja California
Slug: mexico/baja-california
URL Pattern: /mexico/baja-california/{city}/{beach}
Example: /mexico/baja-california/ensenada/san-miguel
```

## Related Documentation

- [URL Routing Architecture](/docs/architecture/URL_ROUTING.md)
- [City Editorial Authoring](/docs/features/CITY_EDITORIAL_AUTHORING_GUIDE.md)
- [Coverage Areas](/docs/COVERAGE_AREAS.md)
- [Database Schema](/docs/diagrams/database-schema.md)
- [Forecast Scoring](/docs/architecture/FORECAST_SCORING.md)

---

**Last Updated:** December 2025
