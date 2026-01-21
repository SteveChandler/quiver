# Time Slot Discovery Filter — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a time slot filter to surf discovery that constrains recommendations to morning, afternoon, or dawn patrol windows.

**Architecture:** Add `timeSlot` parameter to discovery options, filter forecasts in `selectBestWindow` by local hour range, expose via API query param, add UI chip selector on home screen.

**Tech Stack:** TypeScript, Next.js API routes, React hooks, Tailwind CSS

---

## Task 1: Add TimeSlot Type and Constants

**Files:**
- Modify: `types/personalization.ts`
- Modify: `lib/services/surf-discovery-service.ts:168-194` (constants section)

**Step 1: Add TimeSlot type to personalization types**

In `types/personalization.ts`, add after existing type definitions:

```typescript
// Time slot filter for constraining discovery recommendations
export type TimeSlot = 'any' | 'morning' | 'afternoon' | 'dawn-patrol';

export const TIME_SLOT_RANGES: Record<TimeSlot, { startHour: number; endHour: number }> = {
  'any': { startHour: 6, endHour: 21 },
  'dawn-patrol': { startHour: 6, endHour: 9 },
  'morning': { startHour: 6, endHour: 12 },
  'afternoon': { startHour: 12, endHour: 18 },
};
```

**Step 2: Add timeSlot to SurfDiscoveryOptions interface**

In `types/personalization.ts`, find `SurfDiscoveryOptions` interface and add:

```typescript
export interface SurfDiscoveryOptions {
  // ... existing properties
  timeSlot?: TimeSlot;  // Filter windows to specific time of day
}
```

**Step 3: Commit**

```bash
git add types/personalization.ts
git commit -m "feat(types): add TimeSlot type and SurfDiscoveryOptions.timeSlot"
```

---

## Task 2: Write Failing Test for Time Slot Filtering

**Files:**
- Create: `__tests__/services/select-best-window-time-slot.test.ts`

**Step 1: Write the failing test file**

```typescript
import { selectBestWindow } from '@/lib/services/surf-discovery-service';
import type { EnhancedForecastEntity } from '@/types/forecast';
import type { Beach } from '@/types/database';

// Helper to create forecast at specific hour
function createForecast(date: string, hour: number, score: number = 70): EnhancedForecastEntity {
  const timeStr = `${hour.toString().padStart(2, '0')}:00:00`;
  return {
    id: `forecast-${date}-${hour}`,
    beach_id: 'test-beach',
    forecast_date: date,
    forecast_time: timeStr,
    wave_height: '3.5',
    wave_period: '12s',
    wave_direction: 'W',
    wind_speed: '5',
    wind_direction: 'E',
    wind_direction_deg: 90,
    tide_height: '3.0',
    tide_status: 'Rising',
    confidence_score: 80,
    data_source: 'TEST',
  } as EnhancedForecastEntity;
}

const mockBeach: Beach = {
  id: 'test-beach',
  name: 'Test Beach',
  slug: 'test-beach',
  lat: 32.75,
  lon: -117.25,
  center_lat: 32.75,
  center_lng: -117.25,
  timezone: 'America/Los_Angeles',
  wind_offshore_deg: 90,
  wind_offshore_tol_deg: 45,
  preferred_tide_ft_min: 2,
  preferred_tide_ft_max: 5,
} as Beach;

describe('selectBestWindow with timeSlot filter', () => {
  // Tomorrow's date for testing
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  const tomorrowStr = tomorrow.toISOString().split('T')[0];

  it('returns morning window when timeSlot=morning', () => {
    const forecasts = [
      createForecast(tomorrowStr, 7),   // 7am - morning
      createForecast(tomorrowStr, 10),  // 10am - morning
      createForecast(tomorrowStr, 14),  // 2pm - afternoon
      createForecast(tomorrowStr, 17),  // 5pm - afternoon
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'morning');

    expect(result).not.toBeNull();
    const startHour = result!.start.getUTCHours();
    // Morning filter: 6am-12pm, so start should be 7 or 10
    expect(startHour).toBeGreaterThanOrEqual(6);
    expect(startHour).toBeLessThan(12);
  });

  it('returns afternoon window when timeSlot=afternoon', () => {
    const forecasts = [
      createForecast(tomorrowStr, 7),   // 7am - morning
      createForecast(tomorrowStr, 10),  // 10am - morning
      createForecast(tomorrowStr, 14),  // 2pm - afternoon
      createForecast(tomorrowStr, 17),  // 5pm - afternoon
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'afternoon');

    expect(result).not.toBeNull();
    const startHour = result!.start.getUTCHours();
    // Afternoon filter: 12pm-6pm, so start should be 14 or 17
    expect(startHour).toBeGreaterThanOrEqual(12);
    expect(startHour).toBeLessThan(18);
  });

  it('returns dawn-patrol window when timeSlot=dawn-patrol', () => {
    const forecasts = [
      createForecast(tomorrowStr, 6),   // 6am - dawn patrol
      createForecast(tomorrowStr, 8),   // 8am - dawn patrol
      createForecast(tomorrowStr, 10),  // 10am - morning only
      createForecast(tomorrowStr, 14),  // 2pm - afternoon
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'dawn-patrol');

    expect(result).not.toBeNull();
    const startHour = result!.start.getUTCHours();
    // Dawn patrol: 6am-9am
    expect(startHour).toBeGreaterThanOrEqual(6);
    expect(startHour).toBeLessThan(9);
  });

  it('returns null when no windows match time slot', () => {
    const forecasts = [
      createForecast(tomorrowStr, 14),  // 2pm - afternoon only
      createForecast(tomorrowStr, 17),  // 5pm - afternoon only
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'morning');

    expect(result).toBeNull();
  });

  it('returns any window when timeSlot=any', () => {
    const forecasts = [
      createForecast(tomorrowStr, 7),
      createForecast(tomorrowStr, 14),
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, 'any');

    expect(result).not.toBeNull();
  });

  it('returns any window when timeSlot is undefined (default behavior)', () => {
    const forecasts = [
      createForecast(tomorrowStr, 7),
      createForecast(tomorrowStr, 14),
    ];

    const result = selectBestWindow(forecasts, mockBeach, null, 48, undefined, undefined);

    expect(result).not.toBeNull();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test:unit --testPathPattern="select-best-window-time-slot" -v`

Expected: FAIL - selectBestWindow doesn't accept 6th parameter

**Step 3: Commit failing test**

```bash
git add __tests__/services/select-best-window-time-slot.test.ts
git commit -m "test: add failing tests for timeSlot filter in selectBestWindow"
```

---

## Task 3: Implement Time Slot Filtering in selectBestWindow

**Files:**
- Modify: `lib/services/surf-discovery-service.ts:934-1328` (selectBestWindow function)

**Step 1: Update selectBestWindow signature**

Find the function signature around line 934 and update:

```typescript
export function selectBestWindow(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  userPrefs: Awaited<ReturnType<typeof getUserSurfPreferences>> | null,
  horizonHours?: number,
  sunTimesCache?: Map<string, { sunrises: Date[]; sunsets: Date[] }>,
  timeSlot?: TimeSlot  // NEW PARAMETER
): PersonalizedForecastWindow | null {
```

**Step 2: Import TimeSlot and TIME_SLOT_RANGES**

At top of file, add to imports from personalization:

```typescript
import type {
  SurfDiscoveryRecommendation,
  SurfDiscoveryResponse,
  SurfDiscoveryOptions,
  DetailedScore,
  PersonalizedForecastWindow,
  TimeSlot,  // ADD THIS
} from '@/types/personalization';
import { TIME_SLOT_RANGES } from '@/types/personalization';  // ADD THIS
```

**Step 3: Add time slot filter after existing daylight filter**

Find the filter at line ~1014-1020 and add time slot filtering after it:

```typescript
  // After existing filter, add time slot filtering
  let filteredForecasts = scoredForecasts;

  if (timeSlot && timeSlot !== 'any') {
    const { startHour, endHour } = TIME_SLOT_RANGES[timeSlot];

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
        return true; // If tz conversion fails, include it
      }
    });
  }

  if (filteredForecasts.length === 0) return null;
```

**Step 4: Update loop to use filteredForecasts**

Change the main loop from `scoredForecasts` to `filteredForecasts`:

```typescript
  for (let i = 0; i < filteredForecasts.length; i++) {
    const { forecast, forecastTime: startTime, score: startScore, isToday } = filteredForecasts[i];
    // ... rest of loop
```

Also update the fallback section to use `filteredForecasts`.

**Step 5: Run tests to verify they pass**

Run: `yarn test:unit --testPathPattern="select-best-window-time-slot" -v`

Expected: PASS (6 tests)

**Step 6: Run existing tests to verify no regression**

Run: `yarn test:unit --testPathPattern="select-best-window" -v`

Expected: All tests pass

**Step 7: Commit**

```bash
git add lib/services/surf-discovery-service.ts types/personalization.ts
git commit -m "feat: implement timeSlot filtering in selectBestWindow"
```

---

## Task 4: Pass timeSlot Through Discovery Service

**Files:**
- Modify: `lib/services/surf-discovery-service.ts:275-454` (discoverSurfSpots function)

**Step 1: Extract timeSlot from options**

In `discoverSurfSpots`, update the destructuring around line 281:

```typescript
  const {
    userLocation,
    radiusMiles = 25,
    horizonHours,
    maxResults = DEFAULT_MAX_RESULTS,
    includeHome = true,
    maxConcurrent = DEFAULT_MAX_CONCURRENT,
    timeout = DEFAULT_TIMEOUT_MS,
    overallTimeout = DEFAULT_OVERALL_TIMEOUT_MS,
    timeSlot,  // ADD THIS
  } = options;
```

**Step 2: Pass timeSlot to selectBestWindow**

Find the call to selectBestWindow around line 367 and add timeSlot:

```typescript
      const bestWindow = selectBestWindow(forecasts, beach, userPrefs, horizonHours, sunTimesCache, timeSlot);
```

**Step 3: Run tests**

Run: `yarn test:unit --testPathPattern="surf-discovery" -v`

Expected: All tests pass

**Step 4: Commit**

```bash
git add lib/services/surf-discovery-service.ts
git commit -m "feat: pass timeSlot through discoverSurfSpots to selectBestWindow"
```

---

## Task 5: Add timeSlot to API Route

**Files:**
- Modify: `app/api/surf/insights/route.ts`

**Step 1: Parse timeSlot query parameter**

Find where query params are parsed and add:

```typescript
import type { TimeSlot } from '@/types/personalization';

// In the GET handler, parse timeSlot
const timeSlotParam = searchParams.get('timeSlot');
const validTimeSlots: TimeSlot[] = ['any', 'morning', 'afternoon', 'dawn-patrol'];
const timeSlot: TimeSlot = validTimeSlots.includes(timeSlotParam as TimeSlot)
  ? (timeSlotParam as TimeSlot)
  : 'any';
```

**Step 2: Pass timeSlot to discoverSurfSpots**

```typescript
const discovery = await discoverSurfSpots(userId, {
  // ... existing options
  timeSlot,
});
```

**Step 3: Commit**

```bash
git add app/api/surf/insights/route.ts
git commit -m "feat(api): add timeSlot query param to surf insights endpoint"
```

---

## Task 6: Create TimeSlotSelector Component

**Files:**
- Create: `components/home-screen/time-slot-selector.tsx`

**Step 1: Create the component**

```typescript
'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import type { TimeSlot } from '@/types/personalization';

interface TimeSlotSelectorProps {
  value: TimeSlot;
  onChange: (slot: TimeSlot) => void;
  className?: string;
}

const TIME_SLOT_OPTIONS: { value: TimeSlot; label: string }[] = [
  { value: 'any', label: 'Any time' },
  { value: 'dawn-patrol', label: 'Dawn patrol' },
  { value: 'morning', label: 'Morning' },
  { value: 'afternoon', label: 'Afternoon' },
];

export function TimeSlotSelector({ value, onChange, className }: TimeSlotSelectorProps) {
  return (
    <div className={cn('flex gap-2 overflow-x-auto pb-1', className)}>
      {TIME_SLOT_OPTIONS.map((option) => (
        <button
          key={option.value}
          onClick={() => onChange(option.value)}
          className={cn(
            'px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors',
            value === option.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-muted text-muted-foreground hover:bg-muted/80'
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}
```

**Step 2: Commit**

```bash
git add components/home-screen/time-slot-selector.tsx
git commit -m "feat(ui): create TimeSlotSelector component"
```

---

## Task 7: Integrate TimeSlotSelector into Home Screen

**Files:**
- Modify: `components/home-screen/index.tsx` (or wherever discovery card lives)
- Modify: `hooks/use-surf-discovery.ts` (if exists)

**Step 1: Add state for timeSlot**

```typescript
import { TimeSlotSelector } from './time-slot-selector';
import type { TimeSlot } from '@/types/personalization';

// In component
const [timeSlot, setTimeSlot] = useState<TimeSlot>('any');
```

**Step 2: Pass timeSlot to API call**

Update the fetch/hook call to include timeSlot:

```typescript
const { data } = useSurfDiscovery({ timeSlot });
// or if using fetch directly:
fetch(`/api/surf/insights?timeSlot=${timeSlot}`)
```

**Step 3: Render TimeSlotSelector**

Add above the recommendations list:

```tsx
<TimeSlotSelector
  value={timeSlot}
  onChange={setTimeSlot}
  className="mb-4"
/>
```

**Step 4: Manual test in browser**

- Navigate to home screen while logged in
- Verify chips appear
- Click "Morning" - recommendations should change
- Click "Afternoon" - recommendations should change
- Verify badges show morning/afternoon times appropriately

**Step 5: Commit**

```bash
git add components/home-screen/
git commit -m "feat(ui): integrate TimeSlotSelector into home screen discovery"
```

---

## Task 8: Handle Empty Results

**Files:**
- Modify: `components/home-screen/index.tsx`

**Step 1: Add empty state handling**

```tsx
{recommendations.length === 0 && timeSlot !== 'any' && (
  <div className="text-center py-8">
    <p className="text-muted-foreground mb-2">
      No great {timeSlot === 'dawn-patrol' ? 'dawn patrol' : timeSlot} windows tomorrow.
    </p>
    <button
      onClick={() => setTimeSlot('any')}
      className="text-primary hover:underline text-sm"
    >
      Show all times
    </button>
  </div>
)}
```

**Step 2: Commit**

```bash
git add components/home-screen/
git commit -m "feat(ui): add empty state for time slot filter"
```

---

## Task 9: Final Integration Test

**Step 1: Run all surf-discovery tests**

Run: `yarn test:unit --testPathPattern="surf-discovery" -v`

Expected: All tests pass

**Step 2: Run full test suite**

Run: `yarn test:unit`

Expected: No regressions

**Step 3: Manual E2E verification**

1. Start dev server: `yarn dev`
2. Log in as test user
3. Navigate to home screen
4. Test each time slot filter
5. Verify recommendations update appropriately
6. Test empty state by selecting time with no good conditions

**Step 4: Final commit**

```bash
git add -A
git commit -m "feat: complete time slot discovery filter feature"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add types/constants | `types/personalization.ts` |
| 2 | Write failing tests | `__tests__/services/select-best-window-time-slot.test.ts` |
| 3 | Implement filter logic | `lib/services/surf-discovery-service.ts` |
| 4 | Wire through discovery | `lib/services/surf-discovery-service.ts` |
| 5 | Add API param | `app/api/surf/insights/route.ts` |
| 6 | Create UI component | `components/home-screen/time-slot-selector.tsx` |
| 7 | Integrate into home | `components/home-screen/index.tsx` |
| 8 | Handle empty state | `components/home-screen/index.tsx` |
| 9 | Final verification | All files |

**Estimated commits:** 9
**Test coverage:** Unit tests for time slot filtering logic
