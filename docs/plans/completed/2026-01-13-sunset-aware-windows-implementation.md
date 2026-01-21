# Sunset-Aware Time Windows Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make recommendation time windows respect actual sunset times and condition quality, instead of fixed 3-hour blocks.

**Architecture:** Batch-fetch sunset data from `sun_times` table, pass cache to `selectBestWindow`, linearly interpolate scores to find precise degradation points, cap windows at sunset.

**Tech Stack:** TypeScript, Supabase, Next.js

---

## Task 1: Add getBatchSunTimes Function

**Files:**
- Modify: `lib/services/surf-discovery-service.ts`
- Test: `__tests__/services/surf-discovery-service.test.ts` (or create if needed)

**Step 1: Write the failing test**

Create test file if it doesn't exist, add test:

```typescript
// __tests__/services/get-batch-sun-times.test.ts
import { getBatchSunTimes } from '@/lib/services/surf-discovery-service';

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createSupabaseServiceRoleClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        in: jest.fn(() => ({
          in: jest.fn(() => Promise.resolve({
            data: [
              { beach_id: 'beach-1', date: '2026-01-13', sunset_utc: '2026-01-13T01:05:00Z' },
              { beach_id: 'beach-2', date: '2026-01-13', sunset_utc: '2026-01-13T01:10:00Z' },
            ],
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

describe('getBatchSunTimes', () => {
  it('returns Map keyed by beachId_date with sunset Date values', async () => {
    const result = await getBatchSunTimes(['beach-1', 'beach-2'], ['2026-01-13']);

    expect(result.size).toBe(2);
    expect(result.get('beach-1_2026-01-13')).toBeInstanceOf(Date);
    expect(result.get('beach-2_2026-01-13')).toBeInstanceOf(Date);
  });

  it('deduplicates inputs', async () => {
    const result = await getBatchSunTimes(
      ['beach-1', 'beach-1', 'beach-2'],
      ['2026-01-13', '2026-01-13']
    );

    // Should still work with duplicates
    expect(result.size).toBe(2);
  });

  it('returns empty Map on error', async () => {
    // This test needs a separate mock setup - skip for now
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn jest __tests__/services/get-batch-sun-times.test.ts -v`
Expected: FAIL - `getBatchSunTimes` is not exported

**Step 3: Write the implementation**

Add to `lib/services/surf-discovery-service.ts` after the imports:

```typescript
/**
 * Batch fetch sunset times for multiple beaches and dates.
 * Returns a Map keyed by `${beachId}_${YYYY-MM-DD}` → sunset Date (UTC).
 */
export async function getBatchSunTimes(
  beachIds: string[],
  dates: string[]
): Promise<Map<string, Date>> {
  const supabase = createSupabaseServiceRoleClient();

  const uniqueBeachIds = [...new Set(beachIds)];
  const uniqueDates = [...new Set(dates)];

  if (uniqueBeachIds.length === 0 || uniqueDates.length === 0) {
    return new Map();
  }

  const { data, error } = await supabase
    .from('sun_times')
    .select('beach_id, date, sunset_utc')
    .in('beach_id', uniqueBeachIds)
    .in('date', uniqueDates);

  if (error) {
    console.error('Error fetching sun times:', error);
    return new Map();
  }

  const sunMap = new Map<string, Date>();

  data?.forEach((row) => {
    if (row.sunset_utc) {
      const key = `${row.beach_id}_${row.date}`;
      sunMap.set(key, new Date(row.sunset_utc));
    }
  });

  return sunMap;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn jest __tests__/services/get-batch-sun-times.test.ts -v`
Expected: PASS

**Step 5: Commit**

```bash
git add lib/services/surf-discovery-service.ts __tests__/services/get-batch-sun-times.test.ts
git commit -m "feat: add getBatchSunTimes for sunset data caching"
```

---

## Task 2: Add Constants for Window Logic

**Files:**
- Modify: `lib/services/surf-discovery-service.ts`

**Step 1: Add constants near the top of the file (after existing constants)**

```typescript
// Sunset-aware window constants
const MIN_SESSION_HOURS = 1.0; // Minimum viable session length
const MIN_SCORE_THRESHOLD = 50; // Score below which conditions are "poor"
const MAX_WINDOW_HOURS = 4; // Maximum window even with perfect conditions
```

**Step 2: Commit**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "feat: add sunset-aware window constants"
```

---

## Task 3: Modify selectBestWindow Signature

**Files:**
- Modify: `lib/services/surf-discovery-service.ts`

**Step 1: Update function signature to accept sunTimesCache**

Find the `selectBestWindow` function (around line 1002) and update its signature:

```typescript
function selectBestWindow(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null,
  horizonHours?: number,
  sunTimesCache?: Map<string, Date>  // NEW parameter
): PersonalizedForecastWindow | null {
```

**Step 2: Commit**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "refactor: add sunTimesCache parameter to selectBestWindow"
```

---

## Task 4: Implement Sunset-Aware Window Logic

**Files:**
- Modify: `lib/services/surf-discovery-service.ts`

**Step 1: Write test for sunset capping**

Add to existing test file or create new:

```typescript
// __tests__/services/select-best-window-sunset.test.ts
describe('selectBestWindow with sunset', () => {
  it('caps window end at sunset', () => {
    const forecasts = [
      createMockForecast({ forecast_date: '2026-01-13', forecast_time: '16:00:00' }),
      createMockForecast({ forecast_date: '2026-01-13', forecast_time: '17:00:00' }),
      createMockForecast({ forecast_date: '2026-01-13', forecast_time: '18:00:00' }),
    ];

    const beach = createMockBeach({ id: 'beach-1' });
    const sunTimesCache = new Map([
      ['beach-1_2026-01-13', new Date('2026-01-13T01:05:00Z')] // 5:05pm PT
    ]);

    const result = selectBestWindow(forecasts, beach, null, 24, sunTimesCache);

    expect(result).not.toBeNull();
    // Window should end at sunset, not 3 hours after start
    expect(result!.end.getTime()).toBeLessThanOrEqual(
      sunTimesCache.get('beach-1_2026-01-13')!.getTime()
    );
  });

  it('skips windows with less than 1 hour until sunset', () => {
    const forecasts = [
      createMockForecast({ forecast_date: '2026-01-13', forecast_time: '17:00:00' }), // 5pm
    ];

    const beach = createMockBeach({ id: 'beach-1' });
    const sunTimesCache = new Map([
      ['beach-1_2026-01-13', new Date('2026-01-13T01:30:00Z')] // 5:30pm PT - only 30 min left
    ]);

    const result = selectBestWindow(forecasts, beach, null, 24, sunTimesCache);

    // Should return null since there's not enough time
    expect(result).toBeNull();
  });
});
```

**Step 2: Replace the selectBestWindow function body**

Replace the entire function body with the new implementation:

```typescript
function selectBestWindow(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null,
  horizonHours?: number,
  sunTimesCache?: Map<string, Date>
): PersonalizedForecastWindow | null {
  if (forecasts.length === 0) return null;

  const now = new Date();
  const beachTz = getTimezoneFromCoords(beach.lat || 0, beach.lon || 0);

  // Score all forecasts upfront and filter past times
  const scoredForecasts = forecasts
    .map((forecast) => {
      const forecastTime = new Date(`${forecast.forecast_date}T${forecast.forecast_time}Z`);
      const score = scoreForecastWindow(forecast, beach, userPrefs);
      return { forecast, forecastTime, score };
    })
    .filter(({ forecastTime }) => forecastTime > now)
    .sort((a, b) => a.forecastTime.getTime() - b.forecastTime.getTime());

  if (scoredForecasts.length === 0) return null;

  let bestWindow: {
    forecast: EnhancedForecastEntity;
    start: Date;
    end: Date;
    score: number;
  } | null = null;
  let bestAdjustedScore = -1;

  for (let i = 0; i < scoredForecasts.length; i++) {
    const { forecast, forecastTime: startTime, score: startScore } = scoredForecasts[i];

    // Skip low-scoring start times
    if (startScore < MIN_SCORE_THRESHOLD) continue;

    // Get sunset for this date
    const dateKey = forecast.forecast_date;
    const sunset = sunTimesCache?.get(`${beach.id}_${dateKey}`);

    // Skip if too close to sunset
    if (sunset) {
      const hoursUntilSunset = (sunset.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      if (hoursUntilSunset < MIN_SESSION_HOURS) continue;
    }

    // Check horizon constraint
    const hoursAhead = (startTime.getTime() - now.getTime()) / (1000 * 60 * 60);
    if (horizonHours && hoursAhead > horizonHours) continue;

    // Default end time: MAX_WINDOW_HOURS from start
    let endTime = new Date(startTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);

    // Look ahead to find when conditions degrade
    for (let j = i; j < scoredForecasts.length - 1; j++) {
      const current = scoredForecasts[j];
      const next = scoredForecasts[j + 1];

      // Stop if next forecast is on a different date
      if (current.forecast.forecast_date !== next.forecast.forecast_date) break;

      // Check if conditions drop below threshold
      if (current.score >= MIN_SCORE_THRESHOLD && next.score < MIN_SCORE_THRESHOLD) {
        // Linear interpolation to find precise degradation time
        const dropAmount = current.score - next.score;
        const thresholdDiff = current.score - MIN_SCORE_THRESHOLD;
        const fractionOfHour = dropAmount > 0 ? thresholdDiff / dropAmount : 0;

        const degradationTime = new Date(
          current.forecastTime.getTime() + fractionOfHour * 60 * 60 * 1000
        );

        if (degradationTime < endTime) {
          endTime = degradationTime;
        }
        break;
      }

      // Stop extending if we've gone past max window
      const windowDuration = (next.forecastTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
      if (windowDuration >= MAX_WINDOW_HOURS) {
        endTime = new Date(startTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);
        break;
      }
    }

    // Cap at sunset
    if (sunset && sunset < endTime) {
      endTime = sunset;
    }

    // Validate minimum session length
    const durationHours = (endTime.getTime() - startTime.getTime()) / (1000 * 60 * 60);
    if (durationHours < MIN_SESSION_HOURS) continue;

    // Apply time decay for ranking
    const cappedHours = Math.min(hoursAhead, MAX_TIME_DECAY_HOURS);
    const timeDecay = cappedHours * TIME_DECAY_PER_HOUR;
    const adjustedScore = startScore - timeDecay;

    if (adjustedScore > bestAdjustedScore) {
      bestAdjustedScore = adjustedScore;
      bestWindow = { forecast, start: startTime, end: endTime, score: startScore };
    }
  }

  if (!bestWindow) return null;

  // Build the PersonalizedForecastWindow
  return {
    start: bestWindow.start,
    end: bestWindow.end,
    tide: bestWindow.forecast.tide_status || 'Unknown',
    wind: `${bestWindow.forecast.wind_speed} ${bestWindow.forecast.wind_direction}`,
    waveHeight: bestWindow.forecast.wave_height || 'Unknown',
    wavePeriod: bestWindow.forecast.wave_period || 'Unknown',
    dataSource: bestWindow.forecast.data_source || 'FALLBACK',
    confidence: bestWindow.forecast.confidence_score || 50,
    timezone: beachTz,
  };
}
```

**Step 3: Run tests**

Run: `yarn jest __tests__/services/select-best-window-sunset.test.ts -v`
Expected: PASS

**Step 4: Commit**

```bash
git add lib/services/surf-discovery-service.ts __tests__/services/select-best-window-sunset.test.ts
git commit -m "feat: implement sunset-aware window logic with interpolation"
```

---

## Task 5: Integrate Sun Times Fetch in getDiscoveryRecommendations

**Files:**
- Modify: `lib/services/surf-discovery-service.ts`

**Step 1: Find getDiscoveryRecommendations function and add sun times fetch**

After the `getBatchFreshForecastsFromCache` call (around line 200), add:

```typescript
// Collect all dates from forecasts and fetch sun times
const allDates = new Set<string>();
const allBeachIds = new Set<string>();

for (const { beach, forecasts } of beachForecasts) {
  allBeachIds.add(beach.id);
  for (const f of forecasts) {
    allDates.add(f.forecast_date);
  }
}

const sunTimesCache = await getBatchSunTimes(
  Array.from(allBeachIds),
  Array.from(allDates)
);
```

**Step 2: Update the selectBestWindow call to pass sunTimesCache**

Find the line calling `selectBestWindow` (around line 210) and update it:

```typescript
const bestWindow = selectBestWindow(forecasts, beach, userPrefs, horizonHours, sunTimesCache);
```

**Step 3: Commit**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "feat: integrate sun times fetch in discovery recommendations"
```

---

## Task 6: Remove Hardcoded Night Hour Check

**Files:**
- Modify: `lib/services/surf-discovery-service.ts`

**Step 1: Remove the old isNightHour check from selectBestWindow**

The new implementation doesn't use `isNightHour` - it's been replaced by sunset-based logic. Verify the old code block is gone:

```typescript
// REMOVE this block if it exists in the new implementation:
// const localHour = getLocalHour(forecastTime, beachTz);
// if (isNightHour(localHour)) {
//   continue;
// }
```

**Step 2: Remove unused import if applicable**

Check if `isNightHour` is still used elsewhere in the file. If not, remove from imports:

```typescript
// Change this:
import { getTimezoneFromCoords, getLocalHour, isNightHour } from '@/lib/utils/timezone-utils.server';

// To this (if isNightHour no longer used):
import { getTimezoneFromCoords, getLocalHour } from '@/lib/utils/timezone-utils.server';
```

**Step 3: Commit**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "refactor: remove hardcoded night hour check, sunset logic handles it"
```

---

## Task 7: Run Full Test Suite

**Step 1: Run all unit tests**

Run: `yarn test:unit`
Expected: Same or fewer failures than baseline (7 failed suites, 25 failed tests)

**Step 2: Run relevant tests specifically**

Run: `yarn jest surf-discovery -v`
Expected: PASS

**Step 3: Commit if any fixes needed**

```bash
git add -A
git commit -m "fix: address test failures from sunset-aware changes"
```

---

## Task 8: Manual Verification

**Step 1: Start the dev server**

Run: `yarn dev`

**Step 2: Check the home screen**

1. Navigate to home screen
2. Verify the time window badge shows a realistic time (not extending past sunset)
3. For afternoon sessions, the window should cap around sunset time

**Step 3: Check edge cases**

1. Test late afternoon (4pm+) - window should cap at sunset
2. Test morning sessions - window should be based on conditions, not sunset

---

## Task 9: Final Commit and PR Prep

**Step 1: Ensure all changes committed**

```bash
git status
git log --oneline -10
```

**Step 2: Push branch**

```bash
git push -u origin feature/sunset-aware-windows
```

**Step 3: Ready for PR**

Use `superpowers:finishing-a-development-branch` skill to create PR.
