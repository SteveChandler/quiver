# Database Coordinate Naming Conventions

## Overview

This document establishes the standard naming convention for geographic coordinates in the Quiver database and application code.

---

## The Problem

There is a mismatch between database column names and TypeScript type definitions:

- **Database columns**: `latitude` and `longitude` (DOUBLE PRECISION)
- **TypeScript types**: `lat` and `lon` (number | null)

This inconsistency, if not handled correctly, can cause bugs where coordinate data doesn't display properly (e.g., map markers not appearing).

---

## The Solution: Column Aliasing Pattern

All database functions that return beach coordinates **MUST** alias the database columns to match TypeScript expectations.

### ✅ Correct Pattern

```sql
CREATE OR REPLACE FUNCTION my_beach_function(...)
RETURNS TABLE (
  id UUID,
  name TEXT,
  lat DOUBLE PRECISION,     -- ✅ Use 'lat' (not 'latitude')
  lon DOUBLE PRECISION,     -- ✅ Use 'lon' (not 'longitude')
  ...
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.latitude AS lat,      -- ✅ Alias database column
    b.longitude AS lon,     -- ✅ Alias database column
    ...
  FROM beaches b;
END;
$$;
```

### ❌ Incorrect Pattern

```sql
CREATE OR REPLACE FUNCTION my_beach_function(...)
RETURNS TABLE (
  id UUID,
  name TEXT,
  latitude DOUBLE PRECISION,  -- ❌ Wrong - will break TypeScript
  longitude DOUBLE PRECISION, -- ❌ Wrong - will break TypeScript
  ...
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.latitude,              -- ❌ No aliasing - TypeScript can't use this
    b.longitude,             -- ❌ No aliasing - TypeScript can't use this
    ...
  FROM beaches b;
END;
$$;
```

---

## Why This Matters

### Impact of Incorrect Naming

When functions return `latitude`/`longitude` instead of `lat`/`lon`:

1. **Frontend validation fails**: Components like `InteractiveMap` validate coordinates using `lat`/`lon` properties
2. **Map markers don't appear**: Beaches get filtered out because validation fails
3. **Type safety breaks**: TypeScript expects `lat`/`lon` per the Beach type definition
4. **Developer confusion**: Inconsistent property names across the codebase

### Example of the Bug

```typescript
// InteractiveMap validation (expects lat/lon)
const hasValidCoordinates = (lat: any, lon: any) =>
  typeof lat === "number" && typeof lon === "number" && ...;

// If beach has latitude/longitude instead:
const validLocations = locations.filter((location) =>
  hasValidCoordinates(location.lat, location.lon)  // ❌ undefined!
);
// Result: No markers on map because all beaches filtered out
```

---

## Implementation Guidelines

### For Database Functions

1. **Always use `lat`/`lon` in RETURNS TABLE**
   ```sql
   RETURNS TABLE (
     lat DOUBLE PRECISION,
     lon DOUBLE PRECISION,
     ...
   )
   ```

2. **Always alias database columns in SELECT**
   ```sql
   SELECT
     b.latitude AS lat,
     b.longitude AS lon,
     ...
   FROM beaches b
   ```

3. **Add NULL handling for robustness** (optional but recommended)
   ```sql
   SELECT
     COALESCE(b.latitude, 0)::DOUBLE PRECISION AS lat,
     COALESCE(b.longitude, 0)::DOUBLE PRECISION AS lon,
     ...
   ```

### For TypeScript Code

1. **Beach type uses `lat`/`lon`** (from types/database.ts)
   ```typescript
   interface Beach {
     id: string;
     name: string;
     lat: number | null;      // ✅ Standard property name
     lon: number | null;      // ✅ Standard property name
     ...
   }
   ```

2. **When receiving database data with `latitude`/`longitude`, transform it**
   ```typescript
   const normalizedBeaches: Beach[] = beaches.map(beach => ({
     ...beach,
     lat: beach.latitude ?? null,
     lon: beach.longitude ?? null,
   }));
   ```

3. **Always validate coordinates before use**
   ```typescript
   const hasValidCoordinates = (lat: any, lon: any) =>
     typeof lat === "number" &&
     typeof lon === "number" &&
     !isNaN(lat) &&
     !isNaN(lon) &&
     isFinite(lat) &&
     isFinite(lon);
   ```

---

## Reference Examples

### ✅ Correct Implementations

#### 1. `get_beaches_near` (20250820133000_create_get_beaches_near.sql)

```sql
CREATE OR REPLACE FUNCTION public.get_beaches_near(...)
RETURNS TABLE (
  id uuid,
  name text,
  lat double precision,    -- ✅ Correct
  lon double precision,    -- ✅ Correct
  ...
)
LANGUAGE sql STABLE AS $$
  SELECT
    b.id,
    b.name,
    b.latitude AS lat,     -- ✅ Proper aliasing
    b.longitude AS lon,    -- ✅ Proper aliasing
    ...
  FROM public.beaches b
$$;
```

#### 2. `get_beaches_by_location_with_scores` (20251029172934_create_location_ranking_functions.sql)

```sql
CREATE OR REPLACE FUNCTION get_beaches_by_location_with_scores(...)
RETURNS TABLE (
  id UUID,
  name TEXT,
  lat DOUBLE PRECISION,    -- ✅ Correct
  lon DOUBLE PRECISION,    -- ✅ Correct
  ...
)
AS $$
BEGIN
  RETURN QUERY
  SELECT
    b.id,
    b.name,
    b.latitude as lat,     -- ✅ Proper aliasing
    b.longitude as lon,    -- ✅ Proper aliasing
    ...
  FROM beaches b;
END;
$$;
```

### ✅ Fixed Functions

#### `get_nearby_beaches` (FIXED in migration 20251029180000_update_get_nearby_beaches_coordinates.sql)

```sql
-- ✅ Now correct:
RETURNS TABLE(
  lat DOUBLE PRECISION,        -- ✅ Correct
  lon DOUBLE PRECISION,        -- ✅ Correct
  ...
)
SELECT
  b.latitude AS lat,           -- ✅ Proper aliasing
  b.longitude AS lon,          -- ✅ Proper aliasing
  ...
```

**Migration Details:**
- Created: 2025-10-29
- Migration file: `20251029180000_update_get_nearby_beaches_coordinates.sql`
- Updated function signature to use `input_lat`/`input_lng` parameters (to avoid conflicts with return columns)
- Updated all consumers in codebase to use new parameter names
- Regenerated TypeScript types

**Related Changes:**
- [actions/intel-actions.ts](../actions/intel-actions.ts) - Updated parameter names
- [actions/beach/beach-location-actions.ts](../actions/beach/beach-location-actions.ts) - Updated parameter names
- [lib/surf/data.ts](../lib/surf/data.ts) - Updated parameter names
- [actions/beach/best-beaches-simple.ts](../actions/beach/best-beaches-simple.ts) - Updated parameter names
- [app/api/v1/recommendations/route.ts](../app/api/v1/recommendations/route.ts) - Updated parameter names
- [components/location/location-map.tsx](../components/location/location-map.tsx) - Removed unnecessary coordinate transformation
- [types/location.ts](../types/location.ts) - Updated comments and removed deprecated properties

---

## Frontend Coordinate Handling

**Current Status:** As of 2025-10-29, all database functions have been updated to return standardized `lat`/`lon` properties. Frontend components no longer need defensive coordinate transformation.

### ❌ Old Pattern (No Longer Needed)

```typescript
// ❌ DEPRECATED: Don't do this anymore
const normalizedBeaches: Beach[] = useMemo(
  () =>
    beaches.map((beach) => ({
      ...beach,
      lat: beach.latitude ?? beach.lat ?? null,
      lon: beach.longitude ?? beach.lon ?? null,
    })),
  [beaches]
);
```

### ✅ Current Pattern

```typescript
// ✅ CORRECT: Use beaches directly
const { center, zoom } = useMemo(() => {
  // Calculate map bounds from beaches
  beaches.forEach((beach) => {
    if (beach.lat && beach.lon) {
      // Use lat/lon directly - no transformation needed
      // ...
    }
  });
}, [beaches]);

// Pass beaches directly to components
<InteractiveMap beaches={beaches} />
```

**Rationale:** All database functions now return consistent `lat`/`lon` properties, making defensive transformation unnecessary and potentially confusing.

---

## Migration Checklist

When creating a new database function that returns beach coordinates:

- [ ] Define RETURNS TABLE with `lat` and `lon` (not `latitude`/`longitude`)
- [ ] Alias database columns in SELECT: `b.latitude AS lat, b.longitude AS lon`
- [ ] Add NULL handling if appropriate
- [ ] Test that TypeScript consumers receive correct property names
- [ ] Verify map components display markers correctly
- [ ] Update this documentation if introducing new patterns

---

## Testing

### Database Function Tests

```typescript
it('should return beaches with lat/lon properties', async () => {
  const { data } = await supabase.rpc('my_beach_function', { ... });

  expect(data[0]).toHaveProperty('lat');
  expect(data[0]).toHaveProperty('lon');
  expect(data[0]).not.toHaveProperty('latitude');
  expect(data[0]).not.toHaveProperty('longitude');

  expect(typeof data[0].lat).toBe('number');
  expect(typeof data[0].lon).toBe('number');
});
```

### Frontend Validation Tests

```typescript
it('should validate coordinates correctly', () => {
  const validBeach = { lat: 32.7157, lon: -117.1611, ... };
  const invalidBeach = { latitude: 32.7157, longitude: -117.1611, ... };

  expect(hasValidCoordinates(validBeach.lat, validBeach.lon)).toBe(true);
  expect(hasValidCoordinates(invalidBeach.lat, invalidBeach.lon)).toBe(false);
});
```

---

## FAQs

### Q: Why not rename the database columns to `lat`/`lon`?

**A:** The database has 40+ migrations and years of data using `latitude`/`longitude`. Renaming would be a breaking change requiring:
- Migration of all column references across migrations
- Updates to third-party integrations
- Risk of data loss or corruption
- Coordinated deployment across all environments

Column aliasing is the safer, non-breaking approach.

### Q: What if I need to query beaches directly with raw SQL?

**A:** Always alias in your queries:
```sql
SELECT latitude AS lat, longitude AS lon FROM beaches;
```

Or use the standard database functions that already handle this.

### Q: Does aliasing affect performance?

**A:** No. Column aliasing happens at query planning time and has zero runtime performance impact.

### Q: What about other geographic types (e.g., GeoJSON)?

**A:** For GeoJSON or PostGIS geography types, follow the same pattern:
```sql
ST_AsGeoJSON(b.geog) AS geojson  -- Alias for clarity
```

---

## Related Documentation

- **Type Definitions**: `/types/database.ts` - Beach type definition
- **Audit Report**: `/docs/coordinate-naming-audit.md` - Current function status
- **Map Components**: `/components/map/interactive-map.tsx` - Coordinate validation
- **Location Types**: `/types/location.ts` - BeachWithMetrics type

---

## Version History

- **2025-10-29**: Initial documentation
  - Established `lat`/`lon` as standard
  - Documented aliasing pattern
  - Identified `get_nearby_beaches` as needing fix

---

## Contact

Questions or suggestions about this convention? Open an issue or discussion in the repository.
