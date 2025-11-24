# Coordinate Type System

This directory contains centralized type definitions and utilities for handling geographic coordinates throughout the Quiver application.

## Quick Start

```typescript
import type { Coordinates } from '@/lib/types/coordinates';
import { calculateDistance } from '@/lib/utils/distance-utils';
import { fromDatabaseCoordinates, toMapboxCoordinates } from '@/lib/utils/coordinate-transforms';

// Using the standardized Coordinates type
const oceanBeach: Coordinates = { lat: 32.75, lon: -117.25 };
const pacificBeach: Coordinates = { lat: 32.80, lon: -117.24 };

// Calculate distance
const distance = calculateDistance(oceanBeach, pacificBeach, 'miles');
console.log(`${distance.toFixed(1)} miles`); // "3.5 miles"

// Transform to Mapbox format (for map rendering)
const mapboxCoords = toMapboxCoordinates(oceanBeach);
console.log(mapboxCoords); // [-117.25, 32.75] - longitude first!
```

## Core Types

### `Coordinates`
The primary coordinate type used throughout the application.

```typescript
interface Coordinates {
  lat: number;  // Latitude
  lon: number;  // Longitude (NOT 'lng')
}
```

**When to use**: 99% of the time. This is the standard format.

**Examples**:
- User location from geolocation API
- Beach coordinates in UI components
- Distance calculations
- Database queries (after transformation)

### `CoordinatesVerbose`
Explicit long-form coordinates.

```typescript
interface CoordinatesVerbose {
  latitude: number;
  longitude: number;
}
```

**When to use**:
- External API integration that requires verbose naming
- Documentation/examples where clarity is important
- Converting from verbose to standard format

### `MapboxCoordinates`
Mapbox-specific coordinate format (longitude first!).

```typescript
type MapboxCoordinates = [longitude: number, latitude: number];
```

**When to use**:
- Interfacing with Mapbox GL JS API
- Setting map center: `map.setCenter([lon, lat])`
- Creating LngLat objects

**⚠️ WARNING**: Mapbox uses [lon, lat] order (longitude first), which is opposite of `[lat, lon]`!

### `DatabaseCoordinates`
Legacy database format from PostGIS functions.

```typescript
interface DatabaseCoordinates {
  center_lat: number;
  center_lng: number;  // Uses 'lng' due to legacy naming
}
```

**When to use**:
- Reading from PostGIS function results
- Database migration scripts
- Interfacing with legacy stored procedures

## Transformation Utilities

All transformation functions are in `/lib/utils/coordinate-transforms.ts`.

### Database Transformations

```typescript
// FROM database TO app format
const beach = await getBeachFromDB(); // { center_lat: 32.75, center_lng: -117.25 }
const coords = fromDatabaseCoordinates(beach); // { lat: 32.75, lon: -117.25 }

// FROM app TO database format
const coords: Coordinates = { lat: 32.75, lon: -117.25 };
const dbCoords = toDatabaseCoordinates(coords); // { center_lat: 32.75, center_lng: -117.25 }
```

### Mapbox Transformations

```typescript
// TO Mapbox array format [lng, lat]
const coords: Coordinates = { lat: 32.75, lon: -117.25 };
const mapboxArray = toMapboxCoordinates(coords); // [-117.25, 32.75]

// FROM Mapbox LngLat object
const lngLat = map.getCenter(); // { lng: -117.25, lat: 32.75 }
const coords = fromMapboxLngLat(lngLat); // { lat: 32.75, lon: -117.25 }

// TO Mapbox LngLat object
const coords: Coordinates = { lat: 32.75, lon: -117.25 };
const lngLat = toMapboxLngLat(coords); // { lng: -117.25, lat: 32.75 }
```

### Verbose Transformations

```typescript
// FROM verbose TO standard
const verbose: CoordinatesVerbose = { latitude: 32.75, longitude: -117.25 };
const coords = fromVerboseCoordinates(verbose); // { lat: 32.75, lon: -117.25 }

// FROM standard TO verbose
const coords: Coordinates = { lat: 32.75, lon: -117.25 };
const verbose = toVerboseCoordinates(coords); // { latitude: 32.75, longitude: -117.25 }
```

### Legacy Transformations (Deprecated)

For migrating old code that uses `lng` instead of `lon`:

```typescript
// FROM legacy { lat, lng } TO standard { lat, lon }
const legacy = { lat: 32.75, lng: -117.25 }; // Old format
const coords = fromLegacyLngLat(legacy); // { lat: 32.75, lon: -117.25 }

// TO legacy format (avoid when possible)
const coords: Coordinates = { lat: 32.75, lon: -117.25 };
const legacy = toLegacyLngLat(coords); // { lat: 32.75, lng: -117.25 }
```

## Distance Calculations

Distance utilities in `/lib/utils/distance-utils.ts` now use the `Coordinates` type.

```typescript
import { calculateDistance, calculateDistanceFormatted } from '@/lib/utils/distance-utils';

const from: Coordinates = { lat: 32.75, lon: -117.25 };
const to: Coordinates = { lat: 32.80, lon: -117.24 };

// Calculate distance
const miles = calculateDistance(from, to, 'miles'); // 3.5
const km = calculateDistance(from, to, 'km'); // 5.6
const meters = calculateDistance(from, to, 'meters'); // 5600

// Get formatted string
const formatted = calculateDistanceFormatted(from, to, 'miles'); // "3.5 miles"
```

### Legacy Distance Functions

For backward compatibility:

```typescript
import { calculateDistanceLegacy } from '@/lib/utils/distance-utils';

// Old signature (uses lng parameter name)
const distance = calculateDistanceLegacy(32.75, -117.25, 32.80, -117.24, 'miles');
```

## Type Guards

Use type guards to safely check coordinate formats at runtime:

```typescript
import { isCoordinates, isCoordinatesVerbose, isLegacyLngLatFormat } from '@/lib/types/coordinates';

// Check for Coordinates
const maybeCoords = { lat: 32.75, lon: -117.25 };
if (isCoordinates(maybeCoords)) {
  // TypeScript knows this is Coordinates
  const distance = calculateDistance(maybeCoords, otherCoords);
}

// Check for verbose format
const maybeVerbose = { latitude: 32.75, longitude: -117.25 };
if (isCoordinatesVerbose(maybeVerbose)) {
  const coords = fromVerboseCoordinates(maybeVerbose);
}

// Detect legacy format (for migration)
const oldFormat = { lat: 32.75, lng: -117.25 };
if (isLegacyLngLatFormat(oldFormat)) {
  const newFormat = fromLegacyLngLat(oldFormat);
}
```

## Naming Convention

**✅ CORRECT**: Use `lon` (longitude)

```typescript
const coords: Coordinates = { lat: 32.75, lon: -117.25 };
```

**❌ WRONG**: Don't use `lng` in new code

```typescript
// Don't do this:
const coords = { lat: 32.75, lng: -117.25 }; // ❌ Wrong
```

**Exception**: Mapbox APIs use `LngLat` (third-party convention we must follow)

```typescript
// This is OK because it's Mapbox's API:
const lngLat = new mapboxgl.LngLat(-117.25, 32.75); // ✅ Acceptable
```

## Migration Guide

### Migrating `useGeolocation` Hook Usage

**Before:**
```typescript
const { userLocation } = useGeolocation();
// userLocation was { lat: number; lng: number } ❌
const distance = calculateDistance(
  userLocation.lat,
  userLocation.lng,  // ❌ Wrong property name
  beach.lat,
  beach.lon
);
```

**After:**
```typescript
const { userLocation } = useGeolocation();
// userLocation is now Coordinates: { lat: number; lon: number } ✅
const distance = calculateDistance(userLocation, beach, 'miles'); // ✅ Correct
```

### Migrating Distance Calculations

**Before:**
```typescript
const distance = calculateDistance(lat1, lng1, lat2, lng2, 'miles'); // ❌ Old signature
```

**After:**
```typescript
const from: Coordinates = { lat: lat1, lon: lon1 };
const to: Coordinates = { lat: lat2, lon: lon2 };
const distance = calculateDistance(from, to, 'miles'); // ✅ New signature
```

Or use the legacy function during transition:
```typescript
const distance = calculateDistanceLegacy(lat1, lng1, lat2, lng2, 'miles'); // ⚠️ Deprecated
```

### Migrating Database Queries

**Before:**
```typescript
const beach = await db.query('...');
// Directly used center_lat and center_lng ❌
const coords = { lat: beach.center_lat, lon: beach.center_lng };
```

**After:**
```typescript
import { fromDatabaseCoordinates } from '@/lib/utils/coordinate-transforms';

const beach = await db.query('...');
const coords = fromDatabaseCoordinates(beach); // ✅ Centralized transform
```

## Common Patterns

### Fetching and Displaying Beach Coordinates

```typescript
import type { Coordinates } from '@/lib/types/coordinates';
import { fromDatabaseCoordinates } from '@/lib/utils/coordinate-transforms';
import { toMapboxCoordinates } from '@/lib/utils/coordinate-transforms';

// 1. Fetch from database
const beach = await getBeachFromDB(beachId);

// 2. Transform database format to app format
const coords: Coordinates = fromDatabaseCoordinates(beach);

// 3. Use in distance calculations
const userLocation = await getUserLocation();
const distance = calculateDistance(userLocation, coords, 'miles');

// 4. Display on Mapbox map
const mapboxCoords = toMapboxCoordinates(coords);
map.setCenter(mapboxCoords); // [lon, lat] order
```

### User Location with Geolocation

```typescript
import { useGeolocation } from '@/hooks/use-geolocation';
import type { Coordinates } from '@/lib/types/coordinates';

function MyComponent() {
  const { userLocation } = useGeolocation();

  // userLocation is Coordinates | null
  if (!userLocation) return <div>Getting location...</div>;

  // TypeScript knows userLocation has { lat, lon }
  return <div>You are at {userLocation.lat}, {userLocation.lon}</div>;
}
```

## Architecture Documentation

For detailed architecture and conventions, see:
- `/docs/COORDINATE_CONVENTIONS.md` - Comprehensive coordinate naming conventions
- `/lib/coordinate-validation.ts` - Runtime coordinate validation utilities

## FAQs

**Q: Why `lon` instead of `lng`?**
A: `lon` is the standard abbreviation for longitude in geographic/cartographic contexts. It matches our `BeachCoordinates` type and database conventions.

**Q: When should I use verbose coordinates?**
A: Only when integrating with external APIs that require full property names or for documentation clarity.

**Q: How do I handle Mapbox's [lng, lat] order?**
A: Always use `toMapboxCoordinates()` and `fromMapboxLngLat()` transformation functions. Never manually swap the order.

**Q: What if I encounter legacy `lng` usage?**
A: Use `fromLegacyLngLat()` to convert, then update the source to use `Coordinates` type.

**Q: Are coordinate transformations expensive?**
A: No, they're simple object property mappings with zero computational overhead.

## Related Files

- `/lib/types/coordinates.ts` - Core type definitions
- `/lib/types/index.ts` - Type exports (barrel file)
- `/lib/utils/coordinate-transforms.ts` - Transformation utilities
- `/lib/utils/distance-utils.ts` - Distance calculation utilities
- `/lib/coordinate-validation.ts` - Runtime validation
- `/hooks/use-geolocation.ts` - Geolocation hook (uses Coordinates)
- `/types/beach-core.ts` - Beach types (re-exports Coordinates as BeachCoordinates)
