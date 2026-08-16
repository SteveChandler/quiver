# Beach to SurfSpot Transformer

## Purpose

The `beach-to-surfspot-transformer` utility transforms `BeachWithMetrics` objects from the database into `SurfSpot` format for compatibility with map components and city pages.

This transformer is CRITICAL for coordinate mapping because:
- The database stores beaches with `lat` and `lon` coordinates
- The `SurfSpot` interface (used by map components) expects `coordinates.lon`
- Without proper transformation, map markers will appear in incorrect locations

## The Coordinate Problem

### Background

The Quiver codebase has evolved coordinate naming conventions:
- **Database**: Uses `lat` and `lon` (following PostGIS standards for new tables)
- **Legacy Database**: Uses `center_lat` and `center_lng` (older PostGIS naming)
- **Map Components**: Expect `SurfSpot` objects with `coordinates.lat` and `coordinates.lon`

### Critical Mapping

Both the database beach shape and the transformed `SurfSpot` shape use `lon`; no coordinate rename is required:

```typescript
// Database schema (BeachWithMetrics)
{
  lat: 32.7198,
  lon: -117.2557,  // Standard "lon" naming
  // ... other fields
}

// After transformation (SurfSpot)
{
  coordinates: {
    lat: 32.7198,
    lon: -117.2557  // Preserved as "lon" for map compatibility
  },
  // ... other fields
}
```

**Without this transformer**, direct usage of beach data would cause:
- Map markers to be positioned incorrectly
- Silent failures (coordinates appear valid but are wrong)
- Poor user experience with broken map features

## API Reference

### `transformBeachToSurfSpot(beach: BeachWithMetrics): SurfSpot`

Transforms a single beach object from database format to SurfSpot format.

**Parameters:**
- `beach: BeachWithMetrics` - Beach object from database with ranking metrics

**Returns:**
- `SurfSpot` - Transformed object compatible with map components

**Example:**
```typescript
import { transformBeachToSurfSpot } from '@/lib/utils/beach-to-surfspot-transformer';
import type { BeachWithMetrics } from '@/types/location';

const beach: BeachWithMetrics = {
  id: '123',
  slug: 'ocean-beach-san-diego-ca',
  name: 'Ocean Beach',
  lat: 32.7534,
  lon: -117.2511,
  city: 'San Diego',
  state: 'CA',
  country: 'USA',
  // ... other fields
};

const surfSpot = transformBeachToSurfSpot(beach);

// Now safe to use with map components
<CityMapView spots={[surfSpot]} />
```

**Field Mappings:**

| Database Field | SurfSpot Field | Transformation |
|----------------|----------------|----------------|
| `id` | `id` | Direct copy (preserves UUID for forecast lookups) |
| `slug` | `slug` | Direct copy |
| `name` | `name` | Direct copy |
| `lat` | `coordinates.lat` | Direct copy |
| `lon` | `coordinates.lon` | Direct copy |
| `city` | `citySlug` | Derived via `deriveCitySlug()` |
| `region` | `region` | Direct copy (fallback to `{city}, {state}`) |
| `description` | `overview` | Direct copy (fallback: "No description available.") |
| `best_conditions_prose` | `conditions` | Direct copy |
| `wave_tips` | `swellAdvice` | Direct copy |
| `hazards` | `hazards` | Direct copy |
| `skill_level` | `skillLevel` | Mapped via `mapSkillLevel()` |
| `best_months` | `bestSeason` | Direct copy |
| `crowd_level` | `crowdFactor` | Mapped via `mapCrowdFactor()` |
| `parking_tips` | `parking` | Direct copy (fallback to `access_tips`) |
| `features` | `amenities` | Direct copy |
| N/A | `history` | Empty string (not in database) |
| N/A | `tideAdvice` | Empty string (not in database) |
| N/A | `windAdvice` | Empty string (not in database) |
| N/A | `waterTemp` | Empty string (not in database) |
| N/A | `nearby` | Empty array (would require separate query) |
| N/A | `faq` | Empty array (not in database) |

**Derived Fields:**

1. **citySlug**: Derived from `city` name using `deriveCitySlug()`
   - Orange County cities → `"orange-county"`
   - San Diego metro cities → `"san-diego"`
   - Unknown cities → `"san-diego"` (default)

2. **intentTags**: Derived from beach properties via `deriveIntentTags()`
   - Beginner/longboard skill → includes `"beginner"`
   - Light/low crowd → includes `"least-crowded"`
   - Always includes: `"tide"`, `"water-temp"`

3. **beginnerNotes**: Only set for beginner-friendly beaches
   - If `skill_level` contains "beginner" → `"This spot is suitable for beginners."`
   - Otherwise → `undefined`

4. **speakableSummary**: Voice-friendly summary
   - Uses `description` if available
   - Fallback: `"{name} is a surf spot in {city}."`

### `transformBeachesToSurfSpots(beaches: BeachWithMetrics[]): SurfSpot[]`

Transforms an array of beaches to SurfSpot format.

**Parameters:**
- `beaches: BeachWithMetrics[]` - Array of beach objects from database

**Returns:**
- `SurfSpot[]` - Array of transformed objects

**Example:**
```typescript
import { transformBeachesToSurfSpots } from '@/lib/utils/beach-to-surfspot-transformer';

// From database query
const beaches: BeachWithMetrics[] = await getBeachesForCity('san-diego');

// Transform for map component
const surfSpots = transformBeachesToSurfSpots(beaches);

// Use with map
<CityMapView spots={surfSpots} />
```

**Preserves Order:**
```typescript
const beaches = [beachA, beachB, beachC];
const spots = transformBeachesToSurfSpots(beaches);

// spots[0] corresponds to beachA
// spots[1] corresponds to beachB
// spots[2] corresponds to beachC
```

### `validateBeachCoordinates(beach: BeachWithMetrics, context?: string): boolean`

Validates that a beach has valid coordinates before transformation.

**Parameters:**
- `beach: BeachWithMetrics` - Beach to validate
- `context?: string` - Context string for logging (default: "transformer")

**Returns:**
- `boolean` - `true` if coordinates are valid, `false` otherwise

**Validation Rules:**
- `lat` must not be null
- `lon` must not be null
- `lat` must not be NaN
- `lon` must not be NaN
- `lat` must be between -90 and 90 (inclusive)
- `lon` must be between -180 and 180 (inclusive)

**Development Warnings:**
In development mode, logs a warning to console if validation fails:

```typescript
import { validateBeachCoordinates } from '@/lib/utils/beach-to-surfspot-transformer';

const beach = await getBeachById('123');

if (!validateBeachCoordinates(beach, 'CityMapView')) {
  // Development warning logged:
  // [CityMapView] Invalid coordinates for beach "Ocean Beach": lat=null, lon=-117.2511

  // Handle the error
  return <ErrorMessage />;
}

// Safe to transform
const surfSpot = transformBeachToSurfSpot(beach);
```

**Usage in Production:**
Only logs warnings in development. In production, silently returns `true`/`false`:

```typescript
if (process.env.NODE_ENV === 'development') {
  validateBeachCoordinates(beach, 'MyComponent');
}
```

## Helper Functions

### `mapSkillLevel(dbSkillLevel: string | null): SurfSpot["skillLevel"]`

Internal function that maps database skill levels to SurfSpot enum values.

**Mappings:**
```typescript
// Database → SurfSpot
"beginner"      → "Beginner friendly"
"longboard"     → "Longboard friendly"
"advanced"      → "Advanced"
"expert"        → "Intermediate to expert"
"intermediate"  → "Intermediate"
null            → "Intermediate" (default)
```

**Case-insensitive and partial matching:**
```typescript
mapSkillLevel("BEGINNER") // → "Beginner friendly"
mapSkillLevel("Beginner to Intermediate") // → "Beginner friendly" (contains "beginner")
```

### `mapCrowdFactor(dbCrowdLevel: string | null): SurfSpot["crowdFactor"]`

Internal function that maps database crowd levels to SurfSpot enum values.

**Mappings:**
```typescript
// Database → SurfSpot
"light" / "low"     → "Light"
"heavy" / "high"    → "Heavy"
"moderate"          → "Moderate"
null                → "Moderate" (default)
```

### `deriveCitySlug(cityName: string | null): SurfCitySlug`

Internal function that derives the city slug for routing.

**City Mapping:**
```typescript
// Orange County cities
"Orange County"     → "orange-county"

// San Diego metro area
"San Diego"         → "san-diego"
"La Jolla"          → "san-diego"
"Pacific Beach"     → "san-diego"
"Ocean Beach"       → "san-diego"
"Coronado"          → "san-diego"
"Encinitas"         → "san-diego"
"Carlsbad"          → "san-diego"
"Del Mar"           → "san-diego"

// Default
null / unknown      → "san-diego"
```

### `deriveIntentTags(beach: BeachWithMetrics): SurfIntentSlug[]`

Internal function that derives intent tags from beach properties.

**Derivation Logic:**
```typescript
// Beginner intent
if (skill_level includes "beginner" OR "longboard") {
  tags.push("beginner");
}

// Less crowded intent
if (crowd_level includes "light" OR "low") {
  tags.push("least-crowded");
}

// Always include
tags.push("tide");
tags.push("water-temp");

return tags;
```

**Example Output:**
```typescript
// Beginner beach with light crowds
["beginner", "least-crowded", "tide", "water-temp"]

// Advanced beach with moderate crowds
["tide", "water-temp"]
```

## Usage Examples

### Example 1: City Page with Map

```typescript
// app/beaches/[country]/[state]/[city]/page.tsx
import { transformBeachesToSurfSpots } from '@/lib/utils/beach-to-surfspot-transformer';
import { CityMapView } from '@/components/city/city-map-view';
import { getLocationPageData } from '@/actions/beach/beach-location-list-actions';

export default async function LocationPage({ params }) {
  // Fetch beaches from database
  const response = await getLocationPageData(
    params.city,
    params.state,
    params.country
  );

  const { beaches } = response.data;

  // Transform for map component
  const surfSpots = transformBeachesToSurfSpots(beaches);

  return (
    <div>
      <h1>Surf Spots in {params.city}</h1>

      {/* Map component expects SurfSpot format */}
      <CityMapView
        spots={surfSpots}
        center={{ lat: 32.7157, lon: -117.1611 }}
        zoom={11}
      />
    </div>
  );
}
```

### Example 2: Single Beach Transformation

```typescript
import { transformBeachToSurfSpot } from '@/lib/utils/beach-to-surfspot-transformer';

async function getBeachForMap(beachId: string) {
  // Query database
  const beach = await supabase
    .from('beaches')
    .select('*')
    .eq('id', beachId)
    .single();

  // Transform to SurfSpot format
  const surfSpot = transformBeachToSurfSpot(beach.data);

  return surfSpot;
}
```

### Example 3: Validation Before Transformation

```typescript
import {
  transformBeachToSurfSpot,
  validateBeachCoordinates
} from '@/lib/utils/beach-to-surfspot-transformer';

function BeachMapMarker({ beach }: { beach: BeachWithMetrics }) {
  // Validate in development
  if (process.env.NODE_ENV === 'development') {
    if (!validateBeachCoordinates(beach, 'BeachMapMarker')) {
      console.error(`Cannot render marker for ${beach.name}: invalid coordinates`);
      return null;
    }
  }

  // Transform to SurfSpot
  const surfSpot = transformBeachToSurfSpot(beach);

  return <MapMarker coordinates={surfSpot.coordinates} />;
}
```

### Example 4: Filtering and Transforming

```typescript
import { transformBeachesToSurfSpots, validateBeachCoordinates } from '@/lib/utils/beach-to-surfspot-transformer';

async function getValidBeachesForMap(citySlug: string) {
  // Get all beaches
  const beaches = await getBeachesForCity(citySlug);

  // Filter out beaches with invalid coordinates
  const validBeaches = beaches.filter(beach =>
    validateBeachCoordinates(beach, 'getValidBeachesForMap')
  );

  // Transform to SurfSpot format
  const surfSpots = transformBeachesToSurfSpots(validBeaches);

  return surfSpots;
}
```

## Common Pitfalls

### Pitfall 1: Using Database Objects Directly with Map Components

**WRONG - Don't do this:**
```typescript
// ❌ WRONG: Map component expects coordinates.lon, but beach has lon
<CityMapView spots={beaches} />

// This will cause map markers to appear in wrong locations or fail to render
```

**CORRECT - Transform first:**
```typescript
// ✅ CORRECT: Transform to SurfSpot format
const surfSpots = transformBeachesToSurfSpots(beaches);
<CityMapView spots={surfSpots} />
```

### Pitfall 2: Assuming Coordinate Property Names Match

**WRONG:**
```typescript
// ❌ WRONG: Assumes beach coordinates use a different longitude key
const coordinates = {
  lat: beach.lat,
  lon: beach.longitude  // beach.longitude is undefined!
};
```

**CORRECT:**
```typescript
// ✅ CORRECT: Use the transformer, which preserves the canonical lon field
const surfSpot = transformBeachToSurfSpot(beach);
const coordinates = surfSpot.coordinates; // { lat, lon }
```

### Pitfall 3: Not Validating Coordinates

**WRONG:**
```typescript
// ❌ WRONG: Assumes coordinates are always valid
const surfSpot = transformBeachToSurfSpot(beach);
// What if beach.lat is null? Default coordinates will be used silently
```

**CORRECT:**
```typescript
// ✅ CORRECT: Validate before transforming
if (!validateBeachCoordinates(beach, 'MyComponent')) {
  return <ErrorMessage message="Invalid beach coordinates" />;
}

const surfSpot = transformBeachToSurfSpot(beach);
```

### Pitfall 4: Modifying Transformed Data

**WRONG:**
```typescript
// ❌ WRONG: Modifying the transformed object can break type safety
const surfSpot = transformBeachToSurfSpot(beach);
surfSpot.coordinates.lon = beach.lon; // Already done correctly by transformer!
```

**CORRECT:**
```typescript
// ✅ CORRECT: Trust the transformer
const surfSpot = transformBeachToSurfSpot(beach);
// Use as-is, transformation is already correct
```

### Pitfall 5: Forgetting Null Coordinate Fallbacks

The transformer provides San Diego default coordinates when beach coordinates are null:

```typescript
// If beach.lat or beach.lon is null:
const surfSpot = transformBeachToSurfSpot(beach);
console.log(surfSpot.coordinates);
// { lat: 32.7157, lon: -117.1611 } // San Diego center

// Always validate if you need to detect this:
if (!validateBeachCoordinates(beach)) {
  console.warn('Beach has null coordinates, using defaults');
}
```

## Type Definitions

### Input Type: `BeachWithMetrics`

```typescript
interface BeachWithMetrics extends Beach {
  // Required coordinate fields
  lat: number;
  lon: number;

  // Basic fields
  id: string;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  country: string | null;
  region: string | null;

  // Content fields
  description: string | null;
  best_conditions_prose: string | null;
  wave_tips: string | null;
  hazards: string[] | null;
  skill_level: string | null;
  best_months: string | null;
  crowd_level: string | null;
  parking_tips: string | null;
  access_tips: string | null;
  features: string[] | null;

  // Ranking metrics
  composite_score: number;
  recent_intel_count: number;
  avg_confirmations: number;
  rank?: number;
}
```

### Output Type: `SurfSpot`

```typescript
interface SurfSpot {
  // Identity
  id: string;
  slug: string;
  name: string;
  citySlug: SurfCitySlug;
  region: string;

  // Coordinates use the canonical lat/lon shape
  coordinates: {
    lat: number;
    lon: number;
  };

  // Content
  overview: string;
  history: string;
  conditions: string;
  tideAdvice: string;
  swellAdvice: string;
  windAdvice: string;
  waterTemp: string;

  // Safety and skill
  hazards: string[];
  skillLevel: "Beginner friendly" | "Longboard friendly" | "Intermediate" | "Advanced" | "Intermediate to expert";
  bestSeason: string;
  crowdFactor: "Light" | "Moderate" | "Heavy";

  // Access
  parking: string;
  amenities: string[];
  nearby: string[];

  // Metadata
  faq: Array<{ question: string; answer: string }>;
  speakableSummary: string;
  intentTags: SurfIntentSlug[];
  beginnerNotes?: string;
}
```

## Validation Details

### Coordinate Validation Rules

The `validateBeachCoordinates` function applies these checks:

1. **Null Check**:
   ```typescript
   beach.lat !== null && beach.lon !== null
   ```

2. **NaN Check**:
   ```typescript
   !isNaN(beach.lat) && !isNaN(beach.lon)
   ```

3. **Latitude Range**:
   ```typescript
   beach.lat >= -90 && beach.lat <= 90
   ```
   - Valid: `-90` to `90` (inclusive)
   - Invalid: `-91`, `100`, etc.

4. **Longitude Range**:
   ```typescript
   beach.lon >= -180 && beach.lon <= 180
   ```
   - Valid: `-180` to `180` (inclusive)
   - Invalid: `-200`, `185`, etc.

### Edge Cases

**Valid Edge Cases:**
```typescript
// Equator
{ lat: 0, lon: 0 } // ✅ Valid

// North Pole
{ lat: 90, lon: 0 } // ✅ Valid

// South Pole
{ lat: -90, lon: 0 } // ✅ Valid

// International Date Line
{ lat: 0, lon: 180 } // ✅ Valid
{ lat: 0, lon: -180 } // ✅ Valid

// Hawaii (far west)
{ lat: 21.3069, lon: -157.8583 } // ✅ Valid
```

**Invalid Cases:**
```typescript
// Out of range
{ lat: 95, lon: 0 } // ❌ Invalid (lat > 90)
{ lat: 0, lon: 200 } // ❌ Invalid (lon > 180)

// Null values
{ lat: null, lon: -117.1611 } // ❌ Invalid

// NaN values
{ lat: NaN, lon: -117.1611 } // ❌ Invalid
```

## Default Values

When required fields are missing or null, the transformer provides sensible defaults:

### Coordinate Defaults (San Diego Center)
```typescript
const lat = beach.lat ?? 32.7157;
const lon = beach.lon ?? -117.1611;
```

### Content Defaults
```typescript
overview: beach.description ?? "No description available."
region: beach.region ?? `${beach.city ?? "Unknown"}, ${beach.state ?? "CA"}`
speakableSummary: beach.description ?? `${beach.name} is a surf spot in ${beach.city ?? "California"}.`
```

### Enum Defaults
```typescript
skillLevel: mapSkillLevel(beach.skill_level) // Default: "Intermediate"
crowdFactor: mapCrowdFactor(beach.crowd_level) // Default: "Moderate"
citySlug: deriveCitySlug(beach.city) // Default: "san-diego"
```

### Empty Defaults
```typescript
history: ""
tideAdvice: ""
windAdvice: ""
waterTemp: ""
nearby: []
faq: []
```

## Related Files

### Source Files
- `/lib/utils/beach-to-surfspot-transformer.ts` - Transformer implementation
- `/types/location.ts` - Type definitions for `BeachWithMetrics`
- `/lib/data/surf-spots.ts` - Type definitions for `SurfSpot` and related enums

### Components Using This Transformer
- `/components/city/city-map-view.tsx` - Map component requiring SurfSpot format
- `/app/beaches/[country]/[state]/[city]/page.tsx` - Location listing page

### Related Utilities
- `/lib/coordinate-validation.ts` - General coordinate validation utilities
- `/lib/utils/beach-url-utils.ts` - Beach URL generation utilities
- `/lib/utils/location-slug.ts` - Location slug generation

### Tests
- `/__tests__/lib/utils/beach-to-surfspot-transformer.test.ts` - Comprehensive test suite
- `/__tests__/fixtures/beach-data.ts` - Test fixtures for beach data

### Documentation
- `/docs/COORDINATE_CONVENTIONS.md` - Complete coordinate naming standards guide
- `/docs/architecture/URL_ROUTING.md` - URL routing patterns and slug conventions
- `/components/ARCHITECTURE.md` - Component architecture patterns

## Testing

The transformer has comprehensive test coverage (>95%). See test file for full suite.

### Key Test Areas

1. **Coordinate Transformation** (CRITICAL)
   - Preserve the canonical `lon` field through the transformation
   - Null coordinate defaults
   - Precision preservation
   - Hemisphere handling
   - Edge case validation

2. **Skill Level Mapping**
   - All enum values
   - Case-insensitivity
   - Partial matching
   - Null defaults

3. **Crowd Factor Mapping**
   - All enum values
   - Case-insensitivity
   - Null defaults

4. **City Slug Derivation**
   - Orange County cities
   - San Diego metro area
   - Default fallback
   - Case-insensitivity

5. **Intent Tag Generation**
   - Beginner detection
   - Crowd level detection
   - Always-included tags

6. **Validation**
   - Range checking
   - Null detection
   - NaN detection
   - Development warnings

### Running Tests

```bash
# Run all transformer tests
yarn test __tests__/lib/utils/beach-to-surfspot-transformer.test.ts

# Run in watch mode
yarn test --watch beach-to-surfspot-transformer

# Run with coverage
yarn test --coverage beach-to-surfspot-transformer
```

## Best Practices

1. **Always Transform Before Using with Maps**
   - Never pass raw database objects to map components
   - Always use `transformBeachToSurfSpot` or `transformBeachesToSurfSpots`

2. **Validate in Development**
   - Use `validateBeachCoordinates` in development mode
   - Catch coordinate issues early before they cause map bugs

3. **Handle Validation Failures**
   - Don't assume all beaches have valid coordinates
   - Provide fallback UI for invalid beaches

4. **Trust the Transformer**
   - Don't modify transformed objects
   - The transformer handles all necessary mappings correctly

5. **Use Type Safety**
   - TypeScript ensures correct types
   - Let the compiler catch mapping errors

6. **Test After Database Changes**
   - If beach schema changes, update transformer
   - Run test suite to verify mappings still work

## Performance Considerations

The transformer is lightweight and performant:

```typescript
// Batch transformation is efficient
const beaches = await getBeaches(); // e.g., 50 beaches
const surfSpots = transformBeachesToSurfSpots(beaches); // ~0.5ms

// Single transformation is near-instant
const surfSpot = transformBeachToSurfSpot(beach); // ~0.01ms
```

**No caching needed** - transformation is so fast that caching adds unnecessary complexity.

## Future Enhancements

Potential improvements to consider:

1. **Database Field Alignment**
   - Standardize database to use `longitude` instead of `lon`
   - Keep map-facing coordinate types aligned with the canonical lon field
   - Requires database migration

2. **Additional Intent Tags**
   - Derive more intent tags from beach properties
   - Examples: wind direction preferences, swell size preferences

3. **Richer Content Mapping**
   - Map more database fields to SurfSpot format
   - Add tide advice, wind advice, water temp from new database fields

4. **Validation Levels**
   - Add strict vs. lenient validation modes
   - Support different validation requirements

5. **City Slug Expansion**
   - Support more cities and metro areas
   - Make city slug mapping configurable

## Changelog

### 2025-12-03
- Initial implementation for San Diego page redesign
- Preserves the canonical lon coordinate through the map transformation
- Comprehensive test suite with >95% coverage
- Documentation created

## Summary

The Beach to SurfSpot Transformer is a critical utility that:

1. **Transforms** database beach objects to map-compatible SurfSpot format
2. **Preserves** coordinate naming as `lat`/`lon` for map components
3. **Validates** coordinates to prevent map rendering bugs
4. **Derives** city slugs, intent tags, and other metadata
5. **Provides** sensible defaults for missing data

**Golden Rule**: Always use this transformer when passing beach data to map components. Direct usage of database objects will cause coordinate mapping bugs.

## Related Documentation

- [Coordinate Naming Conventions](/docs/COORDINATE_CONVENTIONS.md) - Complete coordinate standards guide
- [Component Architecture](/components/ARCHITECTURE.md) - Component patterns and structure
- [URL Routing](/docs/architecture/URL_ROUTING.md) - URL routing and slug conventions
- [Testing Guidelines](/e2e/ARCHITECTURE.md) - E2E testing patterns

## Support

For questions or issues with the transformer:
1. Check test suite for usage examples
2. Review coordinate conventions documentation
3. Validate coordinate data before transformation
4. Consult component architecture docs for integration patterns
