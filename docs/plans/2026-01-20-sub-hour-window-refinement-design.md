# Sub-Hour Window Refinement Design

**Date:** 2026-01-20
**Status:** Approved
**Problem:** Time windows on home page display hour-aligned times (6:00-9:00) instead of precise times (6:30-8:45)

---

## Overview

The home page shows "Best spots near you" with time windows like `6:30-8:00`. Currently these times are always rounded to full hours because forecast data comes in hourly intervals. This design adds sub-hour precision by interpolating conditions within each hour.

**What the user sees after:**
- Times like `6:30-8:45` instead of `6-9`
- Feels like the app actually understands conditions

---

## Algorithm

### Step 1: Continuous Eligibility Function

Inside any hour interval [H, H+1):
- Interpolate score linearly between score(H) and score(H+1)
- Interpolate tide height between tide points
- `lightOk(t)` is a hard mask (false outside allowed light window)

```
eligible(t) = (interpScore(t) >= threshold) && tideOk(t) && lightOk(t)
```

### Step 2: Refine Start Boundary

If the chosen hourly window starts at H:
- Search within [H, H+1) for the earliest t where `eligible(t)` becomes true
- If never true, fall back to H

### Step 3: Refine End Boundary

If the window ends at K:
- Search within [K-1, K) for the latest t where `eligible(t)` is still true
- If never true, fall back to K

### Step 4: Snap for Readability

Once refined timestamps are found:
- **Directional snap:** Start = ceil to 15-min, End = floor to 15-min
- This ensures displayed window stays inside truly eligible interval
- Clamp so edge shift doesn't exceed 45 minutes from hour tick
- Enforce minimum 60-minute duration (check after snap)

---

## Interface

### Input Parameters

```typescript
export interface RefineWindowBoundsParams {
  hourlyStart: Date;
  hourlyEnd: Date;
  scoreAtStart: number;           // Score at hourlyStart
  scoreAtNextHour: number;        // Score at hourlyStart + 1hr
  scoreAtPrevHour: number;        // Score at hourlyEnd - 1hr
  scoreAtEnd: number;             // Score at hourlyEnd
  threshold: number;              // Min score (e.g., 50)
  getTideHeightAtTime: (t: Date) => number | null;
  tideMin: number | null;         // null = skip tide check
  tideMax: number | null;
  isLightOk: (t: Date) => boolean;
}
```

### Output

```typescript
export interface RefinedWindow {
  start: Date;
  end: Date;
  rawStartDeltaMin: number;       // Delta before snap
  rawEndDeltaMin: number;
  finalStartDeltaMin: number;     // Delta after snap
  finalEndDeltaMin: number;
  clampedStart: boolean;          // Hit 45-min guardrail?
  clampedEnd: boolean;
  usedInterpolation: boolean;     // false if fell back to hourly
  fallbackReason?: FallbackReason;
}

type FallbackReason =
  | 'missing_scores'      // Can't get 4 scores needed
  | 'inverted'            // snappedStart >= snappedEnd
  | 'duration_collapsed'  // < 60 min after snap
  | 'no_eligible_found'   // Scan found no eligible time
  | 'window_too_short';   // Input < 2 hours
```

---

## Eligibility Function

```typescript
function isEligibleAt(t: Date, interpScore: number): boolean {
  // 1. Score check (cheap, first)
  if (interpScore < threshold) return false;

  // 2. Light check (cheap boolean)
  if (!isLightOk(t)) return false;

  // 3. Tide check (may involve interpolation lookup)
  if (tideMin !== null || tideMax !== null) {
    const tideHeight = getTideHeightAtTime(t);
    if (tideHeight !== null) {
      if (tideMin !== null && tideHeight < tideMin) return false;
      if (tideMax !== null && tideHeight > tideMax) return false;
    }
    // tideHeight === null → pass (permissive on missing data)
  }

  return true;
}
```

**Score interpolation:**
```typescript
const HOUR_MS = 60 * 60 * 1000;
const alphaRaw = (t.getTime() - hourStart.getTime()) / HOUR_MS;
const alpha = Math.min(1, Math.max(0, alphaRaw));
const interpScore = scoreAtHourStart + alpha * (scoreAtHourEnd - scoreAtHourStart);
```

---

## Scanning Algorithm

```typescript
const SCAN_STEP_MS = 5 * 60 * 1000;    // 5 minutes
const SNAP_MS = 15 * 60 * 1000;         // 15 minutes
const MAX_SHIFT_MS = 45 * 60 * 1000;    // 45 minutes
const MIN_DURATION_MS = 60 * 60 * 1000; // 60 minutes

// --- Sanity guard ---
const windowMs = hourlyEnd.getTime() - hourlyStart.getTime();
if (windowMs < 2 * HOUR_MS) {
  return hourlyFallback('window_too_short');
}

// --- Refine START edge ---
let refinedStart = hourlyStart;
for (let offset = 0; offset < HOUR_MS; offset += SCAN_STEP_MS) {
  const t = new Date(hourlyStart.getTime() + offset);
  const alpha = offset / HOUR_MS;
  const interpScore = scoreAtStart + alpha * (scoreAtNextHour - scoreAtStart);

  if (isEligibleAt(t, interpScore)) {
    refinedStart = t;
    break;  // First eligible = earliest
  }
}

// --- Refine END edge ---
let refinedEnd = hourlyEnd;
const endScanStart = hourlyEnd.getTime() - HOUR_MS;
for (let offset = HOUR_MS - SCAN_STEP_MS; offset >= 0; offset -= SCAN_STEP_MS) {
  const t = new Date(endScanStart + offset);
  const alpha = offset / HOUR_MS;
  const interpScore = scoreAtPrevHour + alpha * (scoreAtEnd - scoreAtPrevHour);

  if (isEligibleAt(t, interpScore)) {
    refinedEnd = t;
    break;  // Last eligible (scanning backwards)
  }
}
```

---

## Clamp, Snap, and Fallback

```typescript
// --- Guard negative deltas (defensive) ---
const startDeltaMs = Math.max(0, refinedStart.getTime() - hourlyStart.getTime());
const endDeltaMs = Math.max(0, hourlyEnd.getTime() - refinedEnd.getTime());

const rawStartDeltaMin = startDeltaMs / 60000;
const rawEndDeltaMin = endDeltaMs / 60000;

// --- Clamp to max 45-min shift ---
let clampedStart = false;
let clampedEnd = false;

if (startDeltaMs > MAX_SHIFT_MS) {
  refinedStart = new Date(hourlyStart.getTime() + MAX_SHIFT_MS);
  clampedStart = true;
}
if (endDeltaMs > MAX_SHIFT_MS) {
  refinedEnd = new Date(hourlyEnd.getTime() - MAX_SHIFT_MS);
  clampedEnd = true;
}

// --- Directional snap ---
const snappedStartMs = Math.ceil(refinedStart.getTime() / SNAP_MS) * SNAP_MS;
const snappedEndMs = Math.floor(refinedEnd.getTime() / SNAP_MS) * SNAP_MS;

// --- Inversion check ---
if (snappedStartMs >= snappedEndMs) {
  return hourlyFallback('inverted');
}

// --- Duration check ---
if (snappedEndMs - snappedStartMs < MIN_DURATION_MS) {
  return hourlyFallback('duration_collapsed');
}

// --- Return refined window ---
const finalStartDeltaMin = (snappedStartMs - hourlyStart.getTime()) / 60000;
const finalEndDeltaMin = (hourlyEnd.getTime() - snappedEndMs) / 60000;
const changed = snappedStartMs !== hourlyStart.getTime() ||
                snappedEndMs !== hourlyEnd.getTime();

return {
  start: new Date(snappedStartMs),
  end: new Date(snappedEndMs),
  rawStartDeltaMin,
  rawEndDeltaMin,
  finalStartDeltaMin,
  finalEndDeltaMin,
  clampedStart,
  clampedEnd,
  usedInterpolation: changed,
};
```

---

## Integration

In `window-selector.ts`, after selecting bestWindow but before returning:

```typescript
if (bestWindow && !bestWindow.usedTideBoundaries) {
  // Get scores from the same array used for selection
  const startIdx = filteredForecasts.findIndex(
    f => f.forecastTime.getTime() === bestWindow.start.getTime()
  );
  const endIdx = filteredForecasts.findIndex(
    f => f.forecastTime.getTime() === bestWindow.end.getTime()
  );

  // Bail if we can't get the four scores needed
  if (startIdx === -1 || endIdx === -1 ||
      startIdx + 1 >= filteredForecasts.length ||
      endIdx - 1 < 0) {
    // Keep hourly bounds, no refinement
  } else {
    const refined = refineWindowBounds({
      hourlyStart: bestWindow.start,
      hourlyEnd: bestWindow.end,
      scoreAtStart: hourlyScores[startIdx],
      scoreAtNextHour: hourlyScores[startIdx + 1],
      scoreAtPrevHour: hourlyScores[endIdx - 1],
      scoreAtEnd: hourlyScores[endIdx],
      threshold: MIN_SCORE_THRESHOLD,
      getTideHeightAtTime: (t) => interpolateTideHeight(tidePoints, t),
      tideMin: actualBeach.preferred_tide_ft_min,
      tideMax: actualBeach.preferred_tide_ft_max,
      isLightOk: (t) => isTimeInDaylight(t, sunrises, sunsets, beachTz),
    });

    bestWindow = {
      ...bestWindow,
      start: refined.start,
      end: refined.end,
      refinementTelemetry: refined,
    };
  }
}
```

**Key:** Only apply refinement to fallback (hourly) windows, not tide-driven ones (those already have sub-hour precision).

---

## Test Coverage

### Core Scenarios (1-5)

1. **Happy path** - score(06:00)=70, score(07:00)=70, score(08:00)=52, score(09:00)=30, threshold=50, tide ok 06:30-08:45 → refined: 06:30-08:45

2. **Tide unknown** - getTideHeightAtTime returns null → refines on score+light only, doesn't collapse

3. **Duration collapsed** - earliest=07:50, latest=08:10 → snapped inverts → fallback to hourly

4. **Clamp hit** - earliest=06:55 (55min > 45max) → clampedStart: true, start=06:45

5. **Already good at boundaries** - eligible at 06:00 and 09:00 → usedInterpolation: false

### Production Gotchas (6-8)

6. **One-sided tide bounds** - tideMin=2.0, tideMax=null, tide crosses 2.0 at 06:22 → start=06:30

7. **Light mask trims** - score+tide ok 05:30-08:45, light only 06:10-17:00 → start=06:15

8. **Missing edge scores** - bestWindow at first forecast hour → fallbackReason: 'missing_scores'

### Test Implementation Notes

- Use UTC dates (`new Date('2026-01-20T06:00:00Z')`) for DST safety
- Keep tests behavioral (don't import constants unless necessary)
- Test both success telemetry (deltas, clamp flags) and failure telemetry (fallbackReason)

---

## File Locations

| File | Changes |
|------|---------|
| `lib/surf/scoring.ts` | Add `refineWindowBounds()`, constants |
| `lib/services/discovery/window-selector.ts` | Call refinement, add `usedTideBoundaries` flag |
| `__tests__/lib/surf/refine-window-bounds.test.ts` | New test file with 8 scenarios |

---

## Constants

```typescript
const SCAN_STEP_MS = 5 * 60 * 1000;    // 5-min scan resolution
const SNAP_MS = 15 * 60 * 1000;         // 15-min snap increments
const MAX_SHIFT_MS = 45 * 60 * 1000;    // Max 45-min edge shift
const MIN_DURATION_MS = 60 * 60 * 1000; // Min 60-min window
```

---

## Telemetry

Log one structured event in dev:
- **When refined:** deltas + clamp flags
- **When not refined:** fallbackReason

```typescript
console.debug('[window-refine]', {
  beach: actualBeach.name,
  rawStartDelta: refined.rawStartDeltaMin,
  rawEndDelta: refined.rawEndDeltaMin,
  finalStartDelta: refined.finalStartDeltaMin,
  finalEndDelta: refined.finalEndDeltaMin,
  clampedStart: refined.clampedStart,
  clampedEnd: refined.clampedEnd,
  usedInterpolation: refined.usedInterpolation,
  fallbackReason: refined.fallbackReason,
});
```
