# Coordinate Naming Conventions

## Overview

This document establishes the official coordinate naming standards for the Quiver surfing application to prevent coordinate mapping bugs and ensure consistency across the entire stack.

## Background

**Critical Bug Fixed**: November 2025 - The Local Intel feature failed due to inconsistent coordinate naming. Beach data used `center_lat`/`center_lng` from the database, while the hook expected `latitude`/`longitude` props. This mismatch caused the feature to break silently.

**Root Cause**: Mixing `lng` (database legacy from PostGIS) with `lon` (standard abbreviation) and `longitude` (full name) across different layers of the application.

## Official Naming Standards

### Primary Convention

```typescript
✅ CORRECT: lat, lon, latitude, longitude
❌ INCORRECT: lng (do not use in new code)
```

### Layer-Specific Conventions

#### Database Layer (PostgreSQL/PostGIS)

**Legacy Fields** (from PostGIS):
```sql
-- Beaches table (canonical coordinate storage)
center_lat DOUBLE PRECISION  -- Latitude
center_lng DOUBLE PRECISION  -- Longitude (legacy PostGIS naming)

-- New tables should use:
latitude DOUBLE PRECISION
longitude DOUBLE PRECISION
```

**Database Functions**:
```sql
-- Function parameters use full names
get_nearby_intel_posts(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_miles DOUBLE PRECISION
)

-- Returns vary by function.
-- Many feature RPCs return full names (latitude/longitude), but some legacy RPCs
-- (notably location ranking: get_beaches_by_location_with_scores / get_beaches_by_metro_with_scores)
-- return lat/lon for backward compatibility.
RETURNS TABLE (
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  ...
)
```

**Migration Note**: The database uses `center_lng` in legacy tables (beaches) due to PostGIS conventions. DO NOT change this without a comprehensive migration plan.

#### TypeScript/JavaScript Layer

**Type Definitions**:
```typescript
// Database types (matches database schema exactly)
interface Beach {
  center_lat: number;  // From database column
  center_lng: number;  // From database column (legacy)
  // ... other fields
}

// Component props (use full names for clarity)
interface BeachIntelSectionProps {
  latitude: number;   // Full name, NOT lat
  longitude: number;  // Full name, NOT lng
  beachId: string;
  beachName?: string;
}

// API parameters (use short names)
interface GetNearbyIntelPostsParams {
  lat: number;   // Short form
  lon: number;   // Short form (NOT lng)
  radius: number;
  tag?: IntelPostTag | "all";
}
```

**Coordinate Mapping Pattern**:
```typescript
// CORRECT: Map database fields to component props
const IntelTab = ({ beach }: { beach: Beach }) => {
  return (
    <BeachIntelSection
      latitude={beach.center_lat}   // Map: center_lat → latitude
      longitude={beach.center_lng}  // Map: center_lng → longitude
      beachId={beach.id}
    />
  );
};
```

#### API Endpoints

**Request Parameters** (use short names):
```typescript
// POST /api/intel/nearby
{
  "lat": 32.7157,    // Short form
  "lon": -117.1611,  // Short form (NOT lng)
  "radius": 5,
  "tag": "all"
}
```

**Response Fields** (use full names):
```json
{
  "posts": [
    {
      "id": "...",
      "latitude": 32.7157,   // Full name
      "longitude": -117.1611, // Full name
      "title": "...",
      ...
    }
  ]
}
```

## Common Patterns

### Pattern 1: Database to Component Mapping

```typescript
// Database query result
const beach = await supabase
  .from('beaches')
  .select('*')
  .single();

// beach = { center_lat: 32.7157, center_lng: -117.1611, ... }

// Component usage
<MapMarker
  latitude={beach.center_lat}   // Map explicitly
  longitude={beach.center_lng}  // Map explicitly
/>
```

### Pattern 2: User Input to API Call

```typescript
// User provides coordinates
const userLocation = {
  latitude: 32.7157,
  longitude: -117.1611,
};

// API call uses short names
const response = await fetch('/api/intel/nearby', {
  method: 'POST',
  body: JSON.stringify({
    lat: userLocation.latitude,   // Map: latitude → lat
    lon: userLocation.longitude,  // Map: longitude → lon
    radius: 5,
  }),
});
```

### Pattern 3: Hook Usage

```typescript
// Hook accepts full names for clarity
const { data, loading } = useIntelData({
  latitude: beach.center_lat,   // Full name
  longitude: beach.center_lng,  // Full name
  radius: 5,
  enabled: true,
});

// Hook internally maps to API short names
const params = {
  lat: latitude,   // latitude → lat
  lon: longitude,  // longitude → lon
  radius,
};
```

## Common Pitfalls

### Pitfall 1: Using `lng` Instead of `lon`

```typescript
// ❌ WRONG - Don't use lng
const params = {
  lat: beach.center_lat,
  lng: beach.center_lng,  // Wrong! Use 'lon'
};

// ✅ CORRECT - Use lon
const params = {
  lat: beach.center_lat,
  lon: beach.center_lng,  // Correct
};
```

### Pitfall 2: Assuming Property Names Match

```typescript
// ❌ WRONG - Assuming beach has latitude/longitude
<BeachIntelSection
  latitude={beach.latitude}   // beach.latitude doesn't exist!
  longitude={beach.longitude} // beach.longitude doesn't exist!
  beachId={beach.id}
/>

// ✅ CORRECT - Map database fields explicitly
<BeachIntelSection
  latitude={beach.center_lat}   // Map from database field
  longitude={beach.center_lng}  // Map from database field
  beachId={beach.id}
/>
```

### Pitfall 3: Swapping Coordinates

```typescript
// ❌ WRONG - Coordinates swapped
const location = {
  latitude: -117.1611,  // This is longitude!
  longitude: 32.7157,   // This is latitude!
};

// ✅ CORRECT - Latitude first, longitude second
const location = {
  latitude: 32.7157,    // Latitude (-90 to 90)
  longitude: -117.1611, // Longitude (-180 to 180)
};
```

## Type Definitions Reference

### Beach Types

```typescript
// Database schema (from beaches table)
interface Beach {
  id: string;
  name: string;
  center_lat: number;      // Database field
  center_lng: number;      // Database field (legacy)
  slug: string;
  // ... other fields
}

// API response (from get_nearby_intel_posts)
interface IntelPost {
  id: string;
  latitude: number;        // Full name
  longitude: number;       // Full name
  title: string;
  description: string;
  // ... other fields
}
```

### Component Props

```typescript
// Use full names for component props
interface LocationProps {
  latitude: number;   // Full name for clarity
  longitude: number;  // Full name for clarity
}

// Use short names for API parameters
interface ApiParams {
  lat: number;   // Short form
  lon: number;   // Short form (NOT lng)
}
```

## Validation

Always validate coordinates using the coordinate validation utilities:

```typescript
import {
  validateCoordinates,
  getCoordinateValidationError,
  assertValidCoordinates,
} from '@/lib/coordinate-validation';

// Example 1: Development warnings
if (process.env.NODE_ENV === 'development') {
  validateCoordinates(latitude, longitude, 'BeachIntelSection');
}

// Example 2: Error handling
const error = getCoordinateValidationError(lat, lon, 'API call');
if (error) {
  throw new Error(`Invalid coordinates: ${error}`);
}

// Example 3: Critical paths
assertValidCoordinates(lat, lon, 'Database write');
```

See [Runtime Coordinate Validation](#runtime-coordinate-validation) for the
validation utility reference.

## Database Schema

### Canonical Coordinate Columns

```sql
-- beaches table (legacy PostGIS naming)
CREATE TABLE beaches (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  center_lat DOUBLE PRECISION NOT NULL,  -- Canonical latitude
  center_lng DOUBLE PRECISION NOT NULL,  -- Canonical longitude (legacy)
  coordinates GEOGRAPHY(Point, 4326),    -- PostGIS geometry
  -- ... other columns
);

-- New tables (use standard naming)
CREATE TABLE intel_posts (
  id UUID PRIMARY KEY,
  latitude DOUBLE PRECISION NOT NULL,    -- Standard naming
  longitude DOUBLE PRECISION NOT NULL,   -- Standard naming
  -- ... other columns
);
```

### Database Functions

```sql
-- Function signature uses explicit naming
CREATE OR REPLACE FUNCTION get_nearby_intel_posts(
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  radius_miles DOUBLE PRECISION DEFAULT 5,
  tag_filter TEXT DEFAULT 'all',
  limit_count INTEGER DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  latitude DOUBLE PRECISION,     -- Returns full names
  longitude DOUBLE PRECISION,    -- Returns full names
  title TEXT,
  description TEXT,
  -- ... other columns
);
```

## Migration Guide

### Updating Existing Code

If you find code using `lng`, update it following this pattern:

1. **Search for lng usage**:
   ```bash
   grep -r "lng" --include="*.ts" --include="*.tsx"
   ```

2. **Update variable names**:
   ```typescript
   // Before
   const { lat, lng } = coordinates;

   // After
   const { lat, lon } = coordinates;
   ```

3. **Update type definitions**:
   ```typescript
   // Before
   interface Coordinates {
     lat: number;
     lng: number;
   }

   // After
   interface Coordinates {
     lat: number;
     lon: number;  // Changed from lng to lon
   }
   ```

4. **Update tests**:
   ```typescript
   // Before
   expect(result).toHaveProperty('lng');

   // After
   expect(result).toHaveProperty('lon');
   ```

5. **Run tests**:
   ```bash
   yarn test:unit
   yarn test:e2e
   ```

### Database Migration Considerations

**DO NOT change database column names without a migration plan:**

- The `beaches` table uses `center_lng` due to PostGIS legacy
- Changing this requires:
  1. Migration script to rename column
  2. Update all database functions
  3. Update all TypeScript types
  4. Update all queries
  5. Coordinate with production deployment

**Future Migration Checklist**:
- [ ] Create migration script
- [ ] Update TypeScript generated types
- [ ] Update all queries
- [ ] Update all components
- [ ] Update all tests
- [ ] Test in staging environment
- [ ] Coordinate production deployment
- [ ] Update documentation

## Examples

### Example 1: Beach Detail Page

```typescript
// app/beach/[slug]/page.tsx
import { BeachIntelSection } from '@/components/intel';

export default function BeachDetailPage({ beach }: { beach: Beach }) {
  return (
    <div>
      <h1>{beach.name}</h1>

      {/* Map database fields to component props */}
      <BeachIntelSection
        latitude={beach.center_lat}   // Explicit mapping
        longitude={beach.center_lng}  // Explicit mapping
        beachId={beach.id}
        beachName={beach.name}
      />
    </div>
  );
}
```

### Example 2: Intel Hook

```typescript
// hooks/use-intel-data.ts
export function useIntelData({
  latitude,   // Full name prop
  longitude,  // Full name prop
  radius = 5,
  ...
}: UseIntelDataParams) {
  const fetchIntelData = useCallback(async () => {
    // Validate before API call
    assertValidCoordinates(latitude, longitude, 'useIntelData');

    // Map to API parameter names
    const params = {
      lat: latitude,    // Full name → short name
      lon: longitude,   // Full name → short name (NOT lng)
      radius,
    };

    return await getNearbyIntelPosts(params);
  }, [latitude, longitude, radius]);

  // ... rest of hook
}
```

### Example 3: API Route

```typescript
// app/api/intel/nearby/route.ts
export async function POST(request: Request) {
  const { lat, lon, radius } = await request.json();

  // Validate coordinates
  const error = getCoordinateValidationError(lat, lon, 'API /intel/nearby');
  if (error) {
    return NextResponse.json(
      { error: `Invalid coordinates: ${error}` },
      { status: 400 }
    );
  }

  // Call database function (maps to database parameter names)
  const { data } = await supabase.rpc('get_nearby_intel_posts', {
    center_lat: lat,   // API param → database param
    center_lng: lon,   // API param → database param
    radius_miles: radius,
  });

  return NextResponse.json({ posts: data });
}
```

## Testing Conventions

### Unit Tests

```typescript
describe('coordinate mapping', () => {
  it('maps beach database fields to component props', () => {
    const beach = {
      id: '123',
      name: 'Ocean Beach',
      center_lat: 32.7534,    // Database field
      center_lng: -117.2511,  // Database field
    };

    const props = {
      latitude: beach.center_lat,   // Map to full name
      longitude: beach.center_lng,  // Map to full name
    };

    expect(props.latitude).toBe(32.7534);
    expect(props.longitude).toBe(-117.2511);
  });
});
```

### E2E Tests

```typescript
// e2e/intel-coordinates.spec.ts
test('intel section receives correct coordinates', async ({ page }) => {
  await page.goto('/beach/ocean-beach-san-diego-ca');

  // Verify coordinates are passed correctly
  const intelSection = page.locator('[data-testid="intel-section"]');

  // Check that coordinates are valid
  const lat = await intelSection.getAttribute('data-latitude');
  const lon = await intelSection.getAttribute('data-longitude');

  expect(parseFloat(lat)).toBeGreaterThan(-90);
  expect(parseFloat(lat)).toBeLessThan(90);
  expect(parseFloat(lon)).toBeGreaterThan(-180);
  expect(parseFloat(lon)).toBeLessThan(180);
});
```

## Code Review Checklist

When reviewing code that involves coordinates:

- [ ] Are coordinate names consistent (`lon` not `lng`)?
- [ ] Are database fields mapped explicitly to component props?
- [ ] Are coordinates validated before use?
- [ ] Do component props use full names (`latitude`/`longitude`)?
- [ ] Do API parameters use short names (`lat`/`lon`)?
- [ ] Are type definitions accurate and match actual data?
- [ ] Are tests updated to match naming conventions?
- [ ] Is documentation updated if patterns change?

## Contributing Guidelines

### Adding New Features with Coordinates

When implementing features that use geographic coordinates:

1. **Use Standard Naming**:
   - ✅ `lat` and `lon` (NOT `lng`)
   - ✅ `latitude` and `longitude` for props

2. **Map Database Fields**:
   - ✅ Map `center_lat`/`center_lng` to component props explicitly
   - ✅ Don't assume property names match

3. **Validate Coordinates**:
   - ✅ Use `/lib/coordinate-validation.ts` utilities
   - ✅ Add validation in hooks before API calls
   - ✅ Add development warnings in components

4. **Add Tests**:
   - ✅ Test coordinate mapping
   - ✅ Test validation
   - ✅ Test edge cases (null, NaN, out of range)

5. **Check Console**:
   - ✅ Run in development mode
   - ✅ Look for coordinate validation warnings
   - ✅ Fix any warnings before committing

## Related Documentation

- [Runtime Coordinate Validation](#runtime-coordinate-validation) - Runtime validation utilities
- [Supabase Architecture](../supabase/ARCHITECTURE.md) - Database schema and conventions
- [Components Architecture](../components/ARCHITECTURE.md) - Component patterns and structure
- [Testing Guidelines](../e2e/ARCHITECTURE.md) - E2E testing patterns

## References

### Code Files

- Validation utilities: `/lib/coordinate-validation.ts`
- Intel hook: `/hooks/use-intel-data.ts`
- Component example: `/components/intel/beach-intel-section.tsx`
- Type definitions: `/types/database.generated.ts`
- Unit tests: `/__tests__/lib/coordinate-validation.test.ts`
- E2E tests: `/e2e/intel-coordinates.spec.ts`

### Database

- Beaches table schema: See migration `20250914090000_beaches_search_and_sources.sql`
- PostGIS documentation: https://postgis.net/
- Coordinate functions: `get_nearby_intel_posts`, `get_nearest_buoy_with_conditions`

## Changelog

### 2025-11-17
- Initial coordinate conventions documentation
- Established naming standards across all layers
- Documented common pitfalls and migration guide
- Added comprehensive examples and testing patterns
- Integrated with coordinate validation system

## Summary

### Quick Reference

| Layer | Short Form | Full Form | Notes |
|-------|-----------|-----------|-------|
| Database (legacy) | N/A | `center_lat`, `center_lng` | PostGIS legacy naming |
| Database (new) | N/A | `latitude`, `longitude` | Standard naming for new tables |
| TypeScript Types | N/A | Match database schema | Exact match to columns |
| Component Props | N/A | `latitude`, `longitude` | Full names for clarity |
| API Parameters | `lat`, `lon` | N/A | Short names, NOT `lng` |
| API Responses | N/A | `latitude`, `longitude` | Full names |
| Hook Parameters | N/A | `latitude`, `longitude` | Full names for clarity |

### Golden Rules

1. **NEVER use `lng`** - Always use `lon` (short) or `longitude` (full)
2. **Map explicitly** - Don't assume property names match between layers
3. **Validate always** - Use coordinate validation utilities
4. **Test thoroughly** - Add tests for coordinate mapping
5. **Document changes** - Update this guide when patterns evolve

---

**Remember**: Coordinate naming consistency prevents bugs. When in doubt, follow this guide.

## Runtime Coordinate Validation

The runtime validation utilities live in `/lib/coordinate-validation.ts` and
provide early, environment-aware checks at system boundaries. The canonical
naming rules above still apply: use `lat`/`lon` or `latitude`/`longitude`, and
map database fields explicitly before validation.

### Utility reference

- `isValidLatitude(lat)` is a type guard for values from -90 to 90 degrees;
  it rejects undefined, null, NaN, Infinity, and out-of-range values.
- `isValidLongitude(lon)` is a type guard for values from -180 to 180 degrees;
  it rejects undefined, null, NaN, Infinity, and out-of-range values.
- `isValidCoordinate(lat, lon)` returns true only when both values are valid.
- `getCoordinateValidationError(lat, lon, context?)` returns a detailed error
  string or null when valid. Context is included in messages such as
  `Beach: Pacific Beach: Latitude 91 is out of range (-90 to 90)`.
- `validateCoordinates(lat, lon, context?)` returns a boolean and logs
  detailed warnings, coordinate values, context, and a stack in development;
  production validation is silent.
- `assertValidCoordinates(lat, lon, context?)` throws when invalid and is for
  critical paths where invalid coordinates must halt execution.
- `sanitizeCoordinates(lat, lon)` clamps finite numeric values to valid ranges,
  returns `{ latitude: number, longitude: number }`, and returns null for
  undefined, null, non-numeric, or NaN input. Clamping is warned about in
  development.
- `hasValidCoordinates(obj)` is a type guard for objects with either `lat`/`lon`
  or `latitude`/`longitude` properties.

### Validation placement

The current validation pattern is:

1. Validate hook inputs before making an API call. `useIntelData` uses
   `getCoordinateValidationError`, logs detailed development context, and
   throws an error that reaches the error boundary. Its manual-location path
   validates before updating location state.
2. Add development-only warnings at component boundaries. The beach intel and
   intel-tab components validate their coordinate props and include beach name,
   ID, latitude, and longitude in warnings. The home forecast tab warns when
   effective coordinates are zero.
3. Use `getCoordinateValidationError` for API and user-input error handling and
   `assertValidCoordinates` for database writes or other critical paths.
4. Use `hasValidCoordinates` for API responses, database results, and type
   narrowing; use `sanitizeCoordinates` only for best-effort cleanup or legacy
   data handling.

### Environment behavior

- Development uses verbose warnings, coordinate values, component context, and
  stack traces to identify where bad data originated. Warnings do not crash the
  application.
- Production validation is silent at the console, should be handled gracefully
  by the UI, and can be reported to monitoring with useful context. Invalid
  coordinates must not crash the user experience.

### Validation scenarios

```typescript
isValidCoordinate(32.7157, -117.1611) // true: San Diego
isValidCoordinate(0, 0)              // true: Null Island
isValidCoordinate(90, 180)            // true: maximum values
isValidCoordinate(-90, -180)          // true: minimum values
isValidCoordinate(91, -117.1611)      // false: latitude out of range
isValidCoordinate(32.7157, 181)       // false: longitude out of range
isValidCoordinate(-117.1611, 32.7157) // false: swapped coordinates
isValidCoordinate(NaN, -117.1611)     // false
```

### Testing and debugging

The validation suite is at `/__tests__/lib/coordinate-validation.test.ts` and
covers valid ranges, NaN/undefined/null/Infinity, out-of-range values, error
formatting, context, development/production behavior, sanitization, object
type guards, San Diego examples, and swapped coordinates. The current suite
contains 34 tests. Run focused checks with:

```bash
npx jest __tests__/lib/coordinate-validation.test.ts
npx jest __tests__/hooks/use-intel-data.test.ts
yarn test:unit
```

For debugging, inspect the browser console in development for context-rich
warnings and stack traces. In production, inspect Sentry or the relevant
graceful fallback (for example, inability to load local intel posts).

### Adding validation to a new component

1. Import `validateCoordinates` from `/lib/coordinate-validation.ts`.
2. Validate in a development-only `useEffect` with the coordinate values and a
   component/context label.
3. Use `getCoordinateValidationError` in critical paths in all environments.
4. Add tests for coordinate mapping, validation, null/NaN/out-of-range values,
   and edge cases.
5. Run development checks and resolve coordinate warnings before committing.

### Future validation enhancements

Potential additions are suspicious-precision warnings, geographic-bounds
checks for expected regions, automatic correction of common swapped values,
validation-failure metrics, and an admin view of beaches with suspicious data.
