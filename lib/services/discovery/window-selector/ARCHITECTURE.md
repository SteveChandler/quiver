# Window Selector Module Architecture

## Overview

The Window Selector module determines the optimal surf session time window based on forecast data, tide schedules, user preferences, and time slot constraints. It powers the "Best Window" recommendation feature in Quiver.

## Module Structure

```
window-selector/
├── index.ts                      # Barrel export (public API)
├── types.ts                      # TypeScript interfaces
├── constants.ts                  # Configuration values and thresholds
├── direction-utils.ts            # Cardinal direction parsing
├── time-slot-utils.ts            # Timezone and time slot calculations
├── tide-boundary-calculator.ts   # Tide schedule extraction
├── peak-finder.ts                # Sub-hour peak interpolation
├── window-refiner.ts             # Boundary refinement logic
├── window-scorer.ts              # Forecast scoring functions
├── scoring-engine-singleton.ts   # Lazy-initialized scoring engine
└── window-selector-core.ts       # Main selectBestWindow algorithm
```

## Data Flow

```
                    ┌─────────────────┐
                    │ selectBestWindow│
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ time-slot-utils │ │ tide-boundary   │ │ direction-utils │
│ (timezone, slots)│ │ (tide schedule) │ │ (wave direction)│
└────────┬────────┘ └────────┬────────┘ └────────┬────────┘
         │                   │                   │
         └───────────────────┼───────────────────┘
                             ▼
                    ┌─────────────────┐
                    │ window-scorer   │
                    │ (score windows) │
                    └────────┬────────┘
                             │
         ┌───────────────────┼───────────────────┐
         ▼                   ▼                   ▼
┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│  peak-finder    │ │ window-refiner  │ │ scoring-engine  │
│ (interpolation) │ │ (boundaries)    │ │ (singleton)     │
└─────────────────┘ └─────────────────┘ └─────────────────┘
```

## Module Descriptions

### `types.ts`
TypeScript interfaces for the module:
- `WindowSelectorOptions` - Input configuration
- `CandidateWindow` - Output window structure
- `ScoredForecast` - Intermediate scoring result

### `constants.ts`
Configuration values and thresholds:
- Time decay parameters
- Score thresholds
- Window duration limits
- Morning/evening cutoffs
- Bonus point values

### `direction-utils.ts`
Pure functions for wave direction parsing:
- `parseWaveDirection()` - Parse direction string to degrees
- `getDirectionDegrees()` - Convert cardinal to degrees

### `time-slot-utils.ts`
Timezone-aware time calculations:
- `getLocalDateStr()` - Format date in beach timezone
- `getTimeSlotRange()` - Calculate time slot boundaries
- `getDawnPatrolRange()` - Early morning slot handling
- `capEndTimeToTimeSlot()` - Enforce time slot limits
- `getLocalHour()` - Get hour in beach timezone
- `isWithinTimeSlot()` - Check if time is in slot

### `tide-boundary-calculator.ts`
Tide schedule processing:
- `extractTideSchedule()` - Parse tide data for date
- `calculateTideDrivenBoundaries()` - Compute optimal boundaries based on tides

### `peak-finder.ts`
Sub-hour interpolation:
- `findPeakWithinWindow()` - Find best moment within a window using minute-level interpolation

### `window-refiner.ts`
Boundary refinement:
- `applySubHourRefinement()` - Adjust window boundaries to exact minutes based on score curves

### `window-scorer.ts`
Scoring functions:
- `scoreForecastWindow()` - Calculate base score for a forecast
- `scoreWindowWithEngine()` - Score using unified scoring engine

### `scoring-engine-singleton.ts`
Lazy-loaded scoring engine:
- `getScoringEngine()` - Get or create singleton
- `resetScoringEngine()` - Reset for testing

### `window-selector-core.ts`
Main algorithm (~825 lines):
- `selectBestWindow()` - Primary entry point
- Candidate generation
- Filtering by time slot and daylight
- Scoring and ranking
- Fallback window selection

## Public API

```typescript
// Primary function
selectBestWindow(options: WindowSelectorOptions): Promise<CandidateWindow | null>

// Types
interface WindowSelectorOptions {
  forecasts: SurfForecast[];
  beachTimezone: string;
  timeSlot?: string;
  tideData?: TideData[];
  beachConfig?: BeachConfig;
}

interface CandidateWindow {
  startTime: Date;
  endTime: Date;
  peakTime: Date;
  score: number;
  forecast: SurfForecast;
  reasoning: string[];
}
```

## Backwards Compatibility

The original `window-selector.ts` file (now at parent directory level) re-exports all public APIs from this module. Existing imports continue to work:

```typescript
// Both import paths work
import { selectBestWindow } from '@/lib/services/discovery/window-selector';
import { selectBestWindow } from '@/lib/services/discovery/window-selector/window-selector-core';
```

## Testing

Tests are located at `__tests__/lib/services/discovery/window-selector.test.ts` and cover:
- Time slot boundary calculations
- Direction parsing
- Tide-driven boundary calculations
- Peak finding interpolation
- Window scoring
- Full algorithm integration

Run tests:
```bash
yarn test:unit --testPathPattern="window-selector"
```

## Dependencies

Internal:
- `@/lib/services/unified-surf-scoring-engine` - Scoring engine
- `@/lib/utils/tide-window` - Tide window utilities
- `@/types/forecast` - Forecast types
- `@/types/beaches` - Beach configuration types

External:
- `date-fns` - Date manipulation
- `date-fns-tz` - Timezone handling
