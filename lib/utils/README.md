# Utility Library

This directory contains reusable utility functions organized by domain. Import utilities directly from their respective files.

## Quick Reference

### Unit Conversions

**File:** `unit-conversions.ts`

```typescript
import {
  metersToFeet, feetToMeters,
  msToKnots, knotsToMs, msToMph, mphToMs, kmhToKnots,
  celsiusToFahrenheit, fahrenheitToCelsius,
  degreesToCardinal, cardinalToDegrees,
  formatWaveHeight, formatWindSpeed
} from "@/lib/utils/unit-conversions";

metersToFeet(1.83)           // 6.0
msToKnots(5.14)              // 10
degreesToCardinal(45)        // "NE"
formatWaveHeight(3, 5)       // "3-5 ft"
```

### Date & Time

**File:** `date-time.ts` (canonical — absorbs date-formatting, date-utils, time-formatting, time-formatters)

```typescript
import { formatDate, formatForecastTime, formatTimeInTimezone, formatTimeAgo } from "@/lib/utils/date-time";
```

**File:** `timezone-utils.ts`

```typescript
import { getBeachTimezone, convertToLocalTime } from "@/lib/utils/timezone-utils";
```

### Forecast Utilities

| File | Purpose |
|------|---------|
| `forecast-client-utils.ts` | Client-side forecast helpers |
| `forecast-server-utils.ts` | Server-side forecast helpers |
| `forecast-data-utils.ts` | Data transformation utilities |
| `forecast-service-utils.ts` | Service layer helpers |
| `forecast-freshness.ts` | Stale forecast detection |
| `forecast-snapshot-utils.ts` | Forecast snapshot handling |
| `forecast-analytics.ts` | Analytics tracking |
| `current-forecast-utils.ts` | Current conditions helpers |

### Tide & Wave Analysis

| File | Purpose |
|------|---------|
| `tide-window.ts` | Tide window calculations |
| `tide-interpolation.ts` | Tide data interpolation |
| `tide-diagnostics-generator.ts` | NOAA tide diagnostics |
| `wave-height-formatter.ts` | Wave height display |

### Wind & Direction

| File | Purpose |
|------|---------|
| `wind-direction.ts` | Wind direction utilities |
| `direction-utils.ts` | General direction helpers |

### Beach & Location

| File | Purpose |
|------|---------|
| `beach-url-utils.ts` | Beach URL generation |
| `beach-search-utils.ts` | Beach search/filtering |
| `beach-card-utils.ts` | Beach card data prep |
| `beach-conditions-utils.ts` | Conditions formatting |
| `beach-to-surfspot-transformer.ts` | Type transformations |
| `location-slug.ts` | Location slug utilities |
| `distance-utils.ts` | Distance calculations |
| `coordinate-parser.ts` | Coordinate parsing |
| `branded-coordinate-utils.ts` | Type-safe coordinates |

### Scoring & Recommendations

| File | Purpose |
|------|---------|
| `score-utils.ts` | General scoring utilities |
| `recommendation-scorer.ts` | Recommendation scoring |
| `morning-intel-utils.ts` | Morning intel helpers |

### Text & Formatting

| File | Purpose |
|------|---------|
| `text-utils.ts` | General text utilities |
| `text-normalization.ts` | Text normalization |
| `rating-formatters.ts` | Rating display |

### Performance & Caching

| File | Purpose |
|------|---------|
| `request-cache.ts` | Request caching |
| `cache-headers.ts` | HTTP cache headers |
| `rate-limiter.ts` | Basic rate limiting |
| `enhanced-rate-limiter.ts` | Advanced rate limiting |
| `debounce.ts` | Debounce utilities |
| `performance-utils.ts` | Performance helpers |

### API & Network

| File | Purpose |
|------|---------|
| `fetch-utils.ts` | Fetch wrappers |
| `api-retry.ts` | Retry logic |

### User Interface

| File | Purpose |
|------|---------|
| `toast-utils.ts` | Toast notifications |
| `navigation-utils.ts` | Navigation helpers |
| `map-utilities.ts` | Map helpers |
| `image-utils.ts` | Image utilities |

### Session & Profile

| File | Purpose |
|------|---------|
| `session-utils.ts` | Session helpers |
| `session-wizard-params.ts` | Session wizard state |
| `profile-form-utils.ts` | Profile form helpers |

### Data Processing

| File | Purpose |
|------|---------|
| `intel-dedupe.ts` | Intel deduplication |
| `spot-data-transformer.ts` | Spot data transforms |

## Conventions

### Null Safety

All conversion functions handle null/undefined gracefully:

```typescript
metersToFeet(null)  // null
msToKnots(undefined)  // null
```

### Precision

Numeric functions accept optional precision parameters:

```typescript
metersToFeet(1.8288, 2)  // 6.00
metersToFeet(1.8288)     // 6.0 (default: 1 decimal)
```

### Deprecated Aliases

Some functions have deprecated aliases for backward compatibility:

```typescript
// Deprecated - use metersToFeet instead
mToFt(meters)

// Deprecated - use msToKnots instead
msToKts(speed)
```

## Testing

Unit tests are located in `__tests__/lib/utils/`. Run tests with:

```bash
yarn test:unit --testPathPattern="lib/utils"
```
