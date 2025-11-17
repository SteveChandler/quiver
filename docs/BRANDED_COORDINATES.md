# Branded Coordinates: Compile-Time Safety Guide

## Table of Contents

- [Overview](#overview)
- [The Problem](#the-problem)
- [The Solution](#the-solution)
- [When to Use Branded Types](#when-to-use-branded-types)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
- [Migration Examples](#migration-examples)
- [Performance Considerations](#performance-considerations)
- [Limitations and Trade-offs](#limitations-and-trade-offs)
- [Best Practices](#best-practices)

---

## Overview

Branded types provide **compile-time safety** against coordinate swap bugs. They're zero-cost abstractions that prevent accidentally swapping latitude and longitude values.

### What are Branded Types?

Branded types are TypeScript types that add a "brand" (unique symbol) to distinguish otherwise identical types:

```typescript
type Latitude = number & { readonly _brand: 'Latitude' };
type Longitude = number & { readonly _brand: 'Longitude' };
```

At runtime, brands are erased and these are just regular numbers. But at compile time, TypeScript prevents mixing them up.

---

## The Problem

### Type-Safe but Semantically Unsafe

Regular TypeScript types can't prevent semantic mistakes:

```typescript
function setLocation(lat: number, lon: number) { ... }

const latitude = 32.75;
const longitude = -117.25;

// This compiles fine but is WRONG:
setLocation(longitude, latitude); // ❌ Swapped! But TypeScript allows it
```

Both `latitude` and `longitude` are `number` types, so TypeScript sees no issue even though we've swapped them.

### Real-World Impact

In the Quiver codebase, we identified **23 high-risk locations** where coordinate swaps could occur:
- API endpoints accepting lat/lon parameters
- Database queries with coordinate filters
- Distance calculations
- Map integration code
- External API integrations

A single swap bug can cause:
- Users seeing wrong beaches
- Distance calculations being off by thousands of miles
- Map markers appearing in wrong locations
- Database queries returning incorrect results

---

## The Solution

### Branded Types Make Swaps Impossible

```typescript
import { Latitude, Longitude, BrandedCoordinates } from '@/lib/types/coordinates';
import { latitude, longitude } from '@/lib/types/coordinates';

function setLocation(lat: Latitude, lon: Longitude) { ... }

const lat = latitude(32.75);
const lon = longitude(-117.25);

setLocation(lat, lon); // ✅ Correct - compiles fine

setLocation(lon, lat); // ❌ TypeScript error: types don't match!
```

TypeScript now enforces that `Latitude` and `Longitude` can't be swapped.

---

## When to Use Branded Types

### ✅ USE Branded Types For:

1. **High-risk APIs** - Endpoints accepting coordinate parameters
   ```typescript
   export async function POST(request: Request) {
     const result = validateAndBrandCoordinates(await request.json());
     if (!result.valid) {
       return NextResponse.json({ error: result.error }, { status: 400 });
     }
     // result.coordinates is now branded - can't swap lat/lon
   }
   ```

2. **Critical calculations** - Distance, bearing, area calculations
   ```typescript
   function calculateBearing(
     from: BrandedCoordinates,
     to: BrandedCoordinates
   ): number {
     // Compile-time guarantee that coordinates aren't swapped
   }
   ```

3. **Database interactions** - Queries involving geographic data
   ```typescript
   async function findNearbyBeaches(
     center: BrandedCoordinates,
     radius: number
   ): Promise<Beach[]> {
     // Safe from coordinate swap bugs
   }
   ```

4. **External integrations** - Third-party API calls with coordinates
   ```typescript
   async function fetchWeather(location: BrandedCoordinates) {
     const { lat, lon } = fromBranded(location);
     // Can't accidentally swap when calling external API
   }
   ```

### ❌ DON'T Use Branded Types For:

1. **Internal components** - If structure prevents swaps
   ```typescript
   // Already safe - object structure prevents swaps
   interface Beach {
     coordinates: { lat: number; lon: number };
   }
   ```

2. **Temporary calculations** - Short-lived, local transformations
   ```typescript
   // Fine for local scope
   function internalHelper(coords: Coordinates) {
     const midpoint = {
       lat: (coords.lat + otherCoords.lat) / 2,
       lon: (coords.lon + otherCoords.lon) / 2,
     };
   }
   ```

3. **Performance-critical paths** - Though overhead is zero, conversion adds verbosity
   ```typescript
   // If called millions of times, extra verbosity might not be worth it
   function simpleTransform(lat: number, lon: number) { ... }
   ```

---

## Quick Start

### Installation (Already Available)

Branded types are already integrated into the Quiver codebase. Just import them:

```typescript
import {
  BrandedCoordinates,
  latitude,
  longitude,
  brandedCoordinates,
} from '@/lib/types/coordinates';
```

### Basic Usage

```typescript
import { latitude, longitude, brandedCoordinates } from '@/lib/types/coordinates';

// Create branded coordinates
const coords = brandedCoordinates(32.75, -117.25);
// Type: BrandedCoordinates

// Or create individually
const lat = latitude(32.75);
const lon = longitude(-117.25);
```

### Safe Construction (Non-Throwing)

```typescript
import { safeLat, safeLon, safeCoordinates } from '@/lib/types/coordinates';

// Returns null instead of throwing
const lat = safeLat(userInput);
if (!lat) {
  return { error: 'Invalid latitude' };
}

// Or validate both at once
const coords = safeCoordinates(req.body.lat, req.body.lon);
if (!coords) {
  return res.status(400).json({ error: 'Invalid coordinates' });
}
```

### Conversion Between Branded and Plain

```typescript
import { toBranded, fromBranded } from '@/lib/types/coordinates';

// Plain to branded
const plain: Coordinates = { lat: 32.75, lon: -117.25 };
const branded = toBranded(plain);

// Branded to plain
const backToPlain = fromBranded(branded);
```

---

## API Reference

### Type Constructors

#### `latitude(value: number): Latitude`

Creates a branded Latitude with validation.

```typescript
const lat = latitude(32.75); // ✅ Valid
const invalid = latitude(91); // ❌ Throws Error
```

**Throws:** Error if value is out of range (-90 to 90) or non-finite.

---

#### `longitude(value: number): Longitude`

Creates a branded Longitude with validation.

```typescript
const lon = longitude(-117.25); // ✅ Valid
const invalid = longitude(181); // ❌ Throws Error
```

**Throws:** Error if value is out of range (-180 to 180) or non-finite.

---

#### `brandedCoordinates(lat: number, lon: number): BrandedCoordinates`

Creates a branded coordinate pair with validation.

```typescript
const coords = brandedCoordinates(32.75, -117.25);
// Type: BrandedCoordinates
```

**Throws:** Error if either value is invalid.

---

### Safe Constructors (Non-Throwing)

#### `safeLat(value: unknown): Latitude | null`

Safely creates a branded Latitude, returning null on failure.

```typescript
const lat = safeLat(userInput);
if (!lat) {
  return { error: 'Invalid latitude' };
}
// lat is now Latitude type
```

---

#### `safeLon(value: unknown): Longitude | null`

Safely creates a branded Longitude, returning null on failure.

```typescript
const lon = safeLon(userInput);
if (!lon) {
  return { error: 'Invalid longitude' };
}
// lon is now Longitude type
```

---

#### `safeCoordinates(lat: unknown, lon: unknown): BrandedCoordinates | null`

Safely creates branded coordinates, returning null on failure.

```typescript
const coords = safeCoordinates(req.body.lat, req.body.lon);
if (!coords) {
  return res.status(400).json({ error: 'Invalid coordinates' });
}
// coords is now BrandedCoordinates type
```

---

### Conversion Functions

#### `toBranded(coords: Coordinates): BrandedCoordinates`

Converts plain coordinates to branded.

```typescript
const plain: Coordinates = { lat: 32.75, lon: -117.25 };
const branded = toBranded(plain);
```

**Throws:** Error if coordinates are invalid.

---

#### `fromBranded(coords: BrandedCoordinates): Coordinates`

Converts branded coordinates to plain.

```typescript
const branded: BrandedCoordinates = { ... };
const plain = fromBranded(branded);
```

---

#### `safeToBranded(coords: unknown): BrandedCoordinates | null`

Safely converts to branded, returning null on failure.

```typescript
const branded = safeToBranded(apiResponse.location);
if (!branded) {
  console.error('Invalid coordinates from API');
  return;
}
```

---

### Utility Functions

See `/lib/utils/branded-coordinate-utils.ts` for additional utilities:

- `calculateBrandedDistance()` - Distance between branded coordinates
- `toBrandedMapboxArray()` - Convert to Mapbox format
- `calculateBrandedBoundingBox()` - Calculate bounding box
- `validateAndBrandCoordinates()` - Validate API input
- `sortByDistance()` - Sort coordinates by distance
- And more...

---

## Migration Examples

### Example 1: API Endpoint Migration

**Before:**
```typescript
// app/api/beaches/nearby/route.ts
export async function POST(request: Request) {
  const { lat, lon } = await request.json();

  // No compile-time safety - could swap lat/lon
  const beaches = await findNearbyBeaches(lat, lon);

  return NextResponse.json(beaches);
}
```

**After:**
```typescript
import { validateAndBrandCoordinates } from '@/lib/utils/branded-coordinate-utils';

export async function POST(request: Request) {
  const body = await request.json();

  // Validate and brand in one step
  const result = validateAndBrandCoordinates(body);

  if (!result.valid) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  // result.coordinates is branded - compile-time safe
  const beaches = await findNearbyBeaches(result.coordinates);

  return NextResponse.json(beaches);
}
```

---

### Example 2: Distance Calculation Migration

**Before:**
```typescript
import { calculateDistance } from '@/lib/utils/distance-utils';

function getNearbyBeaches(userLat: number, userLon: number, beaches: Beach[]) {
  return beaches.filter(beach => {
    const distance = calculateDistance(
      { lat: userLat, lon: userLon },
      { lat: beach.lat, lon: beach.lon }
    );
    return distance <= 10;
  });
}
```

**After:**
```typescript
import { calculateBrandedDistance, brandedCoordinates } from '@/lib/utils/branded-coordinate-utils';
import type { BrandedCoordinates } from '@/lib/types/coordinates';

function getNearbyBeaches(
  userLocation: BrandedCoordinates,
  beaches: Array<{ coordinates: BrandedCoordinates }>
) {
  return beaches.filter(beach => {
    const distance = calculateBrandedDistance(userLocation, beach.coordinates);
    return distance <= 10;
  });
}
```

---

### Example 3: Database Query Migration

**Before:**
```typescript
async function findBeachesInBounds(
  north: number,
  south: number,
  east: number,
  west: number
) {
  const { data } = await supabase
    .from('beaches')
    .select('*')
    .gte('center_lat', south)
    .lte('center_lat', north)
    .gte('center_lng', west)
    .lte('center_lng', east);

  return data;
}
```

**After:**
```typescript
import type { BrandedBoundingBox } from '@/lib/utils/branded-coordinate-utils';

async function findBeachesInBounds(bbox: BrandedBoundingBox) {
  const { data } = await supabase
    .from('beaches')
    .select('*')
    .gte('center_lat', bbox.south as number)
    .lte('center_lat', bbox.north as number)
    .gte('center_lng', bbox.west as number)
    .lte('center_lng', bbox.east as number);

  return data;
}
```

---

### Example 4: React Hook Migration

**Before:**
```typescript
function useNearbyBeaches(lat: number, lon: number) {
  const [beaches, setBeaches] = useState<Beach[]>([]);

  useEffect(() => {
    fetchNearbyBeaches(lat, lon).then(setBeaches);
  }, [lat, lon]);

  return beaches;
}
```

**After:**
```typescript
import type { BrandedCoordinates } from '@/lib/types/coordinates';

function useNearbyBeaches(location: BrandedCoordinates) {
  const [beaches, setBeaches] = useState<Beach[]>([]);

  useEffect(() => {
    fetchNearbyBeaches(location).then(setBeaches);
  }, [location.lat, location.lon]);

  return beaches;
}
```

---

## Performance Considerations

### Zero Runtime Overhead

Branded types are **zero-cost abstractions**:

```typescript
// TypeScript (compile-time)
const lat: Latitude = latitude(32.75);
const lon: Longitude = longitude(-117.25);

// JavaScript (runtime) - brands are erased
const lat = 32.75;
const lon = -117.25;
```

The compiled JavaScript is identical to the non-branded version.

### Bundle Size Impact

Branded types add **zero bytes** to your production bundle. They exist only at compile time.

### Development Impact

- **Type checking:** No measurable impact on TypeScript compilation time
- **Autocomplete:** Better IDE autocomplete due to distinct types
- **Debugging:** Easier to catch bugs during development

---

## Limitations and Trade-offs

### 1. Brands Can't Be Verified at Runtime

Type guards can validate ranges but not brands:

```typescript
// Can validate range
if (isValidLatitudeValue(value)) { ... }

// Can't verify brand at runtime - brands are erased
// This is by design - brands are compile-time only
```

### 2. Increased Verbosity

Branded types require explicit construction:

```typescript
// Before: Concise but unsafe
setLocation(32.75, -117.25);

// After: More verbose but safe
setLocation(latitude(32.75), longitude(-117.25));
```

### 3. Mixed Codebase During Migration

During migration, you'll have both branded and non-branded code:

```typescript
// Old code (unbranded)
function oldFunction(lat: number, lon: number) { ... }

// New code (branded)
function newFunction(coords: BrandedCoordinates) { ... }

// Need to convert between them
const branded = brandedCoordinates(lat, lon);
newFunction(branded);
```

### 4. Third-Party Libraries Don't Use Brands

External libraries expect plain numbers:

```typescript
// External library expects plain numbers
import { externalAPI } from 'third-party-lib';

const coords: BrandedCoordinates = { ... };

// Need to convert
externalAPI.setLocation(
  coords.lat as number,
  coords.lon as number
);
```

---

## Best Practices

### 1. Brand at the Edges

Brand coordinates when they enter your system (API endpoints, user input):

```typescript
// ✅ Good: Brand at API boundary
export async function POST(request: Request) {
  const result = validateAndBrandCoordinates(await request.json());
  // Now branded throughout the call stack
}

// ❌ Less good: Brand in the middle of processing
function processBeaches(beaches: Beach[]) {
  const branded = beaches.map(b => toBranded(b.coordinates));
  // Extra conversion overhead
}
```

### 2. Use Safe Constructors for User Input

```typescript
// ✅ Good: Graceful error handling
const coords = safeCoordinates(req.body.lat, req.body.lon);
if (!coords) {
  return res.status(400).json({ error: 'Invalid coordinates' });
}

// ❌ Less good: Could throw error
const coords = brandedCoordinates(req.body.lat, req.body.lon);
// Throws if invalid - might crash the API
```

### 3. Store Branded Types in Interfaces

```typescript
// ✅ Good: Type safety at the interface level
interface Beach {
  id: string;
  name: string;
  location: BrandedCoordinates;
}

// ❌ Less good: Plain numbers still allow swaps
interface Beach {
  id: string;
  name: string;
  lat: number;
  lon: number;
}
```

### 4. Convert Only at Boundaries

```typescript
// ✅ Good: Keep branded throughout, convert only at external boundary
function processAndSave(coords: BrandedCoordinates) {
  // ... lots of processing ...

  // Convert only when calling external API
  await externalAPI.save({
    lat: coords.lat as number,
    lon: coords.lon as number,
  });
}

// ❌ Less good: Converting back and forth
function processAndSave(coords: BrandedCoordinates) {
  const plain = fromBranded(coords);
  // ... processing ...
  const branded = toBranded(plain);
  // Extra conversions
}
```

### 5. Document Why You're Using Brands

```typescript
/**
 * Fetches nearby beaches
 *
 * @param center - User's location (branded for swap prevention)
 * @param radius - Search radius in miles
 *
 * Uses branded coordinates to prevent accidentally swapping
 * latitude and longitude in database queries.
 */
async function fetchNearbyBeaches(
  center: BrandedCoordinates,
  radius: number
): Promise<Beach[]> {
  // ...
}
```

---

## Adoption Strategy

### Phase 1: Optional (Current)

- ✅ Branded types available but not required
- ✅ Use in new code where extra safety is desired
- ✅ Gradual migration of high-risk areas

### Phase 2: Incremental (Recommended)

1. **Identify high-risk areas** (use coordinate audit in `/docs/COORDINATE_AUDIT.md`)
2. **Migrate API endpoints first** - highest risk of coordinate swaps
3. **Migrate database queries** - prevent data integrity issues
4. **Migrate distance calculations** - prevent incorrect results
5. **Update documentation** - reflect branded type usage

### Phase 3: Strict (Long-term Goal)

- Consider making branded types the default
- Deprecate plain number coordinates in critical paths
- Update ESLint rules to encourage branded types

---

## Additional Resources

- **Type definitions:** `/lib/types/branded-coordinates.ts`
- **Utilities:** `/lib/utils/branded-coordinate-utils.ts`
- **Tests:** `/__tests__/lib/types/branded-coordinates.test.ts`
- **Coordinate conventions:** `/docs/COORDINATE_CONVENTIONS.md`
- **Coordinate audit:** `/docs/COORDINATE_AUDIT.md`

---

## FAQ

### Q: Will this slow down my application?

**A:** No. Branded types are zero-cost abstractions - they're erased at compile time and have no runtime overhead.

### Q: Do I need to migrate all existing code?

**A:** No. Branded types are optional. Start with high-risk areas (API endpoints, database queries) and migrate gradually.

### Q: Can I use branded types with Mapbox?

**A:** Yes. Use conversion utilities:
```typescript
const mapboxArray = toBrandedMapboxArray(brandedCoords);
const backToBranded = fromBrandedMapboxArray(mapboxArray);
```

### Q: What if I need to call a library that expects plain numbers?

**A:** Cast the branded type to a number:
```typescript
externalLib.setLocation(coords.lat as number, coords.lon as number);
```

### Q: How do I handle database responses?

**A:** Validate and brand when fetching:
```typescript
const { data } = await supabase.from('beaches').select('*');
const branded = data.map(beach => toBranded(beach.coordinates));
```

---

## Summary

Branded coordinates provide **compile-time safety** against coordinate swap bugs:

- ✅ **Zero runtime overhead** - pure compile-time feature
- ✅ **Catch bugs early** - prevents swaps during development
- ✅ **Backward compatible** - can be adopted gradually
- ✅ **Type-safe** - leverages TypeScript's type system
- ⚠️ **More verbose** - requires explicit construction
- ⚠️ **Can't verify at runtime** - brands are compile-time only

**Use branded types in high-risk areas** like API endpoints, database queries, and critical calculations to prevent coordinate swap bugs.
