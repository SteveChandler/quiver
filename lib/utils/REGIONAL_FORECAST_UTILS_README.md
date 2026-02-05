# Regional Forecast Utilities

Utilities for aggregating forecast data across multiple beaches within a region to provide comprehensive 7-day regional forecasts.

## Location

`lib/utils/regional-forecast-utils.ts`

## Overview

This module provides functions to:
- Filter beaches by geographic region
- Calculate daily condition scores
- Detect upcoming swell events
- Aggregate regional forecast summaries
- Rank beaches by conditions
- Identify trends

## Core Types

### `DaySummary`

Summary of forecast conditions for a single day across a region.

```typescript
interface DaySummary {
  date: Date;
  dateString: string;         // "2024-01-15"
  dayOfWeek: string;          // "Monday"
  score: number;              // 0-100 aggregate score
  avgWaveHeight: number;      // Average wave height (feet)
  waveRange: [number, number]; // [min, max] wave height
  dominantWindDirection: string;
  windConditions: 'offshore' | 'light' | 'onshore';
  bestTimeSlot: 'dawn-patrol' | 'morning' | 'midday' | 'afternoon' | 'evening';
  topBeaches: Array<{
    id: string;
    name: string;
    slug: string;
    score: number;
    waveHeight: number;
  }>;
  beachesWithGoodConditions: number; // Count of beaches with score > 60
}
```

### `SwellEvent`

Detected swell event with timing and characteristics.

```typescript
interface SwellEvent {
  startDate: Date;
  peakDate: Date;
  endDate: Date;
  direction: string;          // "NW", "SW", "S"
  period: number;             // seconds
  heightRange: [number, number]; // [min, max] feet
  size: string;               // 'knee-high', 'waist-high', etc.
  description: string;        // Human-readable summary
}
```

### `BeachConditionSummary`

Individual beach condition summary within a region.

```typescript
interface BeachConditionSummary {
  beachId: string;
  beachName: string;
  beachSlug: string;
  currentScore: number;
  currentWaveHeight: number;
  trend: 'improving' | 'steady' | 'declining';
  bestDay: string;            // Day name
  bestDayScore: number;
}
```

### `RegionalForecastSummary`

Complete regional forecast with 7-day outlook.

```typescript
interface RegionalForecastSummary {
  region: ForecastRegion;
  generatedAt: Date;
  days: DaySummary[];         // 7 days
  bestDay: DaySummary;
  upcomingSwells: SwellEvent[];
  beachConditions: BeachConditionSummary[];
  stats: {
    totalBeaches: number;
    beachesWithData: number;
    avgRegionScore: number;
  };
}
```

## Functions

### `getBeachesForRegion(region, allBeaches)`

Filter beaches by region's geographic criteria (state and optional cities).

**Parameters:**
- `region: ForecastRegion` - The forecast region
- `allBeaches: Beach[]` - Array of all beaches

**Returns:** `Beach[]` - Filtered beaches matching region

**Example:**
```typescript
import { FORECAST_REGIONS } from '@/lib/data/forecast-regions';
import { getBeachesForRegion } from '@/lib/utils/regional-forecast-utils';

const sdRegion = FORECAST_REGIONS['san-diego'];
const sdBeaches = getBeachesForRegion(sdRegion, allBeaches);
// Returns beaches in San Diego, Imperial Beach, Oceanside, etc.
```

### `calculateDayScore(forecasts, beach)`

Calculate aggregate score (0-100) for a day based on conditions.

**Scoring Factors:**
- Wave height: 3-6ft ideal (40 points max)
- Wind direction: Offshore +25, light +15, onshore 0
- Swell period: Longer periods better (+2 per second over 10s)
- Confidence: Higher confidence adds bonus points

**Parameters:**
- `forecasts: EnhancedForecastEntity[]` - Forecasts for the day
- `beach: Beach` - The beach being scored

**Returns:** `number` - Score from 0-100

**Example:**
```typescript
const score = calculateDayScore(dayForecasts, beach);
// Returns: 85 (excellent conditions)
```

### `detectSwellEvents(forecastMap)`

Detect upcoming swell events from forecast data.

Identifies significant wave height increases (>40% jump) and tracks swell direction changes.

**Parameters:**
- `forecastMap: Map<string, EnhancedForecastEntity[]>` - Map of beach IDs to forecasts

**Returns:** `SwellEvent[]` - Array of detected swell events

**Example:**
```typescript
const swells = detectSwellEvents(forecastsByBeachId);
// Returns: [
//   {
//     startDate: Date(2024-01-16),
//     peakDate: Date(2024-01-17),
//     direction: "NW",
//     period: 14,
//     size: "head-high",
//     description: "head-high NW swell with 14s period"
//   }
// ]
```

### `aggregateRegionalForecast(region, beaches, forecastMap)`

Main aggregation function to create comprehensive regional forecast summary.

**Parameters:**
- `region: ForecastRegion` - The forecast region
- `beaches: Beach[]` - Beaches in the region
- `forecastMap: Map<string, EnhancedForecastEntity[]>` - Map of beach IDs to forecasts

**Returns:** `RegionalForecastSummary` - Complete regional forecast

**Example:**
```typescript
import { FORECAST_REGIONS } from '@/lib/data/forecast-regions';
import { aggregateRegionalForecast } from '@/lib/utils/regional-forecast-utils';
import { getBatchFreshForecastsFromCache } from '@/lib/utils/forecast-service-utils';

// 1. Get region and beaches
const region = FORECAST_REGIONS['southern-california'];
const beaches = getBeachesForRegion(region, allBeaches);

// 2. Fetch forecasts for all beaches
const beachIds = beaches.map(b => b.id);
const forecastResults = await getBatchFreshForecastsFromCache(beachIds, 168); // 7 days

// 3. Build forecast map (only include beaches with data)
const forecastMap = new Map();
for (const [beachId, result] of forecastResults.entries()) {
  if (result.forecasts.length > 0 && !result.metadata.stale) {
    forecastMap.set(beachId, result.forecasts);
  }
}

// 4. Aggregate regional forecast
const summary = aggregateRegionalForecast(region, beaches, forecastMap);

// Use the summary
console.log(`Best day: ${summary.bestDay.dayOfWeek} with score ${summary.bestDay.score}`);
console.log(`Upcoming swells: ${summary.upcomingSwells.length}`);
console.log(`Top beach: ${summary.days[0].topBeaches[0].name}`);
```

## Wave Size Descriptions

| Height Range | Description |
|-------------|-------------|
| < 2ft       | knee-high   |
| 2-3ft       | waist-high  |
| 3-5ft       | chest-high  |
| 5-7ft       | head-high   |
| 7-10ft      | overhead    |
| > 10ft      | double-overhead |

## Usage in API Routes

**Example: Regional Forecast API Route**

```typescript
// app/api/forecast/[region]/route.ts
import { NextResponse } from 'next/server';
import { FORECAST_REGIONS, getForecastRegion } from '@/lib/data/forecast-regions';
import { createSupabaseServiceRoleClient } from '@/lib/supabase/server';
import { getBeachesForRegion, aggregateRegionalForecast } from '@/lib/utils/regional-forecast-utils';
import { getBatchFreshForecastsFromCache } from '@/lib/utils/forecast-service-utils';

export async function GET(
  request: Request,
  { params }: { params: { region: string } }
) {
  try {
    // 1. Get region
    const region = getForecastRegion(params.region);
    if (!region) {
      return NextResponse.json({ error: 'Region not found' }, { status: 404 });
    }

    // 2. Get beaches in region
    const supabase = await createSupabaseServiceRoleClient();
    const { data: allBeaches } = await supabase.from('beaches').select('*');
    const beaches = getBeachesForRegion(region, allBeaches || []);

    // 3. Fetch forecasts
    const beachIds = beaches.map(b => b.id);
    const forecastResults = await getBatchFreshForecastsFromCache(beachIds, 168);

    // 4. Build forecast map
    const forecastMap = new Map();
    for (const [beachId, result] of forecastResults.entries()) {
      if (result.forecasts.length > 0 && !result.metadata.stale) {
        forecastMap.set(beachId, result.forecasts);
      }
    }

    // 5. Aggregate
    const summary = aggregateRegionalForecast(region, beaches, forecastMap);

    return NextResponse.json(summary);
  } catch (error) {
    console.error('Error generating regional forecast:', error);
    return NextResponse.json(
      { error: 'Failed to generate forecast' },
      { status: 500 }
    );
  }
}
```

## Performance Considerations

1. **Batch Fetching**: Always use `getBatchFreshForecastsFromCache()` instead of individual fetches to minimize database queries
2. **Stale Data**: Filter out stale forecasts before aggregation
3. **Date Limiting**: The aggregation function automatically limits to 7 days
4. **Caching**: Consider caching regional summaries at the API route level

## Testing

Comprehensive test suite available at:
`__tests__/lib/utils/regional-forecast-utils.test.ts`

Run tests:
```bash
npm run test:unit -- __tests__/lib/utils/regional-forecast-utils.test.ts
```

## Related Files

- `lib/data/forecast-regions.ts` - Region definitions
- `lib/utils/forecast-service-utils.ts` - Forecast fetching utilities
- `types/forecast.ts` - Forecast types
- `types/database.ts` - Beach types

## Architecture Compliance

This module follows established Quiver patterns:
- Uses existing forecast types from `types/forecast.ts`
- Leverages batch fetching patterns from `forecast-service-utils.ts`
- Follows coordinate naming conventions (lon not lng)
- Includes comprehensive JSDoc comments
- Full TypeScript strict mode compliance
