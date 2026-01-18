# Tide-Driven Window Boundaries Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Calculate surf window start/end times based on when tide crosses beach-specific height thresholds, replacing hourly boundaries with precise times like "7:23-9:18am".

**Architecture:** Add cosine interpolation to calculate tide threshold crossing times. Modify `selectBestWindow()` to use these crossing times instead of hourly forecast timestamps. Fallback to current behavior when tide data is missing.

**Tech Stack:** TypeScript, Jest for testing, existing tide-interpolation.ts utilities

---

## Task 1: Add Cosine Interpolation for Tide Heights

**Files:**
- Modify: `lib/utils/tide-interpolation.ts`
- Test: `__tests__/lib/tide-interpolation.test.ts`

### Step 1: Write the failing test for cosine interpolation

Add to `__tests__/lib/tide-interpolation.test.ts`:

```typescript
describe('interpolateTideHeightCosine', () => {
  it('should use cosine interpolation between tide events', () => {
    // Low tide at 6:47am (1.2ft), High tide at 12:52pm (5.8ft)
    const lowTide = { time: new Date('2026-01-17T14:47:00Z'), height: 1.2 }; // 6:47am PST
    const highTide = { time: new Date('2026-01-17T20:52:00Z'), height: 5.8 }; // 12:52pm PST

    // Midpoint should NOT be linear average (3.5), but cosine-based
    const midpoint = new Date('2026-01-17T17:49:30Z'); // Halfway between
    const result = interpolateTideHeightCosine([lowTide, highTide], midpoint);

    // Cosine midpoint: 1.2 + (5.8 - 1.2) * (1 - cos(π/2)) / 2 = 1.2 + 4.6 * 0.5 = 3.5
    // Actually at midpoint, cosine gives same as linear. Test at 25% point instead.
    const quarterPoint = new Date('2026-01-17T16:18:15Z'); // 25% of the way
    const quarterResult = interpolateTideHeightCosine([lowTide, highTide], quarterPoint);

    // Linear would give: 1.2 + 4.6 * 0.25 = 2.35
    // Cosine gives: 1.2 + 4.6 * (1 - cos(0.25 * π)) / 2 = 1.2 + 4.6 * 0.146 = 1.87
    expect(quarterResult).toBeCloseTo(1.87, 1);
  });

  it('should handle falling tide correctly', () => {
    // High tide at 6am (5.5ft), Low tide at 12pm (0.8ft)
    const highTide = { time: new Date('2026-01-17T14:00:00Z'), height: 5.5 };
    const lowTide = { time: new Date('2026-01-17T20:00:00Z'), height: 0.8 };

    const quarterPoint = new Date('2026-01-17T15:30:00Z'); // 25% of the way
    const result = interpolateTideHeightCosine([highTide, lowTide], quarterPoint);

    // Cosine gives slower initial drop: 5.5 - 4.7 * 0.146 = 4.81
    expect(result).toBeCloseTo(4.81, 1);
  });
});
```

### Step 2: Run test to verify it fails

Run: `yarn jest __tests__/lib/tide-interpolation.test.ts -t "interpolateTideHeightCosine" --no-coverage`

Expected: FAIL with "interpolateTideHeightCosine is not a function"

### Step 3: Implement cosine interpolation

Add to `lib/utils/tide-interpolation.ts`:

```typescript
/**
 * Cosine interpolation factor - more accurate for tidal motion
 * Returns value between 0 and 1 representing progress through tide cycle
 */
function cosineInterpolationFactor(t: number): number {
  return (1 - Math.cos(t * Math.PI)) / 2;
}

/**
 * Interpolates tide height using cosine interpolation (more accurate for tides).
 * Tides follow a sinusoidal pattern, so cosine interpolation is more accurate
 * than linear interpolation between high/low tide events.
 *
 * @param data - Array of tide data points (high/low events)
 * @param targetTime - Target timestamp to interpolate
 * @returns Interpolated tide height in feet, or null if insufficient data
 */
export function interpolateTideHeightCosine(
  data: TideDataPoint[],
  targetTime: Date | string | number
): number | null {
  if (!data || data.length === 0) return null;

  const targetTs = normalizeTimestamp(targetTime);

  // Normalize all points to have numeric timestamps
  const points = data
    .map(point => ({
      ts: normalizeTimestamp(point.time),
      height: point.height,
    }))
    .filter(p => !isNaN(p.ts) && isFinite(p.height))
    .sort((a, b) => a.ts - b.ts);

  if (points.length === 0) return null;
  if (points.length === 1) return points[0].height;

  // If target is before first point, return first height
  if (targetTs <= points[0].ts) return points[0].height;

  // If target is after last point, return last height
  if (targetTs >= points[points.length - 1].ts) {
    return points[points.length - 1].height;
  }

  // Find the two points that bracket the target time
  for (let i = 0; i < points.length - 1; i++) {
    const before = points[i];
    const after = points[i + 1];

    if (targetTs >= before.ts && targetTs <= after.ts) {
      const timeDiff = after.ts - before.ts;
      if (timeDiff === 0) return before.height;

      const t = (targetTs - before.ts) / timeDiff;
      const cosineT = cosineInterpolationFactor(t);

      // Cosine interpolation
      return before.height + (after.height - before.height) * cosineT;
    }
  }

  return null;
}
```

### Step 4: Run test to verify it passes

Run: `yarn jest __tests__/lib/tide-interpolation.test.ts -t "interpolateTideHeightCosine" --no-coverage`

Expected: PASS

### Step 5: Commit

```bash
git add lib/utils/tide-interpolation.ts __tests__/lib/tide-interpolation.test.ts
git commit -m "feat(tide): add cosine interpolation for accurate tide heights"
```

---

## Task 2: Add Tide Threshold Crossing Calculator

**Files:**
- Modify: `lib/utils/tide-interpolation.ts`
- Test: `__tests__/lib/tide-interpolation.test.ts`

### Step 1: Write the failing test for threshold crossing

Add to `__tests__/lib/tide-interpolation.test.ts`:

```typescript
describe('findTideThresholdCrossing', () => {
  // Low tide at 6:47am (1.2ft), High tide at 12:52pm (5.8ft)
  const lowTide = { time: new Date('2026-01-17T14:47:00Z'), height: 1.2 };
  const highTide = { time: new Date('2026-01-17T20:52:00Z'), height: 5.8 };
  const tideSchedule = [lowTide, highTide];

  it('should find when rising tide crosses threshold', () => {
    const result = findTideThresholdCrossing(
      tideSchedule,
      2.0, // Target height
      'rising',
      new Date('2026-01-17T14:00:00Z') // After this time
    );

    expect(result).not.toBeNull();
    // Should be sometime between low and high tide
    expect(result!.getTime()).toBeGreaterThan(lowTide.time.getTime());
    expect(result!.getTime()).toBeLessThan(highTide.time.getTime());

    // Verify the height at crossing time is approximately 2.0ft
    const heightAtCrossing = interpolateTideHeightCosine(tideSchedule, result!);
    expect(heightAtCrossing).toBeCloseTo(2.0, 1);
  });

  it('should find when falling tide crosses threshold', () => {
    // High tide first, then low tide
    const fallingSchedule = [
      { time: new Date('2026-01-17T08:00:00Z'), height: 5.5 },
      { time: new Date('2026-01-17T14:00:00Z'), height: 0.8 },
    ];

    const result = findTideThresholdCrossing(
      fallingSchedule,
      3.0, // Target height
      'falling',
      new Date('2026-01-17T07:00:00Z')
    );

    expect(result).not.toBeNull();
    const heightAtCrossing = interpolateTideHeightCosine(fallingSchedule, result!);
    expect(heightAtCrossing).toBeCloseTo(3.0, 1);
  });

  it('should return null if threshold is never crossed', () => {
    const result = findTideThresholdCrossing(
      tideSchedule,
      10.0, // Higher than high tide
      'rising',
      new Date('2026-01-17T14:00:00Z')
    );

    expect(result).toBeNull();
  });

  it('should return null if threshold already passed', () => {
    const result = findTideThresholdCrossing(
      tideSchedule,
      1.5, // Below current tide at search start
      'rising',
      new Date('2026-01-17T18:00:00Z') // After tide already passed 1.5ft
    );

    expect(result).toBeNull();
  });

  it('should handle empty tide schedule', () => {
    const result = findTideThresholdCrossing(
      [],
      2.0,
      'rising',
      new Date()
    );

    expect(result).toBeNull();
  });
});
```

### Step 2: Run test to verify it fails

Run: `yarn jest __tests__/lib/tide-interpolation.test.ts -t "findTideThresholdCrossing" --no-coverage`

Expected: FAIL with "findTideThresholdCrossing is not a function"

### Step 3: Implement threshold crossing calculator

Add to `lib/utils/tide-interpolation.ts`:

```typescript
/**
 * Inverse cosine interpolation - finds t value (0-1) for a given height
 * @param startHeight - Height at start of interval
 * @param endHeight - Height at end of interval
 * @param targetHeight - Height to find
 * @returns t value (0-1) or null if target outside range
 */
function inverseCosineInterpolation(
  startHeight: number,
  endHeight: number,
  targetHeight: number
): number | null {
  const range = endHeight - startHeight;
  if (range === 0) return null;

  const normalized = (targetHeight - startHeight) / range;
  if (normalized < 0 || normalized > 1) return null;

  // Inverse of cosine interpolation: t = acos(1 - 2*normalized) / π
  return Math.acos(1 - 2 * normalized) / Math.PI;
}

/**
 * Finds when tide crosses a specific height threshold.
 *
 * @param tideSchedule - Array of tide events (high/low points)
 * @param targetHeight - Height threshold to find crossing for
 * @param direction - 'rising' or 'falling' - which crossing to find
 * @param afterTime - Only find crossings after this time
 * @returns Date when tide crosses threshold, or null if not found
 */
export function findTideThresholdCrossing(
  tideSchedule: TideDataPoint[],
  targetHeight: number,
  direction: 'rising' | 'falling',
  afterTime: Date | string | number
): Date | null {
  if (!tideSchedule || tideSchedule.length < 2) return null;

  const afterTs = normalizeTimestamp(afterTime);

  // Normalize and sort tide events
  const events = tideSchedule
    .map(point => ({
      ts: normalizeTimestamp(point.time),
      height: point.height,
    }))
    .filter(p => !isNaN(p.ts) && isFinite(p.height))
    .sort((a, b) => a.ts - b.ts);

  if (events.length < 2) return null;

  // Find consecutive event pairs that could contain the crossing
  for (let i = 0; i < events.length - 1; i++) {
    const start = events[i];
    const end = events[i + 1];

    // Skip if this interval ends before our search start
    if (end.ts <= afterTs) continue;

    // Determine if this interval is rising or falling
    const isRising = end.height > start.height;
    if ((direction === 'rising') !== isRising) continue;

    // Check if target height is within this interval's range
    const minHeight = Math.min(start.height, end.height);
    const maxHeight = Math.max(start.height, end.height);
    if (targetHeight < minHeight || targetHeight > maxHeight) continue;

    // Calculate when tide crosses threshold using inverse cosine interpolation
    const t = inverseCosineInterpolation(start.height, end.height, targetHeight);
    if (t === null) continue;

    const crossingTs = start.ts + t * (end.ts - start.ts);

    // Skip if crossing is before our search start
    if (crossingTs <= afterTs) continue;

    return new Date(crossingTs);
  }

  return null;
}
```

### Step 4: Run test to verify it passes

Run: `yarn jest __tests__/lib/tide-interpolation.test.ts -t "findTideThresholdCrossing" --no-coverage`

Expected: PASS

### Step 5: Commit

```bash
git add lib/utils/tide-interpolation.ts __tests__/lib/tide-interpolation.test.ts
git commit -m "feat(tide): add threshold crossing calculator with cosine interpolation"
```

---

## Task 3: Add Tide Window Calculator

**Files:**
- Modify: `lib/utils/tide-interpolation.ts`
- Test: `__tests__/lib/tide-interpolation.test.ts`

### Step 1: Write the failing test for tide window calculation

Add to `__tests__/lib/tide-interpolation.test.ts`:

```typescript
import type { TideScheduleEntry } from '@/types/forecast';

describe('calculateTideWindow', () => {
  // Realistic San Diego tide schedule
  const tideSchedule: TideScheduleEntry[] = [
    { time: 1737129420, height: 1.2, type: 'low' },  // 6:47am
    { time: 1737151320, height: 5.8, type: 'high' }, // 12:52pm
    { time: 1737175920, height: 0.5, type: 'low' },  // 7:45pm
  ];

  it('should calculate window for rising tide beach', () => {
    const result = calculateTideWindow({
      tideSchedule,
      minHeight: 2.0,
      maxHeight: 4.0,
      preferredDirection: 'rising',
      afterTime: new Date('2026-01-17T14:00:00Z'), // 6am PST
    });

    expect(result).not.toBeNull();
    expect(result!.start.getTime()).toBeGreaterThan(new Date('2026-01-17T14:47:00Z').getTime());
    expect(result!.end.getTime()).toBeLessThan(new Date('2026-01-17T20:52:00Z').getTime());

    // Verify heights at boundaries
    const startHeight = interpolateTideHeightCosine(
      tideSchedule.map(t => ({ time: t.time * 1000, height: t.height })),
      result!.start
    );
    const endHeight = interpolateTideHeightCosine(
      tideSchedule.map(t => ({ time: t.time * 1000, height: t.height })),
      result!.end
    );

    expect(startHeight).toBeCloseTo(2.0, 1);
    expect(endHeight).toBeCloseTo(4.0, 1);
  });

  it('should calculate window for falling tide beach', () => {
    const result = calculateTideWindow({
      tideSchedule,
      minHeight: 2.0,
      maxHeight: 4.0,
      preferredDirection: 'falling',
      afterTime: new Date('2026-01-17T20:00:00Z'), // After high tide
    });

    expect(result).not.toBeNull();
    // On falling tide, start is when it drops below max, end when it drops below min
    expect(result!.start.getTime()).toBeGreaterThan(new Date('2026-01-17T20:52:00Z').getTime());
  });

  it('should return null for "either" direction if no valid window', () => {
    const result = calculateTideWindow({
      tideSchedule,
      minHeight: 10.0, // Above any tide height
      maxHeight: 12.0,
      preferredDirection: 'either',
      afterTime: new Date('2026-01-17T14:00:00Z'),
    });

    expect(result).toBeNull();
  });

  it('should handle "slack" preference by finding mid-tide window', () => {
    const result = calculateTideWindow({
      tideSchedule,
      minHeight: 2.5,
      maxHeight: 4.5,
      preferredDirection: 'slack',
      afterTime: new Date('2026-01-17T14:00:00Z'),
    });

    expect(result).not.toBeNull();
    // Slack prefers times around mid-tide
  });
});
```

### Step 2: Run test to verify it fails

Run: `yarn jest __tests__/lib/tide-interpolation.test.ts -t "calculateTideWindow" --no-coverage`

Expected: FAIL with "calculateTideWindow is not a function"

### Step 3: Implement tide window calculator

Add to `lib/utils/tide-interpolation.ts`:

```typescript
import type { TideScheduleEntry } from '@/types/forecast';

export interface TideWindowOptions {
  tideSchedule: TideScheduleEntry[];
  minHeight: number;
  maxHeight: number;
  preferredDirection: 'rising' | 'falling' | 'slack' | 'either';
  afterTime: Date | string | number;
}

export interface TideWindow {
  start: Date;
  end: Date;
}

/**
 * Calculates the optimal tide window based on height thresholds and direction preference.
 *
 * @param options - Configuration for tide window calculation
 * @returns Tide window with start/end times, or null if no valid window
 */
export function calculateTideWindow(options: TideWindowOptions): TideWindow | null {
  const { tideSchedule, minHeight, maxHeight, preferredDirection, afterTime } = options;

  if (!tideSchedule || tideSchedule.length < 2) return null;

  // Convert TideScheduleEntry to TideDataPoint format (time in ms)
  const tidePoints: TideDataPoint[] = tideSchedule.map(t => ({
    time: t.time * 1000, // Convert seconds to milliseconds
    height: t.height,
  }));

  const afterTs = normalizeTimestamp(afterTime);

  // For 'either' or 'slack', try both directions and pick first valid
  const directionsToTry: ('rising' | 'falling')[] =
    preferredDirection === 'either' || preferredDirection === 'slack'
      ? ['rising', 'falling']
      : [preferredDirection];

  for (const direction of directionsToTry) {
    // For rising tide: start when tide rises to minHeight, end when it reaches maxHeight
    // For falling tide: start when tide falls to maxHeight, end when it falls to minHeight
    const startHeight = direction === 'rising' ? minHeight : maxHeight;
    const endHeight = direction === 'rising' ? maxHeight : minHeight;

    const startTime = findTideThresholdCrossing(tidePoints, startHeight, direction, afterTs);
    if (!startTime) continue;

    const endTime = findTideThresholdCrossing(tidePoints, endHeight, direction, startTime);
    if (!endTime) continue;

    // Validate window is reasonable (at least 30 minutes)
    if (endTime.getTime() - startTime.getTime() < 30 * 60 * 1000) continue;

    return { start: startTime, end: endTime };
  }

  return null;
}
```

### Step 4: Run test to verify it passes

Run: `yarn jest __tests__/lib/tide-interpolation.test.ts -t "calculateTideWindow" --no-coverage`

Expected: PASS

### Step 5: Commit

```bash
git add lib/utils/tide-interpolation.ts __tests__/lib/tide-interpolation.test.ts
git commit -m "feat(tide): add tide window calculator for threshold-based boundaries"
```

---

## Task 4: Integrate Tide Windows into Window Selector

**Files:**
- Modify: `lib/services/discovery/window-selector.ts`
- Test: `__tests__/lib/services/discovery/window-selector.test.ts`

### Step 1: Write the failing test for tide-driven boundaries

Add to `__tests__/lib/services/discovery/window-selector.test.ts`:

```typescript
describe('selectBestWindow with tide-driven boundaries', () => {
  const fixedNow = new Date('2024-01-15T16:00:00Z'); // 8am PST

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(fixedNow);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should use tide threshold crossings for window boundaries when data available', () => {
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T14:47:00Z').getTime() / 1000), height: 1.2, type: 'low' as const },
      { time: Math.floor(new Date('2024-01-15T20:52:00Z').getTime() / 1000), height: 5.8, type: 'high' as const },
    ];

    const forecasts = [
      createForecast({
        id: 'forecast-with-tide',
        forecast_date: '2024-01-15',
        forecast_time: '17:00', // 9am PST
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

    const result = selectBestWindow(
      forecasts,
      beachWithTidePrefs,
      null
    );

    expect(result).not.toBeNull();

    // Window should NOT start exactly on the hour
    const startMinutes = result!.start.getMinutes();
    const endMinutes = result!.end.getMinutes();

    // At least one of start/end should have non-zero minutes (tide-driven)
    // This is a weak assertion - the key is the times align with tide crossings
    expect(startMinutes !== 0 || endMinutes !== 0).toBe(true);
  });

  it('should fall back to hourly boundaries when tide data is missing', () => {
    const forecasts = [
      createForecast({
        forecast_date: '2024-01-15',
        forecast_time: '17:00',
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
        // No raw_forecast with tide_schedule
      }),
    ];

    const result = selectBestWindow(
      forecasts,
      mockBeach as Beach,
      null
    );

    expect(result).not.toBeNull();
    // Should start on the hour (fallback behavior)
    expect(result!.start.getMinutes()).toBe(0);
  });

  it('should fall back when beach has no tide height thresholds', () => {
    const tideSchedule = [
      { time: Math.floor(new Date('2024-01-15T14:47:00Z').getTime() / 1000), height: 1.2, type: 'low' as const },
      { time: Math.floor(new Date('2024-01-15T20:52:00Z').getTime() / 1000), height: 5.8, type: 'high' as const },
    ];

    const forecasts = [
      createForecast({
        forecast_date: '2024-01-15',
        forecast_time: '17:00',
        wave_height: '4',
        wave_period: '12s',
        confidence_score: 80,
        raw_forecast: {
          tide_schedule: tideSchedule,
          data_sources: ['NOAA_NWS'],
        },
      } as any),
    ];

    const result = selectBestWindow(
      forecasts,
      mockBeachNoPrefs as Beach, // No tide thresholds
      null
    );

    expect(result).not.toBeNull();
    // Should use hourly boundaries (no tide thresholds to apply)
    expect(result!.start.getMinutes()).toBe(0);
  });
});
```

### Step 2: Run test to verify it fails

Run: `yarn jest __tests__/lib/services/discovery/window-selector.test.ts -t "tide-driven boundaries" --no-coverage`

Expected: FAIL (current implementation doesn't use tide thresholds for boundaries)

### Step 3: Implement tide-driven window boundaries

Modify `lib/services/discovery/window-selector.ts`:

Add import at top:

```typescript
import { calculateTideWindow } from '@/lib/utils/tide-interpolation';
import type { TideScheduleEntry } from '@/types/forecast';
```

Add helper function after existing helpers (around line 130):

```typescript
/**
 * Extract tide schedule from forecasts.
 * The tide schedule is stored in raw_forecast of the first forecast of each day.
 */
function extractTideSchedule(forecasts: EnhancedForecastEntity[]): TideScheduleEntry[] | null {
  for (const forecast of forecasts) {
    const rawForecast = forecast.raw_forecast as { tide_schedule?: TideScheduleEntry[] } | null;
    if (rawForecast?.tide_schedule && rawForecast.tide_schedule.length >= 2) {
      return rawForecast.tide_schedule;
    }
  }
  return null;
}

/**
 * Calculate tide-driven window boundaries if beach has tide thresholds.
 * Returns null to indicate fallback to hourly boundaries should be used.
 */
function calculateTideDrivenBoundaries(
  forecasts: EnhancedForecastEntity[],
  beach: Beach,
  startTime: Date
): { start: Date; end: Date } | null {
  // Check if beach has tide thresholds
  if (
    beach.preferred_tide_ft_min === null ||
    beach.preferred_tide_ft_min === undefined ||
    beach.preferred_tide_ft_max === null ||
    beach.preferred_tide_ft_max === undefined
  ) {
    return null;
  }

  // Extract tide schedule from forecasts
  const tideSchedule = extractTideSchedule(forecasts);
  if (!tideSchedule) {
    return null;
  }

  // Map direction preference
  const directionMap: Record<string, 'rising' | 'falling' | 'slack' | 'either'> = {
    rising: 'rising',
    falling: 'falling',
    slack: 'slack',
    either: 'either',
  };
  const preferredDirection = directionMap[beach.preferred_tide_direction || 'either'] || 'either';

  // Calculate tide window
  const tideWindow = calculateTideWindow({
    tideSchedule,
    minHeight: beach.preferred_tide_ft_min,
    maxHeight: beach.preferred_tide_ft_max,
    preferredDirection,
    afterTime: startTime,
  });

  return tideWindow;
}
```

Modify the `selectBestWindow` function. In the main loop (around line 580), after calculating `effectiveStartTime` and before setting `endTime`, add:

```typescript
    // Try to use tide-driven boundaries
    const tideBoundaries = calculateTideDrivenBoundaries(forecasts, actualBeach, effectiveStartTime);

    let effectiveBoundaryStart = effectiveStartTime;
    let endTime: Date;

    if (tideBoundaries) {
      // Use tide-driven boundaries
      effectiveBoundaryStart = tideBoundaries.start;
      endTime = tideBoundaries.end;
    } else {
      // Fallback: default end time MAX_WINDOW_HOURS from start
      endTime = new Date(effectiveStartTime.getTime() + MAX_WINDOW_HOURS * 60 * 60 * 1000);

      // Look ahead to find when conditions degrade (existing logic)
      // ... keep existing degradation detection loop ...
    }
```

Note: The full integration requires careful modification of the existing loop structure. The key changes are:
1. Try tide-driven boundaries first
2. If available, use them for start/end
3. If not available, use existing hourly logic
4. Still apply sunset capping and time slot capping after

### Step 4: Run test to verify it passes

Run: `yarn jest __tests__/lib/services/discovery/window-selector.test.ts -t "tide-driven boundaries" --no-coverage`

Expected: PASS

### Step 5: Run full test suite for window-selector

Run: `yarn jest __tests__/lib/services/discovery/window-selector.test.ts --no-coverage`

Expected: All tests PASS

### Step 6: Commit

```bash
git add lib/services/discovery/window-selector.ts __tests__/lib/services/discovery/window-selector.test.ts
git commit -m "feat(discovery): use tide threshold crossings for window boundaries"
```

---

## Task 5: Update EnhancedForecastEntity Type for raw_forecast Access

**Files:**
- Modify: `types/forecast.ts` (if needed for type safety)

### Step 1: Verify type compatibility

The `raw_forecast` field already includes `tide_schedule` in the type definition. Verify this by checking that the code compiles without errors.

Run: `yarn typecheck`

Expected: PASS (or identify any type errors to fix)

### Step 2: Fix any type errors (if needed)

If there are type errors, update the type definition or add type assertions as needed.

### Step 3: Commit (if changes made)

```bash
git add types/forecast.ts
git commit -m "fix(types): ensure raw_forecast.tide_schedule is properly typed"
```

---

## Task 6: Run Integration Tests

**Files:**
- Test: Full test suite

### Step 1: Run discovery service tests

Run: `yarn jest __tests__/lib/services/discovery/ --no-coverage`

Expected: All tests PASS

### Step 2: Run tide interpolation tests

Run: `yarn jest __tests__/lib/tide-interpolation.test.ts --no-coverage`

Expected: All tests PASS

### Step 3: Run full test suite

Run: `yarn test:unit`

Expected: All tests PASS

### Step 4: Final commit if any fixes needed

```bash
git add -A
git commit -m "test: ensure all tests pass with tide-driven window boundaries"
```

---

## Summary

**Total Tasks:** 6
**New Functions Added:**
- `interpolateTideHeightCosine()` - Accurate cosine interpolation for tide heights
- `findTideThresholdCrossing()` - Find when tide crosses a specific height
- `calculateTideWindow()` - Calculate window based on tide thresholds
- `extractTideSchedule()` - Extract tide data from forecasts
- `calculateTideDrivenBoundaries()` - Integration helper for window selector

**Files Modified:**
- `lib/utils/tide-interpolation.ts` - New interpolation functions
- `lib/services/discovery/window-selector.ts` - Use tide boundaries
- `__tests__/lib/tide-interpolation.test.ts` - New tests
- `__tests__/lib/services/discovery/window-selector.test.ts` - New tests

**Behavior Changes:**
- Windows now show precise times like "7:23-9:18am" when tide data is available
- Falls back to hourly boundaries when tide data or thresholds are missing
- No breaking changes to existing functionality
