# Dynamic Tide Computation Design

**Date:** 2026-01-14
**Status:** Ready for implementation

## Problem

The "Next Tide" display on beach detail pages shows stale data. When viewing at 5:04 PM, it shows "Low Tide at 2:04 PM" because:

1. `next_tide_time` is computed at forecast generation time (e.g., 10:32 AM)
2. It's computed relative to each forecast time slot, not the viewing time
3. The full tide schedule is discarded after generation - only static values are stored
4. The UI displays these static values without recomputation

## Solution

Store the tide prediction schedule in forecast data, then compute "next tide" dynamically on the client at render time.

### Data Flow Change

```
BEFORE:
[NOAA API] → tides array → compute next_tide for each slot → store static values → display stale data

AFTER:
[NOAA API] → tides array → store schedule in raw_forecast → client computes from schedule → always fresh
```

## Implementation

### 1. Store Tide Schedule

**File:** `lib/services/enhanced-forecast-service.ts`

Add tide schedule to `raw_forecast` for the first forecast entry of each day:

```typescript
raw_forecast: {
  data_sources: dataSources,
  // ... existing fields ...

  // Store tide schedule for client-side dynamic computation
  tide_schedule: isFirstForecastOfDay ? tideData?.tides?.slice(0, 20).map(t => ({
    time: t.time,        // Unix timestamp (seconds)
    height: t.height,    // Height in feet
    type: t.type,        // "high" or "low"
  })) : undefined,

  tide_station: isFirstForecastOfDay ? {
    id: tideData?.station_id,
    name: tideData?.station_name,
  } : undefined,
}
```

- 20 extremes covers ~5 days (4 tides/day)
- Only stored on first forecast of each day to avoid duplication

### 2. Client-Side Hook

**File:** `hooks/useDynamicTide.ts` (new file)

```typescript
interface DynamicTideResult {
  // The soonest upcoming tide (high or low)
  nextTide: { time: number; height: number; type: 'high' | 'low' } | null;
  minutesUntil: number | null;

  // Individual extremes (for Tides tab display)
  nextHigh: { time: number; height: number } | null;
  nextLow: { time: number; height: number } | null;
  minutesToHigh: number | null;
  minutesToLow: number | null;

  // Fallback indicator
  usingFallback: boolean;
}

export function useDynamicTide(
  forecasts: EnhancedForecastEntity[],
  beachTimezone?: string
): DynamicTideResult
```

Behavior:
- Extracts `tide_schedule` from first forecast that has it
- Computes next high/low relative to `Date.now()`
- Returns `nextTide` (whichever comes first)
- Recomputes on mount and tab focus (visibility change)
- Returns `usingFallback: true` if no schedule found

### 3. Update Forecast Tab

**File:** `components/beach-detail/tabs/forecast-tab.tsx`

```typescript
const dynamicTide = useDynamicTide(forecasts, beachTimezone);

const heroNextTideType = dynamicTide.nextTide
  ? (dynamicTide.nextTide.type === 'high' ? 'High Tide' : 'Low Tide')
  : currentForecast?.next_tide_type ?? '—';

const heroNextTideHeight = dynamicTide.nextTide
  ? `${dynamicTide.nextTide.height.toFixed(1)} ft`
  : currentForecast?.next_tide_height ?? '';

const heroNextTideTime = dynamicTide.nextTide
  ? formatTideTime(dynamicTide.nextTide.time, beachTimezone)
  : formatTimeString(currentForecast?.next_tide_time);
```

### 4. Update Tide Diagnostics Generator

**File:** `lib/utils/tide-diagnostics-generator.ts`

Update `findNextExtremes()` to prefer `tide_schedule` when available:

```typescript
function findNextExtremes(forecasts: EnhancedForecastEntity[], now: Date) {
  // Try tide_schedule first
  for (const forecast of forecasts) {
    const schedule = forecast.raw_forecast?.tide_schedule;
    if (schedule?.length) {
      const nowSeconds = now.getTime() / 1000;
      let nextHigh = null, nextLow = null;

      for (const tide of schedule) {
        if (tide.time > nowSeconds) {
          if (tide.type === 'high' && !nextHigh) {
            nextHigh = { time: new Date(tide.time * 1000), height: tide.height };
          }
          if (tide.type === 'low' && !nextLow) {
            nextLow = { time: new Date(tide.time * 1000), height: tide.height };
          }
          if (nextHigh && nextLow) break;
        }
      }

      if (nextHigh || nextLow) return { nextHigh, nextLow };
    }
  }

  // Fall back to parsing static next_tide_* fields
  // ... existing code ...
}
```

## Files Changed

| File | Change |
|------|--------|
| `lib/services/enhanced-forecast-service.ts` | Store `tide_schedule` in `raw_forecast` |
| `hooks/useDynamicTide.ts` | New file - client hook |
| `components/beach-detail/tabs/forecast-tab.tsx` | Use hook for display |
| `lib/utils/tide-diagnostics-generator.ts` | Prefer schedule over static fields |

## What Stays the Same

- Database schema (uses existing `raw_forecast` JSON field)
- NOAA CO-OPS data fetching
- Tide chart visualization
- API routes
- Static `next_tide_*` fields (kept for backward compatibility)

## Edge Cases

1. **Old forecasts without schedule:** Falls back to static `next_tide_*` values
2. **Long page visits:** Recomputes on tab focus via `visibilitychange` event
3. **Missing data:** Returns null, UI shows fallback "—"

## Testing

1. Verify "Next Tide" shows future time (not past)
2. Verify time updates when switching tabs after tide passes
3. Verify fallback works for old forecasts
4. Verify Tides tab and Today tab show consistent data
