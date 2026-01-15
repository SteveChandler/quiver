# Dynamic Tide Computation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix stale "Next Tide" display by computing dynamically on client from stored tide schedule.

**Architecture:** Store NOAA tide schedule (20 extremes) in `raw_forecast` JSON field during forecast generation. Client hook extracts schedule and computes next tide relative to `Date.now()`. Recomputes on tab focus.

**Tech Stack:** React hooks, TypeScript, existing EnhancedForecastEntity type, NOAA CO-OPS service

**Design Doc:** `docs/plans/2026-01-14-dynamic-tide-computation-design.md`

---

## Task 1: Add Tide Schedule Types

**Files:**
- Modify: `types/forecast.ts:162-175`

**Step 1: Add tide schedule types to raw_forecast interface**

In `types/forecast.ts`, update the `raw_forecast` type within `EnhancedForecastEntity`:

```typescript
// Around line 162, update raw_forecast type:
raw_forecast?: {
  cdip_data?: any;
  noaa_data?: any;
  data_sources?: string[];
  quality_scores?: {
    cdip?: number;
    noaa?: number;
    overall?: number;
  };
  fetch_timestamps?: {
    cdip?: string;
    noaa?: string;
  };
  // NEW: Tide schedule for dynamic client-side computation
  tide_schedule?: Array<{
    time: number;      // Unix timestamp (seconds)
    height: number;    // Height in feet
    type: 'high' | 'low';
  }>;
  tide_station?: {
    id: string;
    name: string;
  };
} | null;
```

**Step 2: Run type check**

Run: `yarn typecheck`
Expected: PASS (no type errors)

**Step 3: Commit**

```bash
git add types/forecast.ts
git commit -m "feat(types): add tide_schedule to raw_forecast type"
```

---

## Task 2: Create useDynamicTide Hook - Types & Structure

**Files:**
- Create: `hooks/use-dynamic-tide.ts`
- Create: `__tests__/hooks/use-dynamic-tide.test.ts`

**Step 1: Write the failing test for hook structure**

Create `__tests__/hooks/use-dynamic-tide.test.ts`:

```typescript
import { renderHook } from "@testing-library/react";
import { useDynamicTide } from "@/hooks/use-dynamic-tide";
import type { EnhancedForecastEntity } from "@/types/forecast";

describe("useDynamicTide", () => {
  it("returns null values when forecasts array is empty", () => {
    const { result } = renderHook(() => useDynamicTide([]));

    expect(result.current.nextTide).toBeNull();
    expect(result.current.nextHigh).toBeNull();
    expect(result.current.nextLow).toBeNull();
    expect(result.current.minutesUntil).toBeNull();
    expect(result.current.usingFallback).toBe(true);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/hooks/use-dynamic-tide.test.ts`
Expected: FAIL with "Cannot find module '@/hooks/use-dynamic-tide'"

**Step 3: Create minimal hook implementation**

Create `hooks/use-dynamic-tide.ts`:

```typescript
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import type { EnhancedForecastEntity } from "@/types/forecast";

export interface TideExtreme {
  time: number;      // Unix timestamp (seconds)
  height: number;    // Height in feet
  type: "high" | "low";
}

export interface DynamicTideResult {
  /** The soonest upcoming tide (high or low) */
  nextTide: TideExtreme | null;
  /** Minutes until nextTide */
  minutesUntil: number | null;
  /** Next high tide */
  nextHigh: TideExtreme | null;
  /** Next low tide */
  nextLow: TideExtreme | null;
  /** Minutes until next high */
  minutesToHigh: number | null;
  /** Minutes until next low */
  minutesToLow: number | null;
  /** True if using fallback (no tide_schedule found) */
  usingFallback: boolean;
}

export function useDynamicTide(
  forecasts: EnhancedForecastEntity[],
  _beachTimezone?: string | null
): DynamicTideResult {
  const [computedAt, setComputedAt] = useState<number>(Date.now());

  // Default return for empty/missing data
  const defaultResult: DynamicTideResult = {
    nextTide: null,
    minutesUntil: null,
    nextHigh: null,
    nextLow: null,
    minutesToHigh: null,
    minutesToLow: null,
    usingFallback: true,
  };

  if (!forecasts || forecasts.length === 0) {
    return defaultResult;
  }

  return defaultResult;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/hooks/use-dynamic-tide.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/use-dynamic-tide.ts __tests__/hooks/use-dynamic-tide.test.ts
git commit -m "feat(hooks): add useDynamicTide hook skeleton"
```

---

## Task 3: Implement Tide Schedule Extraction

**Files:**
- Modify: `hooks/use-dynamic-tide.ts`
- Modify: `__tests__/hooks/use-dynamic-tide.test.ts`

**Step 1: Write test for tide schedule extraction**

Add to `__tests__/hooks/use-dynamic-tide.test.ts`:

```typescript
import { act } from "@testing-library/react";

// Helper to create mock forecast with tide_schedule
function createMockForecast(tideSchedule?: Array<{ time: number; height: number; type: "high" | "low" }>): EnhancedForecastEntity {
  return {
    id: "test-1",
    beach_id: "beach-1",
    forecast_date: "2026-01-14",
    forecast_time: "12:00",
    wave_height: "3 ft",
    wave_period: "12s",
    wave_direction: "W",
    water_temp: "60°F",
    confidence_score: 80,
    data_source: "NOAA_NWS",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    raw_forecast: tideSchedule ? { tide_schedule: tideSchedule } : null,
  } as EnhancedForecastEntity;
}

describe("useDynamicTide - schedule extraction", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-14T17:00:00Z")); // 5 PM UTC
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("extracts tide_schedule from raw_forecast", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const forecasts = [
      createMockForecast([
        { time: futureTime, height: 5.2, type: "high" },
        { time: futureTime + 7200, height: 0.5, type: "low" },
      ]),
    ];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.usingFallback).toBe(false);
    expect(result.current.nextHigh).not.toBeNull();
    expect(result.current.nextHigh?.height).toBe(5.2);
  });

  it("finds tide_schedule across multiple forecasts", () => {
    const futureTime = Math.floor(Date.now() / 1000) + 3600;
    const forecasts = [
      createMockForecast(), // No schedule
      createMockForecast([{ time: futureTime, height: 4.8, type: "low" }]),
    ];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    expect(result.current.usingFallback).toBe(false);
    expect(result.current.nextLow?.height).toBe(4.8);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/hooks/use-dynamic-tide.test.ts`
Expected: FAIL (usingFallback is still true)

**Step 3: Implement schedule extraction**

Update `hooks/use-dynamic-tide.ts`:

```typescript
export function useDynamicTide(
  forecasts: EnhancedForecastEntity[],
  _beachTimezone?: string | null
): DynamicTideResult {
  const [computedAt, setComputedAt] = useState<number>(Date.now());

  // Extract tide_schedule from the first forecast that has it
  const tideSchedule = useMemo(() => {
    if (!forecasts || forecasts.length === 0) return null;

    for (const forecast of forecasts) {
      const schedule = forecast.raw_forecast?.tide_schedule;
      if (Array.isArray(schedule) && schedule.length > 0) {
        return schedule;
      }
    }
    return null;
  }, [forecasts]);

  // Compute next tides from schedule
  const tideResult = useMemo((): DynamicTideResult => {
    if (!tideSchedule) {
      return {
        nextTide: null,
        minutesUntil: null,
        nextHigh: null,
        nextLow: null,
        minutesToHigh: null,
        minutesToLow: null,
        usingFallback: true,
      };
    }

    const nowSeconds = computedAt / 1000;
    let nextHigh: TideExtreme | null = null;
    let nextLow: TideExtreme | null = null;

    for (const tide of tideSchedule) {
      if (tide.time > nowSeconds) {
        if (tide.type === "high" && !nextHigh) {
          nextHigh = { time: tide.time, height: tide.height, type: "high" };
        }
        if (tide.type === "low" && !nextLow) {
          nextLow = { time: tide.time, height: tide.height, type: "low" };
        }
        if (nextHigh && nextLow) break;
      }
    }

    // Determine which tide comes first
    let nextTide: TideExtreme | null = null;
    if (nextHigh && nextLow) {
      nextTide = nextHigh.time < nextLow.time ? nextHigh : nextLow;
    } else {
      nextTide = nextHigh || nextLow;
    }

    const minutesUntil = nextTide
      ? Math.round((nextTide.time - nowSeconds) / 60)
      : null;
    const minutesToHigh = nextHigh
      ? Math.round((nextHigh.time - nowSeconds) / 60)
      : null;
    const minutesToLow = nextLow
      ? Math.round((nextLow.time - nowSeconds) / 60)
      : null;

    return {
      nextTide,
      minutesUntil,
      nextHigh,
      nextLow,
      minutesToHigh,
      minutesToLow,
      usingFallback: false,
    };
  }, [tideSchedule, computedAt]);

  return tideResult;
}
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/hooks/use-dynamic-tide.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/use-dynamic-tide.ts __tests__/hooks/use-dynamic-tide.test.ts
git commit -m "feat(hooks): implement tide schedule extraction in useDynamicTide"
```

---

## Task 4: Add Visibility Change Recomputation

**Files:**
- Modify: `hooks/use-dynamic-tide.ts`
- Modify: `__tests__/hooks/use-dynamic-tide.test.ts`

**Step 1: Write test for visibility change**

Add to `__tests__/hooks/use-dynamic-tide.test.ts`:

```typescript
describe("useDynamicTide - visibility recomputation", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-01-14T17:00:00Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("recomputes when tab becomes visible", () => {
    const initialTime = Math.floor(Date.now() / 1000) + 3600; // 1 hour away
    const forecasts = [
      createMockForecast([
        { time: initialTime, height: 5.2, type: "high" },
      ]),
    ];

    const { result } = renderHook(() => useDynamicTide(forecasts));

    // Initial: ~60 minutes until tide
    expect(result.current.minutesUntil).toBeCloseTo(60, -1);

    // Advance time by 30 minutes
    act(() => {
      jest.advanceTimersByTime(30 * 60 * 1000);
    });

    // Simulate tab becoming visible
    act(() => {
      Object.defineProperty(document, "visibilityState", {
        value: "visible",
        writable: true,
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });

    // Should now show ~30 minutes
    expect(result.current.minutesUntil).toBeCloseTo(30, -1);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `yarn test __tests__/hooks/use-dynamic-tide.test.ts`
Expected: FAIL (minutesUntil doesn't update)

**Step 3: Add visibility change listener**

Update `hooks/use-dynamic-tide.ts` - add useEffect after the useMemo blocks:

```typescript
  // Recompute on mount and when tab becomes visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        setComputedAt(Date.now());
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return tideResult;
```

**Step 4: Run test to verify it passes**

Run: `yarn test __tests__/hooks/use-dynamic-tide.test.ts`
Expected: PASS

**Step 5: Commit**

```bash
git add hooks/use-dynamic-tide.ts __tests__/hooks/use-dynamic-tide.test.ts
git commit -m "feat(hooks): add visibility change recomputation to useDynamicTide"
```

---

## Task 5: Store Tide Schedule in Forecast Service

**Files:**
- Modify: `lib/services/enhanced-forecast-service.ts`

**Step 1: Find the combineDataSources method and add tracking variable**

Locate the `combineDataSources` method (around line 390). Add a variable to track first forecast of each day:

```typescript
// Inside combineDataSources, before the timepoints loop (around line 470):
const processedDates = new Set<string>();
```

**Step 2: Add tide_schedule to raw_forecast**

In the forecast object creation (around line 676), update raw_forecast:

```typescript
// Replace the raw_forecast block with:
const isFirstOfDay = !processedDates.has(dateString);
if (isFirstOfDay) {
  processedDates.add(dateString);
}

// Then in the forecast object:
raw_forecast: {
  data_sources: dataSources,
  // Existing CDIP data block...
  ...(useCDIPData && cdipData && {
    cdip_data: {
      stationId: (cdipData as any).stationId,
      stationName: (cdipData as any).stationName,
      lastUpdated: (cdipData as any).lastUpdated,
      dataSource: "CDIP",
      data: Array.isArray((cdipData as any).data)
        ? (cdipData as any).data.slice(0, 2)
        : [],
    },
  }),
  // Existing quality_scores and fetch_timestamps...
  quality_scores: {
    cdip: cdipData
      ? this.dataSourceManager.getCDIPService().getDataQualityScore(cdipData)
      : undefined,
    noaa: waveData ? 75 : undefined,
    overall: confidenceScore,
  },
  fetch_timestamps: {
    cdip: cdipData?.lastUpdated,
    noaa: now.toISOString(),
  },
  // NEW: Store tide schedule on first forecast of each day
  ...(isFirstOfDay && tideData?.tides && {
    tide_schedule: tideData.tides.slice(0, 20).map((t: any) => ({
      time: t.time,
      height: t.height,
      type: t.type,
    })),
    tide_station: {
      id: tideData.station_id,
      name: tideData.station_name,
    },
  }),
},
```

**Step 3: Run type check**

Run: `yarn typecheck`
Expected: PASS

**Step 4: Commit**

```bash
git add lib/services/enhanced-forecast-service.ts
git commit -m "feat(forecast): store tide_schedule in raw_forecast"
```

---

## Task 6: Update Forecast Tab to Use Hook

**Files:**
- Modify: `components/beach-detail/tabs/forecast-tab.tsx`

**Step 1: Import the hook**

At the top of `forecast-tab.tsx`, add:

```typescript
import { useDynamicTide } from "@/hooks/use-dynamic-tide";
```

**Step 2: Use the hook in the component**

Inside the `ForecastTab` component, after the existing hooks (around line 80):

```typescript
// Dynamic tide computation (always fresh, relative to now)
const dynamicTide = useDynamicTide(forecasts, beachTimezone);
```

**Step 3: Update hero tide display**

Replace the existing hero tide variables (around line 192-196):

```typescript
// Replace these lines:
// const heroNextTideHeight = currentForecast?.next_tide_height ?? "";
// const heroNextTideType = currentForecast?.next_tide_type ?? "—";

// With dynamic computation with fallback:
const heroNextTideType = dynamicTide.nextTide
  ? dynamicTide.nextTide.type === "high"
    ? "High Tide"
    : "Low Tide"
  : currentForecast?.next_tide_type ?? "—";

const heroNextTideHeight = dynamicTide.nextTide
  ? `${dynamicTide.nextTide.height.toFixed(1)} ft`
  : currentForecast?.next_tide_height ?? "";

// For the time display, create a helper:
const getNextTideTimeDisplay = () => {
  if (dynamicTide.nextTide) {
    const date = new Date(dynamicTide.nextTide.time * 1000);
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  }
  return formatTimeString(currentForecast?.next_tide_time, currentForecast?.next_tide_at);
};
```

**Step 4: Update the JSX**

Find the "Next Tide" card JSX (around line 343-354) and update the time display:

```typescript
<div className="text-sm text-muted-foreground">
  {heroNextTideHeight} · {getNextTideTimeDisplay()}
</div>
```

**Step 5: Run type check and build**

Run: `yarn typecheck && yarn build`
Expected: PASS

**Step 6: Commit**

```bash
git add components/beach-detail/tabs/forecast-tab.tsx
git commit -m "feat(forecast-tab): use useDynamicTide for next tide display"
```

---

## Task 7: Update Tide Diagnostics Generator

**Files:**
- Modify: `lib/utils/tide-diagnostics-generator.ts`

**Step 1: Update findNextExtremes to use tide_schedule**

Replace the `findNextExtremes` function (around line 85-139):

```typescript
function findNextExtremes(
  forecasts: EnhancedForecastEntity[],
  now: Date
): { nextHigh: TideExtreme | null; nextLow: TideExtreme | null } {
  let nextHigh: TideExtreme | null = null;
  let nextLow: TideExtreme | null = null;
  const nowSeconds = now.getTime() / 1000;

  // NEW: Try tide_schedule first (most accurate)
  for (const forecast of forecasts) {
    const schedule = forecast.raw_forecast?.tide_schedule;
    if (Array.isArray(schedule) && schedule.length > 0) {
      for (const tide of schedule) {
        if (tide.time > nowSeconds) {
          if (tide.type === "high" && !nextHigh) {
            nextHigh = {
              time: new Date(tide.time * 1000),
              height: tide.height,
            };
          }
          if (tide.type === "low" && !nextLow) {
            nextLow = {
              time: new Date(tide.time * 1000),
              height: tide.height,
            };
          }
          if (nextHigh && nextLow) return { nextHigh, nextLow };
        }
      }
      // If we found the schedule, use what we got (even if partial)
      if (nextHigh || nextLow) return { nextHigh, nextLow };
    }
  }

  // EXISTING FALLBACK: Parse static next_tide_* fields
  for (const forecast of forecasts) {
    const dateStr = forecast.forecast_date?.includes("T")
      ? forecast.forecast_date.split("T")[0]
      : forecast.forecast_date;
    const baseDate = dateStr ? new Date(dateStr) : now;

    if (forecast.next_tide_time && forecast.next_tide_type) {
      const tideTime = parseTime(forecast.next_tide_time, baseDate);
      const tideHeight = parseHeight(forecast.next_tide_height);

      if (tideTime && tideTime > now && tideHeight !== null) {
        const type = forecast.next_tide_type.toLowerCase();

        if (type.includes("high") && !nextHigh) {
          nextHigh = { time: tideTime, height: tideHeight };
        } else if (type.includes("low") && !nextLow) {
          nextLow = { time: tideTime, height: tideHeight };
        }
      }
    }

    if (nextHigh && nextLow) break;
  }

  return { nextHigh, nextLow };
}
```

**Step 2: Run existing tests**

Run: `yarn test __tests__/lib/utils/tide-diagnostics-generator.test.ts`
Expected: PASS (existing tests should still pass)

**Step 3: Commit**

```bash
git add lib/utils/tide-diagnostics-generator.ts
git commit -m "feat(tide-diagnostics): prefer tide_schedule over static fields"
```

---

## Task 8: Manual Testing

**Step 1: Trigger forecast refresh for a test beach**

```bash
# In browser or via curl, trigger forecast refresh:
curl -X POST "http://localhost:3000/api/forecasts/refresh?beachId=<test-beach-id>"
```

**Step 2: Verify tide_schedule in database**

Check Supabase dashboard or query directly to confirm `raw_forecast.tide_schedule` is populated.

**Step 3: Test in browser**

1. Open beach detail page (e.g., `/ca/san-diego/avalanche`)
2. Check "Next Tide" shows a **future** time
3. Wait or manually change system time, switch tabs, verify it updates
4. Check Tides tab shows consistent data

**Step 4: Test fallback**

1. Find a beach with old forecast data (no tide_schedule)
2. Verify it still shows the static values (graceful fallback)

---

## Task 9: Final Cleanup & PR

**Step 1: Run full test suite**

```bash
yarn test
yarn typecheck
yarn lint
```

**Step 2: Final commit if needed**

```bash
git add -A
git commit -m "chore: cleanup and fixes"
```

**Step 3: Create PR**

```bash
gh pr create --title "feat: dynamic tide computation" --body "## Summary
- Store tide schedule in raw_forecast during forecast generation
- New useDynamicTide hook computes next tide relative to current time
- Recomputes on tab focus to handle long page visits
- Falls back to static values for old forecasts

Fixes stale 'Next Tide' display issue.

## Test Plan
- [x] Unit tests for useDynamicTide hook
- [x] Manual test: Next Tide shows future time
- [x] Manual test: Updates on tab focus
- [x] Manual test: Fallback works for old data
"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add tide schedule types | `types/forecast.ts` |
| 2 | Create hook skeleton | `hooks/use-dynamic-tide.ts`, tests |
| 3 | Implement schedule extraction | `hooks/use-dynamic-tide.ts`, tests |
| 4 | Add visibility recomputation | `hooks/use-dynamic-tide.ts`, tests |
| 5 | Store schedule in forecast | `lib/services/enhanced-forecast-service.ts` |
| 6 | Update forecast tab | `components/beach-detail/tabs/forecast-tab.tsx` |
| 7 | Update diagnostics generator | `lib/utils/tide-diagnostics-generator.ts` |
| 8 | Manual testing | — |
| 9 | Final cleanup & PR | — |
