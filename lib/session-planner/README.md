# Session Planner Utilities

This module provides utilities for analyzing surf forecast data to determine optimal surfing times.

## Overview

The session planner calculates the best times to surf by scoring forecast data based on multiple factors:
- Wave height (2-6ft ideal)
- Swell period (10-16s optimal)
- Wind speed (lighter is better)
- Wind direction (offshore preferred)
- Tide height and movement
- Forecast confidence

## Main Export

### `optimal-times-utils.ts`

Core utilities for time parsing, forecast scoring, and optimal time calculation.

## Key Functions

### Time Parsing

```typescript
import { parseTimeToHour, toTimeString } from "@/lib/session-planner/optimal-times-utils";

// Convert time string to hour float
parseTimeToHour("14:30")     // 14.5
parseTimeToHour("2:30 PM")   // 14.5
parseTimeToHour("2024-01-04T14:30:00Z") // 14.5

// Convert hour float back to HH:MM string
toTimeString(14.5)  // "14:30"
```

### Forecast Scoring

```typescript
import { scoreForecast, type OptimalTimeSlot } from "@/lib/session-planner/optimal-times-utils";

// Score a single forecast row
const slot: OptimalTimeSlot = scoreForecast(forecastRow, currentTimeHour);

// Returns:
// {
//   time: "14:00",
//   score: 75,              // 0-100
//   rating: "good",         // "poor" | "fair" | "good" | "excellent"
//   reasons: ["Good wave height (4ft)", "Light winds (5mph)", ...],
//   conditions: {
//     waveHeight: 4,
//     waveQuality: "Good",
//     windSpeed: 5,
//     windDirection: "NE",
//     confidence: 85,
//     tideHeight: 2.5,
//     swellPeriod: 12,
//     ...
//   }
// }
```

### Analyzing Optimal Times

```typescript
import { analyzeOptimalTimes } from "@/lib/session-planner/optimal-times-utils";

// Get best surf windows from forecast data
const optimalSlots = analyzeOptimalTimes(
  forecasts,           // Array of forecast rows
  selectedTime,        // Optional: center analysis around this time
  currentTimeHour      // Optional: filter out past times
);

// Returns array of OptimalTimeSlot sorted by score
```

### 2-Hour Block Averaging

```typescript
import { buildTwoHourBlocks } from "@/lib/session-planner/optimal-times-utils";

// Group scored forecasts into 2-hour windows with averaged conditions
const blocks = buildTwoHourBlocks(scoredForecasts);

// Each block has:
// - time: center of window
// - startTime / endTime: window bounds
// - Averaged score, conditions from all points in window
```

## Scoring Algorithm

### Score Components (Max 100 points)

| Factor | Max Points | Optimal Range |
|--------|------------|---------------|
| Wave Height | 30 | 2-6 ft |
| Swell Period | 15 | 10-16 seconds |
| Wind Speed | 20 | 0-5 mph |
| Wind Direction | 15 | Offshore (E, NE, SE) |
| Tide | 12 | 1.5-3.5 ft, rising |
| Confidence | 10 | 80%+ |

### Rating Thresholds

| Score | Rating |
|-------|--------|
| 70+ | Excellent |
| 55-69 | Good |
| 40-54 | Fair |
| 0-39 | Poor |

## Usage in API Routes

The session planner is used by `/api/session-planner/optimal-times`:

```typescript
// Simplified example
const forecasts = await fetchForecasts(beachId, date);
const optimalTimes = analyzeOptimalTimes(forecasts, selectedTime);
return { optimalTimes };
```

## Types

```typescript
interface OptimalTimeSlot {
  time: string;           // Center time (HH:MM format)
  startTime?: string;     // Block start (for 2-hour windows)
  endTime?: string;       // Block end
  score: number;          // 0-100
  rating: "poor" | "fair" | "good" | "excellent";
  reasons: string[];      // Human-readable explanations
  conditions: {
    waveHeight: number;
    waveQuality: string;
    windSpeed: number;
    windDirection: string;
    confidence: number;
    weatherCondition: string;
    tideHeight?: number | null;
    tideType?: string | null;
    swellPeriod?: number | null;
  };
}
```

## See Also

- `/app/api/session-planner/optimal-times/route.ts` - API endpoint
- `/lib/analyzers/tide-analyzer.ts` - Tide analysis utilities
- `/lib/analyzers/conditions-analyzer.ts` - Conditions scoring
