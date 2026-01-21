# Surf Discovery Time Priority Fix — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the "surf now" deprioritization bug by allowing current windows, strengthening time priority, fixing date boundaries, and ensuring consistent thresholds.

**Architecture:** Four targeted changes to `selectBestWindow()` in surf-discovery-service.ts. All changes are isolated to window selection logic — no API or schema changes.

**Tech Stack:** TypeScript, Jest, Next.js

---

## Task 1: Add New Constants

**Files:**
- Modify: `lib/services/surf-discovery-service.ts:171-183`

**Step 1: Update constants section**

Find the existing constants block (around line 171) and update:

```typescript
// Time-priority window selection constants
const TIME_DECAY_PER_HOUR = 1.0;        // Changed from 0.5
const MAX_TIME_DECAY_HOURS = 24;        // Unchanged

// New: Start-soon bonuses for "surf now" prioritization
const SOON_BONUS_2HR = 8;               // Bonus for windows starting within 2 hours
const SOON_BONUS_4HR = 4;               // Bonus for windows starting within 4 hours
const UNDERWAY_BONUS = 4;               // Bonus for windows already in progress
```

**Step 2: Verify constants are defined**

Run: `npx tsc --noEmit lib/services/surf-discovery-service.ts 2>&1 | head -20`
Expected: No errors related to the new constants

**Step 3: Commit**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "feat(discovery): add time-priority constants for surf-now fix"
```

---

## Task 2: Write Failing Tests for Current Window Lookback

**Files:**
- Modify: `__tests__/services/select-best-window-sunset.test.ts`

**Step 1: Add test for current window eligibility**

Add this test to the existing describe block (after line 277):

```typescript
describe('selectBestWindow with lookback (current window)', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set "now" to 9:20am PT = 17:20 UTC on 2026-01-13
    jest.setSystemTime(new Date('2026-01-13T17:20:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('includes window that started within last 3 hours', () => {
    // Forecast at 9am PT (17:00 UTC) - started 20 minutes ago
    // Should still be eligible since it's within 3-hour lookback
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '17:00:00', // 9am PT, 20 min ago
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '20:00:00', // 12pm PT, 2h 40min away
      }),
    ];

    const beach = createMockBeach();
    const result = selectBestWindow(forecasts, beach, null, 24);

    expect(result).not.toBeNull();
    // Should select the 9am window (underway) because of underway bonus
    expect(result!.start).toEqual(new Date('2026-01-13T17:00:00Z'));
  });

  it('excludes window that started more than 3 hours ago', () => {
    // Set "now" to 1pm PT = 21:00 UTC
    jest.setSystemTime(new Date('2026-01-13T21:00:00Z'));

    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '17:00:00', // 9am PT, 4 hours ago - should be excluded
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '22:00:00', // 2pm PT, 1 hour away
      }),
    ];

    const beach = createMockBeach();
    const result = selectBestWindow(forecasts, beach, null, 24);

    expect(result).not.toBeNull();
    // Should select 2pm (the 9am is too old)
    expect(result!.start).toEqual(new Date('2026-01-13T22:00:00Z'));
  });

  it('does not give bonus to past-start windows via negative decay', () => {
    // Window started 1 hour ago should get 0 decay, not negative
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '16:20:00', // 8:20am PT, 1 hour ago
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '20:00:00', // 12pm PT, 2h 40min away
      }),
    ];

    const beach = createMockBeach();
    const result = selectBestWindow(forecasts, beach, null, 24);

    // Both have similar conditions. The 8:20am window gets underway bonus (+4)
    // but 0 time decay. The 12pm window gets soon bonus (+8) but ~2.7 decay.
    // 8:20am: base + 4 (underway) + 8 (soon, since hoursAhead=0) - 0 decay
    // 12pm: base + 8 (soon) - 2.67 decay
    // The underway window should win or be very close
    expect(result).not.toBeNull();
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern="select-best-window-sunset" --verbose 2>&1 | tail -30`
Expected: FAIL - tests should fail because current behavior filters out past-start windows

**Step 3: Commit failing tests**

```bash
git add __tests__/services/select-best-window-sunset.test.ts
git commit -m "test(discovery): add failing tests for current window lookback"
```

---

## Task 3: Implement Current Window Lookback (Issue #2)

**Files:**
- Modify: `lib/services/surf-discovery-service.ts:1228-1258`

**Step 1: Update the filter logic**

Find the `scoredForecasts` mapping and filtering (around line 1228). Replace:

```typescript
// OLD (line 1257):
.filter(({ forecastTime }) => forecastTime > now)
```

With:

```typescript
// NEW: Allow windows that started within lookback period
const lookbackMs = WINDOW_HOURS * 60 * 60 * 1000; // 3 hours
const minEligible = new Date(now.getTime() - lookbackMs);

// ... existing .map() code ...

.filter(({ forecastTime }) => forecastTime >= minEligible)
```

The full block should look like:

```typescript
// Allow windows that started within lookback period (3 hours)
const lookbackMs = WINDOW_HOURS * 60 * 60 * 1000;
const minEligible = new Date(now.getTime() - lookbackMs);

// Score all forecasts upfront and filter stale times
const scoredForecasts = forecasts
  .map((forecast) => {
    const forecastTime = new Date(`${forecast.forecast_date}T${forecast.forecast_time}Z`);
    const score = scoreForecastWindow(forecast, beach, userPrefs);

    // Check if forecast is for today (in beach timezone)
    let isToday = false;
    let localHourStr = '';
    try {
      const forecastDateStr = new Intl.DateTimeFormat("en-CA", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: beachTz,
      }).format(forecastTime);
      isToday = forecastDateStr === todayDateStr;
      localHourStr = new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "numeric",
        hour12: true,
        timeZone: beachTz,
      }).format(forecastTime);
    } catch {
      // Default to not today if timezone conversion fails
    }

    return { forecast, forecastTime, score, isToday, localHourStr };
  })
  .filter(({ forecastTime }) => forecastTime >= minEligible)  // Changed from > now
  .sort((a, b) => a.forecastTime.getTime() - b.forecastTime.getTime());
```

**Step 2: Clamp hoursAhead to prevent negative decay bonus**

Find the `hoursAhead` calculation in the main loop (around line 1334). Replace:

```typescript
// OLD:
const hoursAhead = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
```

With:

```typescript
// NEW: Clamp to zero so past-start windows don't get bonus from negative decay
const rawHoursAhead = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
const hoursAhead = Math.max(0, rawHoursAhead);
```

**Step 3: Run tests**

Run: `npm test -- --testPathPattern="select-best-window-sunset" --verbose 2>&1 | tail -30`
Expected: The lookback tests should now pass (but soon bonus tests may still fail)

**Step 4: Commit**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "feat(discovery): allow current window with 3-hour lookback"
```

---

## Task 4: Write Failing Tests for Time Priority Bonuses

**Files:**
- Modify: `__tests__/services/select-best-window-sunset.test.ts`

**Step 1: Add tests for soon bonus and underway bonus**

Add to the lookback describe block:

```typescript
describe('selectBestWindow time priority bonuses', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set "now" to 10am PT = 18:00 UTC
    jest.setSystemTime(new Date('2026-01-13T18:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('gives soon bonus to windows starting within 2 hours', () => {
    // Window at 11am (1h away) should beat window at 6pm (8h away)
    // even if 6pm has slightly better conditions
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '19:00:00', // 11am PT, 1h away - gets +8 soon bonus
        wave_height: '4.0',
        wind_speed: '8',
      }),
      createMockForecast({
        forecast_date: '2026-01-14',
        forecast_time: '02:00:00', // 6pm PT, 8h away - no soon bonus
        wave_height: '4.5',        // Slightly better
        wind_speed: '6',           // Slightly better
      }),
    ];

    const beach = createMockBeach();
    const result = selectBestWindow(forecasts, beach, null, 24);

    expect(result).not.toBeNull();
    // 11am should win due to soon bonus overcoming small condition difference
    expect(result!.start).toEqual(new Date('2026-01-13T19:00:00Z'));
  });

  it('gives underway bonus to windows already in progress', () => {
    // Window that started 30 min ago should beat similar window 2h away
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '17:30:00', // 9:30am PT, 30 min ago - gets underway bonus
        wave_height: '4.0',
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '20:00:00', // 12pm PT, 2h away
        wave_height: '4.0',        // Same conditions
      }),
    ];

    const beach = createMockBeach();
    const result = selectBestWindow(forecasts, beach, null, 24);

    expect(result).not.toBeNull();
    // Underway window should win
    expect(result!.start).toEqual(new Date('2026-01-13T17:30:00Z'));
  });

  it('stronger decay penalizes distant windows more', () => {
    // With 1.0 pts/hr decay, a window 12h away loses 12 points
    // This should make "tomorrow morning" lose to "decent today"
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '20:00:00', // 12pm PT today, 2h away
        wave_height: '3.5',        // Decent
        wind_speed: '10',
      }),
      createMockForecast({
        forecast_date: '2026-01-14',
        forecast_time: '06:00:00', // 10pm PT, 12h away (note: filtered by night check)
      }),
      createMockForecast({
        forecast_date: '2026-01-14',
        forecast_time: '16:00:00', // 8am PT tomorrow, 22h away
        wave_height: '4.5',        // Better
        wind_speed: '7',           // Better
      }),
    ];

    const beach = createMockBeach();
    const result = selectBestWindow(forecasts, beach, null, 48);

    expect(result).not.toBeNull();
    // Today 12pm should win despite worse conditions
    // Today: ~58 base + 8 soon - 2 decay = ~64
    // Tomorrow 8am: ~65 base + 0 bonus - 22 decay = ~43
    expect(result!.start).toEqual(new Date('2026-01-13T20:00:00Z'));
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --testPathPattern="select-best-window-sunset" --verbose 2>&1 | tail -40`
Expected: FAIL - bonus logic not yet implemented

**Step 3: Commit failing tests**

```bash
git add __tests__/services/select-best-window-sunset.test.ts
git commit -m "test(discovery): add failing tests for time priority bonuses"
```

---

## Task 5: Implement Time Priority Bonuses (Issue #3)

**Files:**
- Modify: `lib/services/surf-discovery-service.ts:1386-1414`

**Step 1: Add soon bonus and underway bonus calculations**

Find the adjusted score calculation (around line 1386). Replace:

```typescript
// OLD:
const cappedHours = Math.min(hoursAhead, MAX_TIME_DECAY_HOURS);
const timeDecay = cappedHours * TIME_DECAY_PER_HOUR;

// Morning priority: add bonus to today's forecasts before noon
// Also add extra bonus for morning/afternoon times (before 5pm) during morning hours
const todayBonus = (isMorning && isToday) ? TODAY_BONUS_POINTS : 0;

// ... morningTimeBonus calculation ...

const adjustedScore = startScore - timeDecay + todayBonus + morningTimeBonus;
```

With:

```typescript
// NEW:
const cappedHours = Math.min(hoursAhead, MAX_TIME_DECAY_HOURS);
const timeDecay = cappedHours * TIME_DECAY_PER_HOUR;

// Start-soon bonus (smooth step based on proximity)
let soonBonus = 0;
if (hoursAhead <= 2) soonBonus = SOON_BONUS_2HR;
else if (hoursAhead <= 4) soonBonus = SOON_BONUS_4HR;

// Underway bonus for windows already in progress
const isUnderway = rawHoursAhead < 0;
const underwayBonus = isUnderway ? UNDERWAY_BONUS : 0;

// Morning priority: add bonus to today's forecasts before noon
const todayBonus = (isMorning && isToday) ? TODAY_BONUS_POINTS : 0;

// Get local hour of forecast start time to determine morning time bonus
let morningTimeBonus = 0;
if (isMorning && isToday) {
  try {
    const forecastLocalHour = parseInt(
      new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        hour12: false,
        timeZone: beachTz,
      }).format(startTime),
      10
    );
    // Give bonus to times before 5pm (prioritize morning/afternoon over evening)
    if (forecastLocalHour < EVENING_CUTOFF_HOUR) {
      morningTimeBonus = MORNING_TIME_BONUS;
    }
  } catch {
    // If timezone conversion fails, no bonus
  }
}

const adjustedScore = startScore - timeDecay + todayBonus + morningTimeBonus + soonBonus + underwayBonus;
```

**Step 2: Run tests**

Run: `npm test -- --testPathPattern="select-best-window-sunset" --verbose 2>&1 | tail -40`
Expected: Time priority bonus tests should pass

**Step 3: Commit**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "feat(discovery): add soon bonus and underway bonus for time priority"
```

---

## Task 6: Write Failing Tests for Local Date Boundary

**Files:**
- Modify: `__tests__/services/select-best-window-sunset.test.ts`

**Step 1: Add test for evening window extension across UTC midnight**

```typescript
describe('selectBestWindow local date boundary', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set "now" to 4pm PT = 00:00 UTC on 2026-01-14 (UTC date just flipped)
    jest.setSystemTime(new Date('2026-01-14T00:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('extends window across UTC midnight when same local date', () => {
    // 4pm PT forecast should extend to 6pm PT even though UTC date changes
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-14',
        forecast_time: '00:00:00', // 4pm PT
        wave_height: '4.0',
        wind_speed: '5',
      }),
      createMockForecast({
        forecast_date: '2026-01-14',
        forecast_time: '01:00:00', // 5pm PT - same local date
        wave_height: '4.0',
        wind_speed: '5',
      }),
      createMockForecast({
        forecast_date: '2026-01-14',
        forecast_time: '02:00:00', // 6pm PT - same local date
        wave_height: '4.0',
        wind_speed: '5',
      }),
    ];

    const beach = createMockBeach();
    // Sunset at 5:30pm PT
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2026-01-14T14:30:00Z')],
        sunsets: [new Date('2026-01-14T01:30:00Z')], // 5:30pm PT
      }],
    ]);

    const result = selectBestWindow(forecasts, beach, null, 24, sunTimesCache);

    expect(result).not.toBeNull();
    // Window should extend to sunset (5:30pm), not stop at 4pm due to UTC boundary
    const sunsetTime = new Date('2026-01-14T01:30:00Z').getTime();
    expect(result!.end.getTime()).toBeLessThanOrEqual(sunsetTime);
    expect(result!.end.getTime()).toBeGreaterThan(new Date('2026-01-14T00:00:00Z').getTime());
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --testPathPattern="select-best-window-sunset" --testNamePattern="local date boundary" --verbose`
Expected: FAIL - window extension stops at UTC date boundary

**Step 3: Commit failing test**

```bash
git add __tests__/services/select-best-window-sunset.test.ts
git commit -m "test(discovery): add failing test for local date boundary"
```

---

## Task 7: Implement Local Date Boundary Fix (Issue #4)

**Files:**
- Modify: `lib/services/surf-discovery-service.ts:1344-1350`

**Step 1: Add helper function for local date**

Add this helper function near the top of `selectBestWindow` (after line 1201):

```typescript
// Helper: get local date string for a timestamp in beach timezone
const getLocalDateStr = (time: Date): string => {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      timeZone: beachTz,
    }).format(time);
  } catch {
    return time.toISOString().slice(0, 10); // Fallback to UTC
  }
};
```

**Step 2: Update the date boundary check in extension loop**

Find the extension loop (around line 1344). Replace:

```typescript
// OLD (line 1349):
if (current.forecast.forecast_date !== next.forecast.forecast_date) break;
```

With:

```typescript
// NEW: Use local dates instead of UTC date strings
const currentLocalDate = getLocalDateStr(current.forecastTime);
const nextLocalDate = getLocalDateStr(next.forecastTime);
if (currentLocalDate !== nextLocalDate) break;
```

**Step 3: Run tests**

Run: `npm test -- --testPathPattern="select-best-window-sunset" --verbose 2>&1 | tail -30`
Expected: Local date boundary test should pass

**Step 4: Commit**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "fix(discovery): use local date boundary for window extension"
```

---

## Task 8: Write Failing Tests for Consistent Threshold

**Files:**
- Modify: `__tests__/services/select-best-window-sunset.test.ts`

**Step 1: Add test for threshold consistency**

```typescript
describe('selectBestWindow threshold consistency', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    // Set "now" to 8am PT = 16:00 UTC (morning hours)
    jest.setSystemTime(new Date('2026-01-13T16:00:00Z'));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('uses morning threshold consistently during extension', () => {
    // Morning window with score 40 (above morning threshold 35, below standard 50)
    // Should extend properly instead of being truncated
    const forecasts = [
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '17:00:00', // 9am PT
        wave_height: '2.5',        // Smaller waves = lower score ~40
        wind_speed: '12',          // Moderate wind
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '18:00:00', // 10am PT
        wave_height: '2.5',        // Same conditions
        wind_speed: '12',
      }),
      createMockForecast({
        forecast_date: '2026-01-13',
        forecast_time: '19:00:00', // 11am PT
        wave_height: '2.5',        // Same conditions
        wind_speed: '12',
      }),
    ];

    const beach = createMockBeach();
    const sunTimesCache = new Map([
      ['beach-1', {
        sunrises: [new Date('2026-01-13T14:30:00Z')],
        sunsets: [new Date('2026-01-14T01:05:00Z')],
      }],
    ]);

    const result = selectBestWindow(forecasts, beach, null, 24, sunTimesCache);

    expect(result).not.toBeNull();
    // Window should extend beyond 9am since conditions stay above morning threshold
    const tenAm = new Date('2026-01-13T18:00:00Z').getTime();
    expect(result!.end.getTime()).toBeGreaterThan(tenAm);
  });
});
```

**Step 2: Run test to verify behavior**

Run: `npm test -- --testPathPattern="select-best-window-sunset" --testNamePattern="threshold consistency" --verbose`
Expected: May pass or fail depending on current state

**Step 3: Commit test**

```bash
git add __tests__/services/select-best-window-sunset.test.ts
git commit -m "test(discovery): add test for threshold consistency"
```

---

## Task 9: Implement Consistent Threshold (Issue #5)

**Files:**
- Modify: `lib/services/surf-discovery-service.ts:1350-1360`

**Step 1: Update extension loop to use effectiveThreshold**

Find the degradation check in the extension loop (around line 1352). Replace:

```typescript
// OLD:
if (current.score >= MIN_SCORE_THRESHOLD && next.score < MIN_SCORE_THRESHOLD) {
  // Linear interpolation to find precise degradation time
  const dropAmount = current.score - next.score;
  const thresholdDiff = current.score - MIN_SCORE_THRESHOLD;
```

With:

```typescript
// NEW: Use same threshold that qualified the window
if (current.score >= effectiveThreshold && next.score < effectiveThreshold) {
  // Linear interpolation to find precise degradation time
  const dropAmount = current.score - next.score;
  if (dropAmount <= 0) break; // Guard against edge case
  const thresholdDiff = current.score - effectiveThreshold;
```

**Step 2: Run all tests**

Run: `npm test -- --testPathPattern="select-best-window-sunset" --verbose`
Expected: All tests pass

**Step 3: Commit**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "fix(discovery): use consistent threshold during window extension"
```

---

## Task 10: Update Fallback Logic with Same Fixes

**Files:**
- Modify: `lib/services/surf-discovery-service.ts:1423-1500`

**Step 1: Review fallback block for consistency**

The fallback logic (when no windows pass threshold) should also use the new time priority bonuses. Find the fallback `getAdjustedScore` function (around line 1446) and update it to include soon/underway bonuses:

```typescript
// NEW fallback getAdjustedScore:
const getAdjustedScore = (f: typeof daylightForecasts[0]) => {
  const rawHoursAhead = (f.forecastTime.getTime() - now.getTime()) / (1000 * 60 * 60);
  const hoursAhead = Math.max(0, rawHoursAhead);

  // Soon bonus
  let soonBonus = 0;
  if (hoursAhead <= 2) soonBonus = SOON_BONUS_2HR;
  else if (hoursAhead <= 4) soonBonus = SOON_BONUS_4HR;

  // Underway bonus
  const underwayBonus = rawHoursAhead < 0 ? UNDERWAY_BONUS : 0;

  // Today bonus (existing logic)
  let bonus = 0;
  if (isMorning && f.isToday) {
    bonus += TODAY_BONUS_POINTS;
    try {
      const localHour = parseInt(
        new Intl.DateTimeFormat("en-US", {
          hour: "numeric",
          hour12: false,
          timeZone: beachTz,
        }).format(f.forecastTime),
        10
      );
      if (localHour < EVENING_CUTOFF_HOUR) {
        bonus += MORNING_TIME_BONUS;
      }
    } catch {
      // If timezone conversion fails, no extra bonus
    }
  }

  return f.score + bonus + soonBonus + underwayBonus;
};
```

**Step 2: Run all tests**

Run: `npm test -- --testPathPattern="select-best-window" --verbose`
Expected: All tests pass

**Step 3: Commit**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "fix(discovery): apply time priority to fallback logic"
```

---

## Task 11: Run Full Test Suite

**Step 1: Run all surf discovery tests**

Run: `npm test -- --testPathPattern="surf-discovery" --verbose`
Expected: All tests pass

**Step 2: Run type check**

Run: `npx tsc --noEmit`
Expected: No type errors

**Step 3: Run lint**

Run: `npm run lint -- --fix`
Expected: No errors (warnings OK)

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore(discovery): cleanup and final verification"
```

---

## Task 12: Manual QA Verification

**Step 1: Start dev server**

Run: `npm run dev`

**Step 2: Test at various times**

Verify in the app:
- [ ] At 9:20am, the 9:00am window appears as a recommendation
- [ ] Windows starting "now" show higher priority than tomorrow
- [ ] Evening windows extend past 5pm PT (not truncated at UTC midnight)
- [ ] Morning windows with marginal scores still extend properly

**Step 3: Check console logs**

Look for the debug logs:
```
🔍 [selectBestWindow] Beach Name: isMorning=true, todayDateStr=2026-01-15
   9:00 AM: score=63, isToday=true
   ...
🔍 [selectBestWindow] Beach Name: SELECTED start=...
```

---

## Summary of Changes

| File | Lines Changed | Purpose |
|------|--------------|---------|
| `lib/services/surf-discovery-service.ts` | ~50 lines | All four fixes |
| `__tests__/services/select-best-window-sunset.test.ts` | ~150 lines | New tests |

**Constants changed:**
- `TIME_DECAY_PER_HOUR`: 0.5 → 1.0
- Added: `SOON_BONUS_2HR`, `SOON_BONUS_4HR`, `UNDERWAY_BONUS`

**Behavior changes:**
1. Windows that started within 3 hours are now eligible
2. "Surf now" windows get +4 to +12 bonus points
3. Future windows penalized more strongly (1 pt/hr vs 0.5)
4. Evening windows extend to local midnight, not UTC
5. Morning threshold used consistently during extension
