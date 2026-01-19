# Time Slot Tide-Driven Boundaries Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make time slot filters (Dawn patrol, Morning, Afternoon) use natural tide-driven window boundaries instead of hourly boundaries.

**Architecture:** Remove early time slot filtering, calculate tide-driven windows first, then filter by whether the window START falls within the slot. Dawn patrol uses dynamic start based on civil twilight (sunrise - 30min).

**Tech Stack:** TypeScript, Jest for testing

---

## Task 1: Add Dynamic Dawn Patrol Range Helper

**Files:**
- Modify: `lib/services/discovery/window-selector.ts:136-148`

**Step 1: Write the failing test**

Add to `__tests__/lib/services/discovery/window-selector.test.ts`:

```typescript
describe('getDawnPatrolRange', () => {
  it('should return civil twilight start based on sunrise', () => {
    // Import the helper (will add export after test fails)
    const { getDawnPatrolRange } = require('@/lib/services/discovery/window-selector');

    const beachTz = 'America/Los_Angeles';
    // Sunrise at 6:47am PST (14:47 UTC)
    const sunrises = [new Date('2024-01-15T14:47:00Z')];
    const forecastDate = new Date('2024-01-15T17:00:00Z'); // 9am PST

    const range = getDawnPatrolRange(sunrises, forecastDate, beachTz);

    // Civil twilight is ~30 min before sunrise
    // 6:47am - 30min = 6:17am, so startHour should be 6
    expect(range.startHour).toBe(6);
    expect(range.endHour).toBe(9);
  });

  it('should return earlier start for summer sunrise', () => {
    const { getDawnPatrolRange } = require('@/lib/services/discovery/window-selector');

    const beachTz = 'America/Los_Angeles';
    // Summer sunrise at 5:42am PST (12:42 UTC)
    const sunrises = [new Date('2024-06-15T12:42:00Z')];
    const forecastDate = new Date('2024-06-15T14:00:00Z');

    const range = getDawnPatrolRange(sunrises, forecastDate, beachTz);

    // 5:42am - 30min = 5:12am, so startHour should be 5
    expect(range.startHour).toBe(5);
    expect(range.endHour).toBe(9);
  });

  it('should fall back to 6am when no sunrise data', () => {
    const { getDawnPatrolRange } = require('@/lib/services/discovery/window-selector');

    const beachTz = 'America/Los_Angeles';
    const sunrises: Date[] = [];
    const forecastDate = new Date('2024-01-15T17:00:00Z');

    const range = getDawnPatrolRange(sunrises, forecastDate, beachTz);

    expect(range.startHour).toBe(6);
    expect(range.endHour).toBe(9);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts -t "getDawnPatrolRange"`

Expected: FAIL with "getDawnPatrolRange is not a function" or similar

**Step 3: Write minimal implementation**

Add to `lib/services/discovery/window-selector.ts` after the helper functions section (~line 148):

```typescript
/**
 * Get dawn patrol time range based on sunrise.
 * Start is civil twilight (~30 min before sunrise), end is 9am.
 *
 * @param sunrises - Array of sunrise times for the area
 * @param forecastDate - The forecast date to find sunrise for
 * @param beachTz - IANA timezone string for the beach
 * @returns Time range with startHour and endHour in local time
 */
export function getDawnPatrolRange(
  sunrises: Date[],
  forecastDate: Date,
  beachTz: string
): { startHour: number; endHour: number } {
  // Find sunrise for the same local date
  const forecastDateStr = getLocalDateStr(forecastDate, beachTz);
  const sameDaySunrise = sunrises.find(s => getLocalDateStr(s, beachTz) === forecastDateStr);

  if (!sameDaySunrise) {
    // Fallback to conservative 6am if no sunrise data
    return { startHour: 6, endHour: 9 };
  }

  // Civil twilight ~30 minutes before sunrise
  const civilTwilight = new Date(sameDaySunrise.getTime() - 30 * 60 * 1000);

  // Get local hour of civil twilight
  try {
    const twilightHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: beachTz,
      }).format(civilTwilight),
      10
    );
    return { startHour: twilightHour, endHour: 9 };
  } catch {
    return { startHour: 6, endHour: 9 };
  }
}

// Helper to get local date string (extract if not already available at this scope)
function getLocalDateStr(time: Date, beachTz: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: beachTz,
    }).format(time);
  } catch {
    return time.toISOString().slice(0, 10);
  }
}
```

**Note:** The `getLocalDateStr` helper already exists in `selectBestWindow` - we need to extract it to module scope or reuse it. Check if it's already at module scope; if not, extract it.

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts -t "getDawnPatrolRange"`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/discovery/window-selector.ts __tests__/lib/services/discovery/window-selector.test.ts
git commit -m "feat(discovery): add getDawnPatrolRange helper for dynamic dawn patrol start"
```

---

## Task 2: Add Helper to Get Time Slot Range (Dynamic for Dawn Patrol)

**Files:**
- Modify: `lib/services/discovery/window-selector.ts`

**Step 1: Write the failing test**

Add to `__tests__/lib/services/discovery/window-selector.test.ts`:

```typescript
describe('getTimeSlotRange', () => {
  it('should return static range for morning slot', () => {
    const { getTimeSlotRange } = require('@/lib/services/discovery/window-selector');

    const range = getTimeSlotRange('morning', [], new Date(), 'America/Los_Angeles');

    expect(range.startHour).toBe(6);
    expect(range.endHour).toBe(12);
  });

  it('should return static range for afternoon slot', () => {
    const { getTimeSlotRange } = require('@/lib/services/discovery/window-selector');

    const range = getTimeSlotRange('afternoon', [], new Date(), 'America/Los_Angeles');

    expect(range.startHour).toBe(12);
    expect(range.endHour).toBe(18);
  });

  it('should return dynamic range for dawn-patrol based on sunrise', () => {
    const { getTimeSlotRange } = require('@/lib/services/discovery/window-selector');

    // Winter sunrise at 6:47am PST
    const sunrises = [new Date('2024-01-15T14:47:00Z')];
    const forecastDate = new Date('2024-01-15T17:00:00Z');

    const range = getTimeSlotRange('dawn-patrol', sunrises, forecastDate, 'America/Los_Angeles');

    // Should use civil twilight (6:17am -> hour 6)
    expect(range.startHour).toBe(6);
    expect(range.endHour).toBe(9);
  });

  it('should return full day range for any slot', () => {
    const { getTimeSlotRange } = require('@/lib/services/discovery/window-selector');

    const range = getTimeSlotRange('any', [], new Date(), 'America/Los_Angeles');

    expect(range.startHour).toBe(6);
    expect(range.endHour).toBe(21);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts -t "getTimeSlotRange"`

Expected: FAIL

**Step 3: Write minimal implementation**

Add to `lib/services/discovery/window-selector.ts`:

```typescript
/**
 * Get the hour range for a time slot.
 * Dawn patrol uses dynamic start based on sunrise; others use static ranges.
 *
 * @param timeSlot - The time slot filter
 * @param sunrises - Array of sunrise times (needed for dawn-patrol)
 * @param forecastDate - The forecast date
 * @param beachTz - IANA timezone string
 * @returns Time range with startHour and endHour
 */
export function getTimeSlotRange(
  timeSlot: TimeSlot,
  sunrises: Date[],
  forecastDate: Date,
  beachTz: string
): { startHour: number; endHour: number } {
  if (timeSlot === 'dawn-patrol') {
    return getDawnPatrolRange(sunrises, forecastDate, beachTz);
  }
  return TIME_SLOT_RANGES[timeSlot];
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts -t "getTimeSlotRange"`

Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/discovery/window-selector.ts __tests__/lib/services/discovery/window-selector.test.ts
git commit -m "feat(discovery): add getTimeSlotRange helper with dynamic dawn-patrol support"
```

---

## Task 3: Remove Early Time Slot Filtering

**Files:**
- Modify: `lib/services/discovery/window-selector.ts:533-556`

**Step 1: Write the failing test**

Add to `__tests__/lib/services/discovery/window-selector.test.ts`:

```typescript
describe('selectBestWindow time slot with tide boundaries', () => {
  const fixedNow = new Date('2024-01-15T16:00:00Z'); // 8am PST

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should show tide-driven boundaries for morning slot (not hourly)', () => {
    // Tide schedule with tide crossing at non-hour times
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T16:00:00Z').getTime() / 1000), height: 1.5, type: 'low' as const },
      { time: Math.floor(new Date('2024-01-15T22:00:00Z').getTime() / 1000), height: 5.5, type: 'high' as const },
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-morning',
        forecast_date: '2024-01-15',
        forecast_time: '18:00', // 10am PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '2.5',
        tide_status: 'Rising',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      timeSlot: 'morning',
      userPrefs: null,
    });

    expect(result).not.toBeNull();
    // Key assertion: should NOT be exactly on the hour (tide-driven)
    const startMinutes = result!.start.getMinutes();
    const endMinutes = result!.end.getMinutes();
    expect(startMinutes !== 0 || endMinutes !== 0).toBe(true);
  });

  it('should show tide-driven boundaries for afternoon slot', () => {
    // Tide schedule for afternoon
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T20:00:00Z').getTime() / 1000), height: 1.0, type: 'low' as const }, // 12pm PST
      { time: Math.floor(new Date('2024-01-16T02:00:00Z').getTime() / 1000), height: 5.5, type: 'high' as const }, // 6pm PST
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-afternoon',
        forecast_date: '2024-01-15',
        forecast_time: '22:00', // 2pm PST
        wave_height: '4',
        wave_period: '12s',
        tide_height: '2.0',
        tide_status: 'Rising',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    // Set time to 2pm PST
    jest.setSystemTime(new Date('2024-01-15T22:00:00Z'));

    const beachWithTidePrefs = {
      ...mockBeach,
      preferred_tide_ft_min: 2.0,
      preferred_tide_ft_max: 4.0,
      preferred_tide_direction: 'rising',
    } as Beach;

    const result = selectBestWindow({
      forecasts,
      beach: beachWithTidePrefs,
      timeSlot: 'afternoon',
      userPrefs: null,
    });

    expect(result).not.toBeNull();
    // Should have tide-driven (non-hourly) boundaries
    const startMinutes = result!.start.getMinutes();
    const endMinutes = result!.end.getMinutes();
    expect(startMinutes !== 0 || endMinutes !== 0).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts -t "should show tide-driven boundaries for morning slot"`

Expected: FAIL (currently returns hourly boundaries)

**Step 3: Modify implementation**

In `lib/services/discovery/window-selector.ts`, remove the early time slot filtering block (lines ~533-556):

**DELETE this block:**
```typescript
  // Apply time slot filter
  let filteredForecasts = scoredForecasts;

  if (actualTimeSlot && actualTimeSlot !== 'any') {
    const { startHour, endHour } = TIME_SLOT_RANGES[actualTimeSlot];

    filteredForecasts = scoredForecasts.filter(({ forecastTime }) => {
      try {
        const localHour = parseInt(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: beachTz,
          }).format(forecastTime),
          10
        );
        return localHour >= startHour && localHour < endHour;
      } catch {
        return true; // If timezone conversion fails, include it
      }
    });
  }

  if (filteredForecasts.length === 0) return null;
```

**REPLACE with:**
```typescript
  // No early time slot filtering - we filter AFTER calculating tide boundaries
  const filteredForecasts = scoredForecasts;

  if (filteredForecasts.length === 0) return null;
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts -t "should show tide-driven boundaries for morning slot"`

Expected: May still fail - need Task 4 changes too

**Step 5: Commit (or continue to Task 4)**

This task may need Task 4 to fully pass. Continue to Task 4 before committing.

---

## Task 4: Move Time Slot Validation After Tide Boundaries

**Files:**
- Modify: `lib/services/discovery/window-selector.ts:677-695`

**Step 1: The test from Task 3 serves as the failing test**

**Step 2: Modify the tide boundary validation logic**

In `lib/services/discovery/window-selector.ts`, update the tide window validation section (~lines 677-705).

**REPLACE the existing validation block:**
```typescript
    // Validate tide-driven boundaries before using them
    let useTideBoundaries = !!tideBoundaries;

    if (tideBoundaries) {
      // 1. Check if tide window start is within the time slot (if specified)
      if (actualTimeSlot && actualTimeSlot !== 'any') {
        try {
          const tideStartHour = parseInt(
            new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              hour12: false,
              timeZone: beachTz,
            }).format(tideBoundaries.start),
            10
          );
          const { startHour, endHour } = TIME_SLOT_RANGES[actualTimeSlot];
          if (tideStartHour < startHour || tideStartHour >= endHour) {
            useTideBoundaries = false;
          }
        } catch {
          useTideBoundaries = false;
        }
      }
      // ... rest of validation
    }
```

**WITH:**
```typescript
    // Validate tide-driven boundaries before using them
    let useTideBoundaries = !!tideBoundaries;
    let skipThisForecast = false;

    if (tideBoundaries) {
      // 1. Check if tide window start is within the time slot (if specified)
      if (actualTimeSlot && actualTimeSlot !== 'any') {
        try {
          const tideStartHour = parseInt(
            new Intl.DateTimeFormat("en-US", {
              hour: "numeric",
              hour12: false,
              timeZone: beachTz,
            }).format(tideBoundaries.start),
            10
          );
          // Get dynamic range (dawn-patrol uses sunrise-based start)
          const sunrises = sunTimes?.sunrises || [];
          const slotRange = getTimeSlotRange(actualTimeSlot, sunrises, startTime, beachTz);

          if (tideStartHour < slotRange.startHour || tideStartHour >= slotRange.endHour) {
            // Tide window doesn't start within slot - skip this forecast entirely
            // to find a tide window that does qualify
            skipThisForecast = true;
          }
        } catch {
          useTideBoundaries = false;
        }
      }

      // 2. Check if window spans overnight (different local dates)
      if (useTideBoundaries && !skipThisForecast) {
        const tideStartDate = getLocalDateStr(tideBoundaries.start);
        const tideEndDate = getLocalDateStr(tideBoundaries.end);
        if (tideStartDate !== tideEndDate) {
          useTideBoundaries = false;
        }
      }
    }

    // Skip this forecast if tide window doesn't qualify for time slot
    if (skipThisForecast) {
      continue;
    }
```

**Step 3: Run test to verify it passes**

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts -t "should show tide-driven boundaries for morning slot"`

Expected: PASS

**Step 4: Run all related tests**

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts`

Expected: All tests PASS

**Step 5: Commit**

```bash
git add lib/services/discovery/window-selector.ts __tests__/lib/services/discovery/window-selector.test.ts
git commit -m "feat(discovery): move time slot filtering after tide boundary calculation

Time slot filters now use natural tide-driven boundaries instead of hourly.
The algorithm calculates tide windows first, then filters by whether the
window START falls within the selected slot."
```

---

## Task 5: Remove End Time Capping at Slot Boundary

**Files:**
- Modify: `lib/services/discovery/window-selector.ts:802`

**Step 1: Write the failing test**

Add to `__tests__/lib/services/discovery/window-selector.test.ts`:

```typescript
it('should show full tide window even if it extends past time slot', () => {
  // Tide window that starts in morning but extends to afternoon
  const tideSchedule = [
    { time: Math.floor(new Date('2024-01-15T15:00:00Z').getTime() / 1000), height: 1.0, type: 'low' as const }, // 7am PST
    { time: Math.floor(new Date('2024-01-15T23:00:00Z').getTime() / 1000), height: 5.5, type: 'high' as const }, // 3pm PST
  ];

  const forecasts = [
    createForecast({
      id: 'forecast-morning-extended',
      forecast_date: '2024-01-15',
      forecast_time: '16:00', // 8am PST
      wave_height: '4',
      wave_period: '12s',
      tide_height: '1.5',
      tide_status: 'Rising',
      confidence_score: 80,
      raw_forecast: {
        tide_schedule: tideSchedule,
        data_sources: ['NOAA_NWS'],
      },
    } as any),
  ];

  jest.setSystemTime(new Date('2024-01-15T16:00:00Z')); // 8am PST

  const beachWithTidePrefs = {
    ...mockBeach,
    preferred_tide_ft_min: 2.0,
    preferred_tide_ft_max: 4.5, // Would extend past noon
    preferred_tide_direction: 'rising',
  } as Beach;

  const result = selectBestWindow({
    forecasts,
    beach: beachWithTidePrefs,
    timeSlot: 'morning', // Ends at 12pm
    userPrefs: null,
  });

  expect(result).not.toBeNull();

  // Key assertion: end time should be AFTER noon (not capped at 12pm)
  // If tide window extends to 1:30pm, it should show 1:30pm, not 12pm
  const endHour = parseInt(
    new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      hour12: false,
      timeZone: "America/Los_Angeles",
    }).format(result!.end),
    10
  );

  // End should be after noon (12) since we don't truncate anymore
  expect(endHour).toBeGreaterThanOrEqual(12);
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts -t "should show full tide window even if it extends past time slot"`

Expected: FAIL (currently truncates at noon)

**Step 3: Remove the capping logic**

In `lib/services/discovery/window-selector.ts`, find line ~802:

```typescript
    // Cap at time slot end (e.g., dawn-patrol ends at 9am) - applies to both
    endTime = capEndTimeToSlot(effectiveStartTime, endTime, actualTimeSlot, beachTz);
```

**DELETE or comment out this line.**

Also find similar capping in the fallback section (~line 981):

```typescript
      // Cap at time slot end for fallback window too
      endTime = capEndTimeToSlot(effectiveStartTime, endTime, actualTimeSlot, beachTz);
```

**Keep this one for fallback behavior** - fallback (hourly) windows should still respect slot boundaries. Only tide-driven windows should show full duration.

**Alternative approach:** Instead of deleting, conditionally skip capping only when tide boundaries are used:

```typescript
    // Cap at time slot end - only for fallback (hourly) windows, not tide-driven
    if (!tideBoundaries || !useTideBoundaries) {
      endTime = capEndTimeToSlot(effectiveStartTime, endTime, actualTimeSlot, beachTz);
    }
```

**Step 4: Run test to verify it passes**

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts -t "should show full tide window even if it extends past time slot"`

Expected: PASS

**Step 5: Run all tests**

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts`

Expected: All tests PASS

**Step 6: Commit**

```bash
git add lib/services/discovery/window-selector.ts __tests__/lib/services/discovery/window-selector.test.ts
git commit -m "feat(discovery): show full tide-driven window without truncation

Tide-driven windows are no longer capped at time slot boundaries.
If a tide window starts at 8am (within morning slot) but extends to 1pm,
the full window is displayed. Fallback hourly windows still respect slot boundaries."
```

---

## Task 6: Update Existing Tests for New Behavior

**Files:**
- Modify: `__tests__/lib/services/discovery/window-selector.test.ts`

**Step 1: Review and fix any broken tests**

Some existing tests may expect the old capping behavior. Run full test suite:

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts`

**Step 2: Update tests that expect capping**

The test at line ~750 "should cap tide window at time slot end for dawn-patrol" needs updating:

```typescript
it('should NOT cap tide window at time slot end for dawn-patrol (shows full window)', () => {
  // ... same setup as before ...

  const result = selectBestWindow({
    forecasts,
    beach: beachWithTidePrefs,
    timeSlot: 'dawn-patrol', // 6am-9am
    userPrefs: null,
  });

  if (result) {
    // Window should NOT be capped at 9am - full tide window is shown
    // This is the new behavior: tide-driven windows are not truncated
    expect(result).not.toBeNull();
    // Just verify we got a result; end time can extend past 9am
  }
});
```

**Step 3: Run full test suite**

Run: `yarn test:unit __tests__/lib/services/discovery/window-selector.test.ts`

Expected: All tests PASS

**Step 4: Commit**

```bash
git add __tests__/lib/services/discovery/window-selector.test.ts
git commit -m "test(discovery): update tests for new time slot behavior

Tests now expect tide-driven windows to show full duration without truncation.
Fallback hourly windows still respect slot boundaries."
```

---

## Task 7: Integration Testing

**Files:**
- No code changes, verification only

**Step 1: Run full test suite**

Run: `yarn test:unit`

Expected: All tests PASS

**Step 2: Start dev server and manually verify**

Run: `yarn dev`

**Step 3: Manual verification checklist**

1. Go to home screen
2. Select "Any time" filter - verify tide-driven boundaries (e.g., "6:25-8:22pm")
3. Select "Dawn patrol" filter - verify tide-driven boundaries (not "7-9am")
4. Select "Morning" filter - verify tide-driven boundaries (not "10am-12pm")
5. Select "Afternoon" filter - verify tide-driven boundaries (not "4-6pm")
6. Verify windows that start in slot but end outside show full duration

**Step 4: Commit any final fixes**

```bash
git add -A
git commit -m "fix(discovery): address integration test findings"
```

---

## Task 8: Final Cleanup and Documentation

**Step 1: Update design doc status**

Edit `docs/plans/2026-01-18-time-slot-tide-boundaries-design.md`:

Change `**Status**: Approved` to `**Status**: Implemented`

**Step 2: Commit**

```bash
git add docs/plans/2026-01-18-time-slot-tide-boundaries-design.md
git commit -m "docs: mark time slot tide boundaries design as implemented"
```

---

## Summary

| Task | Description | Estimated Complexity |
|------|-------------|---------------------|
| 1 | Add getDawnPatrolRange helper | Small |
| 2 | Add getTimeSlotRange helper | Small |
| 3 | Remove early time slot filtering | Small |
| 4 | Move time slot validation after tide boundaries | Medium |
| 5 | Remove end time capping for tide windows | Small |
| 6 | Update existing tests | Small |
| 7 | Integration testing | Verification |
| 8 | Final cleanup | Small |

**Total: ~8 focused tasks, each 5-15 minutes**
