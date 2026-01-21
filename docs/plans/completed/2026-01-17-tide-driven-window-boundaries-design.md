# Tide-Driven Window Boundaries Design

**Date**: 2026-01-17
**Status**: Approved

## Problem

Current surf window recommendations always snap to hour boundaries (e.g., "Tomorrow 7-9am") because the window selector uses hourly forecast timestamps as boundaries. This doesn't reflect when conditions are actually optimal based on tide heights.

## Solution

Calculate window start/end times based on when tide crosses the beach's optimal height thresholds, displaying exact times like "7:23-9:18am".

## Core Algorithm

**Current behavior**: Window starts/ends at forecast time points (always on the hour)

**New behavior**: Window starts when tide crosses `preferred_tide_ft_min`, ends when tide crosses `preferred_tide_ft_max` (or vice versa for falling tide spots)

**Calculation approach**:
1. Get tide schedule (high/low events with exact times)
2. Interpolate between tide events to find when height crosses thresholds
3. Use those crossing times as window boundaries
4. Round to nearest minute for display

**Example for Windansea (rising tide, works 2ft-4ft)**:
- Low tide at 6:47am (1.2ft)
- Tide hits 2ft at 7:23am → window starts
- Tide hits 4ft at 9:18am → window ends
- Display: "7:23-9:18am"

## Tide Interpolation

Tides follow a sinusoidal curve between high and low events. To find when tide crosses a threshold height:

**Formula**: Use cosine interpolation between tide events

```
Given:
- Event A (low tide): time=6:47am, height=1.2ft
- Event B (high tide): time=12:52pm, height=5.8ft
- Target height: 2.0ft

Calculate:
1. Normalize target within range: (2.0 - 1.2) / (5.8 - 1.2) = 0.174
2. Inverse cosine interpolation: acos(1 - 2 * 0.174) / π = 0.27
3. Time offset: 0.27 × (12:52 - 6:47) = 1hr 38min
4. Crossing time: 6:47 + 1:38 = 8:25am
```

**Edge cases handled**:
- Threshold outside tide range (window covers entire tide cycle or none)
- Multiple crossings per day (pick the one matching preferred direction)
- Missing tide data (fall back to hourly boundaries)

## Data Requirements

**What exists and is sufficient**:
- `beaches.preferred_tide_ft_min` / `preferred_tide_ft_max` - tide height thresholds
- `beaches.preferred_tide_direction` - rising, falling, slack, either
- `raw_forecast.tide_schedule` - array of `{ time, height, type }` events

**What needs updating**:

1. **Threshold coverage**: For beaches without thresholds, fall back to hourly boundaries (current behavior)

2. **Window selector changes**: Modify `selectBestWindow()` to:
   - Extract tide schedule from forecast data
   - Calculate threshold crossing times
   - Use crossing times instead of forecast timestamps for start/end

**No new database columns needed**.

## Implementation Location

**Primary change**: `lib/services/discovery/window-selector.ts`

New helper function:
```typescript
function calculateTideThresholdCrossing(
  tideSchedule: TideScheduleEntry[],
  targetHeight: number,
  direction: 'rising' | 'falling',
  afterTime: Date
): Date | null
```

**Integration points**:

1. **Window start**: Calculate when tide crosses `preferred_tide_ft_min` (for rising) or `preferred_tide_ft_max` (for falling)

2. **Window end**: Calculate when tide crosses the opposite threshold, or use sunset/degradation

3. **Scoring remains unchanged**: Existing tide fit scoring continues to work

**Fallback behavior**: If tide schedule is missing or beach lacks thresholds, current hourly logic applies

## Display Formatting

**Time format**: Exact minutes, no rounding

| Current | New |
|---------|-----|
| "Tomorrow 7-9am" | "Tomorrow 7:23-9:18am" |
| "Today 4-6pm" | "Today 4:07-5:52pm" |

**Special cases**:
- `:00` minutes: Display as "7am" not "7:00am"
- Cross-hour spans: "7:23am-9:18am"
- Same hour: "7:23-7:58am"

**Component impact**: `PersonalizedForecastWindow` already returns `start: Date` and `end: Date` - formatting happens in UI layer. No type changes needed.

## Files to Modify

1. `lib/services/discovery/window-selector.ts` - Core algorithm
2. `lib/utils/tide-interpolation.ts` - Add threshold crossing calculation (file exists)
3. UI components displaying time windows (formatting only)

## Testing

- Unit tests for cosine interpolation accuracy
- Unit tests for edge cases (threshold outside range, missing data)
- Integration tests verifying window boundaries match tide crossings
- Visual verification of time display formatting
