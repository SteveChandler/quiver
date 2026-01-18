# Time Slot Tide-Driven Boundaries Design

**Date**: 2026-01-18
**Status**: Approved

## Problem

Time slot filters (Dawn patrol, Morning, Afternoon) show hourly boundaries like "10am-12pm" instead of natural tide-driven boundaries like "10:23-12:47pm". The tide-driven window calculation only works correctly for the "Any time" filter.

**Current behavior:**
- Any time: "6:25-8:22pm" (tide-driven) ✓
- Dawn patrol: "7-9am" (hourly) ✗
- Morning: "10am-12pm" (hourly) ✗
- Afternoon: "4-6pm" (hourly) ✗

## Root Cause

The current algorithm filters forecasts by time slot BEFORE calculating tide windows. This constrains the tide calculation to specific forecast hours, preventing it from finding the beach's natural optimal window.

**Current flow:**
1. Filter forecasts to hours within time slot (7am, 8am, etc.)
2. For each filtered forecast, calculate tide window starting from that time
3. If tide window start isn't within slot, fall back to hourly

**The problem:** If the 10am forecast is selected, tide calculation looks for crossings AFTER 10am, which may miss the optimal window that started earlier.

## Solution

Reverse the order of operations:

**New flow:**
1. Calculate best tide-driven window (same as "Any time")
2. Check if window START falls within selected time slot
3. If yes, use full tide-driven boundaries (no truncation)
4. If no, find next tide window that qualifies

This ensures we find the actual optimal tide windows first, then filter by slot.

## Algorithm Changes

### Time Slot Filtering

**Remove early forecast filtering** - Currently lines 533-556 in `window-selector.ts` filter `scoredForecasts` to only hours within the slot. Remove this.

**Move check to tide window validation:**
```typescript
// After calculateTideDrivenBoundaries() returns
if (tideBoundaries && actualTimeSlot && actualTimeSlot !== 'any') {
  const tideStartHour = getLocalHour(tideBoundaries.start, beachTz);
  const range = getTimeSlotRange(actualTimeSlot, sunrises, forecastDate, beachTz);

  if (tideStartHour < range.startHour || tideStartHour >= range.endHour) {
    // Tide window doesn't qualify for this slot, try next forecast
    continue;
  }
}
```

### No End Time Truncation

**Remove `capEndTimeToSlot()` call** - Line 802 caps end time at slot boundary. Remove this so full tide-driven windows are displayed.

Example: Tide window "7:23-1:47pm" with Morning filter shows "7:23-1:47pm" (not truncated to "7:23-12pm").

### Dawn Patrol: Dynamic Start

**Current definition:**
```typescript
'dawn-patrol': { startHour: 6, endHour: 9 }
```

**New definition:** Start at civil twilight (sunrise - 30 minutes), end at 9am.

```typescript
function getDawnPatrolRange(
  sunrises: Date[],
  forecastDate: Date,
  beachTz: string
): { startHour: number; endHour: number } {
  const sameDaySunrise = sunrises.find(s =>
    getLocalDateStr(s, beachTz) === getLocalDateStr(forecastDate, beachTz)
  );

  if (!sameDaySunrise) {
    // Fallback to conservative 6am if no sunrise data
    return { startHour: 6, endHour: 9 };
  }

  // Civil twilight ~30 minutes before sunrise
  const civilTwilight = new Date(sameDaySunrise.getTime() - 30 * 60 * 1000);
  const twilightHour = getLocalHour(civilTwilight, beachTz);

  return { startHour: twilightHour, endHour: 9 };
}
```

**Seasonal examples:**

| Season | Sunrise | Civil Twilight | Dawn Patrol Range |
|--------|---------|----------------|-------------------|
| Winter | 6:47am | 6:17am | 6:17am - 9am |
| Summer | 5:42am | 5:12am | 5:12am - 9am |

## Edge Cases

### No tide window starts within slot

- Example: Beach's optimal tide is 2-5pm, user selects "Morning"
- Behavior: Fall back to hourly boundaries within the morning slot
- Display: "10am-12pm" (best conditions within slot, hourly)

### Tide window starts in slot, ends outside

- Example: Tide window is "7:23-1:47pm", user selects "Morning"
- Behavior: Show full window "7:23-1:47pm"
- The start qualifies it; end is not truncated

### Multiple tide windows per day

- Some beaches have two optimal windows (rising tide AM, falling PM)
- Behavior: Select the best-scoring window whose start falls within slot

### Beach without tide thresholds

- Behavior unchanged: Falls back to hourly boundaries
- Time slot filter still applies to hourly windows

### Missing sunrise data (for dawn patrol)

- Fallback to conservative 6am start
- End remains 9am

## Files to Modify

| File | Change |
|------|--------|
| `lib/services/discovery/window-selector.ts` | Core algorithm changes |
| `types/personalization.ts` | Update TIME_SLOT_RANGES for dynamic dawn-patrol |

### Detailed Changes in `window-selector.ts`

1. **Remove early time slot filtering** (lines 533-556)

2. **Update tide window validation** (lines 677-695):
   - For dawn-patrol: calculate civil twilight from sunrise
   - Check if tide window start falls within dynamic range
   - For other slots: use existing hour-based check

3. **Remove end time capping** (line 802)
   - Delete `capEndTimeToSlot()` call

4. **Add helper function** for dawn patrol range calculation

## Testing

### Unit Tests

| Scenario | Slot | Expected |
|----------|------|----------|
| Tide window 7:23-9:18am | Dawn patrol (winter) | 7:23-9:18am ✓ |
| Tide window 5:45-8:30am | Dawn patrol (summer) | 5:45-8:30am ✓ |
| Tide window 5:45-8:30am | Dawn patrol (winter) | Falls back (too early) |
| Tide window 7:23-9:18am | Morning | 7:23-9:18am ✓ |
| Tide window 7:23-1:47pm | Morning | 7:23-1:47pm (full, no truncation) |
| Tide window 1:15-4:47pm | Morning | Falls back to hourly |
| Tide window 1:15-4:47pm | Afternoon | 1:15-4:47pm ✓ |
| No tide thresholds | Any slot | Hourly boundaries |

### Manual QA

1. Select "Dawn patrol" in winter → verify window starts near civil twilight
2. Select "Dawn patrol" in summer → verify earlier start time
3. Select "Morning" → verify tide-driven boundaries (not hourly)
4. Select "Afternoon" → verify tide-driven boundaries (not hourly)
5. Toggle between slots → verify different beaches may rank differently

## Expected Results

| Filter | Before | After |
|--------|--------|-------|
| Any time | 6:25-8:22pm ✓ | 6:25-8:22pm ✓ |
| Dawn patrol | 7-9am | 6:17-8:43am (tide-driven) |
| Morning | 10am-12pm | 10:23-12:47pm (tide-driven) |
| Afternoon | 4-6pm | 4:07-5:52pm (tide-driven) |

## Non-Goals

- Persisting time slot preference
- Custom time ranges
- Changes to scoring algorithm
- Database schema changes
